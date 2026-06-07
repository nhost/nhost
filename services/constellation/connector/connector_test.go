package connector_test

import (
	"bytes"
	"context"
	json "encoding/json/v2"
	"errors"
	"flag"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector"
	"github.com/nhost/nhost/services/constellation/connector/mock"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/internal/lib/testhelpers"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/formatter"
	"github.com/vektah/gqlparser/v2/validator"
	"github.com/vektah/gqlparser/v2/validator/rules"
	"go.uber.org/mock/gomock"
)

// errFactoryBoom and errFactoryBang are test sentinel errors used to verify
// error propagation from factory failures.
var (
	errFactoryBoom = errors.New("boom")
	errFactoryBang = errors.New("bang")
)

var update = flag.Bool("update", false, "update golden files") //nolint:gochecknoglobals

// stubConnector is a no-op Connector used by the customization-failure tests
// so applyCustomization is reached without needing a real factory. None of
// its methods get called in those paths — applyCustomization rejects the
// configuration before the connector is exercised.
type stubConnector struct{}

func (stubConnector) GetSchema() (map[string]*graph.Schema, error) { return nil, nil } //nolint:nilnil

func (stubConnector) Execute(
	context.Context,
	*ast.OperationDefinition,
	ast.FragmentDefinitionList,
	map[string]any,
	string,
	map[string]any,
	*slog.Logger,
) (map[string]any, error) {
	return nil, nil //nolint:nilnil
}

func (stubConnector) ValidateOperation(
	*ast.OperationDefinition,
	ast.FragmentDefinitionList,
	map[string]any,
	string,
	map[string]any,
) error {
	return nil
}

func (stubConnector) GetTypeName(string) string { return "" }
func (stubConnector) Close()                    {}

func TestBuildConnectorsFromMetadata(t *testing.T) {
	ddl, err := os.ReadFile("testdata/pg_schema.sql")
	if err != nil {
		t.Fatalf("failed to read test DDL: %v", err)
	}

	pool := testdb.NewPostgres(t, string(ddl))
	testDBURL := pool.Config().ConnConfig.ConnString()

	t.Setenv("HASURA_GRAPHQL_DATABASE_URL", testDBURL)

	introspectionTypes, err := os.ReadFile("testdata/remote_schema_types.json")
	if err != nil {
		t.Fatalf("failed to read remote schema fixture: %v", err)
	}

	var types []any
	if err := json.Unmarshal(introspectionTypes, &types); err != nil {
		t.Fatalf("failed to parse remote schema fixture: %v", err)
	}

	mockServer := httptest.NewServer(
		http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			response := map[string]any{
				"data": map[string]any{
					"__schema": map[string]any{
						"queryType":        map[string]any{"name": "Query"},
						"mutationType":     map[string]any{"name": "Mutation"},
						"subscriptionType": nil,
						"types":            types,
					},
				},
			}

			w.Header().Set("Content-Type", "application/json")

			if err := json.MarshalWrite(w, response); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
			}
		}),
	)
	defer mockServer.Close()

	t.Setenv("NHOST_FUNCTIONS_URL", mockServer.URL)
	t.Setenv("NHOST_WEBHOOK_SECRET", "test-webhook-secret")

	cases := []struct {
		role string
	}{
		{role: "admin"},
		{role: "user"},
	}

	md, err := metadata.FromDetect(t.Context(), "../integration/nhost/metadata/")
	if err != nil {
		t.Fatalf("failed to load metadata: %v", err)
	}

	logger := slog.Default()

	built, err := connector.BuildConnectorsFromMetadata(t.Context(), md, logger)
	if err != nil {
		t.Fatalf("failed to build connectors from metadata: %v", err)
	}

	for _, tc := range cases { //nolint:paralleltest
		t.Run(tc.role, func(t *testing.T) {
			schemaDoc, ok := built.SchemaDocs[tc.role]
			if !ok {
				t.Fatalf("schema not found for role %q", tc.role)
			}

			var buf bytes.Buffer

			f := formatter.NewFormatter(&buf, formatter.WithIndent("  "))
			f.FormatSchemaDocument(schemaDoc)

			sdl := buf.String()

			testhelpers.GoldenGraphQLSchema(
				t, "testdata/"+t.Name()+".graphqls", sdl, *update,
			)
		})
	}
}

func TestBuildConnectorsFromMetadata_InconsistencyBranches(t *testing.T) {
	t.Parallel()

	logger := slog.Default()

	cases := []struct {
		name     string
		meta     *metadata.Metadata
		wantKind string
		wantName string
		wantSub  string
		setupEnv map[string]string
	}{
		{
			name: "unsupported_database_kind",
			meta: &metadata.Metadata{
				RemoteSchemas: nil,
				Databases: []metadata.DatabaseMetadata{
					{
						Name: "weird",
						Kind: "oracle",
						Configuration: metadata.DatabaseConfiguration{
							ConnectionInfo: metadata.DatabaseConnectionInfo{
								DatabaseURL: "irrelevant",
							},
						},
						Tables:    nil,
						Functions: nil,
					},
				},
			},
			wantKind: metadata.InconsistencyKindDatabase,
			wantName: "weird",
			wantSub:  "unsupported database kind: oracle",
			setupEnv: nil,
		},
		{
			name: "postgres_empty_url",
			meta: &metadata.Metadata{
				RemoteSchemas: nil,
				Databases: []metadata.DatabaseMetadata{
					{
						Name: "default",
						Kind: "postgres",
						Configuration: metadata.DatabaseConfiguration{
							ConnectionInfo: metadata.DatabaseConnectionInfo{
								DatabaseURL: "",
							},
						},
						Tables:    nil,
						Functions: nil,
					},
				},
			},
			wantKind: metadata.InconsistencyKindDatabase,
			wantName: "default",
			wantSub:  `database URL is not set for database default`,
			setupEnv: nil,
		},
		{
			name: "postgres_unresolved_env",
			meta: &metadata.Metadata{
				RemoteSchemas: nil,
				Databases: []metadata.DatabaseMetadata{
					{
						Name: "default",
						Kind: "postgres",
						Configuration: metadata.DatabaseConfiguration{
							ConnectionInfo: metadata.DatabaseConnectionInfo{
								DatabaseURL: "{{UNDEFINED_TEST_VAR_PG}}",
							},
						},
						Tables:    nil,
						Functions: nil,
					},
				},
			},
			wantKind: metadata.InconsistencyKindDatabase,
			wantName: "default",
			wantSub:  "resolving database URL for default",
			setupEnv: nil,
		},
		{
			name: "sqlite_empty_url",
			meta: &metadata.Metadata{
				RemoteSchemas: nil,
				Databases: []metadata.DatabaseMetadata{
					{
						Name: "default",
						Kind: "sqlite",
						Configuration: metadata.DatabaseConfiguration{
							ConnectionInfo: metadata.DatabaseConnectionInfo{
								DatabaseURL: "",
							},
						},
						Tables:    nil,
						Functions: nil,
					},
				},
			},
			wantKind: metadata.InconsistencyKindDatabase,
			wantName: "default",
			wantSub:  "database URL is not set for database default",
			setupEnv: nil,
		},
		{
			name: "sqlite_unresolved_env",
			meta: &metadata.Metadata{
				RemoteSchemas: nil,
				Databases: []metadata.DatabaseMetadata{
					{
						Name: "default",
						Kind: "sqlite",
						Configuration: metadata.DatabaseConfiguration{
							ConnectionInfo: metadata.DatabaseConnectionInfo{
								DatabaseURL: "{{UNDEFINED_TEST_VAR_SQLITE}}",
							},
						},
						Tables:    nil,
						Functions: nil,
					},
				},
			},
			wantKind: metadata.InconsistencyKindDatabase,
			wantName: "default",
			wantSub:  "resolving database URL for default",
			setupEnv: nil,
		},
		{
			name: "remote_schema_unresolved_env",
			meta: &metadata.Metadata{
				Databases: nil,
				RemoteSchemas: []metadata.RemoteSchemaMetadata{
					{
						Name: "rs",
						Definition: metadata.RemoteSchemaDefinition{
							URL:                  "{{UNDEFINED_TEST_VAR_RS}}",
							TimeoutSeconds:       0,
							Customization:        metadata.Customization{},
							Headers:              nil,
							ForwardClientHeaders: false,
						},
						Comment:             "",
						Permissions:         nil,
						RemoteRelationships: nil,
					},
				},
			},
			wantKind: metadata.InconsistencyKindRemoteSchema,
			wantName: "rs",
			wantSub:  "failed to create remote schema connector",
			setupEnv: nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			for k, v := range tc.setupEnv {
				t.Setenv(k, v)
			}

			built, err := connector.BuildConnectorsFromMetadata(
				t.Context(), tc.meta, logger,
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			snapshot := built.Inconsistencies
			if len(snapshot) != 1 {
				t.Fatalf(
					"expected 1 inconsistency, got %d: %+v",
					len(snapshot), snapshot,
				)
			}

			got := snapshot[0]
			if got.Kind != tc.wantKind {
				t.Errorf("kind = %q, want %q", got.Kind, tc.wantKind)
			}

			if got.Name != tc.wantName {
				t.Errorf("name = %q, want %q", got.Name, tc.wantName)
			}

			if !strings.Contains(got.Reason, tc.wantSub) {
				t.Errorf(
					"reason %q does not contain %q",
					got.Reason, tc.wantSub,
				)
			}

			if len(built.Connectors) != 0 {
				t.Errorf(
					"expected no surviving connectors, got %v",
					built.Connectors,
				)
			}
		})
	}
}

// newMinimalSchema mirrors the helper used by composer tests: one query field
// plus a return type, enough to pass GraphQL validation after composition.
func newMinimalSchema(fieldName, returnType string) *graph.Schema {
	queryTypeName := "query_root"

	return &graph.Schema{
		QueryType:        &queryTypeName,
		MutationType:     nil,
		SubscriptionType: nil,
		Types: []*graph.ObjectType{
			{
				Name:        queryTypeName,
				Description: "",
				Fields: []*graph.Field{
					{
						Name:        fieldName,
						Description: "",
						Type:        graph.NewNamedType(returnType),
						Arguments:   nil,
						Directives:  nil,
					},
				},
				Interfaces: nil,
				Directives: nil,
			},
			{
				Name:        returnType,
				Description: "",
				Fields: []*graph.Field{
					{
						Name:        "id",
						Description: "",
						Type:        graph.NewNonNullType("String"),
						Arguments:   nil,
						Directives:  nil,
					},
				},
				Interfaces: nil,
				Directives: nil,
			},
		},
		Scalars:    nil,
		Enums:      nil,
		Interfaces: nil,
		Unions:     nil,
		Inputs:     nil,
		Directives: nil,
	}
}

// TestBuildConnectorsFromMetadata_InjectedFactories exercises the happy path
// of BuildConnectorsFromMetadata for both a database and a remote schema
// without needing a real Postgres pool or HTTP server. Factories are injected
// via the public Option API.
func TestBuildConnectorsFromMetadata_InjectedFactories(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)

	dbConn := mock.NewMockConnector(ctrl)
	dbConn.EXPECT().GetSchema().Return(map[string]*graph.Schema{
		"admin": newMinimalSchema("users", "User"),
	}, nil)

	rsConn := mock.NewMockConnector(ctrl)
	rsConn.EXPECT().GetSchema().Return(map[string]*graph.Schema{
		"admin": newMinimalSchema("hello", "Greeting"),
	}, nil)

	var (
		gotDBKind string
		gotDBName string
		gotRSName string
		dbFactory = func(
			_ context.Context,
			dbMeta *metadata.DatabaseMetadata,
			_ *metadata.Inconsistencies,
			_ *slog.Logger,
		) (connector.Connector, error) {
			gotDBKind = dbMeta.Kind
			gotDBName = dbMeta.Name

			return dbConn, nil
		}
		rsFactory = func(_ context.Context, rsMeta *metadata.RemoteSchemaMetadata) (connector.Connector, error) {
			gotRSName = rsMeta.Name

			return rsConn, nil
		}
	)

	meta := &metadata.Metadata{
		Databases: []metadata.DatabaseMetadata{
			{
				Name:          "default",
				Kind:          "postgres",
				Configuration: metadata.DatabaseConfiguration{},
				Tables:        nil,
				Functions:     nil,
			},
		},
		RemoteSchemas: []metadata.RemoteSchemaMetadata{
			{
				Name:                "rs",
				Definition:          metadata.RemoteSchemaDefinition{},
				Comment:             "",
				Permissions:         nil,
				RemoteRelationships: nil,
			},
		},
	}

	built, err := connector.BuildConnectorsFromMetadata(
		t.Context(), meta, slog.Default(),
		connector.WithDBFactories(map[string]connector.DBFactory{"postgres": dbFactory}),
		connector.WithRemoteSchemaFactory(rsFactory),
	)
	if err != nil {
		t.Fatalf("BuildConnectorsFromMetadata: %v", err)
	}

	if gotDBKind != "postgres" || gotDBName != "default" {
		t.Errorf("db factory got kind=%q name=%q, want postgres/default", gotDBKind, gotDBName)
	}

	if gotRSName != "rs" {
		t.Errorf("remote-schema factory got name=%q, want rs", gotRSName)
	}

	if built.Connectors["default"] != dbConn {
		t.Error("expected db connector stored under 'default'")
	}

	if built.Connectors["rs"] != rsConn {
		t.Error("expected remote-schema connector stored under 'rs'")
	}

	if _, ok := built.ValidatedSchemas["admin"]; !ok {
		t.Fatalf("expected admin schema, got roles %v", built.ValidatedSchemas)
	}
}

// TestBuildConnectorsFromMetadata_FactoryInconsistencies verifies that
// factory failures from both paths are recorded as inconsistencies and skipped
// rather than aborting the build.
func TestBuildConnectorsFromMetadata_ActionInconsistencies(t *testing.T) {
	t.Parallel()

	meta := &metadata.Metadata{
		Databases:     nil,
		RemoteSchemas: nil,
		Actions: []metadata.ActionMetadata{
			{
				Name: "ping",
				Definition: metadata.ActionDefinition{
					Kind:                 metadata.ActionKindSynchronous,
					Handler:              "{{ACTIONS_URL}}/ping",
					ForwardClientHeaders: false,
					Headers:              nil,
					Timeout:              0,
					Type:                 metadata.ActionOperationQuery,
					Arguments:            nil,
					OutputType:           "String",
					RequestTransform:     nil,
					ResponseTransform:    nil,
				},
				Permissions: nil,
				Comment:     "",
			},
		},
		CustomTypes: metadata.CustomTypes{
			InputObjects: nil,
			Objects: []metadata.CustomObjectType{
				{
					Name:          "PingOutput",
					Description:   "",
					Fields:        nil,
					Relationships: nil,
				},
			},
			Scalars: nil,
			Enums:   nil,
		},
		LoadDiagnostics: []metadata.LoadDiagnostic{
			{
				Kind:   metadata.InconsistencyKindAction,
				Source: "",
				Name:   "actions.yaml",
				Reason: "failed to unmarshal actions.yaml",
			},
		},
	}

	built, err := connector.BuildConnectorsFromMetadata(t.Context(), meta, slog.Default())
	if err != nil {
		t.Fatalf("BuildConnectorsFromMetadata: %v", err)
	}

	if len(built.Connectors) != 0 {
		t.Fatalf("Connectors = %v, want none", built.Connectors)
	}

	if len(built.Inconsistencies) != 3 {
		t.Fatalf("Inconsistencies = %+v, want 3 entries", built.Inconsistencies)
	}

	assertInconsistency(
		t,
		built.Inconsistencies,
		metadata.InconsistencyKindAction,
		"actions.yaml",
		"failed to unmarshal actions.yaml",
	)
	assertInconsistency(
		t,
		built.Inconsistencies,
		metadata.InconsistencyKindAction,
		"ping",
		"resolving handler URL",
	)
	assertInconsistency(
		t,
		built.Inconsistencies,
		metadata.InconsistencyKindCustomType,
		"PingOutput",
		"custom type must define at least one field",
	)
}

func TestBuildConnectorsFromMetadata_ActionConnectorRegistration(t *testing.T) {
	t.Parallel()

	meta := validActionMetadata("ping", "PingOutput!")

	built, err := connector.BuildConnectorsFromMetadata(t.Context(), meta, slog.Default())
	if err != nil {
		t.Fatalf("BuildConnectorsFromMetadata: %v", err)
	}

	if _, ok := built.Connectors["__constellation_internal_actions"]; !ok {
		t.Fatalf("action connector was not registered: %v", built.Connectors)
	}

	if len(built.Inconsistencies) != 0 {
		t.Fatalf("Inconsistencies = %+v, want none", built.Inconsistencies)
	}

	if _, ok := built.ValidatedSchemas[metadata.RoleAdmin]; !ok {
		t.Fatalf("admin schema not built for action connector")
	}
}

func TestBuildConnectorsFromMetadata_ActionHTTPDoerOption(t *testing.T) {
	t.Parallel()

	doer := &connectorActionDoer{}

	built, err := connector.BuildConnectorsFromMetadata(
		t.Context(),
		validActionMetadata("ping", "PingOutput!"),
		slog.Default(),
		connector.WithActionHTTPDoer(doer),
	)
	if err != nil {
		t.Fatalf("BuildConnectorsFromMetadata: %v", err)
	}

	conn := built.Connectors["__constellation_internal_actions"]
	if conn == nil {
		t.Fatal("action connector was not registered")
	}

	operation, fragments, variables := actionOperationFromBuiltSchema(
		t,
		built,
		`query { ping { message } }`,
	)

	result, err := conn.Execute(
		t.Context(),
		operation,
		fragments,
		variables,
		metadata.RoleAdmin,
		map[string]any{"x-hasura-role": metadata.RoleAdmin},
		slog.Default(),
	)
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}

	ping, ok := result["ping"].(map[string]any)
	if !ok {
		t.Fatalf("ping result has type %T, want map[string]any", result["ping"])
	}

	if got := ping["message"]; got != "pong" {
		t.Fatalf("ping.message = %v, want pong", got)
	}

	if !doer.called {
		t.Fatal("injected action HTTP doer was not called")
	}
}

type connectorActionDoer struct {
	called bool
}

func (d *connectorActionDoer) Do(*http.Request) (*http.Response, error) {
	d.called = true

	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(`{"message":"pong"}`)),
		Header:     make(http.Header),
	}, nil
}

func actionOperationFromBuiltSchema(
	t *testing.T,
	built *connector.BuildResult,
	query string,
) (*ast.OperationDefinition, ast.FragmentDefinitionList, map[string]any) {
	t.Helper()

	schema := built.ValidatedSchemas[metadata.RoleAdmin]
	if schema == nil {
		t.Fatal("admin schema was not built")
	}

	doc, gqlErrs := gqlparser.LoadQueryWithRules(schema, query, rules.NewDefaultRules())
	if gqlErrs != nil {
		t.Fatalf("LoadQueryWithRules: %v", gqlErrs)
	}

	operation := doc.Operations[0]

	variables, err := validator.VariableValues(schema, operation, nil)
	if err != nil {
		t.Fatalf("VariableValues: %v", err)
	}

	return operation, doc.Fragments, variables
}

func TestBuildConnectorsFromMetadata_ActionConnectorNameCollision(t *testing.T) {
	t.Parallel()

	meta := validActionMetadata("ping", "PingOutput!")
	meta.Databases = []metadata.DatabaseMetadata{
		{
			Name:          "__constellation_internal_actions",
			Kind:          "postgres",
			Configuration: metadata.DatabaseConfiguration{},
			Tables:        nil,
			Functions:     nil,
		},
	}

	factory := func(
		context.Context,
		*metadata.DatabaseMetadata,
		*metadata.Inconsistencies,
		*slog.Logger,
	) (connector.Connector, error) {
		return stubConnector{}, nil
	}

	built, err := connector.BuildConnectorsFromMetadata(
		t.Context(),
		meta,
		slog.Default(),
		connector.WithDBFactories(map[string]connector.DBFactory{"postgres": factory}),
	)
	if err != nil {
		t.Fatalf("BuildConnectorsFromMetadata: %v", err)
	}

	if len(built.Connectors) != 1 {
		t.Fatalf("Connectors = %v, want only colliding database connector", built.Connectors)
	}

	assertInconsistency(
		t,
		built.Inconsistencies,
		metadata.InconsistencyKindAction,
		"ping",
		"conflicts with a database or remote schema",
	)
	assertInconsistency(
		t,
		built.Inconsistencies,
		metadata.InconsistencyKindCustomType,
		"PingOutput",
		"conflicts with a database or remote schema",
	)
}

func validActionMetadata(name, outputType string) *metadata.Metadata {
	return &metadata.Metadata{
		Databases:     nil,
		RemoteSchemas: nil,
		Actions: []metadata.ActionMetadata{
			{
				Name: name,
				Definition: metadata.ActionDefinition{
					Kind: metadata.ActionKindSynchronous,
					Handler: metadata.EnvString(
						"https://actions.example.test/" + name,
					),
					ForwardClientHeaders: false,
					Headers:              nil,
					Timeout:              0,
					Type:                 metadata.ActionOperationQuery,
					Arguments:            nil,
					OutputType:           outputType,
					RequestTransform:     nil,
					ResponseTransform:    nil,
				},
				Permissions: nil,
				Comment:     "",
			},
		},
		CustomTypes: metadata.CustomTypes{
			InputObjects: nil,
			Objects: []metadata.CustomObjectType{
				{
					Name:        "PingOutput",
					Description: "",
					Fields: []metadata.CustomTypeField{
						{Name: "message", Type: "String!", Description: ""},
					},
					Relationships: nil,
				},
			},
			Scalars: nil,
			Enums:   nil,
		},
		LoadDiagnostics: nil,
	}
}

func assertInconsistency(
	t *testing.T,
	items []metadata.Inconsistency,
	wantKind, wantName, wantReasonSubstr string,
) {
	t.Helper()

	for _, item := range items {
		if item.Kind != wantKind || item.Name != wantName {
			continue
		}

		if !strings.Contains(item.Reason, wantReasonSubstr) {
			t.Fatalf(
				"inconsistency %s/%s reason = %q, want substring %q",
				wantKind,
				wantName,
				item.Reason,
				wantReasonSubstr,
			)
		}

		if item.At.IsZero() {
			t.Fatalf("inconsistency %s/%s has zero timestamp", wantKind, wantName)
		}

		return
	}

	t.Fatalf("missing inconsistency %s/%s in %+v", wantKind, wantName, items)
}

func TestBuildConnectorsFromMetadata_FactoryInconsistencies(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		meta     *metadata.Metadata
		opts     []connector.Option
		wantKind string
		wantName string
		wantSub  string
	}{
		{
			name: "db_factory_error",
			meta: &metadata.Metadata{
				RemoteSchemas: nil,
				Databases: []metadata.DatabaseMetadata{
					{
						Name:          "default",
						Kind:          "postgres",
						Configuration: metadata.DatabaseConfiguration{},
						Tables:        nil,
						Functions:     nil,
					},
				},
			},
			opts: []connector.Option{
				connector.WithDBFactories(map[string]connector.DBFactory{
					"postgres": func(
						_ context.Context,
						_ *metadata.DatabaseMetadata,
						_ *metadata.Inconsistencies,
						_ *slog.Logger,
					) (connector.Connector, error) {
						return nil, errFactoryBoom
					},
				}),
			},
			wantKind: metadata.InconsistencyKindDatabase,
			wantName: "default",
			wantSub:  "boom",
		},
		{
			name: "remote_schema_factory_error",
			meta: &metadata.Metadata{
				Databases: nil,
				RemoteSchemas: []metadata.RemoteSchemaMetadata{
					{
						Name:                "rs",
						Definition:          metadata.RemoteSchemaDefinition{},
						Comment:             "",
						Permissions:         nil,
						RemoteRelationships: nil,
					},
				},
			},
			opts: []connector.Option{
				connector.WithRemoteSchemaFactory(
					func(_ context.Context, _ *metadata.RemoteSchemaMetadata) (connector.Connector, error) {
						return nil, errFactoryBang
					},
				),
			},
			wantKind: metadata.InconsistencyKindRemoteSchema,
			wantName: "rs",
			wantSub:  "failed to create remote schema connector",
		},
		{
			// The database factory returns a usable Connector, but the
			// source metadata declares a per-type FieldNames customization
			// that newCustomizedConnector rejects. The whole source is
			// recorded as an inconsistency and dropped.
			name: "db_customization_error",
			meta: &metadata.Metadata{
				RemoteSchemas: nil,
				Databases: []metadata.DatabaseMetadata{
					{
						Name: "default",
						Kind: "postgres",
						Customization: metadata.Customization{
							FieldNames: []metadata.FieldNameCustomization{
								{ParentType: "users", Prefix: "x_"},
							},
						},
						Configuration: metadata.DatabaseConfiguration{},
						Tables:        nil,
						Functions:     nil,
					},
				},
			},
			opts: []connector.Option{
				connector.WithDBFactories(map[string]connector.DBFactory{
					"postgres": func(
						_ context.Context,
						_ *metadata.DatabaseMetadata,
						_ *metadata.Inconsistencies,
						_ *slog.Logger,
					) (connector.Connector, error) {
						return stubConnector{}, nil
					},
				}),
			},
			wantKind: metadata.InconsistencyKindDatabase,
			wantName: "default",
			wantSub:  "per-type field_names customization is not supported",
		},
		{
			// Same trick on the remote-schema side: the factory returns a
			// usable Connector but the customization config is rejected.
			name: "remote_schema_customization_error",
			meta: &metadata.Metadata{
				Databases: nil,
				RemoteSchemas: []metadata.RemoteSchemaMetadata{
					{
						Name: "rs",
						Definition: metadata.RemoteSchemaDefinition{
							Customization: metadata.Customization{
								FieldNames: []metadata.FieldNameCustomization{
									{ParentType: "Query", Prefix: "x_"},
								},
							},
						},
						Comment:             "",
						Permissions:         nil,
						RemoteRelationships: nil,
					},
				},
			},
			opts: []connector.Option{
				connector.WithRemoteSchemaFactory(
					func(_ context.Context, _ *metadata.RemoteSchemaMetadata) (connector.Connector, error) {
						return stubConnector{}, nil
					},
				),
			},
			wantKind: metadata.InconsistencyKindRemoteSchema,
			wantName: "rs",
			wantSub:  "per-type field_names customization is not supported",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			built, err := connector.BuildConnectorsFromMetadata(
				t.Context(), tc.meta, slog.Default(), tc.opts...,
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			snapshot := built.Inconsistencies
			if len(snapshot) != 1 {
				t.Fatalf(
					"expected 1 inconsistency, got %d: %+v",
					len(snapshot), snapshot,
				)
			}

			got := snapshot[0]
			if got.Kind != tc.wantKind || got.Name != tc.wantName {
				t.Errorf(
					"kind/name = %q/%q, want %q/%q",
					got.Kind, got.Name, tc.wantKind, tc.wantName,
				)
			}

			if !strings.Contains(got.Reason, tc.wantSub) {
				t.Errorf(
					"reason %q does not contain %q",
					got.Reason, tc.wantSub,
				)
			}

			if len(built.Connectors) != 0 {
				t.Errorf("expected no surviving connectors, got %v", built.Connectors)
			}
		})
	}
}

// TestBuildConnectorsFromMetadata_SQLite exercises the sqlite branch of
// BuildConnectorsFromMetadata against a temp-file database.
func TestBuildConnectorsFromMetadata_SQLite(t *testing.T) {
	t.Parallel()

	dbPath := testdb.SQLitePath(
		t,
		`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL);`,
	)

	meta := &metadata.Metadata{
		RemoteSchemas: nil,
		Databases: []metadata.DatabaseMetadata{
			{
				Name: "default",
				Kind: "sqlite",
				Configuration: metadata.DatabaseConfiguration{
					ConnectionInfo: metadata.DatabaseConnectionInfo{
						DatabaseURL: metadata.EnvString(dbPath),
					},
				},
				Tables: []metadata.TableMetadata{
					{
						Table: metadata.TableSource{Schema: "", Name: "users"},
					},
				},
				Functions: nil,
			},
		},
	}

	built, err := connector.BuildConnectorsFromMetadata(t.Context(), meta, slog.Default())
	if err != nil {
		t.Fatalf("BuildConnectorsFromMetadata: %v", err)
	}

	t.Cleanup(func() {
		for _, c := range built.Connectors {
			c.Close()
		}
	})

	if _, ok := built.Connectors["default"]; !ok {
		t.Fatalf("expected sqlite connector under name 'default', got %v", built.Connectors)
	}

	if _, ok := built.ValidatedSchemas["admin"]; !ok {
		t.Fatalf("expected admin schema, got roles %v", built.ValidatedSchemas)
	}
}

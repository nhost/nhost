package connector

import (
	"context"
	"errors"
	"log/slog"
	"reflect"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/customization"
	"github.com/nhost/nhost/services/constellation/connector/groupedaggregate"
	"github.com/nhost/nhost/services/constellation/connector/remoteschema"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2/ast"
)

// errCustomizedExecBoom is a test sentinel error used to verify error
// propagation from the inner connector's Execute call.
var errCustomizedExecBoom = errors.New("boom")

// namespacedQueryOp returns the customized (client-facing) operation
// query { league { teams { __typename } } }. Under the primed customizer the
// decorator must reverse it to native query { teams { __typename } } before
// calling the inner connector, then re-wrap the result under league and remap
// __typename Team -> LeagueTeam.
func namespacedQueryOp() *ast.OperationDefinition {
	return namespacedQueryOpWithTeamsField("", nil)
}

func namespacedQueryOpWithTeamsField(
	alias string,
	args ast.ArgumentList,
) *ast.OperationDefinition {
	return &ast.OperationDefinition{
		Operation: ast.Query,
		SelectionSet: ast.SelectionSet{
			&ast.Field{
				Name: "league",
				SelectionSet: ast.SelectionSet{
					&ast.Field{
						Alias:     alias,
						Name:      "teams",
						Arguments: args,
						SelectionSet: ast.SelectionSet{
							&ast.Field{Name: "__typename"},
						},
					},
				},
			},
		},
	}
}

func negativeLimitArguments() ast.ArgumentList {
	return ast.ArgumentList{
		&ast.Argument{
			Name:  "limit",
			Value: &ast.Value{Kind: ast.IntValue, Raw: "-1"},
		},
	}
}

func stampedNegativeLimitValidationError(
	t *testing.T,
	argumentPath string,
) *arguments.QueryValidationError {
	t.Helper()

	whereClause, modifiers, distinctOn, err := arguments.ParseQuery(
		nil,
		negativeLimitArguments(),
		nil,
		metadata.RoleAdmin,
		nil,
		"",
	)
	if err == nil {
		t.Fatalf(
			"ParseQuery: expected a negative limit validation error, got where=%v modifiers=%v distinct_on=%v",
			whereClause,
			modifiers,
			distinctOn,
		)
	}

	var vErr *arguments.QueryValidationError
	if !errors.As(err, &vErr) {
		t.Fatalf("ParseQuery: expected *QueryValidationError, got %T (%v)", err, err)
	}

	vErr.StampArgumentPath(argumentPath)

	return vErr
}

func assertQueryValidationErrorPath(t *testing.T, err error, want string) {
	t.Helper()

	var vErr *arguments.QueryValidationError
	if !errors.As(err, &vErr) {
		t.Fatalf("expected *QueryValidationError in error chain, got %T (%v)", err, err)
	}

	extensions, ok := vErr.AsMap()["extensions"].(map[string]any)
	if !ok {
		t.Fatalf("QueryValidationError extensions missing: %#v", vErr.AsMap())
	}

	if got := extensions["path"]; got != want {
		t.Fatalf("extensions.path = %v, want %s", got, want)
	}
}

// nativeTeamsResult is what an inner connector returns for the reversed native
// operation: the lifted root field `teams` with a Team __typename.
func nativeTeamsResult() map[string]any {
	return map[string]any{
		"teams": []any{
			map[string]any{"__typename": "Team"},
		},
	}
}

// assertReshaped asserts the native teams result was re-wrapped under league
// and its __typename remapped Team -> LeagueTeam, proving ForwardResult ran.
func assertReshaped(t *testing.T, got map[string]any) {
	t.Helper()

	league, ok := got["league"].(map[string]any)
	if !ok {
		t.Fatalf("result not re-wrapped under league: %#v", got)
	}

	teams, ok := league["teams"].([]any)
	if !ok || len(teams) == 0 {
		t.Fatalf("teams missing under league: %#v", league)
	}

	first, ok := teams[0].(map[string]any)
	if !ok {
		t.Fatalf("team element not an object: %#v", teams[0])
	}

	if first["__typename"] != "LeagueTeam" {
		t.Errorf("__typename = %v, want LeagueTeam (remapped from Team)", first["__typename"])
	}
}

// assertReversedToNative asserts the decorator reversed the customized op to
// the native operation before calling inner: league unwrapped so the root
// field is `teams`.
func assertReversedToNative(t *testing.T, op *ast.OperationDefinition) {
	t.Helper()

	if op == nil || len(op.SelectionSet) != 1 {
		t.Fatalf("inner did not receive a reversed operation: %#v", op)
	}

	root, ok := op.SelectionSet[0].(*ast.Field)
	if !ok || root.Name != "teams" {
		t.Fatalf("inner root selection = %#v, want field teams", op.SelectionSet[0])
	}
}

// assertWrappedError asserts the error wraps innerErr and is annotated with the
// connector name.
func assertWrappedError(t *testing.T, err, innerErr error) {
	t.Helper()

	if !errors.Is(err, innerErr) {
		t.Errorf("error chain does not wrap inner error: %v", err)
	}

	if !strings.Contains(err.Error(), "customized connector default") {
		t.Errorf("error not annotated with connector name: %v", err)
	}
}

type groupedCollectionFake struct {
	Connector

	response map[string]any
	err      error
	got      groupedaggregate.Request
	role     string
	session  map[string]any
	logger   *slog.Logger
}

func (f *groupedCollectionFake) HasSelectableJoinColumn(_, _, name string) bool {
	return name == "itemLabel"
}

func (f *groupedCollectionFake) ExecuteGroupedCollection(
	_ context.Context, req groupedaggregate.Request, role string,
	session map[string]any, logger *slog.Logger,
) (map[string]any, error) {
	f.got, f.role, f.session, f.logger = req, role, session, logger

	return f.response, f.err
}

func (f *groupedCollectionFake) ExecuteGroupedAggregate(
	_ context.Context, req groupedaggregate.Request, role string,
	session map[string]any, logger *slog.Logger,
) (map[string]any, error) {
	f.got, f.role, f.session, f.logger = req, role, session, logger

	return f.response, f.err
}

//nolint:cyclop // Checks both optional capabilities, forwarding arguments/errors and fail-closed behavior.
func TestCustomizedConnectorForwardsTargetCapabilities(t *testing.T) {
	t.Parallel()

	inner := &groupedCollectionFake{
		Connector: &fakeConnector{schema: teamSchema()},
		response:  map[string]any{"first": map[string]any{"nodes": []any{101}}},
	}

	wrapper, err := newCustomizedConnector("target", inner,
		metadata.Customization{RootFieldsPrefix: "pfx_"}, customization.FlavorDatabase)
	if err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct {
		column string
		want   bool
	}{
		{"itemLabel", true}, {"otherLabel", false},
	} {
		if got := wrapper.HasSelectableJoinColumn(
			"public.kids",
			"reader",
			tc.column,
		); got != tc.want {
			t.Errorf("HasSelectableJoinColumn(%q) = %t, want %t", tc.column, got, tc.want)
		}
	}

	req := groupedaggregate.Request{
		TableSchema: "public", TableName: "kids",
		JoinColumns: []string{"itemLabel"}, JoinTuples: [][]any{{"first"}, {"second"}},
	}
	session := map[string]any{"x-hasura-user-id": "1"}
	logger := slog.Default()

	got, err := wrapper.ExecuteGroupedCollection(t.Context(), req, "reader", session, logger)
	if err != nil || !reflect.DeepEqual(got, inner.response) ||
		!reflect.DeepEqual(inner.got, req) ||
		inner.role != "reader" ||
		!reflect.DeepEqual(inner.session, session) ||
		inner.logger != logger {
		t.Fatalf("grouped forwarding result=%#v error=%v inner=%+v", got, err, inner)
	}

	aggregate, aggErr := wrapper.ExecuteGroupedAggregate(
		t.Context(), req, "reader", session, logger,
	)
	if aggErr != nil || !reflect.DeepEqual(aggregate, inner.response) ||
		!reflect.DeepEqual(inner.got, req) || inner.role != "reader" ||
		!reflect.DeepEqual(inner.session, session) || inner.logger != logger {
		t.Fatalf("aggregate forwarding result=%#v error=%v inner=%+v", aggregate, aggErr, inner)
	}

	inner.err = errCustomizedExecBoom
	if _, err := wrapper.ExecuteGroupedAggregate(
		t.Context(), req, "reader", session, logger,
	); !errors.Is(err, errCustomizedExecBoom) {
		t.Fatalf("aggregate error = %v, want inner error", err)
	}

	if _, err := wrapper.ExecuteGroupedCollection(
		t.Context(),
		req,
		"reader",
		session,
		logger,
	); !errors.Is(
		err,
		errCustomizedExecBoom,
	) {
		t.Fatalf("grouped error = %v, want inner error", err)
	}

	uncapable, err := newCustomizedConnector("target", &fakeConnector{schema: teamSchema()},
		metadata.Customization{RootFieldsNamespace: "catalog"}, customization.FlavorDatabase)
	if err != nil {
		t.Fatal(err)
	}

	if uncapable.HasSelectableJoinColumn("public.kids", "reader", "itemLabel") {
		t.Error("non-capable inner authorized target column")
	}

	if result, err := uncapable.ExecuteGroupedCollection(
		t.Context(),
		req,
		"reader",
		session,
		logger,
	); result != nil ||
		err == nil ||
		!strings.Contains(err.Error(), "cannot execute per-parent modifiers") {
		t.Fatalf("non-capable grouped result=%#v error=%v", result, err)
	}

	if result, err := uncapable.ExecuteGroupedAggregate(
		t.Context(), req, "reader", session, logger,
	); result != nil || err == nil || !strings.Contains(err.Error(), "grouped aggregate unavailable") {
		t.Fatalf("non-capable aggregate result=%#v error=%v", result, err)
	}
}

//nolint:tparallel,paralleltest // The grouped fake records calls; subtests share it sequentially.
func TestCustomizedConnectorGroupedTypenames(t *testing.T) {
	t.Parallel()

	inner := &groupedCollectionFake{
		Connector: &fakeConnector{schema: teamSchema()},
		response: map[string]any{
			"first": map[string]any{"nodes": []any{
				map[string]any{"__typename": "Team", "id": 101},
			}},
		},
	}

	wrapper, err := newCustomizedConnector("target", inner,
		metadata.Customization{TypeNamesPrefix: "League"}, customization.FlavorDatabase)
	if err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct {
		name string
		run  func() (map[string]any, error)
	}{
		{"collection", func() (map[string]any, error) {
			return wrapper.ExecuteGroupedCollection(t.Context(), groupedaggregate.Request{}, "admin", nil, nil)
		}},
		{"aggregate", func() (map[string]any, error) {
			return wrapper.ExecuteGroupedAggregate(t.Context(), groupedaggregate.Request{}, "admin", nil, nil)
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, callErr := tc.run()
			if callErr != nil {
				t.Fatal(callErr)
			}

			want := map[string]any{"first": map[string]any{"nodes": []any{
				map[string]any{"__typename": "LeagueTeam", "id": 101},
			}}}
			if !reflect.DeepEqual(got, want) {
				t.Errorf("grouped result = %#v want %#v", got, want)
			}

			original := map[string]any{"first": map[string]any{"nodes": []any{
				map[string]any{"__typename": "Team", "id": 101},
			}}}
			if !reflect.DeepEqual(inner.response, original) {
				t.Errorf("inner result mutated: %#v", inner.response)
			}
		})
	}
}

func TestCustomizedConnectorValidateOperation(t *testing.T) {
	t.Parallel()

	t.Run("reverses operation and returns nil on success", func(t *testing.T) {
		t.Parallel()

		inner := &fakeConnector{schema: teamSchema()}

		conn, err := newCustomizedConnector(
			"default",
			inner,
			metadata.Customization{
				RootFieldsNamespace: "league",
				TypeNamesPrefix:     "League",
			},
			customization.FlavorDatabase,
		)
		if err != nil {
			t.Fatalf("newCustomizedConnector: %v", err)
		}

		if err := conn.ValidateOperation(
			namespacedQueryOp(), nil, nil, metadata.RoleAdmin, nil,
		); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		// The inner connector must validate the same native operation it would
		// execute, so a customized SQL source rejects an invalid argument before
		// the controller executes any sibling connector.
		assertReversedToNative(t, inner.gotValOp)
	})

	t.Run("wraps inner validation error with connector name", func(t *testing.T) {
		t.Parallel()

		inner := &fakeConnector{schema: teamSchema(), validateErr: errCustomizedExecBoom}

		conn, err := newCustomizedConnector(
			"default",
			inner,
			metadata.Customization{
				RootFieldsNamespace: "league",
				TypeNamesPrefix:     "League",
			},
			customization.FlavorDatabase,
		)
		if err != nil {
			t.Fatalf("newCustomizedConnector: %v", err)
		}

		err = conn.ValidateOperation(namespacedQueryOp(), nil, nil, metadata.RoleAdmin, nil)
		if err == nil {
			t.Fatal("expected error, got nil")
		}

		if !errors.Is(err, errCustomizedExecBoom) {
			t.Errorf("error chain does not wrap inner error: %v", err)
		}

		if !strings.Contains(err.Error(), "validating customized connector default") {
			t.Errorf("error not annotated with connector name: %v", err)
		}
	})

	t.Run("remaps query validation error paths to customized roots", func(t *testing.T) {
		t.Parallel()

		tests := []struct {
			name       string
			op         *ast.OperationDefinition
			nativePath string
			wantPath   string
		}{
			{
				name:       "namespaced root",
				op:         namespacedQueryOpWithTeamsField("", negativeLimitArguments()),
				nativePath: "teams",
				wantPath:   "$.selectionSet.league.selectionSet.teams.args.limit",
			},
			{
				name:       "aliased root",
				op:         namespacedQueryOpWithTeamsField("roster", negativeLimitArguments()),
				nativePath: "teams",
				wantPath:   "$.selectionSet.league.selectionSet.teams.args.limit",
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				t.Parallel()

				inner := &fakeConnector{
					schema:      teamSchema(),
					validateErr: stampedNegativeLimitValidationError(t, tt.nativePath),
				}

				conn, err := newCustomizedConnector(
					"default",
					inner,
					metadata.Customization{
						RootFieldsNamespace: "league",
						TypeNamesPrefix:     "League",
					},
					customization.FlavorDatabase,
				)
				if err != nil {
					t.Fatalf("newCustomizedConnector: %v", err)
				}

				err = conn.ValidateOperation(tt.op, nil, nil, metadata.RoleAdmin, nil)
				if err == nil {
					t.Fatal("expected validation error, got nil")
				}

				assertReversedToNative(t, inner.gotValOp)
				assertQueryValidationErrorPath(t, err, tt.wantPath)

				if !strings.Contains(err.Error(), "validating customized connector default") {
					t.Errorf("error not annotated with connector name: %v", err)
				}
			})
		}
	})
}

func TestCustomizedConnectorExecute(t *testing.T) {
	t.Parallel()

	innerErr := errCustomizedExecBoom

	tests := []struct {
		name       string
		execData   map[string]any
		execErr    error
		wantErr    bool
		wantData   bool // whether reshaped data is expected (re-wrapped under league)
		assertData func(*testing.T, map[string]any)
	}{
		{
			name:       "success reshapes data",
			execData:   nativeTeamsResult(),
			execErr:    nil,
			wantErr:    false,
			wantData:   true,
			assertData: assertReshaped,
		},
		{
			// The subtle branch the finding cares about: the inner connector
			// returns partial data alongside an error. The decorator must STILL
			// reshape and return that partial data, while wrapping the error.
			name:       "inner error keeps reshaped partial data",
			execData:   nativeTeamsResult(),
			execErr:    innerErr,
			wantErr:    true,
			wantData:   true,
			assertData: assertReshaped,
		},
		{
			name:       "inner error with no data returns nil data and wrapped error",
			execData:   nil,
			execErr:    innerErr,
			wantErr:    true,
			wantData:   false,
			assertData: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			inner := &fakeConnector{
				schema:   teamSchema(),
				execData: tt.execData,
				execErr:  tt.execErr,
			}

			conn, err := newCustomizedConnector(
				"default",
				inner,
				metadata.Customization{
					RootFieldsNamespace: "league",
					TypeNamesPrefix:     "League",
				},
				customization.FlavorDatabase,
			)
			if err != nil {
				t.Fatalf("newCustomizedConnector: %v", err)
			}

			got, err := conn.Execute(
				t.Context(),
				namespacedQueryOp(),
				nil,
				nil,
				metadata.RoleAdmin,
				nil,
				slog.Default(),
			)

			assertReversedToNative(t, inner.gotOp)

			switch {
			case tt.wantErr && err == nil:
				t.Fatalf("expected error, got nil")
			case !tt.wantErr && err != nil:
				t.Fatalf("unexpected error: %v", err)
			}

			if tt.wantErr {
				assertWrappedError(t, err, tt.execErr)
			}

			switch {
			case tt.wantData && got == nil:
				t.Fatalf("expected reshaped data, got nil (partial data dropped on error)")
			case tt.wantData:
				tt.assertData(t, got)
			case got != nil:
				t.Errorf("expected nil data, got %#v", got)
			}
		})
	}
}

type countingValidationConnector struct {
	fakeConnector

	calls int
}

func (f *countingValidationConnector) ValidateOperation(
	op *ast.OperationDefinition, fragments ast.FragmentDefinitionList,
	variables map[string]any, role string, session map[string]any,
) error {
	f.calls++

	return f.fakeConnector.ValidateOperation(op, fragments, variables, role, session)
}

func TestCustomizedConnectorMultiAliasValidationPathUsesFieldNames(t *testing.T) {
	t.Parallel()

	inner := &countingValidationConnector{
		schema: teamSchema(), validateErr: stampedNegativeLimitValidationError(t, "teams"),
	}

	conn, err := newCustomizedConnector("default", inner,
		metadata.Customization{RootFieldsNamespace: "league"}, customization.FlavorDatabase)
	if err != nil {
		t.Fatal(err)
	}

	op := &ast.OperationDefinition{Operation: ast.Mutation, SelectionSet: ast.SelectionSet{
		&ast.Field{Name: "league", Alias: "a", SelectionSet: ast.SelectionSet{
			&ast.Field{Name: "teams", SelectionSet: ast.SelectionSet{&ast.Field{Name: "id"}}},
		}},
		&ast.Field{Name: "league", Alias: "b", SelectionSet: ast.SelectionSet{
			&ast.Field{
				Name: "teams", Alias: "x", Arguments: negativeLimitArguments(),
				SelectionSet: ast.SelectionSet{&ast.Field{Name: "id"}},
			},
		}},
	}}

	err = conn.ValidateOperation(op, nil, nil, metadata.RoleAdmin, nil)
	assertQueryValidationErrorPath(t, err, "$.selectionSet.league.selectionSet.teams.args.limit")

	if inner.calls != 1 {
		t.Errorf("validation invoked %d times; want exactly once", inner.calls)
	}

	inner.execErr = stampedNegativeLimitValidationError(t, "teams")
	_, err = conn.Execute(t.Context(), op, nil, nil, metadata.RoleAdmin, nil, slog.Default())
	assertQueryValidationErrorPath(t, err, "$.selectionSet.league.selectionSet.teams.args.limit")

	if inner.calls != 1 {
		t.Errorf("Execute reran validation: %d calls", inner.calls)
	}
}

func TestCustomizedConnectorExecuteRemapsQueryValidationErrorPath(t *testing.T) {
	t.Parallel()

	inner := &fakeConnector{
		schema:  teamSchema(),
		execErr: stampedNegativeLimitValidationError(t, "teams"),
	}

	conn, err := newCustomizedConnector(
		"default",
		inner,
		metadata.Customization{
			RootFieldsNamespace: "league",
			TypeNamesPrefix:     "League",
		},
		customization.FlavorDatabase,
	)
	if err != nil {
		t.Fatalf("newCustomizedConnector: %v", err)
	}

	_, err = conn.Execute(
		t.Context(),
		namespacedQueryOpWithTeamsField("", negativeLimitArguments()),
		nil,
		nil,
		metadata.RoleAdmin,
		nil,
		slog.Default(),
	)
	if err == nil {
		t.Fatal("expected validation error, got nil")
	}

	assertReversedToNative(t, inner.gotOp)
	assertQueryValidationErrorPath(
		t, err, "$.selectionSet.league.selectionSet.teams.args.limit",
	)

	if !errors.Is(err, arguments.ErrInvalidArgument) {
		t.Errorf("error chain does not wrap ErrInvalidArgument: %v", err)
	}

	if !strings.Contains(err.Error(), "executing customized connector default") {
		t.Errorf("error not annotated with connector name: %v", err)
	}
}

// A remote server stamps its own response key on field errors. Database-only
// disambiguation aliases must not be sent to remote schemas without remapping
// those remote errors first.
type remoteErrorFake struct {
	fakeConnector
}

func (f *remoteErrorFake) Execute(
	_ context.Context, op *ast.OperationDefinition, _ ast.FragmentDefinitionList,
	_ map[string]any, _ string, _ map[string]any, _ *slog.Logger,
) (map[string]any, error) {
	f.gotOp = op

	field, ok := op.SelectionSet[0].(*ast.Field)
	if !ok {
		return nil, errCustomizedExecBoom
	}

	key := field.Name
	if field.Alias != "" {
		key = field.Alias
	}

	return nil, remoteschema.NewGraphQLError([]remoteschema.RemoteError{{
		Message: "boom", Path: []any{key},
	}})
}

func TestRemoteSchemaNamespaceErrorPathDoesNotContainInternalAlias(t *testing.T) {
	t.Parallel()

	for _, aliases := range [][]string{{"a"}, {"a", "b"}} {
		name := strings.Join(aliases, "_")
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			inner := &remoteErrorFake{schema: teamSchema()}

			conn, err := newCustomizedConnector("remote", inner,
				metadata.Customization{RootFieldsNamespace: "league"},
				customization.FlavorRemoteSchema)
			if err != nil {
				t.Fatal(err)
			}

			selections := make(ast.SelectionSet, 0, len(aliases))
			for i, alias := range aliases {
				id := "first"
				if i > 0 {
					id = "second"
				}

				selections = append(selections, &ast.Field{
					Name: "league", Alias: alias,
					SelectionSet: ast.SelectionSet{&ast.Field{
						Name: "teams",
						Arguments: ast.ArgumentList{&ast.Argument{Name: "id", Value: &ast.Value{
							Kind: ast.StringValue, Raw: id,
						}}},
						SelectionSet: ast.SelectionSet{&ast.Field{Name: "id"}},
					}},
				})
			}

			_, err = conn.Execute(t.Context(), &ast.OperationDefinition{
				Operation: ast.Query, SelectionSet: selections,
			}, nil, nil, metadata.RoleAdmin, nil, slog.Default())

			var remoteErr *remoteschema.GraphQLError
			if !errors.As(err, &remoteErr) || len(remoteErr.Errors) != 1 {
				t.Fatalf("remote error lost: %v", err)
			}

			if len(inner.gotOp.SelectionSet) != len(aliases) {
				t.Fatalf("remote roots = %d, want %d", len(inner.gotOp.SelectionSet), len(aliases))
			}

			for i, selection := range inner.gotOp.SelectionSet {
				root, ok := selection.(*ast.Field)
				if !ok || root.Name != "teams" || root.Alias != "" ||
					strings.HasPrefix(root.Alias, "_constellation_ns_") ||
					root.Arguments.ForName("id").Value.Raw !=
						[]string{"first", "second"}[i] {
					t.Errorf(
						"remote root %d lost its argument or gained an alias: %#v",
						i,
						selection,
					)
				}
			}

			if got := remoteErr.Errors[0].Path; !reflect.DeepEqual(got, []any{"teams"}) {
				t.Errorf("remote error path = %#v, want native teams", got)
			}
		})
	}
}

func TestCustomizedConnectorGetSchema(t *testing.T) {
	t.Parallel()

	inner := &fakeConnector{schema: teamSchema()}

	conn, err := newCustomizedConnector(
		"default",
		inner,
		metadata.Customization{
			RootFieldsNamespace: "league",
			TypeNamesPrefix:     "League",
		},
		customization.FlavorDatabase,
	)
	if err != nil {
		t.Fatalf("newCustomizedConnector: %v", err)
	}

	schemas, err := conn.GetSchema()
	if err != nil {
		t.Fatalf("GetSchema: %v", err)
	}

	schema, ok := schemas[metadata.RoleAdmin]
	if !ok {
		t.Fatalf("admin schema missing: %#v", schemas)
	}

	// The returned schema must be the customized one, not the inner native
	// schema: the Team type is prefixed to LeagueTeam.
	var hasLeagueTeam bool

	for _, ty := range schema.Types {
		if ty.Name == "LeagueTeam" {
			hasLeagueTeam = true
		}

		if ty.Name == "Team" {
			t.Errorf("native type Team leaked into customized schema")
		}
	}

	if !hasLeagueTeam {
		t.Errorf("customized schema missing prefixed type LeagueTeam: %#v", schema.Types)
	}
}

func TestCustomizedConnectorGetTypeName(t *testing.T) {
	t.Parallel()

	inner := &fakeConnector{schema: teamSchema(), typeName: "native_type"}

	conn, err := newCustomizedConnector(
		"default",
		inner,
		metadata.Customization{RootFieldsNamespace: "league"},
		customization.FlavorDatabase,
	)
	if err != nil {
		t.Fatalf("newCustomizedConnector: %v", err)
	}

	if got := conn.GetTypeName("anything"); got != "native_type" {
		t.Errorf("GetTypeName = %q, want native_type (delegated to inner)", got)
	}
}

func TestCustomizedConnectorClose(t *testing.T) {
	t.Parallel()

	inner := &fakeConnector{schema: teamSchema()}

	conn, err := newCustomizedConnector(
		"default",
		inner,
		metadata.Customization{RootFieldsNamespace: "league"},
		customization.FlavorDatabase,
	)
	if err != nil {
		t.Fatalf("newCustomizedConnector: %v", err)
	}

	conn.Close()

	if !inner.closed {
		t.Errorf("Close not delegated to inner connector")
	}
}

// TestCustomizedConnectorRelationshipTypeName separates the native root name
// used by connector execution from the exposed type used for injection.
func TestCustomizedConnectorRelationshipTypeName(t *testing.T) {
	t.Parallel()

	inner := &fakeConnector{schema: teamSchema(), typeName: "Team"}

	conn, err := newCustomizedConnector("default", inner, metadata.Customization{
		RootFieldsNamespace: "league", TypeNamesPrefix: "League",
	}, customization.FlavorDatabase)
	if err != nil {
		t.Fatal(err)
	}

	if got := conn.GetTypeName("public.team"); got != "Team" {
		t.Errorf("native root = %q", got)
	}

	if got := conn.GetCustomizedTypeName("Team"); got != "LeagueTeam" {
		t.Errorf("published type = %q", got)
	}

	if got := conn.GetCustomizedTypeName("Ghost"); got != "" {
		t.Errorf("unknown type = %q", got)
	}

	schemas, schemaErr := conn.GetSchema()
	if schemaErr != nil {
		t.Fatal(schemaErr)
	}

	found := false
	for _, object := range schemas[metadata.RoleAdmin].Types {
		if object.Name == "LeagueTeam" {
			found = true
		}

		if object.Name == "Team" {
			t.Error("native Team unexpectedly published")
		}
	}

	if !found {
		t.Error("published LeagueTeam absent")
	}
}

func TestNewCustomizedConnectorRejectsFieldNames(t *testing.T) {
	t.Parallel()

	_, err := newCustomizedConnector(
		"rs",
		&fakeConnector{schema: teamSchema()},
		metadata.Customization{
			FieldNames: []metadata.FieldNameCustomization{
				{
					ParentType: "Team",
					Mapping:    map[string]string{"name": "displayName"},
				},
			},
		},
		customization.FlavorRemoteSchema,
	)
	if err == nil {
		t.Fatal("expected error for field_names customization, got nil")
	}

	if !strings.Contains(err.Error(), "field_names") {
		t.Errorf("error should mention field_names, got: %v", err)
	}
}

//nolint:paralleltest,tparallel // Both variants reuse one fake whose request/result fields are inspected after each call.
func TestCustomizedConnectorGroupedTypenameSelections(t *testing.T) {
	t.Parallel()

	inner := &groupedCollectionFake{
		Connector: &fakeConnector{schema: teamSchema()},
		response: map[string]any{"first": map[string]any{"nodes": []any{
			map[string]any{"id": 101, "t": "Team", "__typename": "Team"},
		}}},
	}

	wrapper, err := newCustomizedConnector("target", inner,
		metadata.Customization{TypeNamesPrefix: "League"}, customization.FlavorDatabase)
	if err != nil {
		t.Fatal(err)
	}

	fragment := &ast.FragmentDefinition{
		Name:          "Types",
		TypeCondition: "LeagueTeam",
		SelectionSet: ast.SelectionSet{
			&ast.Field{Alias: "t", Name: "__typename"},
		},
	}
	fragments := ast.FragmentDefinitionList{fragment}

	nodeSelection := ast.SelectionSet{
		&ast.Field{Name: "id"}, &ast.Field{Name: "__typename"}, &ast.FragmentSpread{Name: "Types"},
	}
	for _, tc := range []struct {
		name  string
		field *ast.Field
		run   func(groupedaggregate.Request) (map[string]any, error)
	}{
		{"collection", &ast.Field{Name: "kids", SelectionSet: nodeSelection}, func(req groupedaggregate.Request) (map[string]any, error) {
			return wrapper.ExecuteGroupedCollection(t.Context(), req, "admin", nil, nil)
		}},
		{"aggregate", &ast.Field{Name: "kids_aggregate", SelectionSet: ast.SelectionSet{
			&ast.Field{Name: "nodes", SelectionSet: nodeSelection},
		}}, func(req groupedaggregate.Request) (map[string]any, error) {
			return wrapper.ExecuteGroupedAggregate(t.Context(), req, "admin", nil, nil)
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, runErr := tc.run(groupedaggregate.Request{Field: tc.field, Fragments: fragments})
			if runErr != nil {
				t.Fatal(runErr)
			}

			want := map[string]any{"first": map[string]any{"nodes": []any{
				map[string]any{"id": 101, "t": "LeagueTeam", "__typename": "LeagueTeam"},
			}}}
			if !reflect.DeepEqual(got, want) {
				t.Errorf("grouped selected names = %#v want %#v", got, want)
			}

			original := map[string]any{"first": map[string]any{"nodes": []any{
				map[string]any{"id": 101, "t": "Team", "__typename": "Team"},
			}}}
			if !reflect.DeepEqual(inner.response, original) {
				t.Errorf("inner grouped result mutated: %#v", inner.response)
			}
		})
	}
}

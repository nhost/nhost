package composer_test

import (
	"errors"
	"log/slog"
	"slices"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/composer"
	"github.com/nhost/nhost/services/constellation/connector/composer/mock"
	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2/ast"
	"go.uber.org/mock/gomock"
)

// containsInconsistency reports whether items has an entry with the given
// kind and name whose Reason contains substr.
func containsInconsistency(
	items []metadata.Inconsistency, kind, name, substr string,
) bool {
	for _, it := range items {
		if it.Kind == kind && it.Name == name && strings.Contains(it.Reason, substr) {
			return true
		}
	}

	return false
}

// errSchemaConnection is a test sentinel error used to verify error
// propagation from a failing connector schema fetch.
var errSchemaConnection = errors.New("connection failed")

// newMinimalSchema returns a graph.Schema with one query field and the required
// scalar/enum/input boilerplate to pass GraphQL validation.
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

// stringComparisonInput builds a `String_comparison_exp` input with the given
// fields. Used by the duplicate/conflicting input cases.
func stringComparisonInput(fields ...*graph.InputField) *graph.InputObjectType {
	return &graph.InputObjectType{
		Name:        "String_comparison_exp",
		Description: "",
		Fields:      fields,
		Directives:  nil,
	}
}

// statusEnum builds a `Status` enum with the given value name. Used by the
// conflicting-enums case.
func statusEnum(valueName string) *graph.EnumType {
	return &graph.EnumType{
		Name:        "Status",
		Description: "",
		Values: []*graph.EnumValue{
			{Name: valueName, Description: "", Directives: nil},
		},
		Directives: nil,
	}
}

// mutationSubscriptionSchema builds a schema with separate query, mutation, and
// subscription roots so the merge/validate path exercises all three operation
// types.
func mutationSubscriptionSchema() *graph.Schema {
	queryRoot := "query_root"
	mutationRoot := "mutation_root"
	subscriptionRoot := "subscription_root"

	return &graph.Schema{
		QueryType:        &queryRoot,
		MutationType:     &mutationRoot,
		SubscriptionType: &subscriptionRoot,
		Types: []*graph.ObjectType{
			{
				Name:        queryRoot,
				Description: "",
				Fields: []*graph.Field{
					{
						Name:        "users",
						Description: "",
						Type:        graph.NewNamedType("User"),
						Arguments:   nil,
						Directives:  nil,
					},
				},
				Interfaces: nil,
				Directives: nil,
			},
			{
				Name:        mutationRoot,
				Description: "",
				Fields: []*graph.Field{
					{
						Name:        "insert_user",
						Description: "",
						Type:        graph.NewNamedType("User"),
						Arguments:   nil,
						Directives:  nil,
					},
				},
				Interfaces: nil,
				Directives: nil,
			},
			{
				Name:        subscriptionRoot,
				Description: "",
				Fields: []*graph.Field{
					{
						Name:        "user_stream",
						Description: "",
						Type:        graph.NewNamedType("User"),
						Arguments:   nil,
						Directives:  nil,
					},
				},
				Interfaces: nil,
				Directives: nil,
			},
			{
				Name:        "User",
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

// crossKindSchema builds a schema containing any combination of root operation
// fields with the same field name.
func crossKindSchema(includeQuery, includeMutation, includeSubscription bool) *graph.Schema {
	queryRoot := "query_root"
	mutationRoot := "mutation_root"
	subscriptionRoot := "subscription_root"
	schema := &graph.Schema{
		QueryType:        nil,
		MutationType:     nil,
		SubscriptionType: nil,
		Types:            nil,
		Scalars:          nil,
		Enums:            nil,
		Interfaces:       nil,
		Unions:           nil,
		Inputs:           nil,
		Directives:       nil,
	}

	if includeQuery {
		schema.QueryType = &queryRoot
		schema.Types = append(schema.Types, &graph.ObjectType{
			Name:        queryRoot,
			Description: "",
			Fields: []*graph.Field{
				{
					Name:        "foo",
					Description: "",
					Type:        graph.NewNamedType("String"),
					Arguments:   nil,
					Directives:  nil,
				},
			},
			Interfaces: nil,
			Directives: nil,
		})
	}

	if includeMutation {
		schema.MutationType = &mutationRoot
		schema.Types = append(schema.Types, &graph.ObjectType{
			Name:        mutationRoot,
			Description: "",
			Fields: []*graph.Field{
				{
					Name:        "foo",
					Description: "",
					Type:        graph.NewNamedType("String"),
					Arguments:   nil,
					Directives:  nil,
				},
			},
			Interfaces: nil,
			Directives: nil,
		})
	}

	if includeSubscription {
		schema.SubscriptionType = &subscriptionRoot
		schema.Types = append(schema.Types, &graph.ObjectType{
			Name:        subscriptionRoot,
			Description: "",
			Fields: []*graph.Field{
				{
					Name:        "foo",
					Description: "",
					Type:        graph.NewNamedType("String"),
					Arguments:   nil,
					Directives:  nil,
				},
			},
			Interfaces: nil,
			Directives: nil,
		})
	}

	return schema
}

// providerSpec describes how to wire a single mock provider into a Compose
// test case. The mock is constructed by the test runner so the gomock
// controller lifetime stays inside the subtest.
type providerSpec struct {
	// schemas is returned from GetSchema(). nil means GetSchema returns
	// (nil, schemaErr).
	schemas   map[string]*graph.Schema
	schemaErr error
}

//nolint:gocognit,gocyclo,cyclop,maintidx // table-driven; assertions inlined per case
func TestComposer_Compose(t *testing.T) {
	t.Parallel()

	stringEq := &graph.InputField{
		Name:         "_eq",
		Description:  "",
		Type:         graph.NewNamedType("String"),
		DefaultValue: nil,
		Directives:   nil,
	}
	stringNeq := &graph.InputField{
		Name:         "_neq",
		Description:  "",
		Type:         graph.NewNamedType("String"),
		DefaultValue: nil,
		Directives:   nil,
	}

	tests := []struct {
		name      string
		providers map[string]providerSpec
		// wantInconsistencyKind / Name / ReasonSubstr, if non-empty, assert
		// that an inconsistency matching those fields was recorded. The
		// surviving Result is still validated through verify if supplied.
		wantInconsistencyKind         string
		wantInconsistencyName         string
		wantInconsistencyReasonSubstr string
		// verify runs additional success-path assertions. Called only when no
		// error is expected.
		verify func(t *testing.T, result composer.Result)
	}{
		{
			name:      "empty_providers",
			providers: map[string]providerSpec{},
			verify: func(t *testing.T, result composer.Result) {
				t.Helper()

				if len(result.ValidatedSchemas) != 0 {
					t.Fatalf("expected no schemas, got %d", len(result.ValidatedSchemas))
				}
			},
		},
		{
			name: "single_provider",
			providers: map[string]providerSpec{
				"db": {schemas: map[string]*graph.Schema{
					"admin": newMinimalSchema("users", "User"),
				}},
			},
			verify: func(t *testing.T, result composer.Result) {
				t.Helper()

				if _, ok := result.ValidatedSchemas["admin"]; !ok {
					t.Fatal("expected validated schema for admin role")
				}

				if got := result.FieldToConnector["admin"][schemamerge.FieldKey(ast.Query, "users")]; got != "db" {
					t.Fatalf("expected field 'users' owned by 'db', got %q", got)
				}
			},
		},
		{
			name: "two_providers_disjoint_types",
			providers: map[string]providerSpec{
				"db1": {schemas: map[string]*graph.Schema{
					"admin": newMinimalSchema("users", "User"),
				}},
				"db2": {schemas: map[string]*graph.Schema{
					"admin": newMinimalSchema("posts", "Post"),
				}},
			},
			verify: func(t *testing.T, result composer.Result) {
				t.Helper()

				schema, ok := result.ValidatedSchemas["admin"]
				if !ok {
					t.Fatal("expected validated schema for admin role")
				}

				queryType := schema.Query
				if queryType == nil {
					t.Fatal("expected query type in schema")
				}

				if queryType.Fields.ForName("users") == nil {
					t.Error("expected 'users' field in merged schema")
				}

				if queryType.Fields.ForName("posts") == nil {
					t.Error("expected 'posts' field in merged schema")
				}

				if got := result.TypeToConnectors["admin"]["User"]; !slices.Equal(
					got,
					[]string{"db1"},
				) {
					t.Errorf("expected User owned by db1, got %v", got)
				}

				if got := result.TypeToConnectors["admin"]["Post"]; !slices.Equal(
					got,
					[]string{"db2"},
				) {
					t.Errorf("expected Post owned by db2, got %v", got)
				}
			},
		},
		{
			name: "duplicate_comparison_exp_inputs",
			providers: func() map[string]providerSpec {
				input := stringComparisonInput(stringEq)
				schema1 := newMinimalSchema("users", "User")
				schema1.Inputs = []*graph.InputObjectType{input}
				schema2 := newMinimalSchema("posts", "Post")
				schema2.Inputs = []*graph.InputObjectType{input}

				return map[string]providerSpec{
					"db1": {schemas: map[string]*graph.Schema{"admin": schema1}},
					"db2": {schemas: map[string]*graph.Schema{"admin": schema2}},
				}
			}(),
			verify: func(t *testing.T, result composer.Result) {
				t.Helper()

				if _, ok := result.ValidatedSchemas["admin"]; !ok {
					t.Fatal("expected validated schema for admin role")
				}
			},
		},
		{
			name: "roles_with_partial_coverage",
			providers: map[string]providerSpec{
				"db1": {schemas: map[string]*graph.Schema{
					"admin": newMinimalSchema("users", "User"),
					"user":  newMinimalSchema("me", "User"),
				}},
				"db2": {schemas: map[string]*graph.Schema{
					"admin": newMinimalSchema("posts", "Post"),
				}},
			},
			verify: func(t *testing.T, result composer.Result) {
				t.Helper()

				adminSchema := result.ValidatedSchemas["admin"]
				if adminSchema == nil {
					t.Fatal("expected admin schema")
				}

				if adminSchema.Query.Fields.ForName("users") == nil {
					t.Error("expected 'users' in admin schema")
				}

				if adminSchema.Query.Fields.ForName("posts") == nil {
					t.Error("expected 'posts' in admin schema")
				}

				userSchema := result.ValidatedSchemas["user"]
				if userSchema == nil {
					t.Fatal("expected user schema")
				}

				if userSchema.Query.Fields.ForName("me") == nil {
					t.Error("expected 'me' in user schema")
				}
			},
		},
		{
			name: "same_root_field_and_type_can_have_different_role_owners",
			providers: map[string]providerSpec{
				"db1": {schemas: map[string]*graph.Schema{
					"admin": newMinimalSchema("shared", "Shared"),
				}},
				"db2": {schemas: map[string]*graph.Schema{
					"user": newMinimalSchema("shared", "Shared"),
				}},
			},
			verify: func(t *testing.T, result composer.Result) {
				t.Helper()

				key := schemamerge.FieldKey(ast.Query, "shared")
				if got := result.FieldToConnector["admin"][key]; got != "db1" {
					t.Errorf("expected admin shared field owned by db1, got %q", got)
				}

				if got := result.FieldToConnector["user"][key]; got != "db2" {
					t.Errorf("expected user shared field owned by db2, got %q", got)
				}

				if got := result.TypeToConnectors["admin"]["Shared"]; !slices.Equal(
					got,
					[]string{"db1"},
				) {
					t.Errorf("expected admin Shared type owned by db1, got %v", got)
				}

				if got := result.TypeToConnectors["user"]["Shared"]; !slices.Equal(
					got,
					[]string{"db2"},
				) {
					t.Errorf("expected user Shared type owned by db2, got %v", got)
				}
			},
		},
		{
			name: "mutation_and_subscription",
			providers: map[string]providerSpec{
				"db": {schemas: map[string]*graph.Schema{
					"admin": mutationSubscriptionSchema(),
				}},
			},
			verify: func(t *testing.T, result composer.Result) {
				t.Helper()

				validated := result.ValidatedSchemas["admin"]
				if validated == nil {
					t.Fatal("expected validated schema for admin role")
				}

				if validated.Query == nil || validated.Query.Fields.ForName("users") == nil {
					t.Error("expected 'users' query field")
				}

				if validated.Mutation == nil ||
					validated.Mutation.Fields.ForName("insert_user") == nil {
					t.Error("expected 'insert_user' mutation field")
				}

				if validated.Subscription == nil ||
					validated.Subscription.Fields.ForName("user_stream") == nil {
					t.Error("expected 'user_stream' subscription field")
				}

				for field, operation := range map[string]ast.Operation{
					"users":       ast.Query,
					"insert_user": ast.Mutation,
					"user_stream": ast.Subscription,
				} {
					if got := result.FieldToConnector["admin"][schemamerge.FieldKey(operation, field)]; got != "db" {
						t.Errorf("expected field %q owned by 'db', got %q", field, got)
					}
				}
			},
		},
		{
			name: "cross_kind_no_overwrite",
			providers: map[string]providerSpec{
				"db": {schemas: map[string]*graph.Schema{
					"admin": crossKindSchema(true, false, true),
				}},
				"rs": {schemas: map[string]*graph.Schema{
					"admin": crossKindSchema(false, true, false),
				}},
			},
			verify: func(t *testing.T, result composer.Result) {
				t.Helper()

				want := map[string]string{
					schemamerge.FieldKey(ast.Query, "foo"):        "db",
					schemamerge.FieldKey(ast.Mutation, "foo"):     "rs",
					schemamerge.FieldKey(ast.Subscription, "foo"): "db",
				}
				for key, connector := range want {
					if got := result.FieldToConnector["admin"][key]; got != connector {
						t.Errorf("expected %q owned by %q, got %q", key, connector, got)
					}
				}
			},
		},
		{
			name: "conflicting_object_type",
			providers: func() map[string]providerSpec {
				schema1 := newMinimalSchema("users", "User")
				schema2 := newMinimalSchema("posts", "User")
				schema2.Types[1].Fields = []*graph.Field{
					{
						Name:        "name",
						Description: "",
						Type:        graph.NewNonNullType("String"),
						Arguments:   nil,
						Directives:  nil,
					},
				}

				return map[string]providerSpec{
					"db1": {schemas: map[string]*graph.Schema{"admin": schema1}},
					"db2": {schemas: map[string]*graph.Schema{"admin": schema2}},
				}
			}(),
			wantInconsistencyKind: metadata.InconsistencyKindRole,
			wantInconsistencyName: "admin",
			wantInconsistencyReasonSubstr: "incoming connector \"db2\"): " +
				"object type has conflicting definitions",
			verify: func(t *testing.T, result composer.Result) {
				t.Helper()

				if _, ok := result.ValidatedSchemas["admin"]; ok {
					t.Fatal("expected admin schema to be dropped on object conflict")
				}
			},
		},
		{
			name: "get_schema_error",
			providers: map[string]providerSpec{
				"db": {
					schemaErr: errSchemaConnection,
				},
			},
			// Compose records the failing connector as a database
			// inconsistency (the test metadata has no entries to look up
			// against, so the default kind is "database") and returns a
			// schema-less Result.
			wantInconsistencyKind:         metadata.InconsistencyKindDatabase,
			wantInconsistencyName:         "db",
			wantInconsistencyReasonSubstr: "connection failed",
			verify: func(t *testing.T, result composer.Result) {
				t.Helper()

				if len(result.ValidatedSchemas) != 0 {
					t.Fatalf(
						"expected no schemas after GetSchema failure, got %d",
						len(result.ValidatedSchemas),
					)
				}
			},
		},
		{
			name: "conflicting_enums",
			providers: func() map[string]providerSpec {
				schema1 := newMinimalSchema("users", "User")
				schema1.Enums = []*graph.EnumType{statusEnum("ACTIVE")}
				schema2 := newMinimalSchema("posts", "Post")
				schema2.Enums = []*graph.EnumType{statusEnum("INACTIVE")}

				return map[string]providerSpec{
					"db1": {schemas: map[string]*graph.Schema{"admin": schema1}},
					"db2": {schemas: map[string]*graph.Schema{"admin": schema2}},
				}
			}(),
			// schemamerge surfaces the conflict; the admin role is dropped
			// and recorded as inconsistent so the rest of the server can
			// keep serving (here, that leaves an empty schema set).
			wantInconsistencyKind:         metadata.InconsistencyKindRole,
			wantInconsistencyName:         "admin",
			wantInconsistencyReasonSubstr: "failed to merge schema",
			verify: func(t *testing.T, result composer.Result) {
				t.Helper()

				if _, ok := result.ValidatedSchemas["admin"]; ok {
					t.Fatal("expected admin schema to be dropped on merge conflict")
				}
			},
		},
		{
			name: "conflicting_comparison_exp_inputs",
			providers: func() map[string]providerSpec {
				schema1 := newMinimalSchema("users", "User")
				schema1.Inputs = []*graph.InputObjectType{stringComparisonInput(stringEq)}
				schema2 := newMinimalSchema("posts", "Post")
				schema2.Inputs = []*graph.InputObjectType{stringComparisonInput(stringNeq)}

				return map[string]providerSpec{
					"db1": {schemas: map[string]*graph.Schema{"admin": schema1}},
					"db2": {schemas: map[string]*graph.Schema{"admin": schema2}},
				}
			}(),
			wantInconsistencyKind:         metadata.InconsistencyKindRole,
			wantInconsistencyName:         "admin",
			wantInconsistencyReasonSubstr: "failed to merge schema",
			verify: func(t *testing.T, result composer.Result) {
				t.Helper()

				if _, ok := result.ValidatedSchemas["admin"]; ok {
					t.Fatal(
						"expected admin schema to be dropped on input conflict",
					)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			providers := make(map[string]composer.SchemaProvider, len(tt.providers))
			for name, spec := range tt.providers {
				m := mock.NewMockSchemaProvider(ctrl)
				m.EXPECT().GetSchema().Return(spec.schemas, spec.schemaErr)
				providers[name] = m
			}

			incs := metadata.NewInconsistencies()
			c := composer.New(
				providers,
				&metadata.Metadata{Databases: nil, RemoteSchemas: nil},
				incs,
			)

			result := c.Compose(t.Context(), slog.Default())

			if tt.wantInconsistencyKind != "" {
				snapshot := incs.Snapshot()
				if !containsInconsistency(
					snapshot,
					tt.wantInconsistencyKind,
					tt.wantInconsistencyName,
					tt.wantInconsistencyReasonSubstr,
				) {
					t.Fatalf(
						"expected inconsistency kind=%q name=%q reason~%q; got %+v",
						tt.wantInconsistencyKind,
						tt.wantInconsistencyName,
						tt.wantInconsistencyReasonSubstr,
						snapshot,
					)
				}
			} else if got := incs.Len(); got != 0 {
				t.Fatalf("expected no inconsistencies, got %d: %+v",
					got, incs.Snapshot())
			}

			if tt.verify != nil {
				tt.verify(t, result)
			}
		})
	}
}

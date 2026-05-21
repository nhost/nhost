package composer_test

import (
	"errors"
	"log/slog"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/composer"
	"github.com/nhost/nhost/services/constellation/connector/composer/mock"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
	"go.uber.org/mock/gomock"
)

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
		// wantErrSubstr, if non-empty, asserts the returned error message
		// contains this substring. When empty, no error is expected.
		wantErrSubstr string
		// wantErrExact, if non-empty, asserts the returned error message is
		// exactly this string. Mutually exclusive with wantErrSubstr.
		wantErrExact string
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

				if got := result.FieldToConnector["users"]; got != "db" {
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

				if got := result.TypeToConnector["User"]; got != "db1" {
					t.Errorf("expected User owned by db1, got %q", got)
				}

				if got := result.TypeToConnector["Post"]; got != "db2" {
					t.Errorf("expected Post owned by db2, got %q", got)
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

				for _, field := range []string{"users", "insert_user", "user_stream"} {
					if got := result.FieldToConnector[field]; got != "db" {
						t.Errorf("expected field %q owned by 'db', got %q", field, got)
					}
				}
			},
		},
		{
			name: "get_schema_error",
			providers: map[string]providerSpec{
				"db": {schemaErr: errors.New("connection failed")},
			},
			wantErrExact: "failed to get schema from connector db: connection failed",
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
			// schemamerge surfaces the conflict; we just need to confirm
			// Compose propagates an error rather than silently accepting
			// divergent enums.
			wantErrSubstr: `role "admin"`,
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
			wantErrSubstr: `role "admin"`,
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

			c := composer.New(
				providers,
				&metadata.Metadata{Databases: nil, RemoteSchemas: nil},
			)

			result, err := c.Compose(t.Context(), slog.Default())

			switch {
			case tt.wantErrExact != "":
				if err == nil {
					t.Fatalf("expected error %q, got nil", tt.wantErrExact)
				}

				if got := err.Error(); got != tt.wantErrExact {
					t.Fatalf("expected error %q, got %q", tt.wantErrExact, got)
				}
			case tt.wantErrSubstr != "":
				if err == nil {
					t.Fatalf(
						"expected error containing %q, got nil", tt.wantErrSubstr,
					)
				}

				if got := err.Error(); !strings.Contains(got, tt.wantErrSubstr) {
					t.Fatalf(
						"expected error containing %q, got %q",
						tt.wantErrSubstr, got,
					)
				}
			default:
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}

				if tt.verify != nil {
					tt.verify(t, result)
				}
			}
		})
	}
}

func TestComposer_MissingProvider(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		meta    *metadata.Metadata
		wantErr string
	}{
		{
			name: "database",
			meta: &metadata.Metadata{
				Databases:     []metadata.DatabaseMetadata{{Name: "default"}},
				RemoteSchemas: nil,
			},
			wantErr: `validating connectors: missing connector for database "default"`,
		},
		{
			name: "remote_schema",
			meta: &metadata.Metadata{
				Databases:     nil,
				RemoteSchemas: []metadata.RemoteSchemaMetadata{{Name: "rs"}},
			},
			wantErr: `validating connectors: missing connector for remote schema "rs"`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			c := composer.New(
				map[string]composer.SchemaProvider{},
				tt.meta,
			)

			_, err := c.Compose(t.Context(), slog.Default())
			if err == nil {
				t.Fatal("expected error for missing connector")
			}

			if got := err.Error(); got != tt.wantErr {
				t.Fatalf("expected error %q, got %q", tt.wantErr, got)
			}
		})
	}
}

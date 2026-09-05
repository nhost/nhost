package remoteschema

import (
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/graph"
)

// upstreamFixture is the introspected (admin) remote schema the role-permission
// cases below validate against. It mirrors the kinds Hasura's role-based-schema
// validator inspects: an object with arguments, an interface and an object
// implementing it, a union, an enum, an input object and a custom scalar.
func upstreamFixture() *graph.Schema {
	queryName := "Query"

	return &graph.Schema{
		QueryType:        &queryName,
		MutationType:     nil,
		SubscriptionType: nil,
		Types: []*graph.ObjectType{
			{
				Name: "Query",
				Fields: []*graph.Field{
					{
						Name: "countries",
						Type: graph.NewNonNullListType(graph.NewNamedType("Country")),
						Arguments: []*graph.Argument{
							{Name: "filter", Type: graph.NewNamedType("CountryFilter")},
							{Name: "region", Type: graph.NewNamedType("Region")},
						},
					},
					{Name: "node", Type: graph.NewNamedType("Node")},
					{Name: "search", Type: graph.NewListType(graph.NewNamedType("SearchResult"))},
				},
			},
			{
				Name:   "Country",
				Fields: []*graph.Field{{Name: "code", Type: graph.NewNonNullType("String")}},
			},
			{
				Name:       "User",
				Interfaces: []string{"Node"},
				Fields:     []*graph.Field{{Name: "id", Type: graph.NewNonNullType("ID")}},
			},
			{
				Name:   "Post",
				Fields: []*graph.Field{{Name: "id", Type: graph.NewNonNullType("ID")}},
			},
		},
		Interfaces: []*graph.InterfaceType{
			{Name: "Node", Fields: []*graph.Field{{Name: "id", Type: graph.NewNonNullType("ID")}}},
		},
		Unions: []*graph.UnionType{
			{Name: "SearchResult", Types: []string{"User", "Post"}},
		},
		Enums: []*graph.EnumType{
			{Name: "Region", Values: []*graph.EnumValue{{Name: "AMERICAS"}, {Name: "EMEA"}}},
		},
		Inputs: []*graph.InputObjectType{
			{
				Name:   "CountryFilter",
				Fields: []*graph.InputField{{Name: "code", Type: graph.NewNamedType("String")}},
			},
		},
		Scalars: []*graph.ScalarType{{Name: "DateTime"}},
	}
}

// TestValidateRoleAgainstUpstream ports the cross-schema cases from Hasura's
// RoleBasedSchemaValidationError set (see
// third-party/hasura/graphql-engine/server/src-lib/Hasura/RemoteSchema/SchemaCache/Permission.hs).
// Each case is a role permission schema validated against upstreamFixture; the
// table asserts on the substring Hasura surfaces in its error text.
func TestValidateRoleAgainstUpstream(t *testing.T) {
	t.Parallel()

	queryName := "Query"

	tests := []struct {
		name string
		role *graph.Schema
		// want is the substring expected in exactly one returned error; empty
		// means the role must validate cleanly (no errors).
		want string
	}{
		{
			name: "valid subset passes",
			role: &graph.Schema{
				QueryType: &queryName,
				Types: []*graph.ObjectType{
					{
						Name: "Query",
						Fields: []*graph.Field{
							{
								Name: "countries",
								Type: graph.NewNonNullListType(graph.NewNamedType("Country")),
								Arguments: []*graph.Argument{
									{Name: "region", Type: graph.NewNamedType("Region")},
								},
							},
						},
					},
					{
						Name: "Country",
						Fields: []*graph.Field{
							{Name: "code", Type: graph.NewNonNullType("String")},
						},
					},
				},
			},
			want: "",
		},
		{
			name: "TypeDoesNotExist: object absent upstream",
			role: &graph.Schema{
				Types: []*graph.ObjectType{
					{
						Name:   "Ghost",
						Fields: []*graph.Field{{Name: "x", Type: graph.NewNamedType("String")}},
					},
				},
			},
			want: `Object: "Ghost" does not exist in the upstream remote schema`,
		},
		{
			name: "NonExistingField: field absent upstream",
			role: &graph.Schema{
				Types: []*graph.ObjectType{
					{
						Name: "Country",
						Fields: []*graph.Field{
							{Name: "population", Type: graph.NewNamedType("Int")},
						},
					},
				},
			},
			want: `field "population" does not exist in the Object: "Country"`,
		},
		{
			name: "NonMatchingType: field type differs",
			role: &graph.Schema{
				Types: []*graph.ObjectType{
					{
						Name:   "Country",
						Fields: []*graph.Field{{Name: "code", Type: graph.NewNamedType("String")}},
					},
				},
			},
			want: `expected type of "Country"("code") to be String! but received String`,
		},
		{
			name: "NonExistingArgument: field argument absent upstream",
			role: &graph.Schema{
				Types: []*graph.ObjectType{{Name: "Query", Fields: []*graph.Field{
					{
						Name: "countries",
						Type: graph.NewNonNullListType(graph.NewNamedType("Country")),
						Arguments: []*graph.Argument{
							{Name: "limit", Type: graph.NewNamedType("Int")},
						},
					},
				}}},
			},
			want: `argument "limit" does not exist in the field "countries"`,
		},
		{
			name: "NonMatchingType: argument type differs",
			role: &graph.Schema{
				Types: []*graph.ObjectType{{Name: "Query", Fields: []*graph.Field{
					{
						Name: "countries",
						Type: graph.NewNonNullListType(graph.NewNamedType("Country")),
						Arguments: []*graph.Argument{
							{Name: "region", Type: graph.NewNonNullType("Region")},
						},
					},
				}}},
			},
			want: `expected type of argument "region" of field "countries" to be Region but received Region!`,
		},
		{
			name: "NonExistingInputArgument: input field absent upstream",
			role: &graph.Schema{
				Inputs: []*graph.InputObjectType{
					{
						Name: "CountryFilter",
						Fields: []*graph.InputField{
							{Name: "name", Type: graph.NewNamedType("String")},
						},
					},
				},
			},
			want: `input argument "name" does not exist in the input object: "CountryFilter"`,
		},
		{
			name: "NonExistingEnumValues: enum value absent upstream",
			role: &graph.Schema{
				Enums: []*graph.EnumType{
					{
						Name:   "Region",
						Values: []*graph.EnumValue{{Name: "AMERICAS"}, {Name: "ANTARCTICA"}},
					},
				},
			},
			want: `enum "Region" contains the following enum values that do not exist`,
		},
		{
			name: "NonExistingUnionMemberTypes: union member absent upstream",
			role: &graph.Schema{
				Unions: []*graph.UnionType{
					{Name: "SearchResult", Types: []string{"User", "Comment"}},
				},
			},
			want: `union "SearchResult" contains members which do not exist`,
		},
		{
			name: "ObjectImplementsNonExistingInterfaces: interface not implemented upstream",
			role: &graph.Schema{
				Types: []*graph.ObjectType{
					{
						Name:       "Post",
						Interfaces: []string{"Node"},
						Fields:     []*graph.Field{{Name: "id", Type: graph.NewNonNullType("ID")}},
					},
				},
			},
			want: `object "Post" is trying to implement the following interfaces that do not exist`,
		},
		{
			name: "DuplicateArguments: argument declared twice on a field",
			role: &graph.Schema{
				Types: []*graph.ObjectType{{Name: "Query", Fields: []*graph.Field{
					{
						Name: "countries",
						Type: graph.NewNonNullListType(graph.NewNamedType("Country")),
						Arguments: []*graph.Argument{
							{Name: "region", Type: graph.NewNamedType("Region")},
							{Name: "region", Type: graph.NewNamedType("Region")},
						},
					},
				}}},
			},
			want: `duplicate arguments: "region" found in the field: "countries"`,
		},
		{
			name: "TypeDoesNotExist: scalar absent upstream",
			role: &graph.Schema{
				Scalars: []*graph.ScalarType{{Name: "JSON"}},
			},
			want: `Scalar: "JSON" does not exist in the upstream remote schema`,
		},
		{
			name: "TypeDoesNotExist: enum absent upstream",
			role: &graph.Schema{
				Enums: []*graph.EnumType{
					{Name: "Color", Values: []*graph.EnumValue{{Name: "RED"}}},
				},
			},
			want: `Enum: "Color" does not exist in the upstream remote schema`,
		},
		{
			name: "builtin scalar field type is accepted",
			role: &graph.Schema{
				Scalars: []*graph.ScalarType{{Name: "String"}, {Name: "ID"}},
			},
			want: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			errs := validateRoleAgainstUpstream(tt.role, upstreamFixture())

			if tt.want == "" {
				if len(errs) != 0 {
					t.Fatalf("expected no validation errors, got: %v", errs)
				}

				return
			}

			for _, e := range errs {
				if strings.Contains(e, tt.want) {
					return
				}
			}

			t.Fatalf("expected an error containing %q, got: %v", tt.want, errs)
		})
	}
}

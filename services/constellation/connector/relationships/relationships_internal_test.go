package relationships

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/graph"
)

// These tests cover edge-case branches in pure helpers that are awkward to
// drive through Inject: nil schemas, custom *QueryType names, and recursive
// type unwrapping. Behaviour reachable from Inject is covered in the
// black-box relationships_test.go.

func TestBaseTypeName(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		in   *graph.Type
		want string
	}{
		{"nil", nil, ""},
		{"named", graph.NewNamedType("User"), "User"},
		{"non-null", graph.NewNonNullType("User"), "User"},
		{"list of named", graph.NewListType(graph.NewNamedType("User")), "User"},
		{
			"non-null list of non-null",
			graph.NewNonNullListType(graph.NewNonNullType("User")),
			"User",
		},
		{"nested list", graph.NewListType(graph.NewListType(graph.NewNonNullType("User"))), "User"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := baseTypeName(tc.in); got != tc.want {
				t.Errorf("baseTypeName(%v) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestFindFieldOnQueryType(t *testing.T) {
	t.Parallel()

	customQueryName := "query_root"
	usersField := &graph.Field{Name: "users", Type: graph.NewNamedType("User")}
	defaultQueryField := &graph.Field{Name: "users"}

	customSchema := &graph.Schema{
		QueryType: &customQueryName,
		Types: []*graph.ObjectType{
			// Type literally named "Query" must NOT be picked when QueryType
			// points elsewhere.
			{Name: "Query", Fields: []*graph.Field{{Name: "decoy"}}},
			{Name: "query_root", Fields: []*graph.Field{usersField}},
		},
	}

	defaultSchema := &graph.Schema{
		QueryType: nil,
		Types: []*graph.ObjectType{
			{Name: "Query", Fields: []*graph.Field{defaultQueryField}},
		},
	}

	tests := []struct {
		name      string
		schema    *graph.Schema
		fieldName string
		want      *graph.Field
	}{
		{"nil schema", nil, "anything", nil},
		{"custom query type — found", customSchema, "users", usersField},
		{"custom query type — decoy ignored", customSchema, "decoy", nil},
		{"custom query type — missing field", customSchema, "missing", nil},
		{"default query type when QueryType nil", defaultSchema, "users", defaultQueryField},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := findFieldOnQueryType(tc.schema, tc.fieldName); got != tc.want {
				t.Errorf("findFieldOnQueryType = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestFindTypeDescription(t *testing.T) {
	t.Parallel()

	schema := &graph.Schema{
		Types: []*graph.ObjectType{
			{Name: "Config", Description: "main config"},
			{Name: "User", Description: "a user"},
		},
	}

	tests := []struct {
		name      string
		schema    *graph.Schema
		fieldType *graph.Type
		want      string
	}{
		{"nil schema", nil, graph.NewNamedType("Config"), ""},
		{"nil type", schema, nil, ""},
		{"type not found", schema, graph.NewNamedType("Missing"), ""},
		{"named type found", schema, graph.NewNamedType("Config"), "main config"},
		{"non-null unwrapped", schema, graph.NewNonNullType("User"), "a user"},
		{
			"list element unwrapped",
			schema,
			graph.NewListType(graph.NewNonNullType("Config")),
			"main config",
		},
		{
			"degenerate empty base name short-circuits",
			schema,
			graph.NewListType(graph.NewNamedType("")),
			"",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := findTypeDescription(tc.schema, tc.fieldType); got != tc.want {
				t.Errorf("findTypeDescription = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestFindUnmappedFieldArguments_FieldMissing(t *testing.T) {
	t.Parallel()

	queryName := "Query"
	schema := &graph.Schema{
		QueryType: &queryName,
		Types: []*graph.ObjectType{
			{Name: "Query", Fields: nil},
		},
	}

	if got := findUnmappedFieldArguments(schema, "missing", nil); got != nil {
		t.Errorf("findUnmappedFieldArguments(missing) = %v, want nil", got)
	}
}

func TestFindUnmappedFieldArguments_AllBound(t *testing.T) {
	t.Parallel()

	queryName := "Query"
	schema := &graph.Schema{
		QueryType: &queryName,
		Types: []*graph.ObjectType{
			{
				Name: "Query",
				Fields: []*graph.Field{{
					Name: "userConfig",
					Arguments: []*graph.Argument{
						{Name: "appID"},
						{Name: "resolve"},
					},
				}},
			},
		},
	}

	got := findUnmappedFieldArguments(schema, "userConfig", map[string]string{
		"appID":   "$id",
		"resolve": "true",
	})

	if got != nil {
		t.Errorf("expected no unmapped args when all are bound, got %v", got)
	}
}

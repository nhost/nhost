package transform_test

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/controller/planner/transform"
	"github.com/vektah/gqlparser/v2/ast"
)

func TestBaseTypeName_HandlesNilListAndNamedTypes(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		in   *ast.Type
		want string
	}{
		{name: "nil type", in: nil, want: ""},
		{
			name: "named type",
			in:   &ast.Type{NamedType: "users"},
			want: "users",
		},
		{
			name: "list of named type",
			in: &ast.Type{
				Elem: &ast.Type{NamedType: "users"},
			},
			want: "users",
		},
		{
			name: "nested list (list of list)",
			in: &ast.Type{
				Elem: &ast.Type{
					Elem: &ast.Type{NamedType: "Int"},
				},
			},
			want: "Int",
		},
		{
			name: "empty leaf (no NamedType, no Elem)",
			in:   &ast.Type{},
			want: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := transform.BaseTypeName(tt.in)
			if got != tt.want {
				t.Errorf("expected %q, got %q", tt.want, got)
			}
		})
	}
}

func TestFieldReturnType_HandlesEmptySchemaAndOperations(t *testing.T) {
	t.Parallel()

	queryRoot := &ast.Definition{
		Kind: ast.Object,
		Name: "query_root",
		Fields: ast.FieldList{
			{
				Name: "users",
				Type: ast.ListType(ast.NamedType("users", nil), nil),
			},
		},
	}
	mutationRoot := &ast.Definition{
		Kind: ast.Object,
		Name: "mutation_root",
		Fields: ast.FieldList{
			{Name: "insert_users", Type: ast.NamedType("users", nil)},
		},
	}

	schema := &ast.Schema{
		Types: map[string]*ast.Definition{
			"query_root":    queryRoot,
			"mutation_root": mutationRoot,
		},
		Query:    queryRoot,
		Mutation: mutationRoot,
	}

	tests := []struct {
		name      string
		opType    ast.Operation
		fieldName string
		schema    *ast.Schema
		want      string
	}{
		{
			name:      "query field returns base type",
			opType:    ast.Query,
			fieldName: "users",
			schema:    schema,
			want:      "users",
		},
		{
			name:      "mutation field returns base type",
			opType:    ast.Mutation,
			fieldName: "insert_users",
			schema:    schema,
			want:      "users",
		},
		{
			name:      "subscription with no subscription root returns empty",
			opType:    ast.Subscription,
			fieldName: "users",
			schema:    schema,
			want:      "",
		},
		{
			name:      "unknown field returns empty",
			opType:    ast.Query,
			fieldName: "missing",
			schema:    schema,
			want:      "",
		},
		{
			name:      "nil schema returns empty",
			opType:    ast.Query,
			fieldName: "users",
			schema:    nil,
			want:      "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := transform.FieldReturnType(tt.schema, tt.fieldName, tt.opType)
			if got != tt.want {
				t.Errorf("expected %q, got %q", tt.want, got)
			}
		})
	}
}

func TestFieldReturnTypeOnType(t *testing.T) {
	t.Parallel()

	schema := &ast.Schema{
		Types: map[string]*ast.Definition{
			"users": {
				Kind: ast.Object,
				Name: "users",
				Fields: ast.FieldList{
					{
						Name: "department",
						Type: ast.NamedType("departments", nil),
					},
				},
			},
		},
	}

	tests := []struct {
		name      string
		schema    *ast.Schema
		typeName  string
		fieldName string
		want      string
	}{
		{
			name:      "known type and field",
			schema:    schema,
			typeName:  "users",
			fieldName: "department",
			want:      "departments",
		},
		{
			name:      "unknown type",
			schema:    schema,
			typeName:  "missing",
			fieldName: "department",
			want:      "",
		},
		{
			name:      "unknown field on known type",
			schema:    schema,
			typeName:  "users",
			fieldName: "missing",
			want:      "",
		},
		{
			name:      "nil schema",
			schema:    nil,
			typeName:  "users",
			fieldName: "department",
			want:      "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := transform.FieldReturnTypeOnType(tt.schema, tt.typeName, tt.fieldName)
			if got != tt.want {
				t.Errorf("expected %q, got %q", tt.want, got)
			}
		})
	}
}

package transform_test

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/controller/planner/transform"
	"github.com/vektah/gqlparser/v2/ast"
)

func TestBuildSubOperation(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		originalOp *ast.OperationDefinition
		subset     ast.SelectionSet
		check      func(t *testing.T, result *ast.OperationDefinition)
	}{
		{
			name: "preserves metadata",
			originalOp: &ast.OperationDefinition{
				Operation: ast.Query,
				Name:      "GetUsers",
				VariableDefinitions: ast.VariableDefinitionList{
					{Variable: "id", Type: ast.NamedType("Int", nil)},
				},
				Directives: ast.DirectiveList{
					{Name: "cached"},
				},
				SelectionSet: ast.SelectionSet{
					&ast.Field{Name: "users"},
					&ast.Field{Name: "posts"},
				},
			},
			subset: ast.SelectionSet{
				&ast.Field{Name: "users"},
			},
			check: func(t *testing.T, result *ast.OperationDefinition) {
				t.Helper()

				if result.Operation != ast.Query {
					t.Errorf("expected Operation=Query, got %v", result.Operation)
				}

				if result.Name != "GetUsers" {
					t.Errorf("expected Name=GetUsers, got %s", result.Name)
				}

				if len(result.VariableDefinitions) != 1 ||
					result.VariableDefinitions[0].Variable != "id" {
					t.Errorf(
						"expected VariableDefinitions preserved, got %+v",
						result.VariableDefinitions,
					)
				}

				if len(result.Directives) != 1 || result.Directives[0].Name != "cached" {
					t.Errorf("expected Directives preserved, got %+v", result.Directives)
				}
			},
		},
		{
			name: "includes only provided selections",
			originalOp: &ast.OperationDefinition{
				Operation: ast.Query,
				Name:      "Multi",
				SelectionSet: ast.SelectionSet{
					&ast.Field{Name: "users"},
					&ast.Field{Name: "posts"},
					&ast.Field{Name: "tags"},
				},
			},
			subset: ast.SelectionSet{
				&ast.Field{Name: "posts"},
			},
			check: func(t *testing.T, result *ast.OperationDefinition) {
				t.Helper()

				names := fieldNames(result.SelectionSet)
				if len(names) != 1 || names[0] != "posts" {
					t.Errorf("expected only [posts], got %v", names)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			result := transform.BuildSubOperation(tt.originalOp, tt.subset)
			tt.check(t, result)
		})
	}
}

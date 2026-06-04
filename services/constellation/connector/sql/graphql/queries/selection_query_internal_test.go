package queries

import (
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
)

func selectedField(t *testing.T, selection ast.Selection) *ast.Field {
	t.Helper()

	field, ok := selection.(*ast.Field)
	if !ok {
		t.Fatalf("expected *ast.Field, got %T", selection)
	}

	return field
}

func TestAstToQuerySelectionDoesNotMutateRelationshipAST(t *testing.T) {
	t.Parallel()

	departments := &table{
		graphqlTypeName: "departments",
		relationships: []*relationship{
			{name: "employees"},
		},
	}

	doc, gqlErr := parser.ParseQuery(&ast.Source{
		Input: `{ departments { employees { user_id } employees { role } } }`,
	})
	if gqlErr != nil {
		t.Fatalf("ParseQuery: %v", gqlErr)
	}

	rootField := selectedField(t, doc.Operations[0].SelectionSet[0])
	employeesUserID := selectedField(t, rootField.SelectionSet[0])
	employeesRole := selectedField(t, rootField.SelectionSet[1])

	rootSelectionLen := len(rootField.SelectionSet)
	firstRelationshipSelectionLen := len(employeesUserID.SelectionSet)
	secondRelationshipSelectionLen := len(employeesRole.SelectionSet)

	for range 3 {
		_, relationships, err := departments.astToQuerySelection(rootField, doc.Fragments)
		if err != nil {
			t.Fatalf("astToQuerySelection: %v", err)
		}

		if len(rootField.SelectionSet) != rootSelectionLen {
			t.Fatalf(
				"root SelectionSet length grew to %d, want %d",
				len(rootField.SelectionSet), rootSelectionLen,
			)
		}

		if len(employeesUserID.SelectionSet) != firstRelationshipSelectionLen {
			t.Fatalf(
				"first relationship SelectionSet length grew to %d, want %d",
				len(employeesUserID.SelectionSet), firstRelationshipSelectionLen,
			)
		}

		if len(employeesRole.SelectionSet) != secondRelationshipSelectionLen {
			t.Fatalf(
				"second relationship SelectionSet length grew to %d, want %d",
				len(employeesRole.SelectionSet), secondRelationshipSelectionLen,
			)
		}

		if len(relationships) != 1 {
			t.Fatalf("relationships length = %d, want 1", len(relationships))
		}

		if relationships[0].field == employeesUserID {
			t.Fatal("merged relationship field aliases the original AST node")
		}

		if got := len(relationships[0].field.SelectionSet); got != 2 {
			t.Fatalf("merged relationship SelectionSet length = %d, want 2", got)
		}
	}
}

package resolver

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2/ast"
)

func TestCollectReferencedFragments(t *testing.T) {
	t.Parallel()

	t.Run("nil operation returns nil", func(t *testing.T) {
		t.Parallel()

		frags := ast.FragmentDefinitionList{
			{Name: "Frag1", TypeCondition: "Foo"},
		}

		got := collectReferencedFragments(nil, frags)
		if got != nil {
			t.Errorf("expected nil, got %v", got)
		}
	})

	t.Run("empty fragments returns nil", func(t *testing.T) {
		t.Parallel()

		op := &ast.OperationDefinition{
			Operation: ast.Query,
			SelectionSet: ast.SelectionSet{
				&ast.FragmentSpread{Name: "Frag1"},
			},
		}

		got := collectReferencedFragments(op, nil)
		if got != nil {
			t.Errorf("expected nil, got %v", got)
		}
	})

	t.Run("no fragment spreads returns nil", func(t *testing.T) {
		t.Parallel()

		op := &ast.OperationDefinition{
			Operation: ast.Query,
			SelectionSet: ast.SelectionSet{
				&ast.Field{Name: "users"},
			},
		}

		frags := ast.FragmentDefinitionList{
			{Name: "UserFields", TypeCondition: "users"},
		}

		got := collectReferencedFragments(op, frags)
		if got != nil {
			t.Errorf("expected nil, got %v", got)
		}
	})

	t.Run("returns only referenced fragment", func(t *testing.T) {
		t.Parallel()

		referenced := &ast.FragmentDefinition{
			Name:          "UserFields",
			TypeCondition: "users",
			SelectionSet: ast.SelectionSet{
				&ast.Field{Name: "id"},
				&ast.Field{Name: "name"},
			},
		}
		unreferenced := &ast.FragmentDefinition{
			Name:          "DeptFields",
			TypeCondition: "departments",
			SelectionSet: ast.SelectionSet{
				&ast.Field{Name: "name"},
			},
		}

		op := &ast.OperationDefinition{
			Operation: ast.Query,
			SelectionSet: ast.SelectionSet{
				&ast.Field{
					Name: "users",
					SelectionSet: ast.SelectionSet{
						&ast.FragmentSpread{Name: "UserFields"},
					},
				},
			},
		}

		frags := ast.FragmentDefinitionList{referenced, unreferenced}
		got := collectReferencedFragments(op, frags)

		wantNames := []string{"UserFields"}
		gotNames := fragNames(got)

		if diff := cmp.Diff(wantNames, gotNames); diff != "" {
			t.Errorf("fragments mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("returns transitively referenced fragments", func(t *testing.T) {
		t.Parallel()

		fragB := &ast.FragmentDefinition{
			Name:          "DeptName",
			TypeCondition: "departments",
			SelectionSet: ast.SelectionSet{
				&ast.Field{Name: "name"},
			},
		}
		fragA := &ast.FragmentDefinition{
			Name:          "UserWithDept",
			TypeCondition: "users",
			SelectionSet: ast.SelectionSet{
				&ast.Field{Name: "id"},
				&ast.Field{
					Name: "department",
					SelectionSet: ast.SelectionSet{
						&ast.FragmentSpread{Name: "DeptName"},
					},
				},
			},
		}
		unrelated := &ast.FragmentDefinition{
			Name:          "Unrelated",
			TypeCondition: "other",
			SelectionSet: ast.SelectionSet{
				&ast.Field{Name: "x"},
			},
		}

		op := &ast.OperationDefinition{
			Operation: ast.Query,
			SelectionSet: ast.SelectionSet{
				&ast.Field{
					Name: "users",
					SelectionSet: ast.SelectionSet{
						&ast.FragmentSpread{Name: "UserWithDept"},
					},
				},
			},
		}

		frags := ast.FragmentDefinitionList{fragA, fragB, unrelated}
		got := collectReferencedFragments(op, frags)

		wantNames := []string{"UserWithDept", "DeptName"}
		gotNames := fragNames(got)

		if diff := cmp.Diff(wantNames, gotNames); diff != "" {
			t.Errorf("fragments mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("handles inline fragments with nested spreads", func(t *testing.T) {
		t.Parallel()

		innerFrag := &ast.FragmentDefinition{
			Name:          "TeamInfo",
			TypeCondition: "Team",
			SelectionSet: ast.SelectionSet{
				&ast.Field{Name: "name"},
			},
		}
		unrelated := &ast.FragmentDefinition{
			Name:          "Unrelated",
			TypeCondition: "other",
			SelectionSet: ast.SelectionSet{
				&ast.Field{Name: "x"},
			},
		}

		op := &ast.OperationDefinition{
			Operation: ast.Query,
			SelectionSet: ast.SelectionSet{
				&ast.InlineFragment{
					TypeCondition: "Query",
					SelectionSet: ast.SelectionSet{
						&ast.Field{
							Name: "teams",
							SelectionSet: ast.SelectionSet{
								&ast.FragmentSpread{Name: "TeamInfo"},
							},
						},
					},
				},
			},
		}

		frags := ast.FragmentDefinitionList{innerFrag, unrelated}
		got := collectReferencedFragments(op, frags)

		wantNames := []string{"TeamInfo"}
		gotNames := fragNames(got)

		if diff := cmp.Diff(wantNames, gotNames); diff != "" {
			t.Errorf("fragments mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("handles duplicate spreads without infinite loop", func(t *testing.T) {
		t.Parallel()

		frag := &ast.FragmentDefinition{
			Name:          "UserFields",
			TypeCondition: "users",
			SelectionSet: ast.SelectionSet{
				&ast.Field{Name: "id"},
			},
		}

		// Two spreads of the same fragment in different fields
		op := &ast.OperationDefinition{
			Operation: ast.Query,
			SelectionSet: ast.SelectionSet{
				&ast.Field{
					Name: "users",
					SelectionSet: ast.SelectionSet{
						&ast.FragmentSpread{Name: "UserFields"},
					},
				},
				&ast.Field{
					Name: "admins",
					SelectionSet: ast.SelectionSet{
						&ast.FragmentSpread{Name: "UserFields"},
					},
				},
			},
		}

		frags := ast.FragmentDefinitionList{frag}
		got := collectReferencedFragments(op, frags)

		wantNames := []string{"UserFields"}
		gotNames := fragNames(got)

		if diff := cmp.Diff(wantNames, gotNames); diff != "" {
			t.Errorf("fragments mismatch (-want +got):\n%s", diff)
		}
	})
}

func fragNames(frags ast.FragmentDefinitionList) []string {
	names := make([]string, 0, len(frags))

	for _, f := range frags {
		names = append(names, f.Name)
	}

	return names
}

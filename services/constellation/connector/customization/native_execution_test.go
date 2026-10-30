package customization_test

import (
	"encoding/json/jsontext"
	"reflect"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/customization"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2/ast"
)

// Controller-built database targets already select native roots, even if a
// published namespace or root affix happens to match one of those names.
func TestNativeOperationAndResultPreserveCollidingRoots(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		cfg  metadata.Customization
	}{
		{name: "prefix", cfg: metadata.Customization{RootFieldsPrefix: "tea"}},
		{name: "suffix", cfg: metadata.Customization{RootFieldsSuffix: "ams"}},
		{name: "namespace", cfg: metadata.Customization{RootFieldsNamespace: "teams"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			tt.cfg.TypeNamesPrefix = "League"
			c := customization.New(tt.cfg, customization.FlavorDatabase)
			c.Apply(newTestSchema())

			row := ast.SelectionSet{&ast.FragmentSpread{Name: "Row"}}
			op := &ast.OperationDefinition{
				Operation: ast.Query,
				VariableDefinitions: ast.VariableDefinitionList{&ast.VariableDefinition{
					Variable: "filter", Type: &ast.Type{NamedType: "LeagueTeam"},
				}},
				SelectionSet: ast.SelectionSet{
					&ast.Field{Name: "teams", Alias: "direct", SelectionSet: row},
					&ast.FragmentSpread{Name: "Roots"},
				},
			}
			fragments := ast.FragmentDefinitionList{
				&ast.FragmentDefinition{
					Name: "Roots", TypeCondition: "Query",
					SelectionSet: ast.SelectionSet{&ast.Field{
						Name: "teams", Alias: "viaFragment", SelectionSet: row,
					}},
				},
				&ast.FragmentDefinition{
					Name: "Row", TypeCondition: "LeagueTeam",
					SelectionSet: ast.SelectionSet{&ast.Field{Name: "__typename", Alias: "kind"}},
				},
			}

			native, nativeFragments := c.ReverseNativeOperation(op, fragments)
			assertNativeRootsAndTypes(t, native, nativeFragments, op, fragments)

			result := map[string]any{
				"direct":      jsontext.Value(`[{"kind":"Team"}]`),
				"viaFragment": jsontext.Value(`[{"kind":"Team"}]`),
			}
			got := c.ForwardNativeResult(result, op, fragments)

			want := map[string]any{
				"direct":      []any{map[string]any{"kind": "LeagueTeam"}},
				"viaFragment": []any{map[string]any{"kind": "LeagueTeam"}},
			}
			if !reflect.DeepEqual(got, want) {
				t.Errorf("forwarded native result = %#v, want %#v", got, want)
			}
		})
	}
}

func assertNativeRootsAndTypes(
	t *testing.T,
	native *ast.OperationDefinition,
	nativeFragments ast.FragmentDefinitionList,
	op *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
) {
	t.Helper()

	if native == nil || len(native.SelectionSet) != 2 || len(nativeFragments) != 2 ||
		len(nativeFragments[0].SelectionSet) != 1 {
		t.Fatalf("unexpected native operation or fragments: %#v, %#v", native, nativeFragments)
	}

	if got, ok := native.SelectionSet[0].(*ast.Field); !ok ||
		got.Name != "teams" || got.Alias != "direct" {
		t.Errorf("direct native root = %#v, want teams (alias direct)", native.SelectionSet[0])
	}

	if got, ok := nativeFragments[0].SelectionSet[0].(*ast.Field); !ok ||
		got.Name != "teams" || got.Alias != "viaFragment" {
		t.Errorf(
			"fragment native root = %#v, want teams (alias viaFragment)",
			nativeFragments[0].SelectionSet[0],
		)
	}

	if got := native.VariableDefinitions[0].Type.NamedType; got != "Team" {
		t.Errorf("native variable type = %s, want Team", got)
	}

	if got := nativeFragments[1].TypeCondition; got != "Team" {
		t.Errorf("native fragment type condition = %s, want Team", got)
	}

	if op.VariableDefinitions[0].Type.NamedType != "LeagueTeam" ||
		fragments[1].TypeCondition != "LeagueTeam" {
		t.Fatal("native reversal mutated the caller's type references")
	}
}

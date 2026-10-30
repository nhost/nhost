package resolver

import (
	"sync"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
)

func TestResolveArgumentVariables_NestedObject(t *testing.T) {
	t.Parallel()

	args := ast.ArgumentList{
		{
			Name: "where",
			Value: &ast.Value{Kind: ast.ObjectValue, Children: ast.ChildValueList{
				{
					Name: "name",
					Value: &ast.Value{Kind: ast.ObjectValue, Children: ast.ChildValueList{
						{Name: "_eq", Value: &ast.Value{Kind: ast.Variable, Raw: "name"}},
					}},
				},
			}},
		},
	}

	resolved := resolveArgumentVariables(args, map[string]any{"name": "Ada"})

	value := resolved[0].Value.Children.ForName("name").Children.ForName("_eq")
	if value.Kind != ast.StringValue || value.Raw != "Ada" {
		t.Fatalf("expected nested variable to resolve to string Ada, got %+v", value)
	}
}

func TestResolveArgumentVariables_NestedList(t *testing.T) {
	t.Parallel()

	args := ast.ArgumentList{
		{
			Name: "tags",
			Value: &ast.Value{Kind: ast.ListValue, Children: ast.ChildValueList{
				{Value: &ast.Value{Kind: ast.Variable, Raw: "first"}},
				{Value: &ast.Value{Kind: ast.StringValue, Raw: "literal"}},
				{Value: &ast.Value{Kind: ast.Variable, Raw: "second"}},
			}},
		},
	}

	resolved := resolveArgumentVariables(args, map[string]any{"first": "a", "second": "b"})

	children := resolved[0].Value.Children
	if children[0].Value.Raw != "a" || children[1].Value.Raw != "literal" ||
		children[2].Value.Raw != "b" {
		t.Fatalf("unexpected resolved list: %+v", children)
	}
}

func TestResolveArgumentVariables_MissingVariableLeftUnchanged(t *testing.T) {
	t.Parallel()

	args := ast.ArgumentList{
		{Name: "id", Value: &ast.Value{Kind: ast.Variable, Raw: "missing"}},
	}

	resolved := resolveArgumentVariables(args, nil)

	if resolved[0].Value.Kind != ast.Variable || resolved[0].Value.Raw != "missing" {
		t.Fatalf("expected missing variable unchanged, got %+v", resolved[0].Value)
	}
}

func TestResolveArgumentVariables_DoesNotMutateCachedAST(t *testing.T) {
	t.Parallel()

	value := &ast.Value{Kind: ast.ObjectValue, Children: ast.ChildValueList{
		{Name: "_and", Value: &ast.Value{Kind: ast.ListValue, Children: ast.ChildValueList{
			{Value: &ast.Value{Kind: ast.ObjectValue, Children: ast.ChildValueList{
				{Name: "id", Value: &ast.Value{Kind: ast.Variable, Raw: "n"}},
			}}},
		}}},
	}}
	args := ast.ArgumentList{&ast.Argument{Name: "where", Value: value}}

	var wg sync.WaitGroup
	for i := range 20 {
		wg.Go(func() {
			resolved := resolveArgumentVariables(args, map[string]any{"n": float64(i)})

			got := resolved[0].Value.Children[0].Value.Children[0].Value.Children[0].Value
			if got.Kind != ast.IntValue || got.Raw != toLiteralValue(float64(i)).Raw {
				t.Errorf("value %d resolved as %+v", i, got)
			}
		})
	}

	wg.Wait()

	original := args[0].Value.Children[0].Value.Children[0].Value.Children[0].Value
	if original.Kind != ast.Variable || original.Raw != "n" {
		t.Fatalf("cached nested value mutated: %+v", original)
	}
}

func TestResolveArgumentVariables_TopLevelVariableStillWorks(t *testing.T) {
	t.Parallel()

	args := ast.ArgumentList{
		{Name: "id", Value: &ast.Value{Kind: ast.Variable, Raw: "id"}},
	}

	resolved := resolveArgumentVariables(args, map[string]any{"id": "u1"})

	arg := resolved.ForName("id")
	if arg == nil {
		t.Fatal("expected id argument")
	}

	if arg.Value.Kind != ast.StringValue || arg.Value.Raw != "u1" {
		t.Fatalf("expected top-level variable to resolve, got %+v", arg.Value)
	}
}

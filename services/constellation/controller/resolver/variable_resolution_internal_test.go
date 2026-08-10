package resolver

import (
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

	resolveArgumentVariables(args, map[string]any{"name": "Ada"})

	value := args[0].Value.Children.ForName("name").Children.ForName("_eq")
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

	resolveArgumentVariables(args, map[string]any{"first": "a", "second": "b"})

	children := args[0].Value.Children
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

	resolveArgumentVariables(args, nil)

	if args[0].Value.Kind != ast.Variable || args[0].Value.Raw != "missing" {
		t.Fatalf("expected missing variable unchanged, got %+v", args[0].Value)
	}
}

func TestResolveArgumentVariables_TopLevelVariableStillWorks(t *testing.T) {
	t.Parallel()

	args := ast.ArgumentList{
		{Name: "id", Value: &ast.Value{Kind: ast.Variable, Raw: "id"}},
	}

	resolveArgumentVariables(args, map[string]any{"id": "u1"})

	arg := args.ForName("id")
	if arg == nil {
		t.Fatal("expected id argument")
	}

	if arg.Value.Kind != ast.StringValue || arg.Value.Raw != "u1" {
		t.Fatalf("expected top-level variable to resolve, got %+v", arg.Value)
	}
}

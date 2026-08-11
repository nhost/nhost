package resolver

import (
	"fmt"
	"math"

	"github.com/vektah/gqlparser/v2/ast"
)

// resolveVariableReferences walks a selection set and replaces any variable references
// in field arguments with their literal values from the variables map.
// This is needed because remote operations are standalone queries without variable definitions.
func resolveVariableReferences(selections ast.SelectionSet, variables map[string]any) {
	for _, sel := range selections {
		switch s := sel.(type) {
		case *ast.Field:
			resolveArgumentVariables(s.Arguments, variables)
			resolveVariableReferences(s.SelectionSet, variables)
		case *ast.InlineFragment:
			resolveVariableReferences(s.SelectionSet, variables)
		case *ast.FragmentSpread:
			// Fragment spreads are resolved separately
		}
	}
}

// resolveArgumentVariables replaces variable references in arguments with literal values.
func resolveArgumentVariables(args ast.ArgumentList, variables map[string]any) {
	for _, arg := range args {
		arg.Value = resolveValueVariables(arg.Value, variables)
	}
}

func resolveValueVariables(value *ast.Value, variables map[string]any) *ast.Value {
	if value == nil {
		return nil
	}

	if value.Kind == ast.Variable {
		if val, ok := variables[value.Raw]; ok {
			return toLiteralValue(val)
		}

		return value
	}

	for _, child := range value.Children {
		child.Value = resolveValueVariables(child.Value, variables)
	}

	return value
}

// toLiteralValue converts a Go value to an AST literal value.
func toLiteralValue(v any) *ast.Value {
	if v == nil {
		return &ast.Value{ //nolint:exhaustruct
			Kind: ast.NullValue,
			Raw:  "null",
		}
	}

	switch val := v.(type) {
	case bool:
		raw := "false" //nolint:goconst,nolintlint
		if val {
			raw = "true" //nolint:goconst,nolintlint
		}

		return &ast.Value{ //nolint:exhaustruct
			Kind: ast.BooleanValue,
			Raw:  raw,
		}
	case float64:
		kind := ast.IntValue
		if val != math.Trunc(val) {
			kind = ast.FloatValue
		}

		return &ast.Value{ //nolint:exhaustruct
			Kind: kind,
			Raw:  fmt.Sprintf("%v", val),
		}
	case []any:
		children := make(ast.ChildValueList, 0, len(val))
		for _, elem := range val {
			children = append(children, &ast.ChildValue{ //nolint:exhaustruct
				Value: toLiteralValue(elem),
			})
		}

		return &ast.Value{ //nolint:exhaustruct
			Kind:     ast.ListValue,
			Children: children,
		}
	case map[string]any:
		children := make(ast.ChildValueList, 0, len(val))
		for k, v := range val {
			children = append(children, &ast.ChildValue{ //nolint:exhaustruct
				Name:  k,
				Value: toLiteralValue(v),
			})
		}

		return &ast.Value{ //nolint:exhaustruct
			Kind:     ast.ObjectValue,
			Children: children,
		}
	default:
		return &ast.Value{ //nolint:exhaustruct
			Kind: ast.StringValue,
			Raw:  fmt.Sprintf("%v", val),
		}
	}
}

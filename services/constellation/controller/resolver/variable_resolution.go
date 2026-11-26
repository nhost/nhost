package resolver

import (
	"fmt"
	"maps"
	"math"
	"reflect"
	"slices"

	"github.com/vektah/gqlparser/v2/ast"
)

// resolveVariableReferences literalizes a per-request selection tree for GraphQL
// targets, whose remote operations have no variable definitions. SQL targets must
// retain references for SQL's enum-aware resolution. Selections may share cached
// client nodes, so literalization never modifies them.
func resolveVariableReferences(
	selections ast.SelectionSet,
	variables map[string]any,
) ast.SelectionSet {
	out := make(ast.SelectionSet, 0, len(selections))
	for _, sel := range selections {
		switch s := sel.(type) {
		case *ast.Field:
			field := *s
			field.Arguments = resolveArgumentVariables(s.Arguments, variables)
			field.SelectionSet = resolveVariableReferences(s.SelectionSet, variables)
			out = append(out, &field)
		case *ast.InlineFragment:
			inline := *s
			inline.SelectionSet = resolveVariableReferences(s.SelectionSet, variables)
			out = append(out, &inline)
		default:
			out = append(out, sel)
		}
	}

	return out
}

// resolveArgumentVariables copies arguments and all nested values before substitution.
func resolveArgumentVariables(args ast.ArgumentList, variables map[string]any) ast.ArgumentList {
	out := make(ast.ArgumentList, 0, len(args))
	for _, arg := range args {
		copyArg := *arg
		copyArg.Value = resolveValueVariables(arg.Value, variables)
		out = append(out, &copyArg)
	}

	return out
}

func resolveValueVariables(value *ast.Value, variables map[string]any) *ast.Value {
	if value == nil {
		return nil
	}

	if value.Kind == ast.Variable {
		if val, ok := variables[value.Raw]; ok {
			return toLiteralValue(val)
		}

		copyValue := *value

		return &copyValue
	}

	copyValue := *value
	if len(value.Children) != 0 {
		copyValue.Children = make(ast.ChildValueList, 0, len(value.Children))
		for _, child := range value.Children {
			copyChild := *child
			copyChild.Value = resolveValueVariables(child.Value, variables)
			copyValue.Children = append(copyValue.Children, &copyChild)
		}
	}

	return &copyValue
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
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return &ast.Value{Kind: ast.IntValue, Raw: fmt.Sprintf("%v", val)} //nolint:exhaustruct
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
		if val == nil {
			return toLiteralValue(nil)
		}

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
		if val == nil {
			return toLiteralValue(nil)
		}

		children := make(ast.ChildValueList, 0, len(val))
		for _, k := range slices.Sorted(maps.Keys(val)) {
			children = append(children, &ast.ChildValue{ //nolint:exhaustruct
				Name:  k,
				Value: toLiteralValue(val[k]),
			})
		}

		return &ast.Value{ //nolint:exhaustruct
			Kind:     ast.ObjectValue,
			Children: children,
		}
	default:
		if literal := toLiteralContainer(reflect.ValueOf(v)); literal != nil {
			return literal
		}

		return &ast.Value{ //nolint:exhaustruct
			Kind: ast.StringValue,
			Raw:  fmt.Sprintf("%v", val),
		}
	}
}

// gqlparser singleton-list coercion retains concrete containers such as []string
// and []float64, even inside []any or input objects. Normalize only containers;
// scalar strings must stay quoted rather than becoming SQL-style enum literals.
func toLiteralContainer(value reflect.Value) *ast.Value {
	switch value.Kind() { //nolint:exhaustive // Other kinds keep the opaque string fallback.
	case reflect.Slice, reflect.Array:
		if _, bytes := reflect.TypeAssert[[]byte](value); bytes {
			return nil
		}

		if value.Kind() == reflect.Slice && value.IsNil() {
			return toLiteralValue(nil)
		}

		elements := make([]any, value.Len())
		for i := range value.Len() {
			elements[i] = value.Index(i).Interface()
		}

		return toLiteralValue(elements)
	case reflect.Map:
		if value.Type().Key().Kind() != reflect.String {
			return nil
		}

		if value.IsNil() {
			return toLiteralValue(nil)
		}

		fields := make(map[string]any, value.Len())

		iter := value.MapRange()
		for iter.Next() {
			fields[iter.Key().String()] = iter.Value().Interface()
		}

		return toLiteralValue(fields)
	default:
		return nil
	}
}

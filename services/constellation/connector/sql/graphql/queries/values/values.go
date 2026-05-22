// Package values provides AST-to-Go value conversion helpers used by the
// query builders. The functions here translate gqlparser ast.Value nodes
// (and Go variables referenced from them) into Go values suitable for SQL
// parameter binding. Resolved values feed Dialect.Placeholder via
// VariableTracker, ensuring user-supplied data never reaches SQL by string
// concatenation.
package values

import (
	"errors"
	"fmt"
	"slices"
	"strconv"

	"github.com/vektah/gqlparser/v2/ast"
)

// ErrVariableNotFound is returned when a GraphQL variable reference does not
// resolve to a value in the provided variables map.
var ErrVariableNotFound = errors.New("variable not found")

var (
	errVariableShouldBeResolved = errors.New(
		"variable should have been resolved before calling ExtractGoValue",
	)
	errUnsupportedASTValueKind   = errors.New("unsupported AST value kind")
	errExpectedListOrKind        = errors.New("expected list or value kind")
	errUnsupportedValueKindJSONB = errors.New("unsupported value kind for JSONB")
	errUnsupportedValueType      = errors.New("unsupported value type")
)

// ResolveVariable resolves a variable reference to its AST value.
// If the value is not a variable, it returns the value unchanged.
// This is useful when you need to process the AST value further (e.g., iterate over object fields).
func ResolveVariable(value *ast.Value, variables map[string]any) (*ast.Value, error) {
	if value.Kind != ast.Variable {
		return value, nil
	}

	varValue, exists := variables[value.Raw]
	if !exists {
		return nil, fmt.Errorf("%w: %s", ErrVariableNotFound, value.Raw)
	}

	resolved, err := GoValueToAST(varValue)
	if err != nil {
		return nil, fmt.Errorf("failed to convert variable %s to AST: %w", value.Raw, err)
	}

	return resolved, nil
}

// ResolveASTValue resolves an AST value to a Go value, recursively substituting
// any nested variable references inside objects and lists. ExtractGoValue alone
// errors on a Variable child because it has no variables map — callers like
// parseFunctionArguments pass args such as `args: {id: $inviteId}` where the
// top-level value is an ObjectValue with a Variable child, and the inner $inviteId
// must be resolved before the Go value can be produced.
func ResolveASTValue(value *ast.Value, variables map[string]any) (any, error) {
	resolved, err := ResolveVariable(value, variables)
	if err != nil {
		return nil, err
	}

	switch resolved.Kind { //nolint:exhaustive
	case ast.ObjectValue:
		result := make(map[string]any, len(resolved.Children))

		for _, child := range resolved.Children {
			childVal, err := ResolveASTValue(child.Value, variables)
			if err != nil {
				return nil, fmt.Errorf("resolving field %q: %w", child.Name, err)
			}

			result[child.Name] = childVal
		}

		return result, nil

	case ast.ListValue:
		result := make([]any, 0, len(resolved.Children))

		for i, child := range resolved.Children {
			childVal, err := ResolveASTValue(child.Value, variables)
			if err != nil {
				return nil, fmt.Errorf("resolving list element %d: %w", i, err)
			}

			result = append(result, childVal)
		}

		return result, nil

	default:
		return ExtractGoValue(resolved)
	}
}

// ExtractGoValue converts an AST value to its Go representation, recursing
// through ObjectValue and ListValue children. Returns an error if v is an
// ast.Variable (variables must be resolved first via ResolveVariable or
// ResolveASTValue) or if a scalar payload (int/float) fails to parse.
func ExtractGoValue(v *ast.Value) (any, error) { //nolint:cyclop
	switch v.Kind {
	case ast.NullValue:
		return nil, nil //nolint:nilnil
	case ast.IntValue:
		var i int64
		if _, err := fmt.Sscanf(v.Raw, "%d", &i); err != nil {
			return nil, fmt.Errorf("failed to parse int: %w", err)
		}

		return i, nil
	case ast.FloatValue:
		var f float64
		if _, err := fmt.Sscanf(v.Raw, "%f", &f); err != nil {
			return nil, fmt.Errorf("failed to parse float: %w", err)
		}

		return f, nil
	case ast.StringValue, ast.BlockValue, ast.EnumValue:
		return v.Raw, nil
	case ast.BooleanValue:
		return v.Raw == "true", nil
	case ast.ListValue:
		result := make([]any, 0, len(v.Children))
		for i, child := range v.Children {
			childVal, err := ExtractGoValue(child.Value)
			if err != nil {
				return nil, fmt.Errorf("extracting list element %d: %w", i, err)
			}

			result = append(result, childVal)
		}

		return result, nil
	case ast.ObjectValue:
		result := make(map[string]any, len(v.Children))
		for _, child := range v.Children {
			childVal, err := ExtractGoValue(child.Value)
			if err != nil {
				return nil, fmt.Errorf("extracting field %q: %w", child.Name, err)
			}

			result[child.Name] = childVal
		}

		return result, nil
	case ast.Variable:
		return nil, errVariableShouldBeResolved
	default:
		return nil, fmt.Errorf("%w: %v", errUnsupportedASTValueKind, v.Kind)
	}
}

// ExtractArrayValues extracts Go values from a list AST value, or wraps a
// single scalar value in a one-element slice.
func ExtractArrayValues(value *ast.Value) ([]any, error) {
	if value.Kind != ast.ListValue {
		val, err := ExtractGoValue(value)
		if err != nil {
			return nil, fmt.Errorf("expected list value or scalar value, got error: %w", err)
		}

		return []any{val}, nil
	}

	out := make([]any, len(value.Children))
	for i, child := range value.Children {
		val, err := ExtractGoValue(child.Value)
		if err != nil {
			return nil, fmt.Errorf("extracting array element %d: %w", i, err)
		}

		out[i] = val
	}

	return out, nil
}

// AnyToString converts a Go value to string efficiently without fmt.Sprintf.
// Note: nil collapses to "" — callers that need to distinguish "no value" from
// "empty string" (e.g. LIKE/regex pattern callers) must check for nil before
// calling. The default fmt.Sprintf branch is a defensive fallback: every value
// produced by ExtractGoValue / ExtractJSONBValue (the only public producers
// for this helper) is already covered by the typed cases above.
func AnyToString(val any) string {
	switch v := val.(type) {
	case string:
		return v
	case int64:
		return strconv.FormatInt(v, 10)
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64)
	case bool:
		return strconv.FormatBool(v)
	case nil:
		return ""
	default:
		return fmt.Sprintf("%v", val)
	}
}

// ExtractStringArrayValues extracts an array of strings from an AST value.
func ExtractStringArrayValues(value *ast.Value) ([]string, error) {
	if value.Kind != ast.ListValue {
		val, err := ExtractGoValue(value)
		if err != nil {
			return nil, fmt.Errorf("expected list value, got error: %w", err)
		}

		return []string{AnyToString(val)}, nil
	}

	out := make([]string, len(value.Children))

	for i, child := range value.Children {
		val, err := ExtractGoValue(child.Value)
		if err != nil {
			return nil, fmt.Errorf("extracting string array element %d: %w", i, err)
		}

		out[i] = AnyToString(val)
	}

	return out, nil
}

// CoerceToChildValueList coerces an AST value to a list of ChildValues.
// If the value is already a list, returns its children.
// If the value matches the expected kind, wraps it in a single-element list.
// This implements GraphQL list input coercion.
func CoerceToChildValueList(
	value *ast.Value,
	expectedKind ast.ValueKind,
) ([]*ast.ChildValue, error) {
	switch value.Kind { //nolint:exhaustive
	case ast.ListValue:
		return value.Children, nil

	case expectedKind:
		return []*ast.ChildValue{{Value: value}}, nil

	default:
		return nil, fmt.Errorf(
			"%w: expected list or %v, got %v",
			errExpectedListOrKind,
			expectedKind,
			value.Kind,
		)
	}
}

// ExtractJSONBValue extracts a Go value suitable for JSONB from an AST value.
// This handles objects, arrays, and scalar values.
func ExtractJSONBValue(value *ast.Value) (any, error) {
	switch value.Kind { //nolint:exhaustive
	case ast.ObjectValue:
		result := make(map[string]any, len(value.Children))

		for _, child := range value.Children {
			childVal, err := ExtractJSONBValue(child.Value)
			if err != nil {
				return nil, fmt.Errorf("extracting JSONB field %q: %w", child.Name, err)
			}

			result[child.Name] = childVal
		}

		return result, nil

	case ast.ListValue:
		result := make([]any, len(value.Children))

		for i, child := range value.Children {
			childVal, err := ExtractJSONBValue(child.Value)
			if err != nil {
				return nil, fmt.Errorf("extracting JSONB list element %d: %w", i, err)
			}

			result[i] = childVal
		}

		return result, nil

	case ast.IntValue:
		intVal, err := strconv.ParseInt(value.Raw, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("failed to parse int value: %w", err)
		}

		return intVal, nil

	case ast.FloatValue:
		floatVal, err := strconv.ParseFloat(value.Raw, 64)
		if err != nil {
			return nil, fmt.Errorf("failed to parse float value: %w", err)
		}

		return floatVal, nil

	case ast.StringValue, ast.BlockValue, ast.EnumValue:
		return value.Raw, nil

	case ast.BooleanValue:
		return value.Raw == "true", nil

	case ast.NullValue:
		return nil, nil //nolint:nilnil

	default:
		return nil, fmt.Errorf("%w: %v", errUnsupportedValueKindJSONB, value.Kind)
	}
}

// GoValueToAST converts a Go value (from GraphQL variables) to an AST Value.
func GoValueToAST(value any) (*ast.Value, error) { //nolint:cyclop,funlen
	if value == nil {
		return &ast.Value{Kind: ast.NullValue}, nil //nolint:exhaustruct
	}

	switch v := value.(type) {
	case map[string]any:
		// Iterate keys in sorted order so the resulting AST (and the SQL it
		// produces downstream) is deterministic: same logical request always
		// emits the same column list and parameter order. Go map iteration is
		// randomized, so without this two identical requests would produce
		// different SQL strings — that defeats prepared-statement caching,
		// makes query logs noisier, and turns golden tests flaky.
		keys := make([]string, 0, len(v))
		for key := range v {
			keys = append(keys, key)
		}

		slices.Sort(keys)

		children := make(ast.ChildValueList, 0, len(v))
		for _, key := range keys {
			childValue, err := GoValueToAST(v[key])
			if err != nil {
				return nil, fmt.Errorf("failed to convert field %s: %w", key, err)
			}

			children = append(children, &ast.ChildValue{ //nolint:exhaustruct
				Name:  key,
				Value: childValue,
			})
		}

		return &ast.Value{ //nolint:exhaustruct
			Kind:     ast.ObjectValue,
			Children: children,
		}, nil

	case []map[string]any:
		return sliceToASTList(v)

	case []any:
		return sliceToASTList(v)

	case []string:
		return sliceToASTList(v)

	case string:
		return &ast.Value{ //nolint:exhaustruct
			Kind: ast.EnumValue,
			Raw:  v,
		}, nil

	case int:
		return &ast.Value{ //nolint:exhaustruct
			Kind: ast.IntValue,
			Raw:  strconv.Itoa(v),
		}, nil

	case int32:
		return &ast.Value{ //nolint:exhaustruct
			Kind: ast.IntValue,
			Raw:  strconv.FormatInt(int64(v), 10),
		}, nil

	case int64:
		return &ast.Value{ //nolint:exhaustruct
			Kind: ast.IntValue,
			Raw:  strconv.FormatInt(v, 10),
		}, nil

	case float32:
		return &ast.Value{ //nolint:exhaustruct
			Kind: ast.FloatValue,
			Raw:  strconv.FormatFloat(float64(v), 'f', -1, 32),
		}, nil

	case float64:
		return &ast.Value{ //nolint:exhaustruct
			Kind: ast.FloatValue,
			Raw:  strconv.FormatFloat(v, 'f', -1, 64),
		}, nil

	case bool:
		return &ast.Value{ //nolint:exhaustruct
			Kind: ast.BooleanValue,
			Raw:  strconv.FormatBool(v),
		}, nil

	default:
		return nil, fmt.Errorf("%w: %T", errUnsupportedValueType, v)
	}
}

// sliceToASTList converts a Go slice of any element type into an ast.ListValue
// by recursing into GoValueToAST for each element. The element type is generic
// so the three list branches in GoValueToAST ([]map[string]any, []any,
// []string) share a single implementation and cannot drift.
func sliceToASTList[T any](in []T) (*ast.Value, error) {
	children := make(ast.ChildValueList, 0, len(in))

	for i, item := range in {
		childValue, err := GoValueToAST(item)
		if err != nil {
			return nil, fmt.Errorf("failed to convert array item %d: %w", i, err)
		}

		children = append(children, &ast.ChildValue{ //nolint:exhaustruct
			Value: childValue,
		})
	}

	return &ast.Value{ //nolint:exhaustruct
		Kind:     ast.ListValue,
		Children: children,
	}, nil
}

package action

import (
	"fmt"
	"math"
	"strconv"

	"github.com/vektah/gqlparser/v2/ast"
)

type shapeResult struct {
	value  any
	null   bool
	bubble bool
	errs   []map[string]any
}

func (c *Connector) shapeRootField(
	field *ast.Field,
	fragments ast.FragmentDefinitionList,
	value any,
) (any, []map[string]any) {
	if field == nil || field.Definition == nil || field.Definition.Type == nil {
		return nil, []map[string]any{
			newShapeError("action field is missing GraphQL type information", nil),
		}
	}

	path := []any{responseFieldName(field)}

	result := c.shapeValue(
		value,
		field.Definition.Type,
		field.SelectionSet,
		fragments,
		astBaseTypeName(field.Definition.Type),
		path,
	)
	if result.bubble || result.null {
		return nil, result.errs
	}

	return result.value, result.errs
}

func (c *Connector) shapeValue(
	value any,
	typeRef *ast.Type,
	selectionSet ast.SelectionSet,
	fragments ast.FragmentDefinitionList,
	typeName string,
	path []any,
) shapeResult {
	if typeRef == nil {
		return shapeResult{
			value:  nil,
			null:   true,
			bubble: false,
			errs: []map[string]any{
				newShapeError("missing GraphQL type information", path),
			},
		}
	}

	if typeRef.NonNull {
		nullable := *typeRef
		nullable.NonNull = false

		result := c.shapeValue(value, &nullable, selectionSet, fragments, typeName, path)
		if result.null || result.bubble {
			if len(result.errs) == 0 {
				result.errs = append(
					result.errs,
					newShapeError("cannot return null for non-null action field", path),
				)
			}

			return shapeResult{value: nil, null: true, bubble: true, errs: result.errs}
		}

		return result
	}

	if value == nil {
		return shapeResult{value: nil, null: true, bubble: false, errs: nil}
	}

	if typeRef.Elem != nil {
		return c.shapeList(value, typeRef.Elem, selectionSet, fragments, path)
	}

	if c.isObjectType(typeName) {
		return c.shapeObject(value, selectionSet, fragments, typeName, path)
	}

	return c.shapeLeaf(value, typeName, path)
}

func (c *Connector) shapeList(
	value any,
	elemType *ast.Type,
	selectionSet ast.SelectionSet,
	fragments ast.FragmentDefinitionList,
	path []any,
) shapeResult {
	items, ok := value.([]any)
	if !ok {
		return shapeResult{
			value:  nil,
			null:   true,
			bubble: false,
			errs: []map[string]any{
				newShapeError("action response field expected a JSON array", path),
			},
		}
	}

	out := make([]any, len(items))

	var errs []map[string]any

	for i, item := range items {
		itemPath := appendPath(path, i)
		result := c.shapeValue(
			item,
			elemType,
			selectionSet,
			fragments,
			astBaseTypeName(elemType),
			itemPath,
		)

		errs = append(errs, result.errs...)
		if result.bubble {
			return shapeResult{value: nil, null: true, bubble: false, errs: errs}
		}

		out[i] = result.value
	}

	return shapeResult{value: out, null: false, bubble: false, errs: errs}
}

func (c *Connector) shapeObject(
	value any,
	selectionSet ast.SelectionSet,
	fragments ast.FragmentDefinitionList,
	typeName string,
	path []any,
) shapeResult {
	object, ok := value.(map[string]any)
	if !ok {
		return shapeResult{
			value:  nil,
			null:   true,
			bubble: false,
			errs: []map[string]any{
				newShapeError("action response field expected a JSON object", path),
			},
		}
	}

	fields := collectSelectedFields(selectionSet, fragments, typeName)
	out := make(map[string]any, len(fields))

	var errs []map[string]any

	for _, child := range fields {
		responseKey := responseFieldName(child)
		childPath := appendPath(path, responseKey)

		if child.Name == "__typename" {
			out[responseKey] = typeName

			continue
		}

		if child.Definition == nil || child.Definition.Type == nil {
			errs = append(
				errs,
				newShapeError(
					fmt.Sprintf("field %q is missing GraphQL type information", child.Name),
					childPath,
				),
			)
			out[responseKey] = nil

			continue
		}

		childValue := object[child.Name]
		result := c.shapeValue(
			childValue,
			child.Definition.Type,
			child.SelectionSet,
			fragments,
			astBaseTypeName(child.Definition.Type),
			childPath,
		)

		errs = append(errs, result.errs...)
		if result.bubble {
			return shapeResult{value: nil, null: true, bubble: false, errs: errs}
		}

		out[responseKey] = result.value
	}

	return shapeResult{value: out, null: false, bubble: false, errs: errs}
}

func (c *Connector) shapeLeaf(value any, typeName string, path []any) shapeResult {
	if c.isEnumType(typeName) {
		return c.shapeEnum(value, typeName, path)
	}

	switch typeName {
	case "Boolean":
		v, ok := value.(bool)
		if !ok {
			return invalidLeaf("action response field expected a Boolean", path)
		}

		return shapeResult{value: v, null: false, bubble: false, errs: nil}
	case "Float":
		v, ok := coerceFloat(value)
		if !ok {
			return invalidLeaf("action response field expected a Float", path)
		}

		return shapeResult{value: v, null: false, bubble: false, errs: nil}
	case "ID":
		v, ok := coerceID(value)
		if !ok {
			return invalidLeaf("action response field expected an ID", path)
		}

		return shapeResult{value: v, null: false, bubble: false, errs: nil}
	case "Int":
		v, ok := coerceInt(value)
		if !ok {
			return invalidLeaf("action response field expected an Int", path)
		}

		return shapeResult{value: v, null: false, bubble: false, errs: nil}
	case "String":
		v, ok := value.(string)
		if !ok {
			return invalidLeaf("action response field expected a String", path)
		}

		return shapeResult{value: v, null: false, bubble: false, errs: nil}
	default:
		if c.isScalarType(typeName) {
			return shapeResult{value: value, null: false, bubble: false, errs: nil}
		}
	}

	return invalidLeaf(fmt.Sprintf("unknown action response type %q", typeName), path)
}

func (c *Connector) shapeEnum(value any, typeName string, path []any) shapeResult {
	s, ok := value.(string)
	if !ok {
		return invalidLeaf("action response field expected an enum string", path)
	}

	if _, ok := c.enumValues[typeName][s]; !ok {
		return invalidLeaf(fmt.Sprintf("action response field has invalid enum value %q", s), path)
	}

	return shapeResult{value: s, null: false, bubble: false, errs: nil}
}

func invalidLeaf(message string, path []any) shapeResult {
	return shapeResult{
		value:  nil,
		null:   true,
		bubble: false,
		errs:   []map[string]any{newShapeError(message, path)},
	}
}

func (c *Connector) isObjectType(typeName string) bool {
	return c.typeKinds[typeName] == customTypeKindObject
}

func (c *Connector) isScalarType(typeName string) bool {
	if isBuiltinScalar(typeName) {
		return true
	}

	return c.typeKinds[typeName] == customTypeKindScalar
}

func (c *Connector) isEnumType(typeName string) bool {
	return c.typeKinds[typeName] == customTypeKindEnum
}

func coerceFloat(value any) (float64, bool) {
	switch v := value.(type) {
	case float64:
		return v, isFinite(v)
	case float32:
		f := float64(v)

		return f, isFinite(f)
	case int:
		return float64(v), true
	case int32:
		return float64(v), true
	case int64:
		return float64(v), true
	default:
		return 0, false
	}
}

func isFinite(v float64) bool {
	return !math.IsInf(v, 0) && !math.IsNaN(v)
}

func coerceInt(value any) (int64, bool) {
	f, ok := coerceFloat(value)
	if !ok || math.Trunc(f) != f || f < math.MinInt32 || f > math.MaxInt32 {
		return 0, false
	}

	return int64(f), true
}

func coerceID(value any) (string, bool) {
	switch v := value.(type) {
	case string:
		return v, true
	case float64:
		if math.Trunc(v) != v {
			return "", false
		}

		return strconv.FormatInt(int64(v), 10), true
	case int:
		return strconv.FormatInt(int64(v), 10), true
	case int32:
		return strconv.FormatInt(int64(v), 10), true
	case int64:
		return strconv.FormatInt(v, 10), true
	default:
		return "", false
	}
}

func collectSelectedFields(
	selectionSet ast.SelectionSet,
	fragments ast.FragmentDefinitionList,
	typeName string,
) []*ast.Field {
	fields := collectSelectedFieldsRecursive(
		selectionSet,
		fragments,
		typeName,
		make(map[string]struct{}),
	)

	return mergeSelectedFields(fields)
}

func collectSelectedFieldsRecursive(
	selectionSet ast.SelectionSet,
	fragments ast.FragmentDefinitionList,
	typeName string,
	visitedFragments map[string]struct{},
) []*ast.Field {
	fields := make([]*ast.Field, 0, len(selectionSet))

	for _, selection := range selectionSet {
		switch sel := selection.(type) {
		case *ast.Field:
			fields = append(fields, sel)
		case *ast.InlineFragment:
			if !fragmentMatchesType(sel.TypeCondition, typeName) {
				continue
			}

			fields = append(
				fields,
				collectSelectedFieldsRecursive(
					sel.SelectionSet,
					fragments,
					typeName,
					visitedFragments,
				)...,
			)
		case *ast.FragmentSpread:
			if _, seen := visitedFragments[sel.Name]; seen {
				continue
			}

			fragment := fragments.ForName(sel.Name)
			if fragment == nil || !fragmentMatchesType(fragment.TypeCondition, typeName) {
				continue
			}

			visitedFragments[sel.Name] = struct{}{}
			fields = append(
				fields,
				collectSelectedFieldsRecursive(
					fragment.SelectionSet,
					fragments,
					typeName,
					visitedFragments,
				)...,
			)
		}
	}

	return fields
}

func fragmentMatchesType(typeCondition, typeName string) bool {
	return typeCondition == "" || typeCondition == typeName
}

func mergeSelectedFields(fields []*ast.Field) []*ast.Field {
	if len(fields) <= 1 {
		return fields
	}

	out := make([]*ast.Field, 0, len(fields))
	indexByKey := make(map[string]int, len(fields))

	for _, field := range fields {
		key := responseFieldName(field)

		idx, exists := indexByKey[key]
		if !exists {
			indexByKey[key] = len(out)
			out = append(out, field)

			continue
		}

		out[idx] = mergeSelectionField(out[idx], field)
	}

	return out
}

func mergeSelectionField(left, right *ast.Field) *ast.Field {
	if len(left.SelectionSet) == 0 {
		if len(right.SelectionSet) == 0 {
			return left
		}

		clone := *left
		clone.SelectionSet = right.SelectionSet

		return &clone
	}

	if len(right.SelectionSet) == 0 {
		return left
	}

	clone := *left
	clone.SelectionSet = append(
		append(ast.SelectionSet(nil), left.SelectionSet...),
		right.SelectionSet...,
	)

	return &clone
}

func appendPath(path []any, elem any) []any {
	out := make([]any, len(path)+1)
	copy(out, path)
	out[len(path)] = elem

	return out
}

func astBaseTypeName(typeRef *ast.Type) string {
	if typeRef == nil {
		return ""
	}

	if typeRef.Elem != nil {
		return astBaseTypeName(typeRef.Elem)
	}

	return typeRef.NamedType
}

package controller

import (
	"fmt"
	"maps"
	"reflect"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/validator"
)

func coerceVariables(
	schema *ast.Schema,
	operation *ast.OperationDefinition,
	variables map[string]any,
) (map[string]any, error) {
	if operation == nil || (len(variables) == 0 && len(operation.VariableDefinitions) == 0) {
		return variables, nil
	}

	// gqlparser writes coercions into input containers. Keep reusable requests
	// isolated, including typed Go containers supplied directly to Resolve.
	local := maps.Clone(variables)
	for _, definition := range operation.VariableDefinitions {
		if value, present := variables[definition.Variable]; present && value != nil {
			local[definition.Variable] = copyVariableInput(
				schema, definition.Type, reflect.ValueOf(value),
			).Interface()
		}
	}

	validated, err := validator.VariableValues(schema, operation, local)
	if err != nil {
		return nil, fmt.Errorf("coercing variables: %w", err)
	}

	return validated, nil
}

// copyVariableInput copies only the containers gqlparser traverses. Custom
// scalar payloads stay opaque, and the library owns coercion and validation.
func copyVariableInput(schema *ast.Schema, typ *ast.Type, value reflect.Value) reflect.Value {
	if typ.Elem == nil {
		definition := schema.Types[typ.NamedType]
		if definition == nil || definition.Kind != ast.InputObject {
			return value
		}
	}

	kind := value.Kind()
	switch {
	case kind == reflect.Interface:
		if value.IsNil() {
			return value
		}

		return copyVariableInput(schema, typ, value.Elem())
	case kind == reflect.Pointer:
		if value.IsNil() {
			return value
		}

		local := reflect.New(value.Type().Elem())
		local.Elem().Set(copyVariableInput(schema, typ, value.Elem()))

		return local
	case kind == reflect.Slice && typ.Elem != nil:
		return copyVariableList(schema, typ.Elem, value)
	case kind == reflect.Map && typ.Elem == nil:
		return copyVariableObject(schema, schema.Types[typ.NamedType], value)
	}

	// Non-list inputs may be singleton-coerced through multiple list levels.
	if typ.Elem != nil {
		return copyVariableInput(schema, typ.Elem, value)
	}

	return value
}

func copyVariableList(schema *ast.Schema, elem *ast.Type, value reflect.Value) reflect.Value {
	if value.IsNil() {
		return value
	}

	local := reflect.MakeSlice(value.Type(), value.Len(), value.Len())
	for i := range value.Len() {
		local.Index(i).Set(copyVariableInput(schema, elem, value.Index(i)))
	}

	return local
}

func copyVariableObject(
	schema *ast.Schema, definition *ast.Definition, value reflect.Value,
) reflect.Value {
	if value.IsNil() {
		return value
	}

	local := reflect.MakeMapWithSize(value.Type(), value.Len())

	fields := value.MapRange()
	for fields.Next() {
		field := fields.Value()
		if fieldDefinition := definition.Fields.ForName(
			fields.Key().String(),
		); fieldDefinition != nil {
			field = copyVariableInput(schema, fieldDefinition.Type, field)
		}

		local.SetMapIndex(fields.Key(), field)
	}

	return local
}

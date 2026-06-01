// Package introspection executes GraphQL introspection queries (__schema /
// __type) against an already-validated *ast.Schema by walking the requested
// selection set and emitting the canonical introspection result shape.
//
// It is intentionally state-less: every entry point is a free function. The
// controller dispatches to Execute when an operation contains an introspection
// root field; the response is a plain map[string]any ready to be serialised
// as the GraphQL data payload.
package introspection

import (
	"maps"
	"slices"

	"github.com/vektah/gqlparser/v2/ast"
)

// Execute walks the introspection selection set of operation against schema
// and returns the canonical {"__schema": ..., "__type": ...} payload. Only the
// fields actually requested in the selection set appear in the result.
//
// query is consulted to resolve named fragment spreads encountered in nested
// selection sets.
func Execute(
	schema *ast.Schema,
	operation *ast.OperationDefinition,
	query *ast.QueryDocument,
) map[string]any {
	result := make(map[string]any)

	for _, selection := range operation.SelectionSet {
		field, ok := selection.(*ast.Field)
		if !ok {
			continue
		}

		switch field.Name {
		case "__schema":
			result["__schema"] = executeSchemaField(schema, field, query)
		case "__type":
			if typ := executeTypeField(schema, field, query); typ != nil {
				result["__type"] = typ
			} else {
				result["__type"] = nil
			}
		}
	}

	return result
}

// executeTypeField resolves the top-level `__type(name: "X")` introspection
// field. It returns the introspected representation of the requested type, or
// nil when the type does not exist or the name argument is missing/not a
// literal string. Variables in the name argument are not resolved -- callers
// using variables will see a nil result.
func executeTypeField(
	schema *ast.Schema,
	field *ast.Field,
	query *ast.QueryDocument,
) map[string]any {
	nameArg := field.Arguments.ForName("name")
	if nameArg == nil || nameArg.Value == nil ||
		nameArg.Value.Kind != ast.StringValue {
		return nil
	}

	typeDef := schema.Types[nameArg.Value.Raw]
	if typeDef == nil {
		return nil
	}

	return executeFullTypeFragment(typeDef, field.SelectionSet, query, schema)
}

func executeSchemaField(
	schema *ast.Schema,
	field *ast.Field,
	query *ast.QueryDocument,
) map[string]any {
	result := map[string]any{
		"queryType":        nil,
		"mutationType":     nil,
		"subscriptionType": nil,
	}

	for _, selection := range field.SelectionSet {
		subField, ok := selection.(*ast.Field)
		if !ok {
			continue
		}

		switch subField.Name {
		case "queryType":
			if schema.Query != nil {
				result["queryType"] = executeTypeRefField(schema.Query.Name, subField)
			}
		case "mutationType":
			if schema.Mutation != nil {
				result["mutationType"] = executeTypeRefField(schema.Mutation.Name, subField)
			}
		case "subscriptionType":
			if schema.Subscription != nil {
				result["subscriptionType"] = executeTypeRefField(
					schema.Subscription.Name, subField,
				)
			}
		case "types":
			result["types"] = executeTypesField(schema, subField, query)
		case "directives":
			result["directives"] = executeDirectivesField(schema, subField, query)
		}
	}

	return result
}

func executeTypeRefField(typeName string, field *ast.Field) map[string]any {
	result := make(map[string]any)

	for _, selection := range field.SelectionSet {
		if subField, ok := selection.(*ast.Field); ok {
			if subField.Name == "name" {
				result["name"] = typeName
			}
		}
	}

	return result
}

func executeTypesField(
	schema *ast.Schema,
	field *ast.Field,
	query *ast.QueryDocument,
) []map[string]any {
	names := slices.Sorted(maps.Keys(schema.Types))
	types := make([]map[string]any, 0, len(names))

	for _, name := range names {
		typeInfo := executeFullTypeFragment(schema.Types[name], field.SelectionSet, query, schema)
		types = append(types, typeInfo)
	}

	return types
}

func executeDirectivesField(
	schema *ast.Schema,
	field *ast.Field,
	query *ast.QueryDocument,
) []map[string]any {
	names := slices.Sorted(maps.Keys(schema.Directives))
	directives := make([]map[string]any, 0, len(names))

	for _, name := range names {
		directiveInfo := executeDirectiveFields(
			schema.Directives[name], field.SelectionSet, query, schema,
		)
		directives = append(directives, directiveInfo)
	}

	return directives
}

func executeDirectiveFields(
	directive *ast.DirectiveDefinition,
	selectionSet ast.SelectionSet,
	query *ast.QueryDocument,
	schema *ast.Schema,
) map[string]any {
	result := make(map[string]any)

	for _, selection := range selectionSet {
		switch sel := selection.(type) {
		case *ast.Field:
			fillDirectiveField(result, directive, sel, query, schema)
		case *ast.FragmentSpread:
			if fragment := query.Fragments.ForName(sel.Name); fragment != nil {
				fragmentResult := executeDirectiveFields(
					directive, fragment.SelectionSet, query, schema,
				)
				maps.Copy(result, fragmentResult)
			}
		}
	}

	return result
}

func fillDirectiveField(
	result map[string]any,
	directive *ast.DirectiveDefinition,
	sel *ast.Field,
	query *ast.QueryDocument,
	schema *ast.Schema,
) {
	switch sel.Name {
	case kindName:
		result[kindName] = directive.Name
	case kindDescription:
		result[kindDescription] = stringOrNil(directive.Description)
	case "locations":
		locations := make([]string, 0, len(directive.Locations))
		for _, location := range directive.Locations {
			locations = append(locations, string(location))
		}

		result["locations"] = locations
	case "args":
		args := make([]map[string]any, 0, len(directive.Arguments))
		for _, arg := range directive.Arguments {
			argInfo := executeInputValueFragment(arg, sel.SelectionSet, query, schema)
			args = append(args, argInfo)
		}

		result["args"] = args
	}
}

// Field-name and type-kind string constants. Using named constants both
// keeps the giant switch statements below readable and gives golangci-lint
// no reason to complain about duplicate literals.
const (
	kindName        = "name"
	kindDescription = "description"

	kindKindEnum    = "kind"
	kindFieldsEnum  = "fields"
	kindOfTypeField = "ofType"
)

func executeFullTypeFragment(
	typeDef *ast.Definition,
	selectionSet ast.SelectionSet,
	query *ast.QueryDocument,
	schema *ast.Schema,
) map[string]any {
	result := make(map[string]any)

	for _, selection := range selectionSet {
		switch sel := selection.(type) {
		case *ast.Field:
			fillFullTypeField(result, typeDef, sel, query, schema)
		case *ast.FragmentSpread:
			if fragment := query.Fragments.ForName(sel.Name); fragment != nil {
				fragmentResult := executeFullTypeFragment(
					typeDef, fragment.SelectionSet, query, schema,
				)
				maps.Copy(result, fragmentResult)
			}
		}
	}

	return result
}

func fillFullTypeField( //nolint:cyclop
	result map[string]any,
	typeDef *ast.Definition,
	sel *ast.Field,
	query *ast.QueryDocument,
	schema *ast.Schema,
) {
	switch sel.Name {
	case kindKindEnum:
		result[kindKindEnum] = string(typeDef.Kind)
	case kindName:
		result[kindName] = typeDef.Name
	case kindDescription:
		result[kindDescription] = stringOrNil(typeDef.Description)
	case kindFieldsEnum:
		if typeDef.Kind == ast.Object || typeDef.Kind == ast.Interface {
			result[kindFieldsEnum] = collectFields(typeDef, sel, query, schema)
		}
	case "inputFields":
		if typeDef.Kind == ast.InputObject {
			result["inputFields"] = collectInputFields(typeDef, sel, query, schema)
		}
	case "interfaces":
		if typeDef.Kind == ast.Object {
			result["interfaces"] = collectInterfaces(typeDef, sel, query, schema)
		}
	case "enumValues":
		if typeDef.Kind == ast.Enum {
			result["enumValues"] = collectEnumValues(typeDef, sel)
		}
	case "possibleTypes":
		if typeDef.Kind == ast.Union || typeDef.Kind == ast.Interface {
			result["possibleTypes"] = collectPossibleTypes(typeDef, sel, query, schema)
		}
	}
}

func collectFields(
	typeDef *ast.Definition,
	sel *ast.Field,
	query *ast.QueryDocument,
	schema *ast.Schema,
) []map[string]any {
	fields := make([]map[string]any, 0)
	for _, field := range typeDef.Fields {
		// Skip introspection meta fields (__schema, __type, __typename).
		// These are implicitly available but should not be included in the schema.
		if len(field.Name) >= 2 && field.Name[0] == '_' && field.Name[1] == '_' {
			continue
		}

		fields = append(fields, executeFieldInfo(field, sel.SelectionSet, query, schema))
	}

	return fields
}

func collectInputFields(
	typeDef *ast.Definition,
	sel *ast.Field,
	query *ast.QueryDocument,
	schema *ast.Schema,
) []map[string]any {
	inputFields := make([]map[string]any, 0, len(typeDef.Fields))
	for _, field := range typeDef.Fields {
		inputFields = append(inputFields, executeInputValueFragmentFromField(
			field, sel.SelectionSet, query, schema,
		))
	}

	return inputFields
}

func collectInterfaces(
	typeDef *ast.Definition,
	sel *ast.Field,
	query *ast.QueryDocument,
	schema *ast.Schema,
) []map[string]any {
	interfaces := make([]map[string]any, 0, len(typeDef.Interfaces))
	for _, iface := range typeDef.Interfaces {
		interfaces = append(interfaces, executeTypeRefFragment(
			nil, iface, sel.SelectionSet, query, schema,
		))
	}

	return interfaces
}

func collectEnumValues(typeDef *ast.Definition, sel *ast.Field) []map[string]any {
	enumValues := make([]map[string]any, 0, len(typeDef.EnumValues))
	for _, enumValue := range typeDef.EnumValues {
		enumValues = append(enumValues, executeEnumValueInfo(enumValue, sel.SelectionSet))
	}

	return enumValues
}

func collectPossibleTypes(
	typeDef *ast.Definition,
	sel *ast.Field,
	query *ast.QueryDocument,
	schema *ast.Schema,
) []map[string]any {
	possibleTypes := make([]map[string]any, 0, len(typeDef.Types))
	for _, possibleType := range typeDef.Types {
		possibleTypes = append(possibleTypes, executeTypeRefFragment(
			nil, possibleType, sel.SelectionSet, query, schema,
		))
	}

	return possibleTypes
}

func executeFieldInfo(
	field *ast.FieldDefinition,
	selectionSet ast.SelectionSet,
	query *ast.QueryDocument,
	schema *ast.Schema,
) map[string]any {
	result := make(map[string]any)

	for _, selection := range selectionSet {
		sel, ok := selection.(*ast.Field)
		if !ok {
			continue
		}

		switch sel.Name {
		case kindName:
			result[kindName] = field.Name
		case kindDescription:
			result[kindDescription] = stringOrNil(field.Description)
		case "args":
			args := make([]map[string]any, 0, len(field.Arguments))
			for _, arg := range field.Arguments {
				args = append(args, executeInputValueFragment(
					arg, sel.SelectionSet, query, schema,
				))
			}

			result["args"] = args
		case "type": //nolint:goconst
			result["type"] = executeTypeRefFragment(
				field.Type, "", sel.SelectionSet, query, schema,
			)
		case "isDeprecated":
			result["isDeprecated"] = field.Directives.ForName("deprecated") != nil
		case "deprecationReason":
			result["deprecationReason"] = getDeprecationReason(field.Directives)
		}
	}

	return result
}

func executeInputValueFragment(
	arg *ast.ArgumentDefinition,
	selectionSet ast.SelectionSet,
	query *ast.QueryDocument,
	schema *ast.Schema,
) map[string]any {
	result := make(map[string]any)

	for _, selection := range selectionSet {
		switch sel := selection.(type) {
		case *ast.Field:
			switch sel.Name {
			case kindName:
				result[kindName] = arg.Name
			case kindDescription:
				result[kindDescription] = stringOrNil(arg.Description)
			case "type":
				result["type"] = executeTypeRefFragment(
					arg.Type, "", sel.SelectionSet, query, schema,
				)
			case "defaultValue":
				result["defaultValue"] = defaultValueOrNil(arg.DefaultValue)
			}
		case *ast.FragmentSpread:
			if fragment := query.Fragments.ForName(sel.Name); fragment != nil {
				fragmentResult := executeInputValueFragment(
					arg, fragment.SelectionSet, query, schema,
				)
				maps.Copy(result, fragmentResult)
			}
		}
	}

	return result
}

func executeInputValueFragmentFromField(
	field *ast.FieldDefinition,
	selectionSet ast.SelectionSet,
	query *ast.QueryDocument,
	schema *ast.Schema,
) map[string]any {
	result := make(map[string]any)

	for _, selection := range selectionSet {
		switch sel := selection.(type) {
		case *ast.Field:
			switch sel.Name {
			case kindName:
				result[kindName] = field.Name
			case kindDescription:
				result[kindDescription] = stringOrNil(field.Description)
			case "type":
				result["type"] = executeTypeRefFragment(
					field.Type, "", sel.SelectionSet, query, schema,
				)
			case "defaultValue":
				result["defaultValue"] = defaultValueOrNil(field.DefaultValue)
			}
		case *ast.FragmentSpread:
			if fragment := query.Fragments.ForName(sel.Name); fragment != nil {
				fragmentResult := executeInputValueFragmentFromField(
					field, fragment.SelectionSet, query, schema,
				)
				maps.Copy(result, fragmentResult)
			}
		}
	}

	return result
}

func executeEnumValueInfo(
	enumValue *ast.EnumValueDefinition,
	selectionSet ast.SelectionSet,
) map[string]any {
	result := make(map[string]any)

	for _, selection := range selectionSet {
		sel, ok := selection.(*ast.Field)
		if !ok {
			continue
		}

		switch sel.Name {
		case kindName:
			result[kindName] = enumValue.Name
		case kindDescription:
			result[kindDescription] = stringOrNil(enumValue.Description)
		case "isDeprecated":
			result["isDeprecated"] = enumValue.Directives.ForName("deprecated") != nil
		case "deprecationReason":
			result["deprecationReason"] = getDeprecationReason(enumValue.Directives)
		}
	}

	return result
}

func executeTypeRefFragment(
	typeRef *ast.Type,
	typeName string,
	selectionSet ast.SelectionSet,
	query *ast.QueryDocument,
	schema *ast.Schema,
) map[string]any {
	result := make(map[string]any)

	for _, selection := range selectionSet {
		switch sel := selection.(type) {
		case *ast.Field:
			fillTypeRefField(result, sel, typeRef, typeName, query, schema)
		case *ast.FragmentSpread:
			if fragment := query.Fragments.ForName(sel.Name); fragment != nil {
				fragmentResult := executeTypeRefFragment(
					typeRef, typeName, fragment.SelectionSet, query, schema,
				)
				maps.Copy(result, fragmentResult)
			}
		}
	}

	return result
}

func fillTypeRefField(
	result map[string]any,
	sel *ast.Field,
	typeRef *ast.Type,
	typeName string,
	query *ast.QueryDocument,
	schema *ast.Schema,
) {
	switch sel.Name {
	case kindKindEnum:
		result[kindKindEnum] = typeRefKind(typeRef, schema)
	case kindName:
		result[kindName] = typeRefName(typeRef, typeName)
	case kindOfTypeField:
		if of := typeRefOfType(typeRef, sel, query, schema); of != nil {
			result[kindOfTypeField] = of
		}
	}
}

func typeRefKind(typeRef *ast.Type, schema *ast.Schema) string {
	if typeRef == nil {
		return "OBJECT"
	}

	switch {
	case typeRef.NonNull:
		return "NON_NULL"
	case typeRef.Elem != nil:
		return "LIST"
	default:
		return getTypeKind(typeRef.NamedType, schema)
	}
}

func typeRefName(typeRef *ast.Type, fallback string) any {
	if typeRef == nil {
		return fallback
	}

	if typeRef.NonNull || typeRef.Elem != nil {
		return nil
	}

	return typeRef.NamedType
}

func typeRefOfType(
	typeRef *ast.Type,
	sel *ast.Field,
	query *ast.QueryDocument,
	schema *ast.Schema,
) map[string]any {
	if typeRef == nil {
		return nil
	}

	if typeRef.NonNull {
		innerType := &ast.Type{
			NamedType: typeRef.NamedType,
			Elem:      typeRef.Elem,
			NonNull:   false,
			Position:  nil,
		}

		return executeTypeRefFragment(innerType, "", sel.SelectionSet, query, schema)
	}

	if typeRef.Elem != nil {
		return executeTypeRefFragment(typeRef.Elem, "", sel.SelectionSet, query, schema)
	}

	return nil
}

func getTypeKind(typeName string, schema *ast.Schema) string {
	if typeDef := schema.Types[typeName]; typeDef != nil {
		return string(typeDef.Kind)
	}

	// Fallback for built-in scalar types.
	switch typeName {
	case "Int", "Float", "String", "Boolean", "ID":
		return "SCALAR"
	default:
		return "OBJECT"
	}
}

func stringOrNil(s string) *string {
	if s == "" {
		return nil
	}

	return &s
}

func defaultValueOrNil(value *ast.Value) *string {
	if value == nil {
		return nil
	}

	str := value.String()

	return &str
}

func getDeprecationReason(directives ast.DirectiveList) *string {
	deprecated := directives.ForName("deprecated")
	if deprecated == nil {
		return nil
	}

	reason := deprecated.Arguments.ForName("reason")
	if reason == nil {
		return nil
	}

	str := reason.Value.Raw

	return &str
}

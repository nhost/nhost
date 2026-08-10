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
// selection sets; inline fragments are walked directly.
func Execute(
	schema *ast.Schema,
	operation *ast.OperationDefinition,
	query *ast.QueryDocument,
) map[string]any {
	result := make(map[string]any)

	forEachSelectedField(operation.SelectionSet, query, func(field *ast.Field) {
		switch field.Name {
		case "__schema":
			result[responseName(field)] = executeSchemaField(schema, field, query)
		case "__type":
			key := responseName(field)
			if typ := executeTypeField(schema, field, query); typ != nil {
				result[key] = typ
			} else {
				result[key] = nil
			}
		case kindTypename:
			// A root-level __typename resolves to the operation root type name
			// (query_root / mutation_root / subscription_root), keyed by the
			// response alias when one is given.
			result[responseName(field)] = rootTypeName(schema, operation.Operation)
		}
	})

	return result
}

func responseName(field *ast.Field) string {
	if field.Alias != "" {
		return field.Alias
	}

	return field.Name
}

// forEachSelectedField assumes query was checked with gqlparser's default
// validation rules; NoFragmentCycles bounds recursion through fragment spreads.
func forEachSelectedField(
	selectionSet ast.SelectionSet,
	query *ast.QueryDocument,
	visit func(*ast.Field),
) {
	for _, selection := range selectionSet {
		switch sel := selection.(type) {
		case *ast.Field:
			visit(sel)
		case *ast.FragmentSpread:
			if fragment := fragmentByName(query, sel.Name); fragment != nil {
				forEachSelectedField(fragment.SelectionSet, query, visit)
			}
		case *ast.InlineFragment:
			forEachSelectedField(sel.SelectionSet, query, visit)
		}
	}
}

func fragmentByName(
	query *ast.QueryDocument,
	name string,
) *ast.FragmentDefinition {
	if query == nil {
		return nil
	}

	return query.Fragments.ForName(name)
}

// rootTypeName returns the name of the schema's root type for the given
// operation, falling back to the canonical Hasura name when the schema does not
// declare one (which should not happen for a validated operation).
func rootTypeName(schema *ast.Schema, op ast.Operation) string {
	switch op {
	case ast.Mutation:
		if schema.Mutation != nil {
			return schema.Mutation.Name
		}

		return "mutation_root"
	case ast.Subscription:
		if schema.Subscription != nil {
			return schema.Subscription.Name
		}

		return "subscription_root"
	case ast.Query:
		if schema.Query != nil {
			return schema.Query.Name
		}

		return "query_root"
	default:
		if schema.Query != nil {
			return schema.Query.Name
		}

		return "query_root"
	}
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
	// Only emit the __schema sub-fields the client actually requested, matching
	// Hasura (and the GraphQL execution model). A requested root-operation field
	// whose schema has no such root resolves to null.
	result := make(map[string]any)

	forEachSelectedField(field.SelectionSet, query, func(subField *ast.Field) {
		key := responseName(subField)

		switch subField.Name {
		case kindTypename:
			result[key] = metaSchema
		case "queryType":
			result[key] = rootTypeRef(schema.Query, subField, query, schema)
		case "mutationType":
			result[key] = rootTypeRef(schema.Mutation, subField, query, schema)
		case "subscriptionType":
			result[key] = rootTypeRef(schema.Subscription, subField, query, schema)
		case "types":
			result[key] = executeTypesField(schema, subField, query)
		case "directives":
			result[key] = executeDirectivesField(schema, subField, query)
		}
	})

	return result
}

// rootTypeRef resolves a __schema root-operation type reference
// (queryType/mutationType/subscriptionType), returning nil when the schema does
// not declare that root — Hasura emits null for a requested-but-absent root.
func rootTypeRef(
	def *ast.Definition,
	field *ast.Field,
	query *ast.QueryDocument,
	schema *ast.Schema,
) any {
	if def == nil {
		return nil
	}

	return executeFullTypeFragment(def, field.SelectionSet, query, schema)
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
		if !shouldAdvertiseDirective(name) {
			continue
		}

		directiveInfo := executeDirectiveFields(
			schema.Directives[name], field.SelectionSet, query, schema,
		)
		directives = append(directives, directiveInfo)
	}

	return directives
}

// shouldAdvertiseDirective filters gqlparser prelude directives Constellation
// does not support at execution time from __schema.directives output.
func shouldAdvertiseDirective(name string) bool {
	switch name {
	case "defer", "oneOf":
		return false
	default:
		return true
	}
}

func executeDirectiveFields(
	directive *ast.DirectiveDefinition,
	selectionSet ast.SelectionSet,
	query *ast.QueryDocument,
	schema *ast.Schema,
) map[string]any {
	result := make(map[string]any)

	forEachSelectedField(selectionSet, query, func(sel *ast.Field) {
		fillDirectiveField(result, directive, sel, query, schema)
	})

	return result
}

func fillDirectiveField(
	result map[string]any,
	directive *ast.DirectiveDefinition,
	sel *ast.Field,
	query *ast.QueryDocument,
	schema *ast.Schema,
) {
	key := responseName(sel)

	switch sel.Name {
	case kindTypename:
		result[key] = metaDirective
	case kindName:
		result[key] = directive.Name
	case kindDescription:
		result[key] = stringOrNil(directive.Description)
	case "isRepeatable":
		result[key] = directive.IsRepeatable
	case "locations":
		locations := make([]string, 0, len(directive.Locations))
		for _, location := range directive.Locations {
			locations = append(locations, string(location))
		}

		result[key] = locations
	case "args":
		args := make([]map[string]any, 0, len(directive.Arguments))
		for _, arg := range directive.Arguments {
			argInfo := executeInputValueFragment(arg, sel.SelectionSet, query, schema)
			args = append(args, argInfo)
		}

		result[key] = args
	}
}

// Field-name and type-kind string constants. Using named constants both
// keeps the giant switch statements below readable and gives golangci-lint
// no reason to complain about duplicate literals.
const (
	kindName        = "name"
	kindDescription = "description"
	kindTypename    = "__typename"

	kindKindEnum    = "kind"
	kindFieldsEnum  = "fields"
	kindOfTypeField = "ofType"

	metaSchema     = "__Schema"
	metaType       = "__Type"
	metaField      = "__Field"
	metaInputValue = "__InputValue"
	metaEnumValue  = "__EnumValue"
	metaDirective  = "__Directive"
)

func executeFullTypeFragment(
	typeDef *ast.Definition,
	selectionSet ast.SelectionSet,
	query *ast.QueryDocument,
	schema *ast.Schema,
) map[string]any {
	result := make(map[string]any)

	forEachSelectedField(selectionSet, query, func(sel *ast.Field) {
		fillFullTypeField(result, typeDef, sel, query, schema)
	})

	return result
}

func fillFullTypeField( //nolint:cyclop
	result map[string]any,
	typeDef *ast.Definition,
	sel *ast.Field,
	query *ast.QueryDocument,
	schema *ast.Schema,
) {
	key := responseName(sel)

	switch sel.Name {
	case kindTypename:
		result[key] = metaType
	case kindKindEnum:
		result[key] = string(typeDef.Kind)
	case kindName:
		result[key] = typeDef.Name
	case kindDescription:
		result[key] = stringOrNil(typeDef.Description)
	case kindFieldsEnum:
		if typeDef.Kind == ast.Object || typeDef.Kind == ast.Interface {
			result[key] = collectFields(typeDef, sel, query, schema)
		}
	case "inputFields":
		if typeDef.Kind == ast.InputObject {
			result[key] = collectInputFields(typeDef, sel, query, schema)
		}
	case "interfaces":
		if typeDef.Kind == ast.Object {
			result[key] = collectInterfaces(typeDef, sel, query, schema)
		}
	case "enumValues":
		if typeDef.Kind == ast.Enum {
			result[key] = collectEnumValues(typeDef, sel, query)
		}
	case "possibleTypes":
		if typeDef.Kind == ast.Union || typeDef.Kind == ast.Interface {
			result[key] = collectPossibleTypes(typeDef, sel, query, schema)
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

func collectEnumValues(
	typeDef *ast.Definition,
	sel *ast.Field,
	query *ast.QueryDocument,
) []map[string]any {
	enumValues := make([]map[string]any, 0, len(typeDef.EnumValues))
	for _, enumValue := range typeDef.EnumValues {
		enumValues = append(enumValues, executeEnumValueInfo(
			enumValue, sel.SelectionSet, query,
		))
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

	forEachSelectedField(selectionSet, query, func(sel *ast.Field) {
		key := responseName(sel)

		switch sel.Name {
		case kindTypename:
			result[key] = metaField
		case kindName:
			result[key] = field.Name
		case kindDescription:
			result[key] = stringOrNil(field.Description)
		case "args":
			args := make([]map[string]any, 0, len(field.Arguments))
			for _, arg := range field.Arguments {
				args = append(args, executeInputValueFragment(
					arg, sel.SelectionSet, query, schema,
				))
			}

			result[key] = args
		case "type": //nolint:goconst
			result[key] = executeTypeRefFragment(
				field.Type, "", sel.SelectionSet, query, schema,
			)
		case "isDeprecated":
			result[key] = field.Directives.ForName("deprecated") != nil
		case "deprecationReason":
			result[key] = getDeprecationReason(field.Directives)
		}
	})

	return result
}

func executeInputValueFragment(
	arg *ast.ArgumentDefinition,
	selectionSet ast.SelectionSet,
	query *ast.QueryDocument,
	schema *ast.Schema,
) map[string]any {
	result := make(map[string]any)

	forEachSelectedField(selectionSet, query, func(sel *ast.Field) {
		key := responseName(sel)

		switch sel.Name {
		case kindTypename:
			result[key] = metaInputValue
		case kindName:
			result[key] = arg.Name
		case kindDescription:
			result[key] = stringOrNil(arg.Description)
		case "type":
			result[key] = executeTypeRefFragment(
				arg.Type, "", sel.SelectionSet, query, schema,
			)
		case "defaultValue":
			result[key] = defaultValueOrNil(arg.DefaultValue)
		}
	})

	return result
}

func executeInputValueFragmentFromField(
	field *ast.FieldDefinition,
	selectionSet ast.SelectionSet,
	query *ast.QueryDocument,
	schema *ast.Schema,
) map[string]any {
	result := make(map[string]any)

	forEachSelectedField(selectionSet, query, func(sel *ast.Field) {
		key := responseName(sel)

		switch sel.Name {
		case kindTypename:
			result[key] = metaInputValue
		case kindName:
			result[key] = field.Name
		case kindDescription:
			result[key] = stringOrNil(field.Description)
		case "type":
			result[key] = executeTypeRefFragment(
				field.Type, "", sel.SelectionSet, query, schema,
			)
		case "defaultValue":
			result[key] = defaultValueOrNil(field.DefaultValue)
		}
	})

	return result
}

func executeEnumValueInfo(
	enumValue *ast.EnumValueDefinition,
	selectionSet ast.SelectionSet,
	query *ast.QueryDocument,
) map[string]any {
	result := make(map[string]any)

	forEachSelectedField(selectionSet, query, func(sel *ast.Field) {
		key := responseName(sel)

		switch sel.Name {
		case kindTypename:
			result[key] = metaEnumValue
		case kindName:
			result[key] = enumValue.Name
		case kindDescription:
			result[key] = stringOrNil(enumValue.Description)
		case "isDeprecated":
			result[key] = enumValue.Directives.ForName("deprecated") != nil
		case "deprecationReason":
			result[key] = getDeprecationReason(enumValue.Directives)
		}
	})

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

	forEachSelectedField(selectionSet, query, func(sel *ast.Field) {
		fillTypeRefField(result, sel, typeRef, typeName, query, schema)
	})

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
	key := responseName(sel)

	switch sel.Name {
	case kindTypename:
		result[key] = metaType
	case kindKindEnum:
		result[key] = typeRefKind(typeRef, schema)
	case kindName:
		result[key] = typeRefName(typeRef, typeName)
	case kindOfTypeField:
		if of := typeRefOfType(typeRef, sel, query, schema); of != nil {
			result[key] = of
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

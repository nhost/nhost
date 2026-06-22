package transform

import "github.com/vektah/gqlparser/v2/ast"

// BaseTypeName extracts the base type name from a GraphQL type, unwrapping
// list and non-null wrappers.
func BaseTypeName(t *ast.Type) string {
	if t == nil {
		return ""
	}

	if t.NamedType != "" {
		return t.NamedType
	}

	if t.Elem != nil {
		return BaseTypeName(t.Elem)
	}

	return ""
}

// FieldReturnType returns the base type name of a root field on the given
// operation type, or "" if no such field exists on the matching root.
func FieldReturnType(schema *ast.Schema, fieldName string, opType ast.Operation) string {
	if schema == nil {
		return ""
	}

	var rootType *ast.Definition

	switch opType {
	case ast.Query:
		rootType = schema.Query
	case ast.Mutation:
		rootType = schema.Mutation
	case ast.Subscription:
		rootType = schema.Subscription
	}

	if rootType == nil {
		return ""
	}

	for _, f := range rootType.Fields {
		if f.Name == fieldName {
			return BaseTypeName(f.Type)
		}
	}

	return ""
}

// FieldReturnTypeOnType returns the base type name of a field defined on the
// named type, or "" if the type or field is unknown.
func FieldReturnTypeOnType(schema *ast.Schema, typeName, fieldName string) string {
	if schema == nil {
		return ""
	}

	typeDef := schema.Types[typeName]
	if typeDef == nil {
		return ""
	}

	for _, f := range typeDef.Fields {
		if f.Name == fieldName {
			return BaseTypeName(f.Type)
		}
	}

	return ""
}

package remoteschema

// builtinTypes is the set of built-in GraphQL type names that must be skipped
// when converting an SDL/introspection result into graph.Schema.
var builtinTypes = map[string]struct{}{ //nolint:gochecknoglobals
	"String":              {},
	"Int":                 {},
	"Float":               {},
	"Boolean":             {},
	"ID":                  {},
	"__Schema":            {},
	"__Type":              {},
	"__TypeKind":          {},
	"__Field":             {},
	"__InputValue":        {},
	"__EnumValue":         {},
	"__Directive":         {},
	"__DirectiveLocation": {},
}

// isBuiltinType reports whether name is a GraphQL built-in/introspection type.
func isBuiltinType(name string) bool {
	_, ok := builtinTypes[name]
	return ok
}

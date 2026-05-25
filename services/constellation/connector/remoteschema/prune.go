package remoteschema

import "github.com/nhost/nhost/services/constellation/graph"

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

// graphBaseTypeName extracts the leaf named type from a potentially nested graph.Type.
func graphBaseTypeName(t *graph.Type) string {
	if t == nil {
		return ""
	}

	if t.Elem != nil {
		return graphBaseTypeName(t.Elem)
	}

	return t.NamedType
}

// pruneUnreachableTypes removes types from the schema that are not transitively
// reachable from the root operation types (Query, Mutation, Subscription).
// This prevents orphaned types (e.g., return types of mutations not exposed to
// a role) from leaking into the schema.
func pruneUnreachableTypes(schema *graph.Schema) {
	reachable := findReachableTypes(schema)

	schema.Types = filterTypes(schema.Types, reachable)
	schema.Inputs = filterInputs(schema.Inputs, reachable)
	schema.Scalars = filterScalars(schema.Scalars, reachable)
	schema.Enums = filterEnums(schema.Enums, reachable)
	schema.Interfaces = filterInterfaces(schema.Interfaces, reachable)
	schema.Unions = filterUnions(schema.Unions, reachable)
}

// reachabilityWalker holds type lookup maps and walks type references transitively.
type reachabilityWalker struct {
	objects    map[string]*graph.ObjectType
	inputs     map[string]*graph.InputObjectType
	interfaces map[string]*graph.InterfaceType
	unions     map[string]*graph.UnionType
	reachable  map[string]struct{}
}

func newReachabilityWalker(schema *graph.Schema) *reachabilityWalker {
	w := &reachabilityWalker{
		objects:    make(map[string]*graph.ObjectType, len(schema.Types)),
		inputs:     make(map[string]*graph.InputObjectType, len(schema.Inputs)),
		interfaces: make(map[string]*graph.InterfaceType, len(schema.Interfaces)),
		unions:     make(map[string]*graph.UnionType, len(schema.Unions)),
		reachable:  make(map[string]struct{}),
	}

	for _, t := range schema.Types {
		w.objects[t.Name] = t
	}

	for _, t := range schema.Inputs {
		w.inputs[t.Name] = t
	}

	for _, t := range schema.Interfaces {
		w.interfaces[t.Name] = t
	}

	for _, t := range schema.Unions {
		w.unions[t.Name] = t
	}

	return w
}

func (w *reachabilityWalker) visit(name string) {
	if name == "" {
		return
	}

	if _, ok := w.reachable[name]; ok {
		return
	}

	w.reachable[name] = struct{}{}

	if obj, ok := w.objects[name]; ok {
		visitFields(obj.Fields, w.visit)

		for _, iface := range obj.Interfaces {
			w.visit(iface)
		}
	}

	if inp, ok := w.inputs[name]; ok {
		for _, f := range inp.Fields {
			w.visit(graphBaseTypeName(f.Type))
		}
	}

	if iface, ok := w.interfaces[name]; ok {
		visitFields(iface.Fields, w.visit)

		for _, parent := range iface.Interfaces {
			w.visit(parent)
		}
	}

	if union, ok := w.unions[name]; ok {
		for _, member := range union.Types {
			w.visit(member)
		}
	}
}

// findReachableTypes walks the schema from root operations and directive arguments,
// returning the set of transitively reachable type names.
func findReachableTypes(schema *graph.Schema) map[string]struct{} {
	w := newReachabilityWalker(schema)

	if schema.QueryType != nil {
		w.visit(*schema.QueryType)
	}

	if schema.MutationType != nil {
		w.visit(*schema.MutationType)
	}

	if schema.SubscriptionType != nil {
		w.visit(*schema.SubscriptionType)
	}

	for _, dir := range schema.Directives {
		for _, arg := range dir.Arguments {
			w.visit(graphBaseTypeName(arg.Type))
		}
	}

	return w.reachable
}

func visitFields(fields []*graph.Field, visit func(string)) {
	for _, f := range fields {
		visit(graphBaseTypeName(f.Type))

		for _, arg := range f.Arguments {
			visit(graphBaseTypeName(arg.Type))
		}
	}
}

func filterTypes(types []*graph.ObjectType, reachable map[string]struct{}) []*graph.ObjectType {
	filtered := make([]*graph.ObjectType, 0, len(types))

	for _, t := range types {
		if _, ok := reachable[t.Name]; ok {
			filtered = append(filtered, t)
		}
	}

	return filtered
}

func filterInputs(
	inputs []*graph.InputObjectType,
	reachable map[string]struct{},
) []*graph.InputObjectType {
	filtered := make([]*graph.InputObjectType, 0, len(inputs))

	for _, t := range inputs {
		if _, ok := reachable[t.Name]; ok {
			filtered = append(filtered, t)
		}
	}

	return filtered
}

func filterScalars(scalars []*graph.ScalarType, reachable map[string]struct{}) []*graph.ScalarType {
	filtered := make([]*graph.ScalarType, 0, len(scalars))

	for _, t := range scalars {
		if _, ok := reachable[t.Name]; ok {
			filtered = append(filtered, t)
		}
	}

	return filtered
}

func filterEnums(enums []*graph.EnumType, reachable map[string]struct{}) []*graph.EnumType {
	filtered := make([]*graph.EnumType, 0, len(enums))

	for _, t := range enums {
		if _, ok := reachable[t.Name]; ok {
			filtered = append(filtered, t)
		}
	}

	return filtered
}

func filterInterfaces(
	ifaces []*graph.InterfaceType, reachable map[string]struct{},
) []*graph.InterfaceType {
	filtered := make([]*graph.InterfaceType, 0, len(ifaces))

	for _, t := range ifaces {
		if _, ok := reachable[t.Name]; ok {
			filtered = append(filtered, t)
		}
	}

	return filtered
}

func filterUnions(unions []*graph.UnionType, reachable map[string]struct{}) []*graph.UnionType {
	filtered := make([]*graph.UnionType, 0, len(unions))

	for _, t := range unions {
		if _, ok := reachable[t.Name]; ok {
			filtered = append(filtered, t)
		}
	}

	return filtered
}

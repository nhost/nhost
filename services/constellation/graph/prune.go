package graph

// PruneUnreachableTypes removes types from the schema that are not transitively
// reachable from the root operation types or directives.
// It replaces the schema's slices without modifying the underlying types.
func (s *Schema) PruneUnreachableTypes() {
	reachable := findReachableTypes(s)

	s.Types = filterTypes(s.Types, reachable)
	s.Inputs = filterInputs(s.Inputs, reachable)
	s.Scalars = filterScalars(s.Scalars, reachable)
	s.Enums = filterEnums(s.Enums, reachable)
	s.Interfaces = filterInterfaces(s.Interfaces, reachable)
	s.Unions = filterUnions(s.Unions, reachable)
}

// reachabilityWalker holds type lookup maps and walks type references transitively.
type reachabilityWalker struct {
	objects            map[string]*ObjectType
	inputs             map[string]*InputObjectType
	interfaces         map[string]*InterfaceType
	unions             map[string]*UnionType
	implementors       map[string][]string
	expandedInterfaces map[string]struct{}
	reachable          map[string]struct{}
}

func newReachabilityWalker(schema *Schema) *reachabilityWalker {
	w := &reachabilityWalker{
		objects:            make(map[string]*ObjectType, len(schema.Types)),
		inputs:             make(map[string]*InputObjectType, len(schema.Inputs)),
		interfaces:         make(map[string]*InterfaceType, len(schema.Interfaces)),
		unions:             make(map[string]*UnionType, len(schema.Unions)),
		implementors:       make(map[string][]string),
		expandedInterfaces: make(map[string]struct{}),
		reachable:          make(map[string]struct{}),
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

	for _, obj := range schema.Types {
		seen := make(map[string]struct{}, len(obj.Interfaces))
		for _, iface := range obj.Interfaces {
			w.addImplementor(iface, obj.Name, seen)
		}
	}

	return w
}

func (w *reachabilityWalker) addImplementor(
	interfaceName string,
	objectName string,
	seen map[string]struct{},
) {
	if interfaceName == "" {
		return
	}

	if _, ok := seen[interfaceName]; ok {
		return
	}

	seen[interfaceName] = struct{}{}
	w.implementors[interfaceName] = append(w.implementors[interfaceName], objectName)

	if iface, ok := w.interfaces[interfaceName]; ok {
		for _, parent := range iface.Interfaces {
			w.addImplementor(parent, objectName, seen)
		}
	}
}

// visitTypeReference follows a field, root, union member, or directive type
// reference. Interface references from these positions make their implementors
// reachable because the referenced interface can resolve to any implementor.
func (w *reachabilityWalker) visitTypeReference(name string) {
	w.visit(name, true)
}

// visitImplementedInterface follows an object/interface implements edge. The
// interface declaration is reachable, but sibling implementors are not.
func (w *reachabilityWalker) visitImplementedInterface(name string) {
	w.visit(name, false)
}

func (w *reachabilityWalker) visit(name string, expandInterfaceImplementors bool) {
	if name == "" {
		return
	}

	if _, ok := w.reachable[name]; !ok {
		w.reachable[name] = struct{}{}

		if obj, ok := w.objects[name]; ok {
			visitFields(obj.Fields, w.visitTypeReference)

			for _, iface := range obj.Interfaces {
				w.visitImplementedInterface(iface)
			}
		}

		if inp, ok := w.inputs[name]; ok {
			for _, f := range inp.Fields {
				w.visitTypeReference(f.Type.BaseName())
			}
		}

		if iface, ok := w.interfaces[name]; ok {
			visitFields(iface.Fields, w.visitTypeReference)

			for _, parent := range iface.Interfaces {
				w.visitImplementedInterface(parent)
			}
		}

		if union, ok := w.unions[name]; ok {
			for _, member := range union.Types {
				w.visitTypeReference(member)
			}
		}
	}

	if expandInterfaceImplementors {
		w.expandInterfaceImplementors(name)
	}
}

func (w *reachabilityWalker) expandInterfaceImplementors(name string) {
	if _, ok := w.interfaces[name]; !ok {
		return
	}

	if _, ok := w.expandedInterfaces[name]; ok {
		return
	}

	w.expandedInterfaces[name] = struct{}{}

	for _, impl := range w.implementors[name] {
		w.visitTypeReference(impl)
	}
}

// findReachableTypes walks the schema from root operations and directive arguments,
// returning the set of transitively reachable type names.
func findReachableTypes(schema *Schema) map[string]struct{} {
	w := newReachabilityWalker(schema)

	if schema.QueryType != nil {
		w.visitTypeReference(*schema.QueryType)
	}

	if schema.MutationType != nil {
		w.visitTypeReference(*schema.MutationType)
	}

	if schema.SubscriptionType != nil {
		w.visitTypeReference(*schema.SubscriptionType)
	}

	for _, dir := range schema.Directives {
		for _, arg := range dir.Arguments {
			w.visitTypeReference(arg.Type.BaseName())
		}
	}

	return w.reachable
}

func visitFields(fields []*Field, visit func(string)) {
	for _, f := range fields {
		visit(f.Type.BaseName())

		for _, arg := range f.Arguments {
			visit(arg.Type.BaseName())
		}
	}
}

func filterTypes(types []*ObjectType, reachable map[string]struct{}) []*ObjectType {
	filtered := make([]*ObjectType, 0, len(types))

	for _, t := range types {
		if _, ok := reachable[t.Name]; ok {
			filtered = append(filtered, t)
		}
	}

	return filtered
}

func filterInputs(
	inputs []*InputObjectType,
	reachable map[string]struct{},
) []*InputObjectType {
	filtered := make([]*InputObjectType, 0, len(inputs))

	for _, t := range inputs {
		if _, ok := reachable[t.Name]; ok {
			filtered = append(filtered, t)
		}
	}

	return filtered
}

func filterScalars(scalars []*ScalarType, reachable map[string]struct{}) []*ScalarType {
	filtered := make([]*ScalarType, 0, len(scalars))

	for _, t := range scalars {
		if _, ok := reachable[t.Name]; ok {
			filtered = append(filtered, t)
		}
	}

	return filtered
}

func filterEnums(enums []*EnumType, reachable map[string]struct{}) []*EnumType {
	filtered := make([]*EnumType, 0, len(enums))

	for _, t := range enums {
		if _, ok := reachable[t.Name]; ok {
			filtered = append(filtered, t)
		}
	}

	return filtered
}

func filterInterfaces(
	ifaces []*InterfaceType, reachable map[string]struct{},
) []*InterfaceType {
	filtered := make([]*InterfaceType, 0, len(ifaces))

	for _, t := range ifaces {
		if _, ok := reachable[t.Name]; ok {
			filtered = append(filtered, t)
		}
	}

	return filtered
}

func filterUnions(unions []*UnionType, reachable map[string]struct{}) []*UnionType {
	filtered := make([]*UnionType, 0, len(unions))

	for _, t := range unions {
		if _, ok := reachable[t.Name]; ok {
			filtered = append(filtered, t)
		}
	}

	return filtered
}

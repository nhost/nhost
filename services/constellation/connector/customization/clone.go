package customization

import "github.com/nhost/nhost/services/constellation/graph"

// cloneSchema returns a deep copy of s. Apply mutates names and type
// references throughout the schema in place, and connectors hand out shared
// schema pointers from GetSchema, so the transform must own a private copy to
// avoid corrupting the wrapped connector's schema.
func cloneSchema(s *graph.Schema) *graph.Schema {
	if s == nil {
		return nil
	}

	return &graph.Schema{
		Types:            cloneObjectTypes(s.Types),
		Scalars:          cloneScalars(s.Scalars),
		Enums:            cloneEnums(s.Enums),
		Interfaces:       cloneInterfaces(s.Interfaces),
		Unions:           cloneUnions(s.Unions),
		Inputs:           cloneInputs(s.Inputs),
		Directives:       cloneDirectiveDefs(s.Directives),
		QueryType:        cloneStringPtr(s.QueryType),
		MutationType:     cloneStringPtr(s.MutationType),
		SubscriptionType: cloneStringPtr(s.SubscriptionType),
	}
}

func cloneStringPtr(p *string) *string {
	if p == nil {
		return nil
	}

	v := *p

	return &v
}

func cloneType(t *graph.Type) *graph.Type {
	if t == nil {
		return nil
	}

	return &graph.Type{
		NamedType: t.NamedType,
		NonNull:   t.NonNull,
		Elem:      cloneType(t.Elem),
	}
}

func cloneObjectTypes(types []*graph.ObjectType) []*graph.ObjectType {
	if types == nil {
		return nil
	}

	out := make([]*graph.ObjectType, len(types))
	for i, t := range types {
		out[i] = &graph.ObjectType{
			Name:        t.Name,
			Description: t.Description,
			Fields:      cloneFields(t.Fields),
			Interfaces:  cloneStrings(t.Interfaces),
			Directives:  cloneDirectives(t.Directives),
		}
	}

	return out
}

func cloneFields(fields []*graph.Field) []*graph.Field {
	if fields == nil {
		return nil
	}

	out := make([]*graph.Field, len(fields))
	for i, f := range fields {
		out[i] = &graph.Field{
			Name:        f.Name,
			Description: f.Description,
			Type:        cloneType(f.Type),
			Arguments:   cloneArguments(f.Arguments),
			Directives:  cloneDirectives(f.Directives),
		}
	}

	return out
}

func cloneArguments(args []*graph.Argument) []*graph.Argument {
	if args == nil {
		return nil
	}

	out := make([]*graph.Argument, len(args))
	for i, a := range args {
		out[i] = &graph.Argument{
			Name:         a.Name,
			Description:  a.Description,
			Type:         cloneType(a.Type),
			DefaultValue: cloneStringPtr(a.DefaultValue),
			Directives:   cloneDirectives(a.Directives),
		}
	}

	return out
}

func cloneScalars(scalars []*graph.ScalarType) []*graph.ScalarType {
	if scalars == nil {
		return nil
	}

	out := make([]*graph.ScalarType, len(scalars))
	for i, s := range scalars {
		out[i] = &graph.ScalarType{
			Name:        s.Name,
			Description: s.Description,
			Directives:  cloneDirectives(s.Directives),
		}
	}

	return out
}

func cloneEnums(enums []*graph.EnumType) []*graph.EnumType {
	if enums == nil {
		return nil
	}

	out := make([]*graph.EnumType, len(enums))
	for i, e := range enums {
		values := make([]*graph.EnumValue, len(e.Values))
		for j, v := range e.Values {
			values[j] = &graph.EnumValue{
				Name:        v.Name,
				Description: v.Description,
				Directives:  cloneDirectives(v.Directives),
			}
		}

		out[i] = &graph.EnumType{
			Name:        e.Name,
			Description: e.Description,
			Values:      values,
			Directives:  cloneDirectives(e.Directives),
		}
	}

	return out
}

func cloneInterfaces(interfaces []*graph.InterfaceType) []*graph.InterfaceType {
	if interfaces == nil {
		return nil
	}

	out := make([]*graph.InterfaceType, len(interfaces))
	for i, iface := range interfaces {
		out[i] = &graph.InterfaceType{
			Name:        iface.Name,
			Description: iface.Description,
			Fields:      cloneFields(iface.Fields),
			Interfaces:  cloneStrings(iface.Interfaces),
			Directives:  cloneDirectives(iface.Directives),
		}
	}

	return out
}

func cloneUnions(unions []*graph.UnionType) []*graph.UnionType {
	if unions == nil {
		return nil
	}

	out := make([]*graph.UnionType, len(unions))
	for i, u := range unions {
		out[i] = &graph.UnionType{
			Name:        u.Name,
			Description: u.Description,
			Types:       cloneStrings(u.Types),
			Directives:  cloneDirectives(u.Directives),
		}
	}

	return out
}

func cloneInputs(inputs []*graph.InputObjectType) []*graph.InputObjectType {
	if inputs == nil {
		return nil
	}

	out := make([]*graph.InputObjectType, len(inputs))
	for i, in := range inputs {
		fields := make([]*graph.InputField, len(in.Fields))
		for j, f := range in.Fields {
			fields[j] = &graph.InputField{
				Name:         f.Name,
				Description:  f.Description,
				Type:         cloneType(f.Type),
				DefaultValue: cloneStringPtr(f.DefaultValue),
				Directives:   cloneDirectives(f.Directives),
			}
		}

		out[i] = &graph.InputObjectType{
			Name:        in.Name,
			Description: in.Description,
			Fields:      fields,
			Directives:  cloneDirectives(in.Directives),
		}
	}

	return out
}

func cloneDirectiveDefs(defs []*graph.DirectiveDefinition) []*graph.DirectiveDefinition {
	if defs == nil {
		return nil
	}

	out := make([]*graph.DirectiveDefinition, len(defs))
	for i, d := range defs {
		out[i] = &graph.DirectiveDefinition{
			Name:        d.Name,
			Description: d.Description,
			Arguments:   cloneArguments(d.Arguments),
			Locations:   append([]graph.DirectiveLocation(nil), d.Locations...),
			Repeatable:  d.Repeatable,
		}
	}

	return out
}

func cloneDirectives(directives []*graph.Directive) []*graph.Directive {
	if directives == nil {
		return nil
	}

	out := make([]*graph.Directive, len(directives))
	for i, d := range directives {
		args := make([]*graph.DirectiveArgument, len(d.Arguments))
		for j, a := range d.Arguments {
			args[j] = &graph.DirectiveArgument{Name: a.Name, Value: a.Value}
		}

		out[i] = &graph.Directive{Name: d.Name, Arguments: args}
	}

	return out
}

func cloneStrings(in []string) []string {
	if in == nil {
		return nil
	}

	return append([]string(nil), in...)
}

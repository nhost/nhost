package remoteschema

import (
	"fmt"

	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
)

// presetArg represents a preset argument that should be injected during execution.
type presetArg struct {
	ArgumentName string
	Value        string // Literal value or session variable (x-hasura-*)
}

// presetDirectiveSDL defines the @preset directive used in remote schema permissions.
const presetDirectiveSDL = `
directive @preset(value: String!) on ARGUMENT_DEFINITION
`

// parseSDL parses a GraphQL SDL string into an intermediate schema representation.
// It extracts @preset directives from arguments and returns them separately.
// Arguments with @preset are hidden from the exposed schema (for non-admin roles).
func parseSDL(sdl string) (*graph.Schema, map[string][]presetArg, error) {
	fullSDL := presetDirectiveSDL + sdl

	source := &ast.Source{ //nolint:exhaustruct
		Name:  "remote_schema",
		Input: fullSDL,
	}

	doc, parseErr := gqlparser.LoadSchema(source)
	if parseErr != nil {
		return nil, nil, fmt.Errorf("failed to parse SDL: %w", parseErr)
	}

	schema, presets := convertToGraphSchema(doc)

	pruneUnreachableTypes(schema)

	return schema, presets, nil
}

// convertToGraphSchema converts a gqlparser Schema to graph.Schema,
// extracting @preset directives along the way.
func convertToGraphSchema(doc *ast.Schema) (*graph.Schema, map[string][]presetArg) {
	schema := &graph.Schema{
		Types:            nil,
		Scalars:          nil,
		Enums:            nil,
		Interfaces:       nil,
		Unions:           nil,
		Inputs:           nil,
		Directives:       nil,
		QueryType:        nil,
		MutationType:     nil,
		SubscriptionType: nil,
	}
	presets := make(map[string][]presetArg)

	if doc.Query != nil {
		schema.QueryType = &doc.Query.Name
	}

	if doc.Mutation != nil {
		schema.MutationType = &doc.Mutation.Name
	}

	if doc.Subscription != nil {
		schema.SubscriptionType = &doc.Subscription.Name
	}

	for _, typ := range doc.Types {
		if isBuiltinType(typ.Name) {
			continue
		}

		switch typ.Kind {
		case ast.Scalar:
			schema.Scalars = append(schema.Scalars, convertSDLScalar(typ))
		case ast.Enum:
			schema.Enums = append(schema.Enums, convertSDLEnum(typ))
		case ast.Interface:
			schema.Interfaces = append(schema.Interfaces, convertSDLInterface(typ))
		case ast.Union:
			schema.Unions = append(schema.Unions, convertSDLUnion(typ))
		case ast.InputObject:
			schema.Inputs = append(schema.Inputs, convertSDLInput(typ))
		case ast.Object:
			schema.Types = append(schema.Types, convertSDLObject(typ, presets))
		}
	}

	return schema, presets
}

func convertSDLScalar(typ *ast.Definition) *graph.ScalarType {
	return &graph.ScalarType{
		Name:        typ.Name,
		Description: typ.Description,
		Directives:  nil,
	}
}

func convertSDLEnum(typ *ast.Definition) *graph.EnumType {
	values := make([]*graph.EnumValue, len(typ.EnumValues))
	for i, val := range typ.EnumValues {
		values[i] = &graph.EnumValue{
			Name:        val.Name,
			Description: val.Description,
			Directives:  nil,
		}
	}

	return &graph.EnumType{
		Name:        typ.Name,
		Description: typ.Description,
		Values:      values,
		Directives:  nil,
	}
}

func convertSDLInterface(typ *ast.Definition) *graph.InterfaceType {
	return &graph.InterfaceType{
		Name:        typ.Name,
		Description: typ.Description,
		Fields:      convertFields(typ.Fields, nil),
		Interfaces:  typ.Interfaces,
		Directives:  nil,
	}
}

func convertSDLUnion(typ *ast.Definition) *graph.UnionType {
	return &graph.UnionType{
		Name:        typ.Name,
		Description: typ.Description,
		Types:       typ.Types,
		Directives:  nil,
	}
}

func convertSDLInput(typ *ast.Definition) *graph.InputObjectType {
	return &graph.InputObjectType{
		Name:        typ.Name,
		Description: typ.Description,
		Fields:      convertInputFields(typ.Fields),
		Directives:  nil,
	}
}

func convertSDLObject(typ *ast.Definition, presets map[string][]presetArg) *graph.ObjectType {
	fieldPresets := make(map[string][]presetArg)
	fields := convertFields(typ.Fields, fieldPresets)

	for fieldName, args := range fieldPresets {
		key := typ.Name + "." + fieldName
		presets[key] = args
	}

	return &graph.ObjectType{
		Name:        typ.Name,
		Description: typ.Description,
		Fields:      fields,
		Interfaces:  typ.Interfaces,
		Directives:  nil,
	}
}

// convertFields converts ast.FieldList to []*graph.Field, extracting presets.
// It filters out fields that start with "__" (introspection fields).
// Arguments with @preset are hidden from the schema and returned via the presets map.
func convertFields(
	fields ast.FieldList,
	presets map[string][]presetArg,
) []*graph.Field {
	result := make([]*graph.Field, 0, len(fields))

	for _, f := range fields {
		if len(f.Name) > 0 && f.Name[0] == '_' && len(f.Name) > 1 && f.Name[1] == '_' {
			continue
		}

		var fieldPresets []presetArg

		args := make([]*graph.Argument, 0, len(f.Arguments))

		for _, arg := range f.Arguments {
			presetValue := extractPresetValue(arg.Directives)
			if presetValue != "" {
				fieldPresets = append(fieldPresets, presetArg{
					ArgumentName: arg.Name,
					Value:        presetValue,
				})

				continue
			}

			// Hide @preset from the exposed schema: presets are server-side-only
			// policy values; surfacing them to clients would leak the policy.
			filteredDirectives := filterPresetDirective(arg.Directives)

			args = append(args, &graph.Argument{
				Name:         arg.Name,
				Description:  arg.Description,
				Type:         convertType(arg.Type),
				DefaultValue: convertDefaultValue(arg.DefaultValue),
				Directives:   convertDirectives(filteredDirectives),
			})
		}

		if presets != nil && len(fieldPresets) > 0 {
			presets[f.Name] = fieldPresets
		}

		result = append(result, &graph.Field{
			Name:        f.Name,
			Description: f.Description,
			Type:        convertType(f.Type),
			Arguments:   args,
			Directives:  convertDirectives(filterPresetDirective(f.Directives)),
		})
	}

	return result
}

// convertInputFields converts ast.FieldList to []*graph.InputField.
func convertInputFields(fields ast.FieldList) []*graph.InputField {
	result := make([]*graph.InputField, len(fields))

	for i, f := range fields {
		result[i] = &graph.InputField{
			Name:         f.Name,
			Description:  f.Description,
			Type:         convertType(f.Type),
			DefaultValue: convertDefaultValue(f.DefaultValue),
			Directives:   convertDirectives(f.Directives),
		}
	}

	return result
}

// convertType converts ast.Type to graph.Type.
func convertType(t *ast.Type) *graph.Type {
	if t == nil {
		return nil
	}

	result := &graph.Type{
		NamedType: "",
		NonNull:   t.NonNull,
		Elem:      nil,
	}

	if t.Elem != nil {
		result.Elem = convertType(t.Elem)
	} else {
		result.NamedType = t.NamedType
	}

	return result
}

// convertDefaultValue converts ast.Value to a string pointer.
func convertDefaultValue(v *ast.Value) *string {
	if v == nil {
		return nil
	}

	raw := v.Raw

	return &raw
}

// convertDirectives converts ast.DirectiveList to []*graph.Directive.
func convertDirectives(directives ast.DirectiveList) []*graph.Directive {
	if len(directives) == 0 {
		return nil
	}

	result := make([]*graph.Directive, len(directives))

	for i, d := range directives {
		args := make([]*graph.DirectiveArgument, len(d.Arguments))
		for j, arg := range d.Arguments {
			args[j] = &graph.DirectiveArgument{
				Name:  arg.Name,
				Value: arg.Value.Raw,
			}
		}

		result[i] = &graph.Directive{
			Name:      d.Name,
			Arguments: args,
		}
	}

	return result
}

// extractPresetValue extracts the value from a @preset directive if present.
func extractPresetValue(directives ast.DirectiveList) string {
	for _, d := range directives {
		if d.Name == "preset" {
			for _, arg := range d.Arguments {
				if arg.Name == "value" {
					return arg.Value.Raw
				}
			}
		}
	}

	return ""
}

// filterPresetDirective removes @preset directives from the list.
func filterPresetDirective(directives ast.DirectiveList) ast.DirectiveList {
	result := make(ast.DirectiveList, 0, len(directives))

	for _, d := range directives {
		if d.Name != "preset" {
			result = append(result, d)
		}
	}

	return result
}

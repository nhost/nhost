package hasura

import (
	"errors"
	"fmt"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
)

const (
	loadDiagnosticKindAction     = "action"
	loadDiagnosticKindCustomType = "custom_type"
	defaultDeprecatedReason      = "No longer supported"
)

var (
	errActionSDLRequired = errors.New(
		"actions.graphql is required for action signatures/custom-type fields",
	)
	errActionSDLSignatureMissing = errors.New("actions.graphql has no signature for action")
)

type actionsYAMLMetadata struct {
	Actions     []ActionMetadata `yaml:"actions"`
	CustomTypes CustomTypes      `yaml:"custom_types"`
}

type actionSDLMetadata struct {
	actions     map[string]ActionDefinition
	customTypes CustomTypes
}

func parseActionSDL(data []byte) (*actionSDLMetadata, error) {
	doc, err := parser.ParseSchema(&ast.Source{
		Name:    "actions.graphql",
		Input:   string(data),
		BuiltIn: false,
	})
	if err != nil {
		return nil, fmt.Errorf("parsing actions.graphql SDL: %w", err)
	}

	parsed := &actionSDLMetadata{
		actions:     make(map[string]ActionDefinition),
		customTypes: emptyCustomTypes(),
	}

	for _, def := range doc.Definitions {
		if def == nil {
			continue
		}

		switch def.Kind {
		case ast.Object:
			parsed.collectObjectDefinition(def)
		case ast.InputObject:
			parsed.customTypes.InputObjects = append(
				parsed.customTypes.InputObjects,
				convertSDLInputObject(def),
			)
		case ast.Scalar:
			parsed.customTypes.Scalars = append(
				parsed.customTypes.Scalars,
				CustomScalarType{Name: def.Name, Description: def.Description},
			)
		case ast.Enum:
			parsed.customTypes.Enums = append(
				parsed.customTypes.Enums,
				convertSDLEnum(def),
			)
		case ast.Interface, ast.Union:
			// Hasura action custom types do not support interfaces or unions.
		}
	}

	return parsed, nil
}

func (m *actionSDLMetadata) collectObjectDefinition(def *ast.Definition) {
	switch def.Name {
	case "Query":
		m.collectRootFields(def, ActionOperationQuery)
	case "Mutation":
		m.collectRootFields(def, ActionOperationMutation)
	case "Subscription":
		// Hasura actions are exposed through Query or Mutation roots only.
		return
	default:
		m.customTypes.Objects = append(m.customTypes.Objects, convertSDLObject(def))
	}
}

func (m *actionSDLMetadata) collectRootFields(def *ast.Definition, operationType string) {
	for _, field := range def.Fields {
		if field == nil {
			continue
		}

		m.actions[field.Name] = ActionDefinition{
			Kind:                 "",
			Handler:              "",
			ForwardClientHeaders: false,
			Headers:              nil,
			Timeout:              0,
			Type:                 operationType,
			Arguments:            convertSDLArguments(field.Arguments),
			OutputType:           field.Type.String(),
			RequestTransform:     nil,
			ResponseTransform:    nil,
		}
	}
}

func convertSDLArguments(args ast.ArgumentDefinitionList) []ActionArgument {
	out := make([]ActionArgument, 0, len(args))
	for _, arg := range args {
		if arg == nil {
			continue
		}

		out = append(out, ActionArgument{
			Name:        arg.Name,
			Type:        arg.Type.String(),
			Description: arg.Description,
		})
	}

	return out
}

func convertSDLFields(fields ast.FieldList) []CustomTypeField {
	out := make([]CustomTypeField, 0, len(fields))
	for _, field := range fields {
		if field == nil {
			continue
		}

		out = append(out, CustomTypeField{
			Name:        field.Name,
			Type:        field.Type.String(),
			Description: field.Description,
		})
	}

	return out
}

func convertSDLObject(def *ast.Definition) CustomObjectType {
	return CustomObjectType{
		Name:          def.Name,
		Description:   def.Description,
		Fields:        convertSDLFields(def.Fields),
		Relationships: nil,
	}
}

func convertSDLInputObject(def *ast.Definition) CustomInputObjectType {
	return CustomInputObjectType{
		Name:        def.Name,
		Description: def.Description,
		Fields:      convertSDLFields(def.Fields),
	}
}

func convertSDLEnum(def *ast.Definition) CustomEnumType {
	values := make([]CustomEnumValue, 0, len(def.EnumValues))
	for _, value := range def.EnumValues {
		if value == nil {
			continue
		}

		values = append(values, convertSDLEnumValue(value))
	}

	return CustomEnumType{
		Name:        def.Name,
		Description: def.Description,
		Values:      values,
	}
}

func convertSDLEnumValue(value *ast.EnumValueDefinition) CustomEnumValue {
	out := CustomEnumValue{
		Value:             value.Name,
		Description:       value.Description,
		IsDeprecated:      false,
		DeprecationReason: "",
	}

	deprecated := value.Directives.ForName("deprecated")
	if deprecated == nil {
		return out
	}

	out.IsDeprecated = true
	out.DeprecationReason = defaultDeprecatedReason

	if reason := deprecated.Arguments.ForName("reason"); reason != nil && reason.Value != nil {
		out.DeprecationReason = reason.Value.Raw
	}

	return out
}

func mergeActionsYAMLWithSDL(actions *actionsYAMLMetadata, sdl *actionSDLMetadata) error {
	if sdl == nil {
		if actionsNeedSDL(actions.Actions) || customTypesNeedSDL(actions.CustomTypes) {
			return errActionSDLRequired
		}

		return nil
	}

	for i := range actions.Actions {
		action := &actions.Actions[i]

		signature, ok := sdl.actions[action.Name]
		if !ok {
			if actionDefinitionNeedsSDL(action.Definition) {
				return fmt.Errorf("%w %q", errActionSDLSignatureMissing, action.Name)
			}

			continue
		}

		mergeActionDefinitionSignature(&action.Definition, signature)
	}

	mergeCustomTypesFromSDL(&actions.CustomTypes, sdl.customTypes)

	return nil
}

func actionsNeedSDL(actions []ActionMetadata) bool {
	for _, action := range actions {
		if actionDefinitionNeedsSDL(action.Definition) {
			return true
		}
	}

	return false
}

func actionDefinitionNeedsSDL(def ActionDefinition) bool {
	return def.Type == "" || def.OutputType == ""
}

func customTypesNeedSDL(customTypes CustomTypes) bool {
	for _, object := range customTypes.Objects {
		if len(object.Fields) == 0 {
			return true
		}
	}

	for _, input := range customTypes.InputObjects {
		if len(input.Fields) == 0 {
			return true
		}
	}

	for _, enum := range customTypes.Enums {
		if len(enum.Values) == 0 {
			return true
		}
	}

	return false
}

func mergeActionDefinitionSignature(dst *ActionDefinition, signature ActionDefinition) {
	if dst.Type == "" {
		dst.Type = signature.Type
	}

	if len(dst.Arguments) == 0 {
		dst.Arguments = signature.Arguments
	}

	if dst.OutputType == "" {
		dst.OutputType = signature.OutputType
	}
}

func mergeCustomTypesFromSDL(dst *CustomTypes, src CustomTypes) {
	for _, object := range src.Objects {
		mergeSDLObject(dst, object)
	}

	for _, input := range src.InputObjects {
		mergeSDLInputObject(dst, input)
	}

	for _, scalar := range src.Scalars {
		if !hasScalar(dst.Scalars, scalar.Name) {
			dst.Scalars = append(dst.Scalars, scalar)
		}
	}

	for _, enum := range src.Enums {
		mergeSDLEnum(dst, enum)
	}
}

func mergeSDLObject(dst *CustomTypes, src CustomObjectType) {
	for i := range dst.Objects {
		if dst.Objects[i].Name != src.Name {
			continue
		}

		if dst.Objects[i].Description == "" {
			dst.Objects[i].Description = src.Description
		}

		if len(dst.Objects[i].Fields) == 0 {
			dst.Objects[i].Fields = src.Fields
		}

		return
	}

	dst.Objects = append(dst.Objects, src)
}

func mergeSDLInputObject(dst *CustomTypes, src CustomInputObjectType) {
	for i := range dst.InputObjects {
		if dst.InputObjects[i].Name != src.Name {
			continue
		}

		if dst.InputObjects[i].Description == "" {
			dst.InputObjects[i].Description = src.Description
		}

		if len(dst.InputObjects[i].Fields) == 0 {
			dst.InputObjects[i].Fields = src.Fields
		}

		return
	}

	dst.InputObjects = append(dst.InputObjects, src)
}

func mergeSDLEnum(dst *CustomTypes, src CustomEnumType) {
	for i := range dst.Enums {
		if dst.Enums[i].Name != src.Name {
			continue
		}

		if dst.Enums[i].Description == "" {
			dst.Enums[i].Description = src.Description
		}

		if len(dst.Enums[i].Values) == 0 {
			dst.Enums[i].Values = src.Values
		}

		return
	}

	dst.Enums = append(dst.Enums, src)
}

func hasScalar(scalars []CustomScalarType, name string) bool {
	for _, scalar := range scalars {
		if scalar.Name == name {
			return true
		}
	}

	return false
}

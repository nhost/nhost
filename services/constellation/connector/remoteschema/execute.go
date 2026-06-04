package remoteschema

import (
	"bytes"
	"context"
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/formatter"
	"github.com/vektah/gqlparser/v2/parser"
)

// graphQLRequest represents a GraphQL request to send to the remote server.
type graphQLRequest struct {
	Query     string         `json:"query"`
	Variables map[string]any `json:"variables,omitempty"`
}

// graphQLResponse represents a response from a GraphQL server.
type graphQLResponse struct {
	Data   map[string]any `json:"data,omitempty"`
	Errors []RemoteError  `json:"errors,omitempty"`
}

// applyPresets modifies an operation to inject preset argument values.
// rootTypeName must be the role schema's actual root type name, since preset
// keys are extracted from the permission SDL's type names. It clones the
// operation to avoid mutating the original.
func applyPresets(
	operation *ast.OperationDefinition,
	presets map[string][]presetArg,
	sessionVariables map[string]any,
	rootTypeName string,
) *ast.OperationDefinition {
	if operation == nil || len(presets) == 0 {
		return operation
	}

	cloned := cloneOperation(operation)
	if rootTypeName == "" {
		rootTypeName = defaultRootTypeName(cloned.Operation)
	}

	applyPresetsToSelectionSet(cloned.SelectionSet, rootTypeName, presets, sessionVariables)

	return cloned
}

func defaultRootTypeName(op ast.Operation) string {
	switch op {
	case ast.Query:
		return "Query" //nolint:goconst,nolintlint
	case ast.Mutation:
		return "Mutation" //nolint:goconst,nolintlint
	case ast.Subscription:
		return "Subscription" //nolint:goconst,nolintlint
	default:
		return "Query" //nolint:goconst,nolintlint
	}
}

// applyPresetsToSelectionSet recursively applies presets to a selection set.
// Nested-field presets require the operation to have been validated so that
// sel.Definition is populated; without it we cannot determine the nested type
// name and presets on nested fields are silently skipped.
func applyPresetsToSelectionSet(
	selectionSet ast.SelectionSet,
	typeName string,
	presets map[string][]presetArg,
	sessionVariables map[string]any,
) {
	for _, selection := range selectionSet {
		switch sel := selection.(type) {
		case *ast.Field:
			key := typeName + "." + sel.Name
			if fieldPresets, ok := presets[key]; ok {
				applyFieldPresets(sel, fieldPresets, sessionVariables)
			}

			if len(sel.SelectionSet) > 0 && sel.Definition != nil && sel.Definition.Type != nil {
				nestedTypeName := getBaseTypeName(sel.Definition.Type)
				applyPresetsToSelectionSet(
					sel.SelectionSet,
					nestedTypeName,
					presets,
					sessionVariables,
				)
			}

		case *ast.InlineFragment:
			fragmentTypeName := typeName
			if sel.TypeCondition != "" {
				fragmentTypeName = sel.TypeCondition
			}

			applyPresetsToSelectionSet(
				sel.SelectionSet,
				fragmentTypeName,
				presets,
				sessionVariables,
			)

		case *ast.FragmentSpread:
			continue
		}
	}
}

func getBaseTypeName(t *ast.Type) string {
	if t == nil {
		return ""
	}

	if t.NamedType != "" {
		return t.NamedType
	}

	return getBaseTypeName(t.Elem)
}

// applyFieldPresets applies preset values to a field's arguments.
func applyFieldPresets(
	field *ast.Field,
	presets []presetArg,
	sessionVariables map[string]any,
) {
	for _, preset := range presets {
		value := resolvePresetArgumentValue(preset, sessionVariables)
		found := false

		for _, arg := range field.Arguments {
			if arg.Name == preset.ArgumentName {
				arg.Value = value
				found = true

				break
			}
		}

		if !found {
			field.Arguments = append(field.Arguments, &ast.Argument{ //nolint:exhaustruct
				Name:  preset.ArgumentName,
				Value: value,
			})
		}
	}
}

func resolvePresetArgumentValue(
	preset presetArg,
	sessionVariables map[string]any,
) *ast.Value {
	if preset.SessionVariable != "" {
		return presetValueForTarget(
			createStringValue(resolveSessionVariable(preset.SessionVariable, sessionVariables)),
			preset.Type,
			preset.TargetKind,
		)
	}

	return presetValueForTarget(preset.Value, preset.Type, preset.TargetKind)
}

func resolveSessionVariable(name string, sessionVariables map[string]any) string {
	if val, found := sessionVariables[name]; found {
		return fmt.Sprintf("%v", val)
	}

	return ""
}

func presetValueForTarget(
	value *ast.Value,
	targetType *ast.Type,
	targetKind ast.DefinitionKind,
) *ast.Value {
	if value == nil {
		return createNullValue()
	}

	if isListType(targetType) {
		return coercePresetValue(value, ast.ListValue)
	}

	switch getBaseTypeName(targetType) {
	case "String", "ID":
		return createStringValue(valueString(value))
	case "Int":
		return coercePresetValue(value, ast.IntValue)
	case "Float":
		return coercePresetValue(value, ast.FloatValue)
	case "Boolean":
		return coercePresetValue(value, ast.BooleanValue)
	}

	switch targetKind {
	case ast.Enum:
		return coercePresetValue(value, ast.EnumValue)
	case ast.InputObject:
		return coercePresetValue(value, ast.ObjectValue)
	case ast.Scalar:
		if value.Kind == ast.StringValue || value.Kind == ast.BlockValue {
			return createStringValue(value.Raw)
		}
	case ast.Object, ast.Interface, ast.Union:
		return cloneValue(value)
	}

	return cloneValue(value)
}

func coercePresetValue(value *ast.Value, kind ast.ValueKind) *ast.Value {
	if value.Kind == ast.NullValue {
		return cloneValue(value)
	}

	// GraphQL input coercion allows an Int literal where a Float is expected.
	if value.Kind == kind || (kind == ast.FloatValue && value.Kind == ast.IntValue) {
		return cloneValue(value)
	}

	if value.Kind != ast.StringValue && value.Kind != ast.BlockValue {
		return cloneValue(value)
	}

	if value.Raw == "" {
		return createNullValue()
	}

	parsed := parsePresetValue(value.Raw)
	if parsed == nil {
		return createStringValue(value.Raw)
	}

	// GraphQL input coercion allows an Int literal where a Float is expected.
	if parsed.Kind == kind || (kind == ast.FloatValue && parsed.Kind == ast.IntValue) {
		return parsed
	}

	return createStringValue(value.Raw)
}

func parsePresetValue(raw string) *ast.Value {
	doc, err := parser.ParseQuery(&ast.Source{ //nolint:exhaustruct
		Name:  "preset_value",
		Input: "query { preset(value: " + raw + ") }",
	})
	if err != nil || len(doc.Operations) != 1 {
		return nil
	}

	if len(doc.Operations[0].SelectionSet) != 1 {
		return nil
	}

	field, ok := doc.Operations[0].SelectionSet[0].(*ast.Field)
	if !ok || field.Name != presetDirectiveName || len(field.Arguments) != 1 ||
		len(field.Directives) != 0 || len(field.SelectionSet) != 0 {
		return nil
	}

	arg := field.Arguments.ForName("value")
	if arg == nil {
		return nil
	}

	return cloneValue(arg.Value)
}

func isListType(t *ast.Type) bool {
	return t != nil && t.Elem != nil
}

func valueString(value *ast.Value) string {
	if value == nil {
		return ""
	}

	if value.Kind == ast.StringValue || value.Kind == ast.BlockValue {
		return value.Raw
	}

	return value.String()
}

func createStringValue(s string) *ast.Value {
	return &ast.Value{ //nolint:exhaustruct
		Raw:  s,
		Kind: ast.StringValue,
	}
}

func createNullValue() *ast.Value {
	return &ast.Value{ //nolint:exhaustruct
		Raw:  "null",
		Kind: ast.NullValue,
	}
}

// cloneOperation deep-copies an operation definition so callers can mutate
// the clone without affecting the planner's shared AST. The clone* helpers
// below recursively copy every reachable node so that preset injection can
// safely overwrite argument values on the returned tree.
func cloneOperation(op *ast.OperationDefinition) *ast.OperationDefinition {
	if op == nil {
		return nil
	}

	cloned := &ast.OperationDefinition{ //nolint:exhaustruct
		Operation:           op.Operation,
		Name:                op.Name,
		VariableDefinitions: cloneVariableDefinitions(op.VariableDefinitions),
		Directives:          cloneDirectives(op.Directives),
		SelectionSet:        cloneSelectionSet(op.SelectionSet),
	}

	return cloned
}

func cloneVariableDefinitions(defs ast.VariableDefinitionList) ast.VariableDefinitionList {
	if defs == nil {
		return nil
	}

	result := make(ast.VariableDefinitionList, len(defs))

	for i, def := range defs {
		result[i] = &ast.VariableDefinition{ //nolint:exhaustruct
			Variable:     def.Variable,
			Type:         def.Type, // Types are immutable, no need to clone
			DefaultValue: cloneValue(def.DefaultValue),
			Directives:   cloneDirectives(def.Directives),
		}
	}

	return result
}

func cloneDirectives(directives ast.DirectiveList) ast.DirectiveList {
	if directives == nil {
		return nil
	}

	result := make(ast.DirectiveList, len(directives))

	for i, d := range directives {
		result[i] = &ast.Directive{ //nolint:exhaustruct
			Name:      d.Name,
			Arguments: cloneArguments(d.Arguments),
		}
	}

	return result
}

func cloneSelectionSet(ss ast.SelectionSet) ast.SelectionSet {
	if ss == nil {
		return nil
	}

	result := make(ast.SelectionSet, len(ss))

	for i, sel := range ss {
		switch s := sel.(type) {
		case *ast.Field:
			result[i] = &ast.Field{ //nolint:exhaustruct
				Alias:            s.Alias,
				Name:             s.Name,
				Arguments:        cloneArguments(s.Arguments),
				Directives:       cloneDirectives(s.Directives),
				SelectionSet:     cloneSelectionSet(s.SelectionSet),
				Definition:       s.Definition,
				ObjectDefinition: s.ObjectDefinition,
			}
		case *ast.InlineFragment:
			result[i] = &ast.InlineFragment{ //nolint:exhaustruct
				TypeCondition:    s.TypeCondition,
				Directives:       cloneDirectives(s.Directives),
				SelectionSet:     cloneSelectionSet(s.SelectionSet),
				ObjectDefinition: s.ObjectDefinition,
			}
		case *ast.FragmentSpread:
			result[i] = &ast.FragmentSpread{ //nolint:exhaustruct
				Name:       s.Name,
				Directives: cloneDirectives(s.Directives),
				Definition: s.Definition,
			}
		default:
			result[i] = sel
		}
	}

	return result
}

func cloneArguments(args ast.ArgumentList) ast.ArgumentList {
	if args == nil {
		return nil
	}

	result := make(ast.ArgumentList, len(args))

	for i, arg := range args {
		result[i] = &ast.Argument{ //nolint:exhaustruct
			Name:  arg.Name,
			Value: cloneValue(arg.Value),
		}
	}

	return result
}

func cloneValue(v *ast.Value) *ast.Value {
	if v == nil {
		return nil
	}

	cloned := &ast.Value{ //nolint:exhaustruct
		Raw:      v.Raw,
		Kind:     v.Kind,
		Position: v.Position,
	}

	if v.Children != nil {
		cloned.Children = make(ast.ChildValueList, len(v.Children))

		for i, child := range v.Children {
			cloned.Children[i] = &ast.ChildValue{ //nolint:exhaustruct
				Name:  child.Name,
				Value: cloneValue(child.Value),
			}
		}
	}

	return cloned
}

func buildQueryString(
	operation *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
) string {
	doc := &ast.QueryDocument{ //nolint:exhaustruct
		Operations: ast.OperationList{operation},
		Fragments:  fragments,
	}

	var buf bytes.Buffer

	f := formatter.NewFormatter(&buf)
	f.FormatQueryDocument(doc)

	return buf.String()
}

// executeRemoteQuery sends a GraphQL query to the remote endpoint.
func (c *Connector) executeRemoteQuery(
	ctx context.Context,
	query string,
	variables map[string]any,
	sessionVariables map[string]any,
	clientHeaders http.Header,
	logger *slog.Logger,
) (map[string]any, error) {
	logger.DebugContext(
		ctx, "executing remote query",
		slog.String("query", query),
	)

	body, err := c.httpClient.do(ctx, graphQLRequest{
		Query:     query,
		Variables: variables,
	}, sessionVariables, clientHeaders)
	if err != nil {
		return nil, fmt.Errorf("sending GraphQL request: %w", err)
	}

	var gqlResp graphQLResponse
	if err := json.Unmarshal(
		body, &gqlResp,
		jsontext.AllowDuplicateNames(true),
		jsontext.AllowInvalidUTF8(true),
	); err != nil {
		return nil, fmt.Errorf("parsing response: %w", err)
	}

	if len(gqlResp.Errors) > 0 {
		// Return data (for partial responses) and structured errors separately.
		// The caller merges data by field name and collects errors in the
		// top-level errors array.
		return gqlResp.Data, NewGraphQLError(gqlResp.Errors)
	}

	return gqlResp.Data, nil
}

package remoteschema

import (
	"bytes"
	"context"
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/formatter"
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
		resolvedValue := resolvePresetValue(preset.Value, sessionVariables)

		found := false

		for _, arg := range field.Arguments {
			if arg.Name == preset.ArgumentName {
				arg.Value = createStringValue(resolvedValue)
				found = true

				break
			}
		}

		if !found {
			field.Arguments = append(field.Arguments, &ast.Argument{ //nolint:exhaustruct
				Name:  preset.ArgumentName,
				Value: createStringValue(resolvedValue),
			})
		}
	}
}

// resolvePresetValue resolves a preset value, substituting session variables if needed.
func resolvePresetValue(value string, sessionVariables map[string]any) string {
	if strings.HasPrefix(strings.ToLower(value), "x-hasura-") {
		varName := strings.ToLower(value)

		if val, found := sessionVariables[varName]; found {
			return fmt.Sprintf("%v", val)
		}

		return ""
	}

	return value
}

func createStringValue(s string) *ast.Value {
	return &ast.Value{ //nolint:exhaustruct
		Raw:  s,
		Kind: ast.StringValue,
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
		result[i] = cloneSelection(sel)
	}

	return result
}

func cloneSelection(sel ast.Selection) ast.Selection { //nolint:ireturn,nolintlint
	switch s := sel.(type) {
	case *ast.Field:
		return &ast.Field{ //nolint:exhaustruct
			Alias:            s.Alias,
			Name:             s.Name,
			Arguments:        cloneArguments(s.Arguments),
			Directives:       cloneDirectives(s.Directives),
			SelectionSet:     cloneSelectionSet(s.SelectionSet),
			Definition:       s.Definition,
			ObjectDefinition: s.ObjectDefinition,
		}
	case *ast.InlineFragment:
		return &ast.InlineFragment{ //nolint:exhaustruct
			TypeCondition:    s.TypeCondition,
			Directives:       cloneDirectives(s.Directives),
			SelectionSet:     cloneSelectionSet(s.SelectionSet),
			ObjectDefinition: s.ObjectDefinition,
		}
	case *ast.FragmentSpread:
		return &ast.FragmentSpread{ //nolint:exhaustruct
			Name:       s.Name,
			Directives: cloneDirectives(s.Directives),
			Definition: s.Definition,
		}
	default:
		return sel
	}
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

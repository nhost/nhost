package action

import (
	"context"
	json "encoding/json/v2"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/nhost/nhost/services/constellation/internal/requestcontext"
	"github.com/vektah/gqlparser/v2/ast"
)

type actionPayload struct {
	Action           actionPayloadName `json:"action"`
	Input            map[string]any    `json:"input"`
	SessionVariables map[string]any    `json:"session_variables"`
	RequestQuery     string            `json:"request_query"`
}

type actionPayloadName struct {
	Name string `json:"name"`
}

type actionErrorPayload struct {
	Message    string         `json:"message"`
	Code       string         `json:"code,omitempty"`
	Extensions map[string]any `json:"extensions,omitempty"`
}

func (c *Connector) Execute( //nolint:funlen // connector execution keeps query/mutation error semantics in one loop.
	ctx context.Context,
	operation *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	_ *slog.Logger,
) (map[string]any, error) {
	if operation == nil {
		return nil, errActionOperationNil
	}

	results := make(map[string]any)

	var (
		allErrors  []map[string]any
		hardErrors []error
	)

	clientHeaders := requestcontext.ClientHeadersFromContext(ctx)
	lowerSessionVariables := lowerCaseSessionVariables(sessionVariables)

	for _, selection := range operation.SelectionSet {
		field, ok := selection.(*ast.Field)
		if !ok {
			continue
		}

		responseKey, value, errs, err := c.executeActionField(
			ctx,
			operation.Operation,
			field,
			fragments,
			variables,
			role,
			lowerSessionVariables,
			clientHeaders,
		)
		if err != nil {
			if operation.Operation == ast.Mutation {
				return results, err
			}

			results[responseKey] = nil

			hardErrors = append(hardErrors, err)

			continue
		}

		results[responseKey] = value

		if len(errs) == 0 {
			continue
		}

		allErrors = append(allErrors, errs...)
		if operation.Operation == ast.Mutation {
			return results, newGraphQLError(allErrors)
		}
	}

	if len(allErrors) > 0 || len(hardErrors) > 0 {
		return results, actionExecutionErrors(allErrors, hardErrors)
	}

	return results, nil
}

func actionExecutionErrors(graphQLErrors []map[string]any, hardErrors []error) error {
	var errs []error
	if len(graphQLErrors) > 0 {
		errs = append(errs, newGraphQLError(graphQLErrors))
	}

	if len(hardErrors) > 0 {
		errs = append(errs, errors.Join(hardErrors...))
	}

	return errors.Join(errs...)
}

func (c *Connector) executeActionField(
	ctx context.Context,
	operation ast.Operation,
	field *ast.Field,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	clientHeaders http.Header,
) (string, any, []map[string]any, error) {
	responseKey := responseFieldName(field)

	runtime, ok := c.actions[field.Name]
	if !ok {
		return responseKey, nil, []map[string]any{newSingleGraphQLError(
			fmt.Sprintf("action %q is not available", field.Name),
			[]any{responseKey},
			map[string]any{"code": "not-found"},
		)}, nil
	}

	if runtime.async {
		return c.executeAsyncActionField(
			ctx,
			operation,
			responseKey,
			runtime,
			field,
			fragments,
			variables,
			role,
			sessionVariables,
			clientHeaders,
		)
	}

	body, status, err := c.executeRuntimeAction(
		ctx,
		runtime,
		field,
		variables,
		sessionVariables,
		clientHeaders,
	)
	if err != nil {
		return responseKey, nil, nil, err
	}

	return c.actionFieldResult(responseKey, runtime, field, fragments, body, status)
}

func (c *Connector) executeAsyncActionField(
	ctx context.Context,
	operation ast.Operation,
	responseKey string,
	runtime runtimeAction,
	field *ast.Field,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	clientHeaders http.Header,
) (string, any, []map[string]any, error) {
	if c.asyncStore == nil {
		return responseKey, nil, []map[string]any{newSingleGraphQLError(
			fmt.Sprintf("action %q is not available", field.Name),
			[]any{responseKey},
			map[string]any{"code": "not-found"},
		)}, nil
	}

	switch operation {
	case ast.Mutation:
		return c.asyncMutationResult(
			ctx,
			runtime,
			field,
			fragments,
			variables,
			sessionVariables,
			clientHeaders,
		)
	case ast.Query, ast.Subscription:
		return c.asyncStoredResult(
			ctx,
			runtime,
			field,
			fragments,
			variables,
			role,
			sessionVariables,
		)
	default:
		return responseKey, nil, nil, fmt.Errorf(
			"%w: %q",
			errAsyncActionUnsupportedOperation,
			operation,
		)
	}
}

func (c *Connector) executeRuntimeAction(
	ctx context.Context,
	runtime runtimeAction,
	field *ast.Field,
	variables map[string]any,
	sessionVariables map[string]any,
	clientHeaders http.Header,
) ([]byte, int, error) {
	input, err := actionInput(field, variables)
	if err != nil {
		return nil, 0, fmt.Errorf("building input for action %q: %w", field.Name, err)
	}

	return c.executeRuntimeActionWithInput(
		ctx,
		runtime,
		input,
		sessionVariables,
		clientHeaders,
	)
}

func (c *Connector) executeRuntimeActionWithInput(
	ctx context.Context,
	runtime runtimeAction,
	input map[string]any,
	sessionVariables map[string]any,
	clientHeaders http.Header,
) ([]byte, int, error) {
	payload := actionPayload{
		Action:           actionPayloadName{Name: runtime.name},
		Input:            input,
		SessionVariables: sessionVariables,
		RequestQuery:     requestcontext.GraphQLQueryFromContext(ctx),
	}

	body, status, err := c.httpClient.do(ctx, runtime, payload, clientHeaders)
	if err != nil {
		return nil, 0, fmt.Errorf("executing action %q: %w", runtime.name, err)
	}

	return body, status, nil
}

func (c *Connector) actionFieldResult(
	responseKey string,
	runtime runtimeAction,
	field *ast.Field,
	fragments ast.FragmentDefinitionList,
	body []byte,
	status int,
) (string, any, []map[string]any, error) {
	switch {
	case status >= http.StatusOK && status < http.StatusMultipleChoices:
		shaped, errs, err := c.shapeActionResponse(field, fragments, body)
		if err != nil {
			return responseKey, nil, nil,
				fmt.Errorf("shaping action %q response: %w", runtime.name, err)
		}

		return responseKey, shaped, errs, nil
	case status >= http.StatusBadRequest && status < http.StatusInternalServerError:
		actionErr, err := actionErrorFromBody(body, []any{responseKey})
		if err != nil {
			return responseKey, nil, nil,
				fmt.Errorf("parsing action %q error response: %w", runtime.name, err)
		}

		return responseKey, nil, []map[string]any{actionErr}, nil
	default:
		return responseKey, nil, nil, actionStatusError(status)
	}
}

func actionInput(field *ast.Field, variables map[string]any) (map[string]any, error) {
	input := make(map[string]any, len(field.Arguments))
	for _, arg := range field.Arguments {
		value, err := arg.Value.Value(variables)
		if err != nil {
			return nil, fmt.Errorf("resolving argument %q: %w", arg.Name, err)
		}

		input[arg.Name] = value
	}

	return input, nil
}

func lowerCaseSessionVariables(sessionVariables map[string]any) map[string]any {
	out := make(map[string]any, len(sessionVariables))
	for name, value := range sessionVariables {
		out[strings.ToLower(name)] = value
	}

	return out
}

func responseFieldName(field *ast.Field) string {
	if field.Alias != "" {
		return field.Alias
	}

	return field.Name
}

func (c *Connector) shapeActionResponse(
	field *ast.Field,
	fragments ast.FragmentDefinitionList,
	body []byte,
) (any, []map[string]any, error) {
	var value any
	if err := json.Unmarshal(body, &value); err != nil {
		return nil, nil, fmt.Errorf("decoding JSON response: %w", err)
	}

	shaped, errs := c.shapeRootField(field, fragments, value)

	return shaped, errs, nil
}

func actionErrorFromBody(body []byte, path []any) (map[string]any, error) {
	var payload actionErrorPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("decoding JSON action error payload: %w", err)
	}

	if payload.Message == "" {
		return nil, errActionErrorPayloadMissingText
	}

	extensions := payload.Extensions
	if payload.Code != "" {
		if extensions == nil {
			extensions = make(map[string]any, 1)
		}

		extensions["code"] = payload.Code
	}

	return newSingleGraphQLError(payload.Message, path, extensions), nil
}

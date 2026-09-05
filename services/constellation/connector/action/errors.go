package action

import (
	"errors"
	"fmt"
	"maps"
)

var (
	errEmptyTypeReference            = errors.New("empty type reference")
	errInvalidTypeReference          = errors.New("invalid GraphQL type reference")
	errInvalidBaseType               = errors.New("invalid GraphQL base type")
	errInvalidCustomTypeRef          = errors.New("references invalid custom type")
	errUnknownTypeRef                = errors.New("unknown type")
	errObjectTypeUsedAsInput         = errors.New("object type cannot be used as input")
	errInputObjectUsedAsOutput       = errors.New("input object type cannot be used as output")
	errUnsupportedURLScheme          = errors.New("unsupported URL scheme")
	errURLMissingHost                = errors.New("URL has no host")
	errInvalidActionHeaderName       = errors.New("invalid action header name")
	errInvalidActionHeaderValue      = errors.New("invalid action header value")
	errActionOperationNil            = errors.New("action operation is nil")
	errActionRequestBodyTooLarge     = errors.New("action request body too large")
	errActionResponseTooLarge        = errors.New("action response body too large")
	errActionStatus                  = errors.New("action handler returned status")
	errActionErrorPayloadMissingText = errors.New("action error payload missing message")
)

type graphQLError struct {
	errs []map[string]any
}

func newGraphQLError(errs []map[string]any) error {
	if len(errs) == 0 {
		return nil
	}

	copied := make([]map[string]any, len(errs))
	for i, err := range errs {
		copied[i] = copyErrorMap(err)
	}

	return &graphQLError{errs: copied}
}

func newSingleGraphQLError(message string, path []any, extensions map[string]any) map[string]any {
	err := map[string]any{"message": message}
	if len(path) > 0 {
		err["path"] = append([]any(nil), path...)
	}

	if len(extensions) > 0 {
		err["extensions"] = copyAnyMap(extensions)
	}

	return err
}

func newShapeError(message string, path []any) map[string]any {
	return newSingleGraphQLError(
		message,
		path,
		map[string]any{"code": "validation-failed"},
	)
}

func (e *graphQLError) Error() string {
	if len(e.errs) == 0 {
		return "graphql errors"
	}

	message, _ := e.errs[0]["message"].(string)
	if message == "" {
		return "graphql errors"
	}

	return "graphql error: " + message
}

func (e *graphQLError) GraphQLErrors() []map[string]any {
	if e == nil {
		return nil
	}

	out := make([]map[string]any, len(e.errs))
	for i, err := range e.errs {
		out[i] = copyErrorMap(err)
	}

	return out
}

func copyErrorMap(in map[string]any) map[string]any {
	out := make(map[string]any, len(in))
	for k, v := range in {
		switch typed := v.(type) {
		case []any:
			out[k] = append([]any(nil), typed...)
		case map[string]any:
			out[k] = copyAnyMap(typed)
		default:
			out[k] = v
		}
	}

	return out
}

func copyAnyMap(in map[string]any) map[string]any {
	out := make(map[string]any, len(in))
	maps.Copy(out, in)

	return out
}

func actionStatusError(status int) error {
	return fmt.Errorf("%w %d", errActionStatus, status)
}

package controller

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"slices"

	"github.com/google/uuid"
	"github.com/vektah/gqlparser/v2/gqlerror"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/constellation/connector/remoteschema"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
)

var (
	errContentTypeNotJSON  = errors.New("Content-Type must be application/json")
	errInvalidRequestBody  = errors.New("invalid request body")
	errRequestBodyTooLarge = errors.New("request body too large")
	errInternalServerError = errors.New("internal server error")
	errNoSchemaForRole     = errors.New("no schema available for role")
	errOperationNotFound   = errors.New("operation not found")
)

// operationSelectionMessage returns the Hasura-matching message for an operation
// that could not be uniquely selected: a supplied operationName that matched no
// operation, or an omitted name when several operations are present. The strings
// mirror Hasura graphql-engine verbatim (captured from the live engine). Returns
// "" when neither case applies, which is unreachable for a validated document.
func operationSelectionMessage(operationName string, numOperations int) string {
	switch {
	case operationName != "":
		return fmt.Sprintf("no such operation found in the document: %q", operationName)
	case numOperations > 1:
		return "exactly one operation has to be present in the document " +
			"when operationName is not specified"
	default:
		return ""
	}
}

// newHasuraValidationError wraps a request-level validation message in the
// gqlValidationError envelope Hasura uses (the "validation-failed" code and the
// "$" document path inside extensions), so the HTTP and WebSocket paths surface
// operation-selection failures with an identical wire shape.
func newHasuraValidationError(msg string) *gqlValidationError {
	return &gqlValidationError{
		errs: gqlerror.List{
			{
				Message: msg,
				Extensions: map[string]any{
					"code": "validation-failed",
					"path": "$",
				},
			},
		},
	}
}

// operationSelectionResponse builds the HTTP GraphQLResponse for a failed
// operation selection, matching Hasura's wording and extensions. It falls back
// to the generic operation-not-found envelope for the unreachable residual case.
func operationSelectionResponse(operationName string, numOperations int) *GraphQLResponse {
	msg := operationSelectionMessage(operationName, numOperations)
	if msg == "" {
		return errResponseOperationNotFound
	}

	return &GraphQLResponse{
		Data:        nil,
		Errors:      formatGQLErrors(newHasuraValidationError(msg).errs),
		rawResponse: nil,
	}
}

// sanitizeConnectorError converts a raw connector/database execution error into
// a client-safe message. Raw driver errors (pgx/SQLite) carry SQLSTATE codes,
// constraint/table/column names, and—worst of all—the offending data values
// (e.g. "Key (email)=(alice@example.com) already exists"). Returning those
// verbatim to an unauthenticated caller is an information-disclosure leak.
//
// When devMode is true the raw error is returned to the client verbatim,
// mirroring Hasura's HASURA_GRAPHQL_DEV_MODE so local and CI runs can see the
// full upstream detail. devMode must never be enabled in production.
//
// In the default (non-dev) mode the full error detail is retained server-side
// at Error level and the client receives a generic message tagged with the
// request's trace id. The trace id comes from the tracing middleware (which the
// request logger already stamps onto every log line), so the client message and
// the server logs share one identifier without minting a second one. When no
// trace is present on the context (e.g. a non-request context) a fresh uuid is
// used as a fallback. The returned string is the only thing that should ever
// reach the GraphQL errors[] envelope or a WebSocket error frame for a
// database-execution failure.
func sanitizeConnectorError(
	ctx context.Context,
	logger *slog.Logger,
	devMode bool,
	err error,
) string {
	if devMode {
		if logger != nil {
			logger.ErrorContext(
				ctx, "connector execution error",
				slog.String("error", err.Error()),
			)
		}

		return err.Error()
	}

	traceID := oapimw.TraceFromContext(ctx).TraceID
	if traceID == "" {
		traceID = uuid.NewString()
	}

	if logger != nil {
		logger.ErrorContext(
			ctx, "connector execution error",
			slog.String("trace_id", traceID),
			slog.String("error", err.Error()),
		)
	}

	return "internal server error (trace id: " + traceID + ")"
}

// classifyConnectorError converts an error returned by a connector (either
// during primary execution or during remote-relationship resolution) into the
// slice of GraphQL error maps that should be reported to the client.
//
// Structured *remoteschema.GraphQLError values originate inside a trusted
// remote schema that has already shaped its own GraphQL errors (path,
// locations, extensions). They pass through verbatim via RemoteError.AsMap.
//
// A *arguments.QueryValidationError is a query-validation failure (e.g. a
// distinct_on that does not match the leading order_by) that Constellation
// detects while building SQL. It carries no PII and its envelope must match
// Hasura's validation-failed shape, so it passes through verbatim via AsMap
// rather than being sanitised.
//
// A *arguments.DataExceptionError is an argument failure whose Hasura-compatible
// envelope is the safe data-exception shape (currently negative offset). It is
// constructed by the arguments package with a fixed message, so it also passes
// through verbatim via AsMap.
//
// An error implementing structuredGraphQLErrors carries already-shaped,
// client-safe GraphQL error payloads (message/path/extensions). Action webhook
// errors (Hasura-compatible 4xx responses) and action response-shape
// validation failures implement it, so the action's own error envelope reaches
// the client verbatim instead of being collapsed into a generic sanitized
// message.
//
// Any other error is treated as a raw connector/driver failure and routed
// through sanitizeConnectorError so SQLSTATE codes, table/column names, and
// offending values never reach an unauthenticated caller.
//
// Centralising the trust-boundary decision here keeps the primary-path and
// remote-relationship branches from drifting if the rule evolves (e.g. a
// stricter "is this remote schema trusted" check or an extension-stripping
// step).
func (c *Controller) classifyConnectorError(
	ctx context.Context, logger *slog.Logger, err error,
) []map[string]any {
	structuredErrs, ok := classifyStructuredConnectorError(err)
	if !ok {
		return []map[string]any{{
			"message": sanitizeConnectorError(ctx, logger, c.devMode, err),
		}}
	}

	// A connector may join structured (already-shaped, client-safe) errors with
	// raw execution failures: e.g. a multi-field action query where one field
	// returns a Hasura-shaped 4xx and a sibling field fails hard (5xx, transport
	// error, response-shaping failure). classifyStructuredConnectorError matches
	// only the first structured value, so those raw failures would be dropped,
	// leaving their null fields with no accompanying error. Append a single
	// sanitized generic entry so every failure is represented, without leaking
	// raw driver/webhook text (sanitizeConnectorError still logs it server-side).
	if hasUnstructuredLeaf(err) {
		structuredErrs = append(structuredErrs, map[string]any{
			"message": sanitizeConnectorError(ctx, logger, c.devMode, err),
		})
	}

	return structuredErrs
}

// hasUnstructuredLeaf reports whether the error tree contains a leaf that is not
// a structured (already-shaped, client-safe) connector error. It walks the
// errors.Join tree so a mix of structured and raw failures is detected. It is
// only consulted once at least one structured error is present.
func hasUnstructuredLeaf(err error) bool {
	if joined, ok := err.(interface{ Unwrap() []error }); ok {
		return slices.ContainsFunc(joined.Unwrap(), hasUnstructuredLeaf)
	}

	_, structured := classifyStructuredConnectorError(err)

	return !structured
}

// classifyStructuredConnectorError extracts trusted, already-shaped GraphQL
// errors from a connector error without applying the raw driver-error
// sanitizer. It is shared by HTTP execution and WebSocket subscription paths so
// validation failures keep the same wire envelope across transports.
func classifyStructuredConnectorError(err error) ([]map[string]any, bool) {
	if gqlErrs, ok := errors.AsType[*remoteschema.GraphQLError](err); ok {
		out := make([]map[string]any, len(gqlErrs.Errors))
		for i, re := range gqlErrs.Errors {
			out[i] = re.AsMap()
		}

		return out, true
	}

	if vErr, ok := errors.AsType[*arguments.QueryValidationError](err); ok {
		return []map[string]any{vErr.AsMap()}, true
	}

	if dataErr, ok := errors.AsType[*arguments.DataExceptionError](err); ok {
		return []map[string]any{dataErr.AsMap()}, true
	}

	if carrier, ok := errors.AsType[structuredGraphQLErrors](err); ok {
		if gqlErrs := carrier.GraphQLErrors(); gqlErrs != nil {
			return gqlErrs, true
		}
	}

	return nil, false
}

// structuredGraphQLErrors is implemented by connector errors that already carry
// fully-shaped, client-safe GraphQL error payloads (message/path/extensions).
// The action runtime returns such errors for Hasura-compatible 4xx webhook
// responses and for response-shape validation failures; matching on the
// behaviour rather than the concrete (unexported) action error type keeps the
// controller decoupled from the action package.
type structuredGraphQLErrors interface {
	error
	GraphQLErrors() []map[string]any
}

// Pre-allocated error responses for common cases. Treating them as package
// constants avoids allocating an identical *GraphQLResponse for every
// request that hits these well-known error paths. They are immutable by
// convention — handlers must not mutate the returned pointer.
//
//nolint:gochecknoglobals // intentional read-only allocation-amortising globals.
var (
	errResponseSessionNotFound = &GraphQLResponse{
		Data:        nil,
		Errors:      []map[string]any{{"message": "session not found in context"}},
		rawResponse: nil,
	}
	errResponseOperationNotFound = &GraphQLResponse{
		Data:        nil,
		Errors:      []map[string]any{{"message": "operation not found"}},
		rawResponse: nil,
	}
	errResponseNoConnector = &GraphQLResponse{
		Data:        nil,
		Errors:      []map[string]any{{"message": "no connector available"}},
		rawResponse: nil,
	}
)

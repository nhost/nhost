package controller

import (
	"context"
	"errors"
	"log/slog"

	"github.com/google/uuid"

	"github.com/nhost/nhost/services/constellation/connector/remoteschema"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/internal/lib/oapi/tracing"
)

var (
	errContentTypeNotJSON  = errors.New("Content-Type must be application/json")
	errInvalidRequestBody  = errors.New("invalid request body")
	errInternalServerError = errors.New("internal server error")
	errNoSchemaForRole     = errors.New("no schema available for role")
	errMultipleOperations  = errors.New("multiple operations found, operationName is required")
	errOperationNotFound   = errors.New("operation not found")
)

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

	traceID := tracing.FromContext(ctx).TraceID
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
	if gqlErrs, ok := errors.AsType[*remoteschema.GraphQLError](err); ok {
		out := make([]map[string]any, len(gqlErrs.Errors))
		for i, re := range gqlErrs.Errors {
			out[i] = re.AsMap()
		}

		return out
	}

	if vErr, ok := errors.AsType[*arguments.QueryValidationError](err); ok {
		return []map[string]any{vErr.AsMap()}
	}

	return []map[string]any{{
		"message": sanitizeConnectorError(ctx, logger, c.devMode, err),
	}}
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
	errResponseMultipleOperations = &GraphQLResponse{
		Data: nil,
		Errors: []map[string]any{
			{"message": "operation name is required when multiple operations are present"},
		},
		rawResponse: nil,
	}
	errResponseNoConnector = &GraphQLResponse{
		Data:        nil,
		Errors:      []map[string]any{{"message": "no connector available"}},
		rawResponse: nil,
	}
)

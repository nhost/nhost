package controller

import (
	"context"
	"errors"
	"log/slog"

	"github.com/google/uuid"

	"github.com/nhost/nhost/services/constellation/internal/lib/oapi/tracing"
)

var (
	errContentTypeNotJSON  = errors.New("Content-Type must be application/json")
	errInvalidRequestBody  = errors.New("invalid request body")
	errInternalServerError = errors.New("internal server error")
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
			logger.ErrorContext(ctx, "connector execution error",
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
		logger.ErrorContext(ctx, "connector execution error",
			slog.String("trace_id", traceID),
			slog.String("error", err.Error()),
		)
	}

	return "internal server error (trace id: " + traceID + ")"
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

// Package logger provides a Gin middleware that emits a structured slog
// record for every HTTP request/response pair handled by the engine, and
// stashes a request-scoped slog.Logger in the request context.
//
// The middleware is independent of trace-header propagation: it reads any
// previously stashed tracing identifiers from the request context (via the
// sibling tracing subpackage) but does not parse or write B3 headers itself.
// Callers that need B3 propagation should chain the tracing middleware before
// the logger.
package logger

import (
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/constellation/internal/lib/oapi/tracing"
	"github.com/nhost/nhost/services/constellation/internal/requestcontext"
)

// Logger is a Gin middleware that logs HTTP requests and responses using slog.
//
// It enriches the slog.Logger with request and (if present in context) trace
// attributes, stashes the enriched logger in the request context, and on
// completion emits a single "call completed" or "call completed with errors"
// record carrying response status, latency, and any gin errors.
func Logger(logger *slog.Logger) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		startTime := time.Now()

		t := tracing.FromContext(ctx.Request.Context())

		clientIP := ctx.ClientIP()
		reqMethod := ctx.Request.Method
		reqURL := ctx.Request.RequestURI
		logger := logger.With(
			slog.Group(
				"trace",
				slog.String("trace_id", t.TraceID),
				slog.String("span_id", t.SpanID),
				slog.String("parent_span_id", t.ParentSpanID),
			),
			slog.Group(
				"request",
				slog.String("client_ip", clientIP),
				slog.String("method", reqMethod),
				slog.String("url", reqURL),
			),
		)
		ctx.Request = ctx.Request.WithContext(
			requestcontext.LoggerToContext(ctx.Request.Context(), logger),
		)
		ctx.Next()

		// Re-fetch from context: session middleware (and similar) appends
		// per-request attributes (user-id, role) to the logger after Logger
		// runs but before the request completes.
		logger = requestcontext.LoggerFromContext(ctx.Request.Context())

		latencyTime := time.Since(startTime)
		statusCode := ctx.Writer.Status()

		logger = logger.With(slog.Group(
			"response",
			slog.Int("status_code", statusCode),
			slog.Duration("latency_time", latencyTime),
			slog.Any("errors", ctx.Errors.Errors()),
		))

		if len(ctx.Errors.Errors()) > 0 {
			logger.ErrorContext(ctx, "call completed with errors")
		} else {
			logger.InfoContext(ctx, "call completed")
		}
	}
}

// Package requestcontext stores request-scoped HTTP client headers and the
// slog logger in a [context.Context], with awareness of [*gin.Context] so
// values stashed on the underlying [*http.Request] context are still
// retrievable when callers pass the gin context directly. Context keys are
// unexported, so external callers cannot install a wrong-typed value under
// these keys; a failed type assertion therefore means "not present" and is
// surfaced as a nil header map or [slog.Default] respectively.
package requestcontext

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
)

// clientHeadersCtxKey keys the [http.Header] stashed by [ClientHeadersToContext]
// and read back by [ClientHeadersFromContext].
type clientHeadersCtxKey struct{}

// ClientHeadersFromContext retrieves the client HTTP headers from context.
func ClientHeadersFromContext(
	ctx context.Context, //nolint:contextcheck // gin.Context unwrap to request ctx is intentional; see package doc
) http.Header {
	ginCtx, ok := ctx.(*gin.Context)
	if ok {
		ctx = ginCtx.Request.Context()
	}

	headers, ok := ctx.Value(clientHeadersCtxKey{}).(http.Header)
	if !ok {
		return nil
	}

	return headers
}

// ClientHeadersToContext stores the client HTTP headers in the context.
func ClientHeadersToContext(ctx context.Context, headers http.Header) context.Context {
	return context.WithValue(ctx, clientHeadersCtxKey{}, headers)
}

// loggerCtxKey keys the [*slog.Logger] stashed by [LoggerToContext]
// and read back by [LoggerFromContext].
type loggerCtxKey struct{}

// LoggerToContext stores the logger in the context.
func LoggerToContext(ctx context.Context, logger *slog.Logger) context.Context {
	return context.WithValue(ctx, loggerCtxKey{}, logger)
}

// LoggerFromContext returns the logger stashed in ctx, or [slog.Default] if none is present.
func LoggerFromContext(
	ctx context.Context, //nolint:contextcheck // gin.Context unwrap to request ctx is intentional; see package doc
) *slog.Logger {
	ginCtx, ok := ctx.(*gin.Context)
	if ok {
		ctx = ginCtx.Request.Context()
	}

	logger, ok := ctx.Value(loggerCtxKey{}).(*slog.Logger)
	if !ok {
		return slog.Default()
	}

	return logger
}

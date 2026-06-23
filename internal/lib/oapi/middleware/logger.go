package middleware

import (
	"context"
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
)

type loggerCtxKey struct{}

// LoggerToContext stores the logger in the context.
func LoggerToContext(ctx context.Context, logger *slog.Logger) context.Context {
	return context.WithValue(ctx, loggerCtxKey{}, logger)
}

// LoggerFromContext retrieves the logger from the context. It creates a new one if it can't be found.
func LoggerFromContext(ctx context.Context) *slog.Logger { //nolint:contextcheck
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

// AddLoggerAttrs enriches the logger stored in ctx with attrs and stores the
// result back, returning the derived context. Because it reads through
// LoggerFromContext and writes through LoggerToContext, enrichment added by a
// middleware here is picked up by Logger's deferred completion record and by
// every downstream LoggerFromContext caller, without callers needing to know
// which context key backs the logger.
func AddLoggerAttrs(ctx context.Context, attrs ...slog.Attr) context.Context {
	args := make([]any, len(attrs))
	for i, attr := range attrs {
		args[i] = attr
	}

	return LoggerToContext(ctx, LoggerFromContext(ctx).With(args...))
}

// Logger is a Gin middleware that logs HTTP requests and responses using slog.
//
// It enriches logger with request and trace attributes, stores the enriched
// logger in the request context, and emits a single completion log record after
// downstream handlers finish. If the Tracing middleware runs before Logger, the
// trace identifiers come from the request context; otherwise Logger falls back
// to parsing/generating B3 headers itself so existing callers still get trace
// attributes.
func Logger(logger *slog.Logger) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		startTime := time.Now()

		trace := TraceFromContext(ctx.Request.Context())
		if trace.TraceID == "" {
			trace = TraceFromHTTPHeaders(ctx.Request.Header)
			ctx.Request = ctx.Request.WithContext(TraceToContext(ctx.Request.Context(), trace))
		}

		clientIP := ctx.ClientIP()
		reqMethod := ctx.Request.Method
		reqURL := ctx.Request.RequestURI
		logger := logger.With(
			slog.Group(
				"trace",
				slog.String("trace_id", trace.TraceID),
				slog.String("span_id", trace.SpanID),
				slog.String("parent_span_id", trace.ParentSpanID),
			),
			slog.Group(
				"request",
				slog.String("client_ip", clientIP),
				slog.String("method", reqMethod),
				slog.String("url", reqURL),
			),
		)
		ctx.Request = ctx.Request.WithContext(
			LoggerToContext(ctx.Request.Context(), logger),
		)
		ctx.Next()

		// Re-read logger in case inner middleware enriched it.
		logger = LoggerFromContext(ctx.Request.Context())

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

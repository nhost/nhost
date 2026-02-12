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

// Logger is a Gin middleware that logs HTTP requests and responses using slog.
func Logger(logger *slog.Logger) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		startTime := time.Now()

		trace := TraceFromHTTPHeaders(ctx.Request.Header)

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

		latencyTime := time.Since(startTime)
		statusCode := ctx.Writer.Status()

		logger = logger.With(slog.Group(
			"response",
			slog.Int("status_code", statusCode),
			slog.Duration("latency_time", latencyTime),
			slog.Any("errors", ctx.Errors.Errors()),
		))

		TraceToHTTPHeaders(trace, ctx.Writer.Header())

		if len(ctx.Errors.Errors()) > 0 {
			logger.ErrorContext(ctx, "call completed with errors")
		} else {
			logger.InfoContext(ctx, "call completed")
		}
	}
}

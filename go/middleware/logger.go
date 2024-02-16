package middleware

import (
	"context"
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
)

type loggerCtxKey struct{}

// Stores the logger in the context.
func LoggerToContext(ctx context.Context, logger *slog.Logger) context.Context {
	return context.WithValue(ctx, loggerCtxKey{}, logger)
}

// Retrieves the logger from the context. It creates a new one if it can't be found.
func LoggerFromContext(ctx context.Context) *slog.Logger {
	logger, ok := ctx.Value(loggerCtxKey{}).(*slog.Logger)
	if !ok {
		return slog.Default()
	}
	return logger
}

func Logger(logger *slog.Logger) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		startTime := time.Now()

		trace := TraceFromHTTPHeaders(ctx.Request.Header)

		logger := logger.With(slog.Group(
			"trace",
			slog.String("trace_id", trace.TraceID),
			slog.String("span_id", trace.SpanID),
			slog.String("parent_span_id", trace.ParentSpanID),
		))
		ctx.Request = ctx.Request.WithContext(
			LoggerToContext(ctx.Request.Context(), logger.WithGroup("workflow_data")),
		)
		ctx.Next()

		latencyTime := time.Since(startTime)
		reqMethod := ctx.Request.Method
		reqURL := ctx.Request.RequestURI
		statusCode := ctx.Writer.Status()
		clientIP := ctx.ClientIP()

		fields := slog.Group(
			"request",
			slog.Int("status_code", statusCode),
			slog.Duration("latency_time", latencyTime),
			slog.String("client_ip", clientIP),
			slog.String("method", reqMethod),
			slog.String("url", reqURL),
			slog.Any("errors", ctx.Errors.Errors()),
		)

		TraceToHTTPHeaders(trace, ctx.Writer.Header())

		if len(ctx.Errors.Errors()) > 0 {
			logger.LogAttrs(ctx, slog.LevelError, "call completed with errors", fields)
		} else {
			logger.LogAttrs(ctx, slog.LevelInfo, "call completed", fields)
		}
	}
}

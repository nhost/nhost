package middleware

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

type loggerCtxKey struct{}

// Stores the logger in the context.
func LoggerToContext(ctx context.Context, logger logrus.FieldLogger) context.Context {
	return context.WithValue(ctx, loggerCtxKey{}, logger)
}

// Retrieves the logger from the context. It creates a new one if it can't be found.
func LoggerFromContext(ctx context.Context) logrus.FieldLogger { //nolint:contextcheck,ireturn
	ginCtx, ok := ctx.(*gin.Context)
	if ok {
		ctx = ginCtx.Request.Context()
	}

	logger, ok := ctx.Value(loggerCtxKey{}).(logrus.FieldLogger)
	if !ok {
		return logrus.New()
	}

	return logger
}

func Logger(logger logrus.FieldLogger) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		startTime := time.Now()

		trace := TraceFromHTTPHeaders(ctx.Request.Header)

		clientIP := ctx.ClientIP()
		reqMethod := ctx.Request.Method
		reqURL := ctx.Request.RequestURI
		logger := logger.WithFields(logrus.Fields{
			"trace_id":       trace.TraceID,
			"span_id":        trace.SpanID,
			"parent_span_id": trace.ParentSpanID,
			"client_ip":      clientIP,
			"request_method": reqMethod,
			"request_url":    reqURL,
		})
		ctx.Request = ctx.Request.WithContext(
			LoggerToContext(ctx.Request.Context(), logger),
		)
		ctx.Next()

		latencyTime := time.Since(startTime)
		statusCode := ctx.Writer.Status()

		logger = logger.WithFields(logrus.Fields{
			"status_code":  statusCode,
			"latency_time": latencyTime,
			"errors":       ctx.Errors.Errors(),
		})

		TraceToHTTPHeaders(trace, ctx.Writer.Header())

		if len(ctx.Errors.Errors()) > 0 {
			logger.Error("call completed with errors")
		} else {
			logger.Info("call completed")
		}
	}
}

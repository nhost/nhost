package nhmiddleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	nhcontext "github.com/nhost/be/lib/graphql/context"
	nhtracing "github.com/nhost/be/lib/tracing"
	"github.com/sirupsen/logrus"
)

func Logger(logger logrus.FieldLogger) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		startTime := time.Now()

		trace, _ := nhtracing.FromContext(ctx.Request.Context())

		traceID := trace.TraceID
		if traceID == "" {
			traceID = uuid.New().String()
		}

		logger := logger.WithField("trace_id", traceID)
		ctx.Request = ctx.Request.WithContext(
			nhcontext.LoggerToContext(ctx.Request.Context(), logger),
		)
		ctx.Next()

		latencyTime := time.Since(startTime)
		reqMethod := ctx.Request.Method
		reqURL := ctx.Request.RequestURI
		statusCode := ctx.Writer.Status()
		clientIP := ctx.ClientIP()

		fields := logrus.Fields{
			"status_code":  statusCode,
			"latency_time": latencyTime,
			"client_ip":    clientIP,
			"method":       reqMethod,
			"url":          reqURL,
			"errors":       ctx.Errors.Errors(),
		}

		if len(ctx.Errors.Errors()) > 0 {
			logger.WithFields(fields).Error("call completed with some errors")
		} else {
			logger.WithFields(fields).Info("call completed")
		}
	}
}

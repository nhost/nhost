package main

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nhost/hasura-storage/controller"
	"github.com/sirupsen/logrus"
)

func ginLogger(logger *logrus.Logger) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		startTime := time.Now()

		ctx.Next()

		endTime := time.Now()

		latencyTime := endTime.Sub(startTime)
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
			logger.WithFields(fields).Info()
		}
	}
}

func getGin(
	metadataStorage controller.MetadataStorage,
	contentStorage controller.ContentStorage,
	logger *logrus.Logger,
	debug bool,
) *gin.Engine {
	if !debug {
		gin.SetMode(gin.ReleaseMode)
	}

	ctrl := controller.New(metadataStorage, contentStorage, logger)

	return ctrl.SetupRouter(ginLogger(logger))
}

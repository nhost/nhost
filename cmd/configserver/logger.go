package configserver

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"github.com/urfave/cli/v2"
)

func getLogger(debug bool, formatJSON bool) *logrus.Logger {
	logger := logrus.New()
	if formatJSON {
		logger.Formatter = &logrus.JSONFormatter{} //nolint: exhaustruct
	} else {
		logger.SetFormatter(&logrus.TextFormatter{ //nolint: exhaustruct
			FullTimestamp: true,
		})
	}

	if debug {
		logger.SetLevel(logrus.DebugLevel)
		gin.SetMode(gin.DebugMode)
	} else {
		logger.SetLevel(logrus.InfoLevel)
		gin.SetMode(gin.ReleaseMode)
	}

	return logger
}

func logFlags(logger logrus.FieldLogger, cCtx *cli.Context) {
	fields := logrus.Fields{}

	for _, flag := range cCtx.App.Flags {
		name := flag.Names()[0]
		fields[name] = cCtx.Generic(name)
	}

	for _, flag := range cCtx.Command.Flags {
		name := flag.Names()[0]
		if strings.Contains(name, "pass") ||
			strings.Contains(name, "token") ||
			strings.Contains(name, "secret") ||
			strings.Contains(name, "key") {
			fields[name] = "******"
			continue
		}

		fields[name] = cCtx.Generic(name)
	}

	logger.WithFields(fields).Info("started with settings")
}

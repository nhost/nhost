package configserver

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"github.com/urfave/cli/v3"
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

func logFlags(logger logrus.FieldLogger, cmd *cli.Command) {
	fields := logrus.Fields{}

	for _, flag := range cmd.Root().Flags {
		name := flag.Names()[0]
		fields[name] = cmd.Value(name)
	}

	for _, flag := range cmd.Flags {
		name := flag.Names()[0]
		if strings.Contains(name, "pass") ||
			strings.Contains(name, "token") ||
			strings.Contains(name, "secret") ||
			strings.Contains(name, "key") {
			fields[name] = "******"
			continue
		}

		fields[name] = cmd.Value(name)
	}

	logger.WithFields(fields).Info("started with settings")
}

package cmd

import "github.com/sirupsen/logrus"

func getLogger() *logrus.Logger {
	logger := logrus.New()
	logger.SetFormatter(&logrus.TextFormatter{ //nolint:exhaustivestruct
		FullTimestamp: true,
	})

	return logger
}

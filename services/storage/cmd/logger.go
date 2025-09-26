package cmd

import "github.com/sirupsen/logrus"

func getLogger() *logrus.Logger {
	logger := logrus.New()
	logger.SetFormatter(&logrus.TextFormatter{ //nolint:exhaustruct
		FullTimestamp: true,
	})

	return logger
}

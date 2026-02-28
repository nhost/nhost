package nhcontext

import (
	"context"

	"github.com/sirupsen/logrus"
)

type loggerCtxKey struct{}

// LoggerToContext stores the logger in the context.
func LoggerToContext(ctx context.Context, logger *logrus.Entry) context.Context {
	return context.WithValue(ctx, loggerCtxKey{}, logger)
}

// LoggerFromContext retrieves the logger from the context. It creates a new one if it can't be found.
func LoggerFromContext(ctx context.Context) *logrus.Entry {
	logger, ok := ctx.Value(loggerCtxKey{}).(*logrus.Entry)
	if !ok {
		return logrus.NewEntry(logrus.New())
	}

	return logger
}

package pgmigrate

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
)

// migrateErrorPrefix is hard-coded by golang-migrate's logErr; verify it on dependency upgrades.
const migrateErrorPrefix = "error: "

type slogAdapter struct {
	ctx    context.Context //nolint:containedctx // golang-migrate's logger interface has no context parameter.
	logger *slog.Logger
}

func newSlogAdapter(ctx context.Context, logger *slog.Logger) *slogAdapter {
	return &slogAdapter{
		ctx:    ctx,
		logger: logger,
	}
}

func (l *slogAdapter) Printf(format string, values ...any) {
	message := strings.TrimSuffix(fmt.Sprintf(format, values...), "\n")
	if after, ok := strings.CutPrefix(message, migrateErrorPrefix); ok {
		l.logger.ErrorContext(l.ctx, after)
		return
	}

	if l.Verbose() {
		l.logger.DebugContext(l.ctx, message)
		return
	}

	l.logger.InfoContext(l.ctx, message)
}

func (l *slogAdapter) Verbose() bool {
	return l.logger.Enabled(l.ctx, slog.LevelDebug)
}

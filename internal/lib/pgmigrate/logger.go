package pgmigrate

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
)

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
	l.logger.InfoContext(l.ctx, message)
}

func (l *slogAdapter) Verbose() bool {
	return l.logger.Enabled(l.ctx, slog.LevelDebug)
}

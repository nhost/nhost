package pgmigrate

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
)

const (
	// migrateErrorPrefix is hard-coded by golang-migrate's logErr; verify it on dependency upgrades.
	migrateErrorPrefix = "error: "

	migrateCloseFormat       = "Closing source and database\n"
	migrateStartBufferFormat = "Start buffering %v\n"
	migrateScheduledFormat   = "Scheduled %v\n"
	migrateReadExecuteFormat = "Read and execute %v\n"
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
	if after, ok := strings.CutPrefix(message, migrateErrorPrefix); ok {
		l.logger.ErrorContext(l.ctx, after)
		return
	}

	if isMigrateVerboseFormat(format) {
		l.logger.DebugContext(l.ctx, message)
		return
	}

	l.logger.InfoContext(l.ctx, message)
}

// isMigrateVerboseFormat recognizes the fixed formats used by golang-migrate's
// logVerbosePrintf; verify them on dependency upgrades.
func isMigrateVerboseFormat(format string) bool {
	switch format {
	case migrateCloseFormat,
		migrateStartBufferFormat,
		migrateScheduledFormat,
		migrateReadExecuteFormat:
		return true
	default:
		return false
	}
}

func (l *slogAdapter) Verbose() bool {
	return l.logger.Enabled(l.ctx, slog.LevelDebug)
}

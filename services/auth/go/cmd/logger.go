package cmd

import (
	"context"
	"log/slog"

	serveutil "github.com/nhost/nhost/internal/lib/serve"
	"github.com/urfave/cli/v3"
)

// getLogger builds the structured logger for the auth server. It delegates to
// the shared serve package so logger construction stays identical across every
// Nhost service binary.
func getLogger(debug bool, formatTEXT bool) *slog.Logger {
	return serveutil.NewLogger(debug, formatTEXT)
}

// logFlags logs the resolved flag values at startup, redacting secrets. It
// delegates to the shared serve package.
func logFlags(ctx context.Context, logger *slog.Logger, cmd *cli.Command) {
	serveutil.LogFlags(ctx, logger, cmd)
}

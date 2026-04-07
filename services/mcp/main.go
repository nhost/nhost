package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/nhost/nhost/services/mcp/server"
)

var Version string

func main() {
	app := server.Command(Version)

	if err := app.Run(context.Background(), os.Args); err != nil {
		slog.Error("fatal error", slog.String("error", err.Error()))
		os.Exit(1)
	}
}

package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
)

var Version string

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))

	ctx, cancel := signal.NotifyContext(
		context.Background(),
		syscall.SIGINT,
		syscall.SIGTERM,
	)
	defer cancel()

	logger.InfoContext(ctx, "starting mcp service", slog.String("version", Version))

	<-ctx.Done()

	logger.InfoContext(ctx, "shutting down mcp service")

	fmt.Println("goodbye")
}

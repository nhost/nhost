package cmd

import (
	"context"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lmittmann/tint"
	"github.com/urfave/cli/v3"
)

func getLogger(debug bool, formatTEXT bool) *slog.Logger {
	var (
		logLevel  slog.Level
		addSource bool
	)

	if debug {
		logLevel = slog.LevelDebug
		addSource = true

		gin.SetMode(gin.DebugMode)
	} else {
		logLevel = slog.LevelInfo
		addSource = false

		gin.SetMode(gin.ReleaseMode)
	}

	var handler slog.Handler
	if formatTEXT {
		handler = tint.NewHandler(os.Stdout, &tint.Options{
			AddSource:   addSource,
			Level:       logLevel,
			TimeFormat:  time.StampMilli,
			NoColor:     false,
			ReplaceAttr: nil,
		})
	} else {
		handler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
			AddSource:   addSource,
			Level:       logLevel,
			ReplaceAttr: nil,
		})
	}

	return slog.New(handler)
}

func isSecret(name string) bool {
	return strings.Contains(name, "pass") ||
		strings.Contains(name, "token") ||
		strings.Contains(name, "secret") ||
		strings.Contains(name, "key") ||
		strings.Contains(name, "license") ||
		strings.Contains(name, "postgres") ||
		strings.Contains(name, "client-id") ||
		strings.Contains(name, "client-secret")
}

func logFlags(ctx context.Context, logger *slog.Logger, cmd *cli.Command) {
	processed := make(map[string]struct{})

	flags := make([]any, 0, len(cmd.Root().Flags)+len(cmd.Flags))
	for _, flag := range cmd.Root().Flags {
		name := flag.Names()[0]
		value := cmd.Generic(name)

		var logValue any = value
		if isSecret(name) {
			logValue = "********"
		}

		flags = append(flags, slog.Any(name, logValue))

		processed[name] = struct{}{}
	}

	for _, flag := range cmd.Flags {
		name := flag.Names()[0]
		if _, ok := processed[name]; ok {
			continue
		}

		value := cmd.Generic(name)

		var logValue any = value
		if isSecret(name) {
			logValue = "********"
		}

		flags = append(flags, slog.Any(name, logValue))
	}

	logger.LogAttrs(
		ctx,
		slog.LevelInfo,
		"starting program",
		slog.Group("flags", flags...),
	)
}

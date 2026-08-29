package cmd

import (
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lmittmann/tint"
	"github.com/urfave/cli/v2"
)

func getLogger(debug bool, formatJSON bool) *slog.Logger {
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
	if formatJSON {
		handler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
			AddSource:   addSource,
			Level:       logLevel,
			ReplaceAttr: nil,
		})
	} else {
		handler = tint.NewHandler(os.Stdout, &tint.Options{
			AddSource:   addSource,
			Level:       logLevel,
			TimeFormat:  time.StampMilli,
			NoColor:     false,
			ReplaceAttr: nil,
		})
	}

	return slog.New(handler)
}

func logFlags(logger *slog.Logger, cCtx *cli.Context) {
	flags := make([]any, 0, len(cCtx.App.Flags)+len(cCtx.Command.Flags))
	for _, flag := range cCtx.App.Flags {
		name := flag.Names()[0]
		flags = append(flags, slog.Any(name, cCtx.Generic(name)))
	}

	for _, flag := range cCtx.Command.Flags {
		name := flag.Names()[0]

		value := cCtx.Generic(name)
		if strings.Contains(name, "pass") ||
			strings.Contains(name, "token") ||
			strings.Contains(name, "secret") ||
			strings.Contains(name, "key") ||
			name == "postgres" {
			value = "********"
		}

		flags = append(flags, slog.Any(name, value))
	}

	logger.LogAttrs(cCtx.Context, slog.LevelInfo, "starting program", slog.Group("flags", flags...))
}

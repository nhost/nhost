// Package serve holds runtime helpers shared by the Nhost service binaries
// (auth, storage, constellation) and the unified nhost-engine binary: logger
// construction, startup flag logging with secret redaction, and related
// lifecycle glue. It exists so these concerns are defined once instead of being
// copy-pasted into every service's cmd package.
package serve

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

const redactedSecret = "********"

// NewLogger builds the structured logger shared by every service. When debug is
// set it lowers the level to Debug, records source locations, and puts gin in
// debug mode; otherwise it runs at Info in release mode. formatText selects the
// human-friendly tint handler over the default JSON handler.
func NewLogger(debug bool, formatText bool) *slog.Logger {
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
	if formatText {
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

// isSecret reports whether a flag's value must be redacted before it is logged.
// It is intentionally broad: matching on substrings means a new secret-bearing
// flag is redacted by default as long as it follows the existing naming.
func isSecret(name string) bool {
	return strings.Contains(name, "pass") ||
		strings.Contains(name, "token") ||
		strings.Contains(name, "secret") ||
		strings.Contains(name, "key") ||
		strings.Contains(name, "license") ||
		strings.Contains(name, "postgres") ||
		strings.Contains(name, "client-id") ||
		strings.Contains(name, "client-secret") ||
		strings.Contains(name, "metadata-database-url")
}

// LogFlags logs the resolved value of every flag on the root command and the
// invoked command at startup, redacting anything isSecret matches. Root flags
// are logged first and de-duplicated so a flag shared between root and command
// is only reported once.
func LogFlags(ctx context.Context, logger *slog.Logger, cmd *cli.Command) {
	processed := make(map[string]struct{})

	flags := make([]any, 0, len(cmd.Root().Flags)+len(cmd.Flags))
	for _, flag := range cmd.Root().Flags {
		name := flag.Names()[0]

		value := cmd.Value(name)
		if isSecret(name) {
			value = redactedSecret
		}

		flags = append(flags, slog.Any(name, value))

		processed[name] = struct{}{}
	}

	for _, flag := range cmd.Flags {
		name := flag.Names()[0]
		if _, ok := processed[name]; ok {
			continue
		}

		value := cmd.Value(name)
		if isSecret(name) {
			value = redactedSecret
		}

		flags = append(flags, slog.Any(name, value))
	}

	logger.LogAttrs(
		ctx,
		slog.LevelInfo,
		"starting program",
		slog.Group("flags", flags...),
	)
}

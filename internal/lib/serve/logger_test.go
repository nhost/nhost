package serve_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	serveutil "github.com/nhost/nhost/internal/lib/serve"
	"github.com/urfave/cli/v3"
)

// NewLogger changes gin's mode and reads os.Stdout, both process-global state.
//
//nolint:paralleltest // Running this test in parallel would race those globals.
func TestNewLogger(t *testing.T) {
	previousGinMode := gin.Mode()
	t.Cleanup(func() {
		gin.SetMode(previousGinMode)
	})

	tests := []struct {
		name        string
		debug       bool
		formatText  bool
		wantGinMode string
		wantJSON    bool
	}{
		{
			name:        "release JSON",
			debug:       false,
			formatText:  false,
			wantGinMode: gin.ReleaseMode,
			wantJSON:    true,
		},
		{
			name:        "release text",
			debug:       false,
			formatText:  true,
			wantGinMode: gin.ReleaseMode,
			wantJSON:    false,
		},
		{
			name:        "debug JSON",
			debug:       true,
			formatText:  false,
			wantGinMode: gin.DebugMode,
			wantJSON:    true,
		},
		{
			name:        "debug text",
			debug:       true,
			formatText:  true,
			wantGinMode: gin.DebugMode,
			wantJSON:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			logger, output := newLoggerOutput(t, tt.debug, tt.formatText)

			if got := logger.Enabled(t.Context(), slog.LevelDebug); got != tt.debug {
				t.Errorf("debug level enabled = %v; want %v", got, tt.debug)
			}

			if !logger.Enabled(t.Context(), slog.LevelInfo) {
				t.Error("info level is not enabled")
			}

			if got := gin.Mode(); got != tt.wantGinMode {
				t.Errorf("gin mode = %q; want %q", got, tt.wantGinMode)
			}

			assertLoggerOutput(t, output, tt.wantJSON)

			hasSource := strings.Contains(string(output), "logger_test.go")
			if hasSource != tt.debug {
				t.Errorf(
					"source location present = %v; want %v; output: %q",
					hasSource,
					tt.debug,
					output,
				)
			}
		})
	}
}

func assertLoggerOutput(t *testing.T, output []byte, wantJSON bool) {
	t.Helper()

	if !bytes.Contains(output, []byte("logger output")) {
		t.Errorf("logger output does not contain message %q: %q", "logger output", output)
	}

	var entry map[string]any

	err := json.Unmarshal(bytes.TrimSpace(output), &entry)
	if wantJSON {
		if err != nil {
			t.Fatalf("parsing JSON logger output %q: %v", output, err)
		}

		if got := entry["msg"]; got != "logger output" {
			t.Errorf("log message = %v; want %q", got, "logger output")
		}

		if got := entry["level"]; got != "INFO" {
			t.Errorf("JSON log level = %v; want %q", got, "INFO")
		}

		return
	}

	if err == nil {
		t.Errorf("text logger output unexpectedly parsed as JSON: %q", output)
	}

	ansiEscape := regexp.MustCompile("\x1b\\[[0-9;]*m")
	plainOutput := ansiEscape.ReplaceAllString(string(output), "")

	timestamp, _, found := strings.Cut(plainOutput, " INF ")
	if !found {
		t.Fatalf("text log level marker %q missing from output: %q", "INF", output)
	}

	if _, err := time.Parse(time.StampMilli, timestamp); err != nil {
		t.Errorf(
			"text log timestamp %q does not match layout %q: %v",
			timestamp,
			time.StampMilli,
			err,
		)
	}
}

func newLoggerOutput(t *testing.T, debug bool, formatText bool) (*slog.Logger, []byte) {
	t.Helper()

	reader, writer, err := os.Pipe()
	if err != nil {
		t.Fatalf("creating logger output pipe: %v", err)
	}

	originalStdout := os.Stdout
	os.Stdout = writer

	defer func() {
		os.Stdout = originalStdout
	}()

	logger := serveutil.NewLogger(debug, formatText)
	os.Stdout = originalStdout

	logger.InfoContext(context.Background(), "logger output")

	if err := writer.Close(); err != nil {
		t.Fatalf("closing logger output writer: %v", err)
	}

	output, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("reading logger output: %v", err)
	}

	if err := reader.Close(); err != nil {
		t.Fatalf("closing logger output reader: %v", err)
	}

	return logger, output
}

func TestLogFlagsMasksSecretsAndDeduplicatesSharedFlags(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name            string
		args            []string
		wantBindAddress string
	}{
		{
			name:            "default values",
			args:            []string{"root", "sub"},
			wantBindAddress: ":8000",
		},
		{
			name: "explicit root and command values",
			args: []string{
				"root",
				"--admin-secret", "supplied-root-secret",
				"--bind-address", ":9000",
				"sub",
				"--jwt-secret", "supplied-jwt-secret",
			},
			wantBindAddress: ":9000",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var buf bytes.Buffer

			logger := slog.New(slog.NewJSONHandler(&buf, &slog.HandlerOptions{
				Level: slog.LevelInfo,
			}))

			root := newLogFlagsCommand(logger)
			if err := root.Run(context.Background(), tt.args); err != nil {
				t.Fatalf("running cli: %v", err)
			}

			output := strings.TrimSpace(buf.String())
			if output == "" {
				t.Fatal("expected LogFlags to emit a log line")
			}

			assertNoDuplicateFlagKeys(t, []byte(output))

			if strings.Contains(output, "supplied-root-secret") ||
				strings.Contains(output, "supplied-jwt-secret") {
				t.Errorf("explicitly supplied secret was logged: %s", output)
			}

			assertLoggedFlags(t, []byte(output), tt.wantBindAddress)
		})
	}
}

func newLogFlagsCommand(logger *slog.Logger) *cli.Command {
	return &cli.Command{
		Name: "root",
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "admin-secret",
				Value: "root-topsecret",
			},
			&cli.StringFlag{
				Name:  "bind-address",
				Value: ":8000",
			},
		},
		Commands: []*cli.Command{
			{
				Name: "sub",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:  "admin-secret",
						Value: "sub-topsecret",
					},
					&cli.StringFlag{
						Name:  "jwt-secret",
						Value: "jwt-topsecret",
					},
					&cli.StringFlag{
						Name:  "metadata-path",
						Value: "./metadata.yaml",
					},
				},
				Action: func(ctx context.Context, cmd *cli.Command) error {
					serveutil.LogFlags(ctx, logger, cmd)

					return nil
				},
			},
		},
	}
}

func assertNoDuplicateFlagKeys(t *testing.T, output []byte) {
	t.Helper()

	decoder := json.NewDecoder(bytes.NewReader(output))
	expectJSONObjectStart(t, decoder, "log entry")

	for decoder.More() {
		key := nextJSONKey(t, decoder, "log entry")
		if key == "flags" {
			assertUniqueJSONObjectKeys(t, decoder, output)

			return
		}

		var value any
		if err := decoder.Decode(&value); err != nil {
			t.Fatalf("decoding log entry value for %q: %v", key, err)
		}
	}

	t.Fatal("log entry does not contain a flags object")
}

func assertUniqueJSONObjectKeys(t *testing.T, decoder *json.Decoder, output []byte) {
	t.Helper()

	expectJSONObjectStart(t, decoder, "flags")

	seen := make(map[string]struct{})
	for decoder.More() {
		name := nextJSONKey(t, decoder, "flags")
		if _, duplicate := seen[name]; duplicate {
			t.Errorf("flag %q was logged more than once; output: %s", name, output)
		}

		seen[name] = struct{}{}

		var value any
		if err := decoder.Decode(&value); err != nil {
			t.Fatalf("decoding value for flag %q: %v", name, err)
		}
	}

	if _, err := decoder.Token(); err != nil {
		t.Fatalf("reading flags object end: %v", err)
	}
}

func expectJSONObjectStart(t *testing.T, decoder *json.Decoder, objectName string) {
	t.Helper()

	token, err := decoder.Token()
	if err != nil {
		t.Fatalf("reading %s object start: %v", objectName, err)
	}

	if token != json.Delim('{') {
		t.Fatalf("%s starts with %v; want object", objectName, token)
	}
}

func nextJSONKey(t *testing.T, decoder *json.Decoder, objectName string) string {
	t.Helper()

	token, err := decoder.Token()
	if err != nil {
		t.Fatalf("reading %s key: %v", objectName, err)
	}

	key, ok := token.(string)
	if !ok {
		t.Fatalf("%s key has type %T; want string", objectName, token)
	}

	return key
}

func assertLoggedFlags(t *testing.T, output []byte, wantBindAddress string) {
	t.Helper()

	var entry map[string]any
	if err := json.Unmarshal(output, &entry); err != nil {
		t.Fatalf("parsing slog output %q: %v", output, err)
	}

	flagsAny, ok := entry["flags"]
	if !ok {
		t.Fatalf("expected log entry to contain flags group; got: %v", entry)
	}

	flags, ok := flagsAny.(map[string]any)
	if !ok {
		t.Fatalf("expected flags to be an object; got %T", flagsAny)
	}

	for _, name := range []string{"admin-secret", "jwt-secret"} {
		value, ok := flags[name]
		if !ok {
			t.Errorf("flags missing %q", name)
			continue
		}

		if value != "********" {
			t.Errorf("flag %q not masked: %v", name, value)
		}
	}

	if got := flags["bind-address"]; got != wantBindAddress {
		t.Errorf("bind-address = %v; want %q", got, wantBindAddress)
	}

	if got := flags["metadata-path"]; got != "./metadata.yaml" {
		t.Errorf("metadata-path = %v; want %q", got, "./metadata.yaml")
	}
}

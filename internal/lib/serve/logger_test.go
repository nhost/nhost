package serve_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"os"
	"strings"
	"testing"

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

			var entry map[string]any

			err := json.Unmarshal(bytes.TrimSpace(output), &entry)
			if tt.wantJSON {
				if err != nil {
					t.Fatalf("parsing JSON logger output %q: %v", output, err)
				}

				if got := entry["msg"]; got != "logger output" {
					t.Errorf("log message = %v; want %q", got, "logger output")
				}

				if got := entry["level"]; got != "INFO" {
					t.Errorf("log level = %v; want %q", got, "INFO")
				}
			} else if err == nil {
				t.Errorf("text logger output unexpectedly parsed as JSON: %q", output)
			}

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

// TestLogFlagsMasksSecrets runs a tiny cli.Command tree that ends up calling
// LogFlags, captures the slog output, and asserts that secret-named flag
// values are replaced with "********" while non-secret values pass through
// verbatim.
func TestLogFlagsMasksSecrets(t *testing.T) {
	t.Parallel()

	var buf bytes.Buffer

	logger := slog.New(slog.NewJSONHandler(&buf, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))

	root := &cli.Command{
		Name: "root",
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "admin-secret",
				Value: "topsecret",
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

	if err := root.Run(context.Background(), []string{"root", "sub"}); err != nil {
		t.Fatalf("running cli: %v", err)
	}

	if buf.Len() == 0 {
		t.Fatalf("expected LogFlags to emit a log line")
	}

	var entry map[string]any
	if err := json.Unmarshal(bytes.TrimSpace(buf.Bytes()), &entry); err != nil {
		t.Fatalf("parsing slog output %q: %v", buf.String(), err)
	}

	flagsAny, ok := entry["flags"]
	if !ok {
		t.Fatalf("expected log entry to contain flags group; got: %v", entry)
	}

	flags, ok := flagsAny.(map[string]any)
	if !ok {
		t.Fatalf("expected flags to be an object; got %T", flagsAny)
	}

	wantMasked := []string{"admin-secret", "jwt-secret"}
	for _, name := range wantMasked {
		v, ok := flags[name]
		if !ok {
			t.Errorf("flags missing %q", name)
			continue
		}

		if v != "********" {
			t.Errorf("flag %q not masked: %v", name, v)
		}
	}

	if addr, ok := flags["bind-address"]; !ok {
		t.Errorf("flags missing bind-address")
	} else if s, _ := addr.(string); !strings.Contains(s, ":8000") {
		t.Errorf("bind-address not preserved: %v", addr)
	}

	if path, ok := flags["metadata-path"]; !ok {
		t.Errorf("flags missing metadata-path")
	} else if s, _ := path.(string); !strings.Contains(s, "metadata.yaml") {
		t.Errorf("metadata-path not preserved: %v", path)
	}
}

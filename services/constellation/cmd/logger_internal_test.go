package cmd

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"strings"
	"testing"

	"github.com/urfave/cli/v3"
)

func TestIsSecret(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		want bool
	}{
		{"admin-secret", true},
		{"jwt-secret", true},
		{"hasura-graphql-jwt-secret", true},
		{"password", true},
		{"db-password", true},
		{"api-token", true},
		{"refresh-token", true},
		{"api-key", true},
		{"private-key", true},
		{"license", true},
		{"license-key", true},
		{"postgres-url", true},
		{"client-id", true},
		{"client-secret", true},
		{"metadata-database-url", true},
		{"bind-address", false},
		{"debug", false},
		{"log-format-text", false},
		{"enable-playground", false},
		{"subscription-poll-interval", false},
		{"profile-address", false},
		{"metadata-path", false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := isSecret(tt.name); got != tt.want {
				t.Errorf("isSecret(%q) = %v; want %v", tt.name, got, tt.want)
			}
		})
	}
}

// TestLogFlagsMasksSecrets runs a tiny cli.Command tree that ends up calling
// logFlags, captures the slog output, and asserts that secret-named flag
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
					logFlags(ctx, logger, cmd)
					return nil
				},
			},
		},
	}

	if err := root.Run(context.Background(), []string{"root", "sub"}); err != nil {
		t.Fatalf("running cli: %v", err)
	}

	if buf.Len() == 0 {
		t.Fatalf("expected logFlags to emit a log line")
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

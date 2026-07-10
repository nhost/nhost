package main

import (
	"context"
	"errors"
	"slices"
	"testing"

	"github.com/urfave/cli/v3"
)

func TestParseSharedFlagsResolvesBind(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		args []string
		want string
	}{
		{name: "default when neither set", args: nil, want: ":8080"},
		{name: "explicit bind", args: []string{"--bind", ":9000"}, want: ":9000"},
		{name: "port forms address", args: []string{"--port", "7000"}, want: ":7000"},
		{
			name: "bind wins over port",
			args: []string{"--bind", ":9000", "--port", "7000"},
			want: ":9000",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			cfg, _, err := parseSharedFlags(context.Background(), tc.args)
			if err != nil {
				t.Fatalf("parseSharedFlags: %v", err)
			}

			if cfg.bind != tc.want {
				t.Fatalf("bind = %q, want %q", cfg.bind, tc.want)
			}
		})
	}
}

func TestParseSharedFlagsRejectsUnknown(t *testing.T) {
	t.Parallel()

	if _, _, err := parseSharedFlags(context.Background(), []string{"--nope"}); err == nil {
		t.Fatal("expected error for unknown shared flag, got nil")
	}
}

func TestParseSharedFlagsRejectsStrayPositional(t *testing.T) {
	t.Parallel()

	// A mistyped first service ("nhost-engine storag -- auth") lands in the shared
	// segment as a bare positional. It used to be silently dropped — only auth
	// would run — so it must now surface as an error instead.
	if _, _, err := parseSharedFlags(
		context.Background(), []string{"storag"},
	); !errors.Is(err, errUnexpectedSharedArg) {
		t.Fatalf("err = %v; want errUnexpectedSharedArg", err)
	}

	// A genuine flag value that reads like a service name is consumed by the
	// flag (arity-aware), not left as a stray positional, so it must not error.
	if _, _, err := parseSharedFlags(
		context.Background(), []string{"--admin-secret", "storage"},
	); err != nil {
		t.Fatalf("flag value wrongly rejected as stray positional: %v", err)
	}
}

// TestParseSharedFlagsHelpVersionArity guards the regression where the raw
// shared-token scan mistook a flag *value* equal to a help/version token for an
// actual help/version request, short-circuiting startup with exit 0 and never
// launching the selected service. Detection must be arity-aware: only a genuine
// --help/--version flag counts; a value like "--admin-secret help" must parse as
// the secret and leave the request as requestRun so the service still starts.
func TestParseSharedFlagsHelpVersionArity(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		args       []string
		wantReq    sharedRequest
		wantSecret string
	}{
		{name: "no flags runs", args: nil, wantReq: requestRun},
		{name: "long help", args: []string{"--help"}, wantReq: requestHelp},
		{name: "short help", args: []string{"-h"}, wantReq: requestHelp},
		{name: "long version", args: []string{"--version"}, wantReq: requestVersion},
		{name: "short version", args: []string{"-v"}, wantReq: requestVersion},
		{
			name:       "help as flag value does not request help",
			args:       []string{"--admin-secret", "help"},
			wantReq:    requestRun,
			wantSecret: "help",
		},
		{
			name:       "version token as flag value does not request version",
			args:       []string{"--admin-secret", "-v"},
			wantReq:    requestRun,
			wantSecret: "-v",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			cfg, req, err := parseSharedFlags(context.Background(), tc.args)
			if err != nil {
				t.Fatalf("parseSharedFlags: %v", err)
			}

			if req != tc.wantReq {
				t.Fatalf("request = %d, want %d", req, tc.wantReq)
			}

			if cfg.adminSecret != tc.wantSecret {
				t.Fatalf("adminSecret = %q, want %q", cfg.adminSecret, tc.wantSecret)
			}
		})
	}
}

// runParsed parses args against flags and calls fn with the resulting command,
// so tests can exercise applySharedConfig against a realistically parsed
// command (including its IsSet state).
func runParsed(
	t *testing.T,
	flags []cli.Flag,
	args []string,
	fn func(cmd *cli.Command),
) {
	t.Helper()

	app := &cli.Command{
		Name:  "svc",
		Flags: flags,
		Action: func(_ context.Context, cmd *cli.Command) error {
			fn(cmd)

			return nil
		},
	}

	if err := app.Run(context.Background(), append([]string{"svc"}, args...)); err != nil {
		t.Fatalf("running command: %v", err)
	}
}

func authFlags() []cli.Flag {
	return []cli.Flag{
		&cli.StringFlag{Name: "hasura-admin-secret"},
		&cli.StringFlag{Name: "hasura-graphql-jwt-secret"},
		&cli.StringFlag{Name: "postgres", Value: "default-dsn"},
		&cli.StringFlag{Name: "postgres-migrations"},
	}
}

func TestApplySharedConfigFillsUnsetFlags(t *testing.T) {
	t.Parallel()

	cfg := sharedConfig{
		adminSecret:   "shared-secret",
		jwtSecret:     "shared-jwt",
		databaseURL:   "shared-dsn",
		migrationsURL: "shared-migrations",
	}

	runParsed(t, authFlags(), nil, func(cmd *cli.Command) {
		if err := applySharedConfig(cmd, "auth", cfg); err != nil {
			t.Fatalf("applySharedConfig: %v", err)
		}

		if got := cmd.String("hasura-admin-secret"); got != "shared-secret" {
			t.Fatalf("admin-secret = %q, want shared-secret", got)
		}

		if got := cmd.String("hasura-graphql-jwt-secret"); got != "shared-jwt" {
			t.Fatalf("jwt-secret = %q, want shared-jwt", got)
		}

		if got := cmd.String("postgres"); got != "shared-dsn" {
			t.Fatalf("postgres = %q, want shared-dsn (should overwrite default)", got)
		}
	})
}

func TestApplySharedConfigServiceValueWins(t *testing.T) {
	t.Parallel()

	cfg := sharedConfig{adminSecret: "shared-secret"}

	args := []string{"--hasura-admin-secret", "explicit-secret"}

	runParsed(t, authFlags(), args, func(cmd *cli.Command) {
		if err := applySharedConfig(cmd, "auth", cfg); err != nil {
			t.Fatalf("applySharedConfig: %v", err)
		}

		if got := cmd.String("hasura-admin-secret"); got != "explicit-secret" {
			t.Fatalf("admin-secret = %q, want explicit-secret (service wins)", got)
		}
	})
}

func TestApplySharedConfigEmptySharedIsNoOp(t *testing.T) {
	t.Parallel()

	runParsed(t, authFlags(), nil, func(cmd *cli.Command) {
		if err := applySharedConfig(cmd, "auth", sharedConfig{}); err != nil {
			t.Fatalf("applySharedConfig: %v", err)
		}

		if got := cmd.String("postgres"); got != "default-dsn" {
			t.Fatalf("postgres = %q, want default-dsn (unchanged)", got)
		}

		if got := cmd.String("hasura-admin-secret"); got != "" {
			t.Fatalf("admin-secret = %q, want empty", got)
		}
	})
}

func TestApplySharedConfigInjectsCORSSlice(t *testing.T) {
	t.Parallel()

	cfg := sharedConfig{corsOrigins: []string{"https://a", "https://b"}}

	flags := []cli.Flag{
		&cli.StringSliceFlag{Name: "cors-allow-origins", Value: []string{"*"}},
	}

	runParsed(t, flags, nil, func(cmd *cli.Command) {
		if err := applySharedConfig(cmd, "storage", cfg); err != nil {
			t.Fatalf("applySharedConfig: %v", err)
		}

		got := cmd.StringSlice("cors-allow-origins")
		want := []string{"https://a", "https://b"}

		if !slices.Equal(got, want) {
			t.Fatalf("cors-allow-origins = %v, want %v", got, want)
		}
	})
}

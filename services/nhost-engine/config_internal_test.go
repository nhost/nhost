package main

import (
	"context"
	"slices"
	"testing"

	"github.com/urfave/cli/v3"
)

// runParsed parses args against flags and calls fn with the resulting command,
// so tests can exercise helpers against a realistically parsed command
// (including its IsSet state).
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

// authFlags is a minimal stand-in for auth's shared-config target flags.
func authFlags() []cli.Flag {
	return []cli.Flag{
		&cli.StringFlag{Name: "hasura-admin-secret"},
		&cli.StringFlag{Name: "hasura-graphql-jwt-secret"},
		&cli.StringFlag{Name: "postgres", Value: "default-dsn"},
		&cli.StringFlag{Name: "postgres-migrations"},
	}
}

func TestServeConfigFrom(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		args         []string
		wantBind     string
		wantDisabled map[string]bool
	}{
		{
			name:         "defaults",
			args:         nil,
			wantBind:     defaultBind,
			wantDisabled: map[string]bool{"auth": false, "storage": false, "graphql": false},
		},
		{
			name:         "explicit bind",
			args:         []string{"--bind", ":9000"},
			wantBind:     ":9000",
			wantDisabled: map[string]bool{"auth": false, "storage": false, "graphql": false},
		},
		{
			name:         "disable one service",
			args:         []string{"--disable-storage"},
			wantBind:     defaultBind,
			wantDisabled: map[string]bool{"auth": false, "storage": true, "graphql": false},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			runParsed(t, globalFlags(), tc.args, func(cmd *cli.Command) {
				cfg := serveConfigFrom(cmd)

				if cfg.bind != tc.wantBind {
					t.Fatalf("bind = %q, want %q", cfg.bind, tc.wantBind)
				}

				for svc, want := range tc.wantDisabled {
					if cfg.disabled[svc] != want {
						t.Fatalf("disabled[%q] = %v, want %v", svc, cfg.disabled[svc], want)
					}
				}
			})
		})
	}
}

func TestApplySharedConfigFillsUnsetFlags(t *testing.T) {
	t.Parallel()

	cfg := serveConfig{
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

	cfg := serveConfig{adminSecret: "shared-secret"}

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
		if err := applySharedConfig(cmd, "auth", serveConfig{}); err != nil {
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

	cfg := serveConfig{corsOrigins: []string{"https://a", "https://b"}}

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

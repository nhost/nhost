package main

import (
	"context"
	"errors"
	"slices"
	"strings"
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
		&cli.StringFlag{Name: "api-prefix"},
		&cli.StringFlag{Name: "hasura-admin-secret"},
		&cli.StringFlag{Name: "hasura-graphql-jwt-secret"},
		&cli.StringFlag{Name: "postgres", Value: "default-dsn"},
		&cli.StringFlag{Name: "postgres-migrations"},
	}
}

func TestServeRejectsSkippedPrefixedEnvironment(t *testing.T) {
	tests := []struct {
		name   string
		env    string
		value  string
		reject bool
	}{
		{name: "graphql timeout", env: "GRAPHQL_HTTP_READ_TIMEOUT", value: "30s", reject: true},
		{name: "graphql profile", env: "GRAPHQL_PROFILE_ADDRESS", value: ":6061", reject: true},
		{name: "storage profiling", env: "STORAGE_PPROF_BIND", value: ":6060", reject: true},
		{
			name:   "auth skipped database",
			env:    "AUTH_POSTGRES",
			value:  "postgres://example",
			reject: true,
		},
		{name: "empty skipped source", env: "GRAPHQL_HTTP_WRITE_TIMEOUT", value: "", reject: true},
		{name: "native auth listener", env: "AUTH_PORT", value: "4001", reject: false},
		{name: "native auth debug", env: "AUTH_DEBUG", value: "true", reject: false},
		{name: "native auth log format", env: "AUTH_LOG_FORMAT_TEXT", value: "true", reject: false},
		{
			name:   "native graphql timeout",
			env:    "CONSTELLATION_HTTP_READ_TIMEOUT",
			value:  "30s",
			reject: false,
		},
		{
			name:   "native graphql listener",
			env:    "CONSTELLATION_BIND_ADDRESS",
			value:  ":8081",
			reject: false,
		},
		{name: "native storage profiling", env: "BIND_PPROF", value: ":6060", reject: false},
		{
			name:   "native auth route override",
			env:    "AUTH_API_PREFIX",
			value:  "/custom",
			reject: false,
		},
		{
			name:   "engine routing global",
			env:    "AUTH_COMPAT_HOSTS",
			value:  "auth.example.com",
			reject: false,
		},
		{
			name:   "forwarded option",
			env:    "AUTH_CLIENT_URL",
			value:  "https://example.com",
			reject: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv(tc.env, tc.value)

			err := newApp("test").Run(context.Background(), []string{
				"engine", "serve", "--disable-auth", "--disable-storage", "--disable-graphql",
			})
			if tc.reject {
				if !errors.Is(err, errUnsupportedPrefixedEnv) ||
					!strings.Contains(err.Error(), tc.env) {
					t.Fatalf("serve error = %v, want rejection of %s", err, tc.env)
				}

				if tc.value != "" && strings.Contains(err.Error(), tc.value) {
					t.Fatalf("serve error leaked value of %s: %v", tc.env, err)
				}

				return
			}

			if !errors.Is(err, errAllServicesDisabled) {
				t.Fatalf("serve error = %v, want errAllServicesDisabled", err)
			}
		})
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

func TestServeConfigFromReadsMountPrefixHostsFlag(t *testing.T) {
	tests := []struct {
		name string
		env  string
		args []string
		want []string
	}{
		{
			name: "comma-separated environment value",
			env:  "nhost-engine-service,engine.example.com",
			want: []string{"nhost-engine-service", "engine.example.com"},
		},
		{
			name: "command flag overrides environment",
			env:  "environment.example",
			args: []string{
				"--mount-prefix-hosts", "first.example,second.example",
			},
			want: []string{"first.example", "second.example"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("MOUNT_PREFIX_HOSTS", tc.env)

			runParsed(t, globalFlags(), tc.args, func(cmd *cli.Command) {
				got := serveConfigFrom(cmd).mountPrefixHosts
				if !slices.Equal(got, tc.want) {
					t.Fatalf("mountPrefixHosts = %v, want %v", got, tc.want)
				}
			})
		})
	}
}

func TestServeConfigFromReadsCompatAuthHostsFlag(t *testing.T) {
	tests := []struct {
		name string
		env  string
		args []string
		want []string
	}{
		{
			name: "comma-separated environment value",
			env:  "hasura-auth-service,hasura-auth-service.nhost-project.svc.cluster.local",
			want: []string{
				"hasura-auth-service",
				"hasura-auth-service.nhost-project.svc.cluster.local",
			},
		},
		{
			name: "command flag overrides environment",
			env:  "environment.example",
			args: []string{
				"--auth-compat-hosts", "first.example,second.example",
			},
			want: []string{"first.example", "second.example"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("AUTH_COMPAT_HOSTS", tc.env)

			runParsed(t, globalFlags(), tc.args, func(cmd *cli.Command) {
				got := serveConfigFrom(cmd).compatAuthHosts
				if !slices.Equal(got, tc.want) {
					t.Fatalf("compatAuthHosts = %v, want %v", got, tc.want)
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

func TestApplySharedConfigEmptySharedOnlyAppliesAuthDefault(t *testing.T) {
	t.Parallel()

	runParsed(t, authFlags(), nil, func(cmd *cli.Command) {
		if err := applySharedConfig(cmd, "auth", serveConfig{}); err != nil {
			t.Fatalf("applySharedConfig: %v", err)
		}

		if got := cmd.String("api-prefix"); got != defaultAuthAPIPrefix {
			t.Fatalf("api-prefix = %q, want %q", got, defaultAuthAPIPrefix)
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

package main

import (
	"slices"
	"testing"

	"github.com/urfave/cli/v3"
)

func primaryFlags(t *testing.T, flags []cli.Flag) map[string]cli.Flag {
	t.Helper()

	primary := make(map[string]cli.Flag, len(flags))
	for _, flag := range flags {
		names := flag.Names()
		if len(names) == 0 {
			t.Fatal("service flag has no names")
		}

		name := names[0]
		if _, exists := primary[name]; exists {
			t.Fatalf("duplicate primary service flag %q", name)
		}

		primary[name] = flag
	}

	return primary
}

func TestServiceRegistryFlagReferencesExist(t *testing.T) {
	t.Parallel()

	registry := serviceRegistry()
	for _, service := range serviceOrder() {
		t.Run(service, func(t *testing.T) {
			t.Parallel()

			def := registry[service]
			flags := primaryFlags(t, def.command().Flags)

			for name := range def.skip {
				if _, exists := flags[name]; !exists {
					t.Errorf("skip name %q is not a primary service flag", name)
				}
			}

			for name := range def.hidden {
				if _, exists := flags[name]; !exists {
					t.Errorf("hidden name %q is not a primary service flag", name)
				}
			}
		})
	}
}

func TestSharedOverridesMatchServiceFlags(t *testing.T) {
	t.Parallel()

	cfg := serveConfig{
		bind:            "",
		debug:           false,
		logFormatText:   false,
		adminSecret:     "x",
		jwtSecret:       "x",
		databaseURL:     "x",
		migrationsURL:   "x",
		corsOrigins:     []string{"x"},
		compatAuthHosts: nil,
		disabled:        nil,
	}
	expected := map[string][]string{
		"auth": {
			"hasura-admin-secret",
			"hasura-graphql-jwt-secret",
			"postgres",
			"postgres-migrations",
		},
		"storage": {
			"hasura-graphql-admin-secret",
			"postgres-migrations-source",
			"cors-allow-origins",
		},
		"graphql": {
			"admin-secret",
			"jwt-secret",
			"metadata-database-url",
			"cors-allowed-origins",
		},
	}

	registry := serviceRegistry()
	for _, service := range serviceOrder() {
		t.Run(service, func(t *testing.T) {
			t.Parallel()

			def := registry[service]
			flags := primaryFlags(t, def.command().Flags)
			overrides := sharedOverridesFor(service, cfg)

			got := make([]string, 0, len(overrides))
			for _, override := range overrides {
				got = append(got, override.flag)

				if _, exists := flags[override.flag]; !exists {
					t.Errorf("shared override %q is not a primary service flag", override.flag)
				}

				if !def.skip[override.flag] {
					t.Errorf("shared override %q is not in the service skip set", override.flag)
				}
			}

			if !slices.Equal(got, expected[service]) {
				t.Errorf("shared override flags = %q, want %q", got, expected[service])
			}
		})
	}
}

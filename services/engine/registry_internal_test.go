package main

import (
	"path"
	"slices"
	"strings"
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

func TestServiceOrderMatchesRegistry(t *testing.T) {
	t.Parallel()

	registry := serviceRegistry()
	order := serviceOrder()
	seen := make(map[string]struct{}, len(order))

	for _, name := range order {
		if _, duplicate := seen[name]; duplicate {
			t.Errorf("service order contains duplicate %q", name)
		}

		seen[name] = struct{}{}

		if _, exists := registry[name]; !exists {
			t.Errorf("service order contains %q, which is absent from registry", name)
		}
	}

	for name := range registry {
		if _, exists := seen[name]; !exists {
			t.Errorf("registry contains %q, which is absent from service order", name)
		}
	}
}

func TestServicePrefixesAreMountable(t *testing.T) {
	t.Parallel()

	registry := serviceRegistry()
	for name, def := range registry {
		if def.prefix == "" || !strings.HasPrefix(def.prefix, "/") ||
			strings.HasSuffix(def.prefix, "/") || path.Clean(def.prefix) != def.prefix {
			t.Errorf("service %q has invalid mount prefix %q", name, def.prefix)
		}

		_, containsHealthRoute := strings.CutPrefix("/healthz", def.prefix+"/")
		if def.prefix == "/healthz" || containsHealthRoute {
			t.Errorf("service %q prefix %q collides with engine health route", name, def.prefix)
		}

		for otherName, otherDef := range registry {
			if name == otherName {
				continue
			}

			if def.prefix == otherDef.prefix || strings.HasPrefix(otherDef.prefix, def.prefix+"/") {
				t.Errorf(
					"service %q prefix %q overlaps service %q prefix %q",
					name, def.prefix, otherName, otherDef.prefix,
				)
			}
		}
	}
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
			"api-prefix",
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

				wantPreserveEmpty := service == "graphql" &&
					override.flag == "cors-allowed-origins"
				if override.preserveExplicitEmpty != wantPreserveEmpty {
					t.Errorf(
						"shared override %q preserveExplicitEmpty = %t, want %t",
						override.flag, override.preserveExplicitEmpty, wantPreserveEmpty,
					)
				}

				flag, exists := flags[override.flag]
				if !exists {
					t.Errorf("shared override %q is not a primary service flag", override.flag)

					continue
				}

				switch flag.(type) {
				case *cli.StringFlag, *cli.StringSliceFlag:
				default:
					t.Errorf(
						"shared override %q has unsupported concrete flag type %T",
						override.flag, flag,
					)
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

package main

import (
	"context"
	"log/slog"
	"testing"

	serveutil "github.com/nhost/nhost/internal/lib/serve"
	"github.com/urfave/cli/v3"
)

// engineVersionUnderTest is deliberately unlike any release string, so a passing
// assertion cannot come from a flag default or a service's own build metadata.
const engineVersionUnderTest = "9.9.9-engine-test"

// requiredPassthroughArgs supplies every flag a service requires and the engine
// does not consolidate into a shared global. Deriving them from the service's
// own flags keeps this test alive when a service adds a required flag, rather
// than failing on a hardcoded list that silently rots.
func requiredPassthroughArgs(t *testing.T, service string, def serviceDef) []string {
	t.Helper()

	var args []string

	for _, f := range def.command().Flags {
		name := f.Names()[0]

		req, ok := f.(cli.RequiredFlag)
		if !ok || !req.IsRequired() || def.skip[name] {
			continue
		}

		pname := prefixedName(service, name)

		switch classifyFlag(f) {
		case kindBool:
			args = append(args, "--"+pname+"=true")
		case kindSlice, kindScalar:
			args = append(args, "--"+pname, "engine-test-value")
		}
	}

	return args
}

// TestBundledServicesReportEngineVersion pins the engine command lineage used
// by bundled services: buildService runs under the serve Action's context, so
// cmd.Root().Version comes from the engine command rather than the wrapper.
// The services do not link their own main packages; the engine's project.nix
// supplies main.Version. Service command tests separately pin the hop from
// Root().Version into each controller and version endpoint.
func TestBundledServicesReportEngineVersion(t *testing.T) {
	t.Parallel()

	cfg := serveConfig{
		adminSecret:   "shared-admin",
		jwtSecret:     "shared-jwt",
		databaseURL:   "postgres://shared",
		migrationsURL: "postgres://shared-migrations",
	}

	for _, rs := range serviceDefinitions() {
		t.Run(rs.name, func(t *testing.T) {
			t.Parallel()

			got := "<newService was never called>"

			var commandPath string

			def := rs.def
			def.newService = func(
				_ context.Context, cmd *cli.Command, _ *slog.Logger,
			) (*serveutil.Service, error) {
				got = cmd.Root().Version
				commandPath = cmd.FullName()

				return &serveutil.Service{}, nil
			}

			app := newApp(engineVersionUnderTest)
			app.Commands[0].Action = func(ctx context.Context, cmd *cli.Command) error {
				_, err := buildService(
					ctx, def, rs.name, cmd, slog.New(slog.DiscardHandler), cfg,
				)

				return err
			}

			args := append([]string{"engine", "serve"}, requiredPassthroughArgs(t, rs.name, def)...)
			if err := app.Run(context.Background(), args); err != nil {
				t.Fatalf("engine serve: %v", err)
			}

			if want := "engine serve " + rs.name; commandPath != want {
				t.Errorf("%s command path = %q, want %q", rs.name, commandPath, want)
			}

			if got != engineVersionUnderTest {
				t.Errorf(
					"%s reports Root().Version = %q, want the engine's %q"+
						" (its --version and /version endpoint go stale or empty)",
					rs.name, got, engineVersionUnderTest,
				)
			}
		})
	}
}

// TestEngineAppCarriesBuildVersion checks that the engine command tree holds
// the version injected into main.Version at link time.
func TestEngineAppCarriesBuildVersion(t *testing.T) {
	t.Parallel()

	if got := newApp(engineVersionUnderTest).Version; got != engineVersionUnderTest {
		t.Errorf("engine command Version = %q, want %q", got, engineVersionUnderTest)
	}
}

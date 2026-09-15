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

// TestBundledServicesReportEngineVersion pins the version each bundled service
// reports when it runs inside the engine.
//
// The engine is one binary with one build version. The services it bundles no
// longer link their own main packages, so the "-X main.Version" each service's
// project.nix injects never reaches them here; services/engine/project.nix
// injects the engine's main.Version instead, and buildService hands it to each
// service's wrapper command. Auth, storage and constellation all read
// cmd.Root().Version for their startup log and their version endpoint, so that
// hop is the only thing keeping those from going empty.
//
// This is worth asserting because every way it breaks is silent: a mistyped
// linker symbol still builds (storage shipped that way, injecting
// controller.buildVersion while main.Version stayed empty), and a service
// reintroducing its own package-level version var would compile and report "".
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

			def := rs.def
			def.newService = func(
				_ context.Context, cmd *cli.Command, _ *slog.Logger,
			) (*serveutil.Service, error) {
				got = cmd.Root().Version

				return &serveutil.Service{}, nil
			}

			prefixed := servicePrefixedFlags(
				rs.name, def.command().Flags, def.skip, def.hidden,
			)

			runParsed(t, prefixed, requiredPassthroughArgs(t, rs.name, def),
				func(cmd *cli.Command) {
					if _, err := buildService(
						context.Background(), def, rs.name, cmd,
						engineVersionUnderTest, slog.New(slog.DiscardHandler), cfg,
					); err != nil {
						t.Fatalf("buildService: %v", err)
					}
				})

			if got != engineVersionUnderTest {
				t.Errorf(
					"%s reports Root().Version = %q, want the engine's %q"+
						" (its --version, startup log and /version endpoint go stale or empty)",
					rs.name, got, engineVersionUnderTest,
				)
			}
		})
	}
}

// TestEngineAppCarriesBuildVersion covers the hop before that one: the value
// main.Version receives from the linker has to reach the command tree, since
// that is what buildService later passes to every bundled service.
func TestEngineAppCarriesBuildVersion(t *testing.T) {
	t.Parallel()

	if got := newApp(engineVersionUnderTest).Version; got != engineVersionUnderTest {
		t.Errorf("engine command Version = %q, want %q", got, engineVersionUnderTest)
	}
}

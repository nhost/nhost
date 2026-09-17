// Command engine runs the Nhost Go services (auth, storage, and the
// constellation GraphQL engine) in a single process behind one shared listener.
// `engine serve` runs them all; shared settings are configured with
// global flags and each service's remaining options are available as prefixed
// flags (--auth-*, --storage-*, --graphql-*). It is intended to replace the
// individual service binaries.
package main

import (
	"context"
	"log"
	"os"

	serveutil "github.com/nhost/nhost/internal/lib/serve"
	"github.com/urfave/cli/v3"
	_ "go.uber.org/automaxprocs" // set GOMAXPROCS from the Linux container CPU quota
)

// Version is set at build time via -ldflags "-X main.Version=...".
var Version string

func main() {
	// A single signal-aware context drives every selected service: SIGINT or
	// SIGTERM cancels it, and Supervise propagates that into a graceful shutdown
	// of all of them together. SignalContext keeps both signals captured for the
	// whole sequence, so repeated termination signals cannot interrupt in-flight
	// cleanup; bounded teardown tiers handle services that ignore cancellation.
	ctx := serveutil.SignalContext(context.Background())

	if err := newApp(Version).Run(ctx, os.Args); err != nil {
		log.Fatal(err)
	}
}

// newApp builds the top-level engine command. It carries the serve
// subcommand and lets urfave/cli own --help and --version.
func newApp(version string) *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "engine",
		Version: version,
		Usage:   "run the Nhost services (auth, storage, graphql) in one process",
		Commands: []*cli.Command{
			{
				Name:  "serve",
				Usage: "serve all enabled services behind one shared listener",
				Flags: serveFlags(),
				Action: func(ctx context.Context, cmd *cli.Command) error {
					return runServe(ctx, cmd, version)
				},
			},
		},
	}
}

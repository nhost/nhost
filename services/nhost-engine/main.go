// Command nhost-engine runs the Nhost Go services (auth, storage, and the
// constellation GraphQL engine) in a single process behind one shared listener.
// `nhost-engine serve` runs them all; shared settings are configured with
// global flags and each service's remaining options are available as prefixed
// flags (--auth-*, --storage-*, --graphql-*). It is intended to replace the
// individual service binaries.
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/urfave/cli/v3"
	_ "go.uber.org/automaxprocs" // set GOMAXPROCS from the Linux container CPU quota
)

// Version is set at build time via -ldflags "-X main.Version=...".
var Version string

func main() {
	// realMain owns the signal context so its deferred stop() runs before the
	// process exits; main only turns a returned error into a non-zero exit,
	// keeping log.Fatal out of the way of the deferred cleanup.
	if err := realMain(); err != nil {
		log.Fatal(err)
	}
}

func realMain() error {
	// A single signal-aware context drives every selected service: SIGINT or
	// SIGTERM cancels it, and Supervise propagates that into a graceful
	// shutdown of all of them together.
	ctx, stop := signal.NotifyContext(
		context.Background(), os.Interrupt, syscall.SIGTERM,
	)
	defer stop()

	if err := newApp(Version).Run(ctx, os.Args); err != nil {
		return fmt.Errorf("running nhost-engine: %w", err)
	}

	return nil
}

// newApp builds the top-level nhost-engine command. It carries the serve
// subcommand and lets urfave/cli own --help and --version.
func newApp(version string) *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "nhost-engine",
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

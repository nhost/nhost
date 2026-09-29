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
	"os/signal"
	"syscall"

	"github.com/urfave/cli/v3"
	_ "go.uber.org/automaxprocs" // set GOMAXPROCS from the Linux container CPU quota
)

// Version is set at build time via -ldflags "-X main.Version=...".
var Version string

func main() {
	ctx, stop := signalContext()

	err := newApp(Version).Run(ctx, os.Args)

	// Called directly rather than deferred: log.Fatal exits through os.Exit,
	// which skips deferred calls.
	stop()

	if err != nil {
		log.Fatal(err)
	}
}

// signalContext returns the context that drives every selected service.
// Signal handling is process-wide, so it lives here rather than in the shared
// serve library: SIGINT or SIGTERM cancels ctx, and serve.Run turns that into a
// graceful shutdown of all services together. The handler stays registered
// until stop, so a repeated signal cannot kill the process mid-shutdown; Run's
// shutdown budget bounds how long that takes instead.
func signalContext() (context.Context, context.CancelFunc) {
	return signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
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

package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/nhost/nhost/services/auth/go/cmd"
	docs "github.com/urfave/cli-docs/v3"
	"github.com/urfave/cli/v3"
)

const (
	flagOutput = "output"
)

var Version string

func markdownDocs() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:  "docs",
		Usage: "Generate markdown documentation for the CLI",
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:  flagOutput,
				Usage: "Output file (default: stdout)",
				Value: "",
			},
		},
		Action: func(_ context.Context, cmd *cli.Command) error {
			md, err := docs.ToMarkdown(cmd.Root())
			if err != nil {
				return cli.Exit("failed to generate markdown documentation: "+err.Error(), 1)
			}

			out := os.Stdout
			if output := cmd.String(flagOutput); output != "" {
				out, err = os.OpenFile(
					output,
					os.O_CREATE|os.O_WRONLY|os.O_TRUNC,
					0o644, //nolint:mnd
				)
				if err != nil {
					return cli.Exit("failed to open output file: "+err.Error(), 1)
				}
			}
			defer out.Close()

			if _, err := out.WriteString(md); err != nil {
				return cli.Exit("failed to write markdown documentation: "+err.Error(), 1)
			}

			return nil
		},
	}
}

//go:generate oapi-codegen -config go/api/server.cfg.yaml docs/openapi.yaml
//go:generate oapi-codegen -config go/api/types.cfg.yaml docs/openapi.yaml
func main() {
	// Signal handling is process-wide, so it lives here rather than in the
	// shared serve library. SIGINT or SIGTERM cancels ctx, which reaches the
	// shared serve Run through the command action and triggers a graceful
	// shutdown. The handler stays registered until stop, so a second signal
	// cannot kill the process mid-shutdown; Run's shutdown budget bounds
	// how long that takes instead.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)

	serveCmd := cmd.CommandServe()
	app := &cli.Command{ //nolint:exhaustruct
		Name:    "auth",
		Version: Version,
		Usage:   "Nhost Auth API server",
		Flags:   serveCmd.Flags,
		Commands: []*cli.Command{
			markdownDocs(),
		},
		Action: serveCmd.Action,
	}

	err := app.Run(ctx, os.Args)

	// Called directly rather than deferred: log.Fatal exits through os.Exit,
	// which skips deferred calls.
	stop()

	if err != nil {
		log.Fatal(err)
	}
}

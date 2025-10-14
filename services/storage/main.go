package main

import (
	"context"
	"log"
	"os"

	"github.com/nhost/nhost/services/storage/cmd"
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

//go:generate oapi-codegen -config api/server.cfg.yaml controller/openapi.yaml
//go:generate oapi-codegen -config api/types.cfg.yaml controller/openapi.yaml
//go:generate gqlgenc
func main() {
	serveCmd := cmd.CommandServe()
	app := &cli.Command{ //nolint:exhaustruct
		Name:    "storage",
		Version: Version,
		Usage:   "Nhost Storage API server",
		Flags:   serveCmd.Flags,
		Commands: []*cli.Command{
			markdownDocs(),
		},
		Action: serveCmd.Action,
	}

	if err := app.Run(context.Background(), os.Args); err != nil {
		log.Fatal(err)
	}
}

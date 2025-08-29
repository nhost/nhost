package openapi

import (
	"context"

	"github.com/urfave/cli/v3"
)

const (
	flagOpenAPIFile = "openapi-file"
	flagOutDir      = "out-dir"
)

func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:  "openapi",
		Usage: "Generate OpenAPI reference files from an OpenAPI spec",
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagOpenAPIFile,
				Usage:    "Path to the OpenAPI spec file",
				Required: true,
				Sources:  cli.EnvVars("OPENAPI_FILE"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagOutDir,
				Usage:    "Output directory for the generated files",
				Required: true,
				Sources:  cli.EnvVars("OUT_DIR"),
			},
		},
		Action: action,
	}
}

func action(_ context.Context, cmd *cli.Command) error {
	if err := process(
		cmd.String(flagOpenAPIFile),
		cmd.String(flagOutDir),
	); err != nil {
		return cli.Exit("failed to generate OpenAPI reference files", 1)
	}

	return nil
}

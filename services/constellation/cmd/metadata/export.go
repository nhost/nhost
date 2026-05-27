package metadata

import (
	"context"
	"fmt"
	"os"

	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/urfave/cli/v3"
)

const (
	flagFrom = "from"
	flagTo   = "to"
)

func commandExport() *cli.Command {
	return &cli.Command{ //nolint: exhaustruct
		Name:  "export",
		Usage: "Export Hasura YAML metadata to TOML format",
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagFrom,
				Usage:    "Path to hasura metadata.yaml",
				Required: true,
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagTo,
				Usage:    "Output TOML file path",
				Required: true,
			},
		},
		Action: exportMetadata,
	}
}

func exportMetadata(ctx context.Context, cmd *cli.Command) error {
	from := cmd.String(flagFrom)
	to := cmd.String(flagTo)

	meta, err := metadata.FromDetect(ctx, from)
	if err != nil {
		return fmt.Errorf("loading metadata from %s: %w", from, err)
	}

	data, err := metadata.MarshalTOML(meta)
	if err != nil {
		return fmt.Errorf("encoding metadata to TOML: %w", err)
	}

	if err := os.WriteFile(to, data, 0o600); err != nil { //nolint: mnd
		return fmt.Errorf("writing output to %s: %w", to, err)
	}

	return nil
}

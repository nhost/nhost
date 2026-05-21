package debug //nolint:revive,nolintlint

import (
	"bytes"
	"context"
	"fmt"
	"log/slog"

	"github.com/nhost/nhost/services/constellation/connector"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/urfave/cli/v3"
	"github.com/vektah/gqlparser/v2/formatter"
)

const (
	flagMetadataPath = "metadata"
	flagRole         = "role"
)

func commandSchemaGen() *cli.Command {
	return &cli.Command{ //nolint: exhaustruct
		Name:  "schema-gen",
		Usage: "Load metadata and generate GraphQL schema SDL",
		Description: `Load metadata from a directory, generate schema documents, and output the SDL.
This tool is useful for debugging schema generation and understanding the generated schema.`,
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint: exhaustruct
				Name:     flagMetadataPath,
				Usage:    "Path to the metadata directory",
				Required: true,
				Aliases:  []string{"m"},
			},
			&cli.StringFlag{ //nolint: exhaustruct
				Name:    flagRole,
				Usage:   "Role to generate schema for (default: user)",
				Value:   "user",
				Aliases: []string{"r"},
			},
		},
		Action: schemaGen,
	}
}

func schemaGen(ctx context.Context, cmd *cli.Command) error {
	metadataPath := cmd.String(flagMetadataPath)
	role := cmd.String(flagRole)

	meta, err := metadata.FromDetect(ctx, metadataPath)
	if err != nil {
		return cli.Exit(fmt.Sprintf("failed to load metadata: %v", err), 1)
	}

	logger := slog.Default()

	built, err := connector.BuildConnectorsFromMetadata(ctx, meta, logger)
	if err != nil {
		return cli.Exit(fmt.Sprintf("failed to build connectors from metadata: %v", err), 1)
	}

	schema, exists := built.SchemaDocs[role]
	if !exists {
		availableRoles := make([]string, 0, len(built.SchemaDocs))
		for r := range built.SchemaDocs {
			availableRoles = append(availableRoles, r)
		}

		return cli.Exit(
			fmt.Sprintf("role '%s' not found. Available roles: %v", role, availableRoles),
			1,
		)
	}

	var buf bytes.Buffer

	f := formatter.NewFormatter(&buf, formatter.WithIndent("  "))
	f.FormatSchemaDocument(schema)

	fmt.Println(buf.String()) //nolint:forbidigo

	return nil
}

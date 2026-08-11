// Package metadata provides the `constellation metadata` CLI command group
// for managing Hasura-compatible metadata files (currently: exporting YAML to
// TOML).
package metadata

import "github.com/urfave/cli/v3"

// CommandMetadata returns the top-level "metadata" CLI command and its
// subcommands.
func CommandMetadata() *cli.Command {
	return &cli.Command{ //nolint: exhaustruct
		Name:  "metadata",
		Usage: "Metadata management commands",
		Commands: []*cli.Command{
			commandExport(),
		},
	}
}

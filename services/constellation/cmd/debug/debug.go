// Package debug provides the `constellation debug` CLI command group, which
// exposes development-time utilities for inspecting and comparing generated
// GraphQL schemas.
package debug //nolint:revive,nolintlint

import "github.com/urfave/cli/v3"

// CommandDebug returns the top-level "debug" CLI command and its subcommands.
func CommandDebug() *cli.Command {
	return &cli.Command{ //nolint: exhaustruct
		Name:  "debug",
		Usage: "Debugging commands",
		Commands: []*cli.Command{
			commandSchemaDiff(),
			commandSchemaGen(),
		},
	}
}

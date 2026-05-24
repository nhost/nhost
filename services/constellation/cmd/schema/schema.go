// Package schema provides the `constellation schema` CLI command group, which
// exposes utilities for working with GraphQL schemas exposed by a running
// constellation (or any other GraphQL endpoint).
package schema //nolint:revive,nolintlint

import "github.com/urfave/cli/v3"

// CommandSchema returns the top-level "schema" CLI command and its subcommands.
func CommandSchema() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:  "schema",
		Usage: "Schema utilities",
		Commands: []*cli.Command{
			commandDiff(),
			commandDump(),
		},
	}
}

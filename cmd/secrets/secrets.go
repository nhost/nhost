package secrets

import "github.com/urfave/cli/v2"

func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "secrets",
		Aliases: []string{},
		Usage:   "Manage secrets",
		Subcommands: []*cli.Command{
			CommandCreate(),
			CommandDelete(),
			CommandList(),
			CommandUpdate(),
		},
	}
}

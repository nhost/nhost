package config

import "github.com/urfave/cli/v2"

func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "config",
		Aliases: []string{},
		Usage:   "Perform config operations",
		Subcommands: []*cli.Command{
			CommandDefault(),
			CommandPull(),
			CommandValidate(),
		},
	}
}

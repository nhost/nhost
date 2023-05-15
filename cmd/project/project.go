package project

import "github.com/urfave/cli/v2"

func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "project",
		Aliases: []string{},
		Usage:   "Perform project management operations",
		Subcommands: []*cli.Command{
			CommandInit(),
			CommandList(),
			CommandLink(),
		},
	}
}

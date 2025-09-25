package dev

import "github.com/urfave/cli/v2"

func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "dev",
		Aliases: []string{},
		Usage:   "Operate local development environment",
		Subcommands: []*cli.Command{
			CommandCompose(),
			CommandHasura(),
		},
	}
}

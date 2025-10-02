package dev

import "github.com/urfave/cli/v3"

func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "dev",
		Aliases: []string{},
		Usage:   "Operate local development environment",
		Commands: []*cli.Command{
			CommandCompose(),
			CommandHasura(),
		},
	}
}

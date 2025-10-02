package config

import "github.com/urfave/cli/v3"

const flagSubdomain = "subdomain"

func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "config",
		Aliases: []string{},
		Usage:   "Perform config operations",
		Commands: []*cli.Command{
			CommandDefault(),
			CommandExample(),
			CommandApply(),
			CommandPull(),
			CommandShow(),
			CommandValidate(),
			CommandEdit(),
		},
	}
}

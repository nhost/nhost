package docs

import "github.com/urfave/cli/v3"

func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "docs",
		Aliases: []string{},
		Usage:   "Access embedded documentation",
		Commands: []*cli.Command{
			CommandList(),
			CommandSearch(),
			CommandShow(),
		},
	}
}

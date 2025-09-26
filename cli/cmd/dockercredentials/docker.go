package dockercredentials

import "github.com/urfave/cli/v2"

func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "docker-credentials",
		Aliases: []string{},
		Usage:   "Perform docker-credentials operations",
		Subcommands: []*cli.Command{
			CommandGet(),
			CommandErase(),
			CommandStore(),
			CommandConfigure(),
		},
	}
}

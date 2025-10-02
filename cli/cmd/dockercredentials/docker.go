package dockercredentials

import "github.com/urfave/cli/v3"

func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "docker-credentials",
		Aliases: []string{},
		Usage:   "Perform docker-credentials operations",
		Commands: []*cli.Command{
			CommandGet(),
			CommandErase(),
			CommandStore(),
			CommandConfigure(),
		},
	}
}

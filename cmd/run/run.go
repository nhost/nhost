package run

import "github.com/urfave/cli/v2"

func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "run",
		Aliases: []string{},
		Usage:   "Perform operations on Nhost Run",
		Subcommands: []*cli.Command{
			CommandConfigDeploy(),
			CommandConfigEditImage(),
			CommandConfigPull(),
			CommandConfigValidate(),
		},
	}
}

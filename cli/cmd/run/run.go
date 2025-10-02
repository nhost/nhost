package run

import "github.com/urfave/cli/v3"

func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "run",
		Aliases: []string{},
		Usage:   "Perform operations on Nhost Run",
		Commands: []*cli.Command{
			CommandConfigShow(),
			CommandConfigDeploy(),
			CommandConfigEdit(),
			CommandConfigEditImage(),
			CommandConfigPull(),
			CommandConfigValidate(),
			CommandConfigExample(),
			CommandEnv(),
		},
	}
}

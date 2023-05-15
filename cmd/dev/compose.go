package dev

import (
	"github.com/nhost/cli/clienv"
	"github.com/nhost/cli/v2/dockercompose"
	"github.com/urfave/cli/v2"
)

func CommandCompose() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "compose",
		Aliases: []string{},
		Usage:   "docker-compose wrapper, sets project name and compose file automatically",
		Action:  commandCompose,
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagProjectName,
				Usage:   "Project name",
				Value:   "nhost",
				EnvVars: []string{"NHOST_PROJECT_NAME"},
			},
		},
		SkipFlagParsing: true,
	}
}

func commandCompose(cCtx *cli.Context) error {
	ce := clienv.New(cCtx)
	dc := dockercompose.New(ce.Path.DockerCompose(), cCtx.String(flagProjectName))
	return dc.Wrapper(cCtx.Context, cCtx.Args().Slice()...) //nolint:wrapcheck
}

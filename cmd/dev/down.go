package dev

import (
	"github.com/nhost/cli/clienv"
	"github.com/nhost/cli/v2/dockercompose"
	"github.com/urfave/cli/v2"
)

func CommandDown() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "down",
		Aliases: []string{},
		Usage:   "Stop local development environment",
		Action:  commandDown,
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagProjectName,
				Usage:   "Project name",
				Value:   "nhost",
				EnvVars: []string{"NHOST_PROJECT_NAME"},
			},
		},
	}
}

func commandDown(cCtx *cli.Context) error {
	ce := clienv.New(cCtx)

	dc := dockercompose.New(ce.Path.DockerCompose(), cCtx.String(flagProjectName))

	if err := dc.Stop(cCtx.Context); err != nil {
		ce.Warnln("failed to stop Nhost development environment: %s", err)
	}

	return nil
}

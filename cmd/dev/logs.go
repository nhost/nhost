package dev

import (
	"github.com/nhost/cli/clienv"
	"github.com/nhost/cli/v2/dockercompose"
	"github.com/urfave/cli/v2"
)

func CommandLogs() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "logs",
		Aliases: []string{},
		Usage:   "Show logs from local development environment",
		Action:  commandLogs,
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

func commandLogs(cCtx *cli.Context) error {
	ce := clienv.New(cCtx)

	dc := dockercompose.New(ce.Path.DockerCompose(), cCtx.String(flagProjectName))

	if err := dc.Logs(cCtx.Context, cCtx.Args().Slice()...); err != nil {
		ce.Warnln("%s", err)
	}

	return nil
}

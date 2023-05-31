package dev

import (
	"github.com/nhost/cli/clienv"
	"github.com/nhost/cli/dockercompose"
	"github.com/urfave/cli/v2"
)

func CommandLogs() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:            "logs",
		Aliases:         []string{},
		Usage:           "Show logs from local development environment",
		Action:          commandLogs,
		Flags:           []cli.Flag{},
		SkipFlagParsing: true,
	}
}

func commandLogs(cCtx *cli.Context) error {
	ce := clienv.FromCLI(cCtx)

	dc := dockercompose.New(ce.Path.WorkingDir(), ce.Path.DockerCompose(), ce.ProjectName())

	if err := dc.Logs(cCtx.Context, cCtx.Args().Slice()...); err != nil {
		ce.Warnln("%s", err)
	}

	return nil
}

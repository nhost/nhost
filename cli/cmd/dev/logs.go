package dev

import (
	"context"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/dockercompose"
	"github.com/urfave/cli/v3"
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

func commandLogs(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	dc := dockercompose.New(ce.Path.WorkingDir(), ce.Path.DockerCompose(), ce.ProjectName())

	if err := dc.Logs(ctx, cmd.Args().Slice()...); err != nil {
		ce.Warnln("%s", err)
	}

	return nil
}

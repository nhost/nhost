package dev

import (
	"context"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/dockercompose"
	"github.com/urfave/cli/v3"
)

func CommandCompose() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:            "compose",
		Aliases:         []string{},
		Usage:           "docker compose wrapper, sets project name and compose file automatically",
		Action:          commandCompose,
		Flags:           []cli.Flag{},
		SkipFlagParsing: true,
	}
}

func commandCompose(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)
	dc := dockercompose.New(ce.Path.WorkingDir(), ce.Path.DockerCompose(), ce.ProjectName())

	return dc.Wrapper(ctx, cmd.Args().Slice()...) //nolint:wrapcheck
}

package dev

import (
	"github.com/nhost/cli/clienv"
	"github.com/nhost/cli/dockercompose"
	"github.com/urfave/cli/v2"
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

func commandCompose(cCtx *cli.Context) error {
	ce := clienv.FromCLI(cCtx)
	dc := dockercompose.New(ce.Path.WorkingDir(), ce.Path.DockerCompose(), ce.ProjectName())

	return dc.Wrapper(cCtx.Context, cCtx.Args().Slice()...) //nolint:wrapcheck
}

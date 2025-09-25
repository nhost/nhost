package dev

import (
	"github.com/nhost/cli/clienv"
	"github.com/nhost/cli/dockercompose"
	"github.com/urfave/cli/v2"
)

const (
	flagVolumes = "volumes"
)

func CommandDown() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "down",
		Aliases: []string{},
		Usage:   "Stop local development environment",
		Action:  commandDown,
		Flags: []cli.Flag{
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:  flagVolumes,
				Usage: "Remove volumes",
				Value: false,
			},
		},
	}
}

func commandDown(cCtx *cli.Context) error {
	ce := clienv.FromCLI(cCtx)

	dc := dockercompose.New(ce.Path.WorkingDir(), ce.Path.DockerCompose(), ce.ProjectName())

	if err := dc.Stop(cCtx.Context, cCtx.Bool(flagVolumes)); err != nil {
		ce.Warnln("failed to stop Nhost development environment: %s", err)
	}

	return nil
}

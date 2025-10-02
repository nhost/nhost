package dev

import (
	"context"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/dockercompose"
	"github.com/urfave/cli/v3"
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

func commandDown(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	dc := dockercompose.New(ce.Path.WorkingDir(), ce.Path.DockerCompose(), ce.ProjectName())

	if err := dc.Stop(ctx, cmd.Bool(flagVolumes)); err != nil {
		ce.Warnln("failed to stop Nhost development environment: %s", err)
	}

	return nil
}

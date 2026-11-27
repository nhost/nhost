package dev

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/dockercompose"
	"github.com/urfave/cli/v3"
)

const (
	flagVolumes = "volumes"
)

type composeStopper interface {
	Stop(ctx context.Context, volumes bool) error
}

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

	return stopDevEnvironment(ctx, ce, dc, cmd.Bool(flagVolumes))
}

func stopDevEnvironment(
	ctx context.Context,
	ce *clienv.CliEnv,
	stopper composeStopper,
	volumes bool,
) error {
	if err := stopper.Stop(ctx, volumes); err != nil {
		ce.Warnln("failed to stop Nhost development environment: %s", err)

		return fmt.Errorf("failed to stop Nhost development environment: %w", err)
	}

	return nil
}

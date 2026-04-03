package dev

import (
	"context"
	"io"
	"os"
	"strings"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/dockercompose"
	"github.com/nhost/nhost/cli/tui"
	"github.com/urfave/cli/v3"
	"golang.org/x/term"
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
	volumes := cmd.Bool(flagVolumes)

	isTTY := term.IsTerminal(int(os.Stdout.Fd()))
	if isTTY {
		return commandDownTUI(ctx, ce, volumes)
	}

	return commandDownPlain(ctx, ce, volumes)
}

func commandDownTUI(
	ctx context.Context,
	ce *clienv.CliEnv,
	volumes bool,
) error {
	dc := dockercompose.NewWithWriters(
		ce.Path.WorkingDir(), ce.Path.DockerCompose(), ce.ProjectName(),
		io.Discard, io.Discard, strings.NewReader(""),
	)

	return tui.RunTeardown(ctx, dc, volumes) //nolint:wrapcheck
}

func commandDownPlain(
	ctx context.Context,
	ce *clienv.CliEnv,
	volumes bool,
) error {
	dc := dockercompose.New(
		ce.Path.WorkingDir(), ce.Path.DockerCompose(), ce.ProjectName(),
	)

	if err := dc.Stop(ctx, volumes); err != nil {
		ce.Warnln(
			"failed to stop Nhost development environment: %s", err,
		)
	}

	return nil
}

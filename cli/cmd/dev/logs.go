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

	isTTY := term.IsTerminal(int(os.Stdout.Fd()))
	if isTTY {
		return commandLogsTUI(ctx, ce)
	}

	return commandLogsPlain(ctx, ce, cmd)
}

func commandLogsTUI(ctx context.Context, ce *clienv.CliEnv) error {
	dc := dockercompose.NewWithWriters(
		ce.Path.WorkingDir(), ce.Path.DockerCompose(), ce.ProjectName(),
		io.Discard, io.Discard, strings.NewReader(""),
	)

	return tui.RunLogViewer(ctx, dc, "nhost logs") //nolint:wrapcheck
}

func commandLogsPlain(
	ctx context.Context,
	ce *clienv.CliEnv,
	cmd *cli.Command,
) error {
	dc := dockercompose.New(
		ce.Path.WorkingDir(), ce.Path.DockerCompose(), ce.ProjectName(),
	)

	if err := dc.Logs(ctx, cmd.Args().Slice()...); err != nil {
		ce.Warnln("%s", err)
	}

	return nil
}

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

const flagFollow = "follow"

func CommandLogs() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:      "logs",
		Aliases:   []string{},
		Usage:     "Show logs from local development environment",
		ArgsUsage: "[SERVICE]",
		Action:    commandLogs,
		Flags: []cli.Flag{
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:    flagFollow,
				Aliases: []string{"f"},
				Usage:   "Follow log output",
			},
		},
	}
}

func commandLogs(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)
	service := cmd.Args().First()

	isTTY := term.IsTerminal(int(os.Stdout.Fd()))
	if isTTY {
		return commandLogsTUI(ctx, ce, service)
	}

	return commandLogsPlain(ctx, ce, cmd, service)
}

func commandLogsTUI(ctx context.Context, ce *clienv.CliEnv, service string) error {
	dc := dockercompose.NewWithWriters(
		ce.Path.WorkingDir(), ce.Path.DockerCompose(), ce.ProjectName(),
		io.Discard, io.Discard, strings.NewReader(""),
	)

	return tui.RunLogViewer(ctx, dc, "nhost logs", service) //nolint:wrapcheck
}

func commandLogsPlain(
	ctx context.Context,
	ce *clienv.CliEnv,
	cmd *cli.Command,
	service string,
) error {
	dc := dockercompose.New(
		ce.Path.WorkingDir(), ce.Path.DockerCompose(), ce.ProjectName(),
	)

	var args []string
	if cmd.Bool(flagFollow) {
		args = append(args, "--follow")
	}

	if service != "" {
		args = append(args, service)
	}

	if err := dc.Logs(ctx, args...); err != nil {
		ce.Warnln("%s", err)
	}

	return nil
}

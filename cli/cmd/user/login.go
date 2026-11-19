package user //nolint:revive,nolintlint

import (
	"context"
	"os"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/tui"
	"github.com/urfave/cli/v3"
	"golang.org/x/term"
)

func CommandLogin() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "login",
		Aliases: []string{},
		Usage:   "Login to Nhost",
		Action:  commandLogin,
	}
}

func commandLogin(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	isTTY := term.IsTerminal(int(os.Stdout.Fd()))
	if isTTY {
		return commandLoginTUI(ctx, ce)
	}

	_, err := ce.Login(ctx)

	return err //nolint:wrapcheck
}

func commandLoginTUI(ctx context.Context, ce *clienv.CliEnv) error {
	return tui.RunWithSpinner( //nolint:wrapcheck
		"Waiting for browser authentication...",
		func() error {
			_, err := ce.Login(ctx)

			return err //nolint:wrapcheck
		},
	)
}

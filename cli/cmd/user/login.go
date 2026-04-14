package user //nolint:revive,nolintlint

import (
	"context"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/urfave/cli/v3"
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
	_, err := ce.Login(ctx)

	return err //nolint:wrapcheck
}

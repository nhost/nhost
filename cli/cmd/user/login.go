package user //nolint:revive,nolintlint

import (
	"context"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/urfave/cli/v3"
)

const (
	flagEmail    = "email"
	flagPassword = "password"
	flagPAT      = "pat"
)

func CommandLogin() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "login",
		Aliases: []string{},
		Usage:   "Login to Nhost",
		Action:  commandLogin,
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagPAT,
				Usage:   "Use this Personal Access Token instead of generating a new one with your email/password",
				Sources: cli.EnvVars("NHOST_PAT"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagEmail,
				Usage:   "Email address",
				Sources: cli.EnvVars("NHOST_EMAIL"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagPassword,
				Usage:   "Password",
				Sources: cli.EnvVars("NHOST_PASSWORD"),
			},
		},
	}
}

func commandLogin(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)
	_, err := ce.Login(
		ctx, cmd.String(flagPAT), cmd.String(flagEmail), cmd.String(flagPassword),
	)

	return err //nolint:wrapcheck
}

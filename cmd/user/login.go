package user

import (
	"github.com/nhost/cli/clienv"
	"github.com/urfave/cli/v2"
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
				Name:    flagEmail,
				Usage:   "Email address",
				EnvVars: []string{"NHOST_EMAIL"},
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagPassword,
				Usage:   "Password",
				EnvVars: []string{"NHOST_PASSWORD"},
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagPAT,
				Usage:   "Use this Personal Access Token instead of generating a new one with your email/password",
				EnvVars: []string{"NHOST_PAT"},
			},
		},
	}
}

func commandLogin(cCtx *cli.Context) error {
	ce := clienv.FromCLI(cCtx)
	_, err := ce.Login(
		cCtx.Context, cCtx.String(flagEmail), cCtx.String(flagPassword), cCtx.String(flagPAT),
	)
	return err //nolint:wrapcheck
}

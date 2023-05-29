package user

import (
	"github.com/nhost/cli/clienv"
	"github.com/urfave/cli/v2"
)

const (
	flagEmail    = "email"
	flagPassword = "password"
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
		},
	}
}

func commandLogin(cCtx *cli.Context) error {
	ce := clienv.New(cCtx)
	_, err := ce.Login(cCtx.Context, cCtx.String(flagEmail), cCtx.String(flagPassword))
	return err //nolint:wrapcheck
}

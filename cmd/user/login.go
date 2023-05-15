package user

import (
	"fmt"

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
	email := cCtx.String(flagEmail)
	password := cCtx.String(flagPassword)

	var err error
	if email == "" {
		ce.PromptMessage("email: ")
		email, err = ce.PromptInput(false)
		if err != nil {
			return fmt.Errorf("failed to read email: %w", err)
		}
	}

	if password == "" {
		ce.PromptMessage("password: ")
		password, err = ce.PromptInput(true)
		ce.Println("")
		if err != nil {
			return fmt.Errorf("failed to read password: %w", err)
		}
	}

	_, err = ce.Login(cCtx.Context, email, password)
	return err //nolint:wrapcheck
}

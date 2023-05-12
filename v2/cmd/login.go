package cmd

import (
	"github.com/nhost/cli/v2/controller"
	"github.com/nhost/cli/v2/nhostclient"
	"github.com/spf13/cobra"
)

const (
	flagEmail    = "email"
	flagPassword = "password"
)

func LoginCmd() *cobra.Command {
	return logincCmd()
}

// loginCmd represents the login command.
func logincCmd() *cobra.Command {
	return &cobra.Command{ //nolint:exhaustruct
		Use:        "login",
		SuggestFor: []string{"logout"},
		Short:      "Log in to your Nhost account",
		RunE: func(cmd *cobra.Command, _ []string) error {
			var err error

			email := cmd.Flag(flagEmail).Value.String()
			password := cmd.Flag(flagPassword).Value.String()

			cl := nhostclient.New(cmd.Flag(flagDomain).Value.String())
			_, err = controller.Login(cmd.Context(), cmd, cl, email, password)
			return err //nolint:wrapcheck
		},
	}
}

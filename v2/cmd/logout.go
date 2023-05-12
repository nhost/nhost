package cmd

import (
	"errors"
	"os"

	"github.com/nhost/cli/v2/controller"
	"github.com/nhost/cli/v2/nhostclient"
	"github.com/nhost/cli/v2/system"
	"github.com/nhost/cli/v2/tui"
	"github.com/spf13/cobra"
)

func logoutCmd() *cobra.Command {
	return &cobra.Command{ //nolint:exhaustruct
		Use:        "logout",
		SuggestFor: []string{"login"},
		Short:      "Log out your Nhost account",
		RunE: func(cmd *cobra.Command, _ []string) error {
			cl := nhostclient.New(cmd.Flag(flagDomain).Value.String())
			err := controller.Logout(cmd.Context(), cmd, cl)
			switch {
			case errors.Is(err, controller.ErrNoContent):
				return nil
			case err != nil:
				cmd.Println(tui.Warn("%s", err.Error()))
			}
			cmd.Println(tui.Info("Deleting PAT from local storage"))
			if err := os.Remove(system.PathAuthFile()); err != nil {
				cmd.Println(tui.Warn("failed to remove auth file: %s", err.Error()))
			}
			cmd.Println(tui.Info("Logout successful"))

			return nil
		},
	}
}

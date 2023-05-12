package cmd

import (
	"github.com/nhost/cli/v2/controller"
	"github.com/nhost/cli/v2/nhostclient"
	"github.com/spf13/cobra"
)

func secretsDeleteCmd() *cobra.Command {
	return &cobra.Command{ //nolint:exhaustruct
		Use:   "delete SECRET_NAME",
		Short: "Delete a secret",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cl := nhostclient.New(cmd.Flag(flagDomain).Value.String())
			return controller.SecretsDelete(cmd.Context(), cmd, cl, args[0]) //nolint:wrapcheck
		},
	}
}

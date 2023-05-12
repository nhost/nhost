package cmd

import (
	"github.com/nhost/cli/v2/controller"
	"github.com/nhost/cli/v2/nhostclient"
	"github.com/spf13/cobra"
)

func secretsListCmd() *cobra.Command {
	return &cobra.Command{ //nolint:exhaustruct
		Use:   "list",
		Short: "List all secrets",
		RunE: func(cmd *cobra.Command, _ []string) error {
			cl := nhostclient.New(cmd.Flag(flagDomain).Value.String())
			return controller.SecretsList(cmd.Context(), cmd, cl) //nolint:wrapcheck
		},
	}
}

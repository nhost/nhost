package cmd

import (
	"github.com/nhost/cli/v2/controller"
	"github.com/nhost/cli/v2/nhostclient"
	"github.com/spf13/cobra"
)

func secretsCreateCmd() *cobra.Command {
	return &cobra.Command{ //nolint:exhaustruct
		Use:   "create SECRET_NAME SECRET_VALUE",
		Short: "Create a new secret",
		Args:  cobra.ExactArgs(2), //nolint:gomnd
		RunE: func(cmd *cobra.Command, args []string) error {
			cl := nhostclient.New(cmd.Flag(flagDomain).Value.String())
			return controller.SecretsCreate( //nolint:wrapcheck
				cmd.Context(),
				cmd,
				cl,
				args[0],
				args[1],
			)
		},
	}
}

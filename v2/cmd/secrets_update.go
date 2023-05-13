package cmd

import (
	"github.com/nhost/cli/v2/controller"
	"github.com/nhost/cli/v2/nhostclient"
	"github.com/spf13/cobra"
)

func secretsUpdateCmd() *cobra.Command {
	return &cobra.Command{ //nolint:exhaustruct
		Use:   "update SECRET_NAME SECRET_VALUE",
		Short: "Update a secret",
		Args:  cobra.ExactArgs(2), //nolint:gomnd
		RunE: func(cmd *cobra.Command, args []string) error {
			fs, err := getFolders(cmd.Parent())
			if err != nil {
				return err
			}

			cl := nhostclient.New(cmd.Flag(flagDomain).Value.String())
			return controller.SecretsUpdate( //nolint:wrapcheck
				cmd.Context(),
				cmd,
				cl,
				args[0],
				args[1],
				fs,
			)
		},
	}
}

package cmd

import (
	"fmt"

	"github.com/nhost/cli/v2/controller"
	"github.com/nhost/cli/v2/nhostclient"
	"github.com/spf13/cobra"
)

func configValidateCmd() *cobra.Command {
	return &cobra.Command{ //nolint:exhaustruct
		Use:  "validate",
		Long: `Validate configuration`,
		RunE: func(cmd *cobra.Command, _ []string) error {
			fs, err := getFolders(cmd.Parent())
			if err != nil {
				return err
			}

			validateRemote, err := cmd.Flags().GetBool(flagRemote)
			if err != nil {
				return fmt.Errorf("failed to get local flag: %w", err)
			}

			if validateRemote {
				cl := nhostclient.New(cmd.Flag(flagDomain).Value.String())
				return controller.ConfigValidateRemote( //nolint:wrapcheck
					cmd.Context(),
					cmd,
					cl,
					fs,
				)
			}

			_, err = controller.ConfigValidate(cmd, fs)
			return err //nolint:wrapcheck
		},
	}
}

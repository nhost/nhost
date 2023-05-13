package cmd

import (
	"fmt"

	"github.com/nhost/cli/v2/controller"
	"github.com/nhost/cli/v2/system"
	"github.com/spf13/cobra"
)

func downCmd() *cobra.Command {
	return &cobra.Command{ //nolint:exhaustruct
		Use:        "down",
		SuggestFor: []string{"list", "init"},
		Short:      "Stop local development environment",
		RunE: func(cmd *cobra.Command, _ []string) error {
			fs, err := getFolders(cmd.Parent())
			if err != nil {
				return err
			}

			if !system.PathExists(fs.NhostToml()) {
				return fmt.Errorf( //nolint:goerr113
					"no nhost project found, please run `nhost init`",
				)
			}
			if !system.PathExists(fs.Secrets()) {
				return fmt.Errorf("no secrets found, please run `nhost init`") //nolint:goerr113
			}

			projecName, err := cmd.Flags().GetString(flagProjectName)
			if err != nil {
				return fmt.Errorf("failed to parse project name: %w", err)
			}

			return controller.Down(cmd.Context(), cmd, projecName) //nolint:wrapcheck
		},
	}
}

package cmd

import (
	"fmt"

	"github.com/nhost/cli/v2/controller"
	"github.com/nhost/cli/v2/nhostclient"
	"github.com/nhost/cli/v2/system"
	"github.com/nhost/cli/v2/tui"
	"github.com/spf13/cobra"
)

func verifyFile(cmd *cobra.Command, name string) error {
	if system.PathExists(name) {
		cmd.Print(tui.PromptMessage(
			fmt.Sprintf("%s already exists. Do you want to overwrite it? [y/N] ", name)),
		)
		resp, err := tui.PromptInput(false)
		if err != nil {
			return fmt.Errorf("failed to read input: %w", err)
		}
		if resp != "y" {
			return fmt.Errorf("aborting") //nolint:goerr113
		}
	}
	return nil
}

// to be deleted.
func ConfigPullCmd() *cobra.Command {
	return configPullCmd()
}

func configPullCmd() *cobra.Command {
	return &cobra.Command{ //nolint:exhaustruct
		Use:  "pull",
		Long: `Get cloud configuration`,
		RunE: func(cmd *cobra.Command, _ []string) error {
			fs, err := getFolders(cmd.Parent())
			if err != nil {
				return err
			}

			if err := verifyFile(cmd, fs.NhostToml()); err != nil {
				return err
			}
			if err := verifyFile(cmd, fs.Secrets()); err != nil {
				return err
			}

			cl := nhostclient.New(cmd.Flag(flagDomain).Value.String())

			return controller.ConfigPull(cmd.Context(), cmd, cl, fs) //nolint:wrapcheck
		},
	}
}

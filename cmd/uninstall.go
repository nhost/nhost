package cmd

import (
	"fmt"
	"os"

	"github.com/nhost/cli/v2/tui"
	"github.com/spf13/cobra"
)

// uninstallCmd removed Nhost CLI from system.
var uninstallCmd = &cobra.Command{ //nolint:exhaustruct,gochecknoglobals
	Use:   "uninstall",
	Short: "Remove the installed CLI from system permanently",
	Long: `Remove the installed CLI from system permanently
but without hurting local Nhost apps and their data.`,
	RunE: func(cmd *cobra.Command, _ []string) error {
		path, err := os.Executable()
		if err != nil {
			return fmt.Errorf("failed to find installed CLI: %w", err)
		}

		cmd.Println(tui.PromptMessage("Are you sure you want to uninstall Nhost CLI?[y/N]"))
		resp, err := tui.PromptInput(false)
		if err != nil {
			return fmt.Errorf("failed to read user input: %w", err)
		}

		if resp != "y" && resp != "Y" {
			cmd.Println(tui.Info("Aborted"))
		}

		cmd.Println("Uninstalling Nhost CLI...")
		if err := os.Remove(path); err != nil {
			return fmt.Errorf("failed to remove CLI: %w", err)
		}

		return nil
	},
}

func init() { //nolint:gochecknoinits
	rootCmd.AddCommand(uninstallCmd)
}

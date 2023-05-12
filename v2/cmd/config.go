package cmd

import "github.com/spf13/cobra"

func configCmd() *cobra.Command {
	return &cobra.Command{ //nolint:exhaustruct
		Use:   "config",
		Short: "Manage your Nhost configuration",
	}
}

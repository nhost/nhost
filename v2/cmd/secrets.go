package cmd

import "github.com/spf13/cobra"

func secretsCmd() *cobra.Command {
	return &cobra.Command{ //nolint:exhaustruct
		Use:   "secrets",
		Short: "Manage secrets for Nhost project in the cloud",
	}
}

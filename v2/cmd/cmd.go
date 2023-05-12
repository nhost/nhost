package cmd

import (
	"github.com/spf13/cobra"
)

const (
	flagDomain            = "domain"
	flagRemote            = "remote"
	flagUserDefinedHasura = "hasuracli"
)

func Register(rootCmd *cobra.Command) { //nolint:funlen
	{
		configCmd := configCmd()
		rootCmd.AddCommand(configCmd)

		configPullCmd := configPullCmd()
		configCmd.AddCommand(configPullCmd)

		configShowFullExampleCmd := configShowFullExampleCmd()
		configCmd.AddCommand(configShowFullExampleCmd)

		configValidateCmd := configValidateCmd()
		configCmd.AddCommand(configValidateCmd)
		configValidateCmd.Flags().Bool(
			flagRemote, false, "Validate remote configuration. Defaults to validation of local config.",
		)
	}

	{
		initCmd := initCmd()
		rootCmd.AddCommand(initCmd)
		initCmd.Flags().Bool(
			flagRemote, false, "Validate remote configuration. Defaults to validation of local config.",
		)
		initCmd.Flags().
			StringP(flagUserDefinedHasura, "", "", "User-defined path for hasura-cli binary")
	}

	{
		loginCmd := logincCmd()
		rootCmd.AddCommand(loginCmd)
		loginCmd.PersistentFlags().StringP(flagEmail, "e", "", "Email of your Nhost account")
		loginCmd.PersistentFlags().StringP(flagPassword, "p", "", "Password of your Nhost account")
	}

	{
		logoutCmd := logoutCmd()
		rootCmd.AddCommand(logoutCmd)
	}

	{
		linkCmd := linkCmd()
		rootCmd.AddCommand(linkCmd)
	}

	{
		listCmd := listCmd()
		rootCmd.AddCommand(listCmd)
	}

	{
		secretsCmd := secretsCmd()
		rootCmd.AddCommand(secretsCmd)

		secretsListCmd := secretsListCmd()
		secretsCmd.AddCommand(secretsListCmd)
		secretsCreateCmd := secretsCreateCmd()
		secretsCmd.AddCommand(secretsCreateCmd)
		secretsDeleteCmd := secretsDeleteCmd()
		secretsCmd.AddCommand(secretsDeleteCmd)
		secretsUpdateCmd := secretsUpdateCmd()
		secretsCmd.AddCommand(secretsUpdateCmd)
	}
}

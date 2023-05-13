package cmd

import (
	"fmt"

	"github.com/nhost/cli/v2/controller"
	"github.com/nhost/cli/v2/system"
	"github.com/spf13/cobra"
)

func devCmd() *cobra.Command {
	return &cobra.Command{ //nolint:exhaustruct
		Use:        "dev",
		Aliases:    []string{"up"},
		SuggestFor: []string{"list", "init"},
		Short:      "Start local development environment",
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
			httpPort, err := cmd.Flags().GetUint(flagHTTPPort)
			if err != nil {
				return fmt.Errorf("failed to parse https port: %w", err)
			}

			disableTLS, err := cmd.Flags().GetBool(flagDisableTLS)
			if err != nil {
				return fmt.Errorf("failed to parse use-tls: %w", err)
			}

			postgresPort, err := cmd.Flags().GetUint(flagPostgresPort)
			if err != nil {
				return fmt.Errorf("failed to parse postgres port: %w", err)
			}

			projecName, err := cmd.Flags().GetString(flagProjectName)
			if err != nil {
				return fmt.Errorf("failed to parse project name: %w", err)
			}

			return controller.Dev( //nolint:wrapcheck
				cmd.Context(),
				cmd,
				projecName,
				httpPort,
				!disableTLS,
				postgresPort,
				fs,
			)
		},
	}
}

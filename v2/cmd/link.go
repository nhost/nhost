package cmd

import (
	"fmt"
	"os"

	"github.com/nhost/cli/v2/controller"
	"github.com/nhost/cli/v2/nhostclient"
	"github.com/spf13/cobra"
)

func LinkCmd() *cobra.Command {
	return linkCmd()
}

func linkCmd() *cobra.Command {
	return &cobra.Command{ //nolint:exhaustruct
		Use:        "link",
		SuggestFor: []string{"init"},
		Short:      "Link local app to a remote one",
		Long:       `Connect your already hosted Nhost app to local environment and start development or testings.`,
		RunE: func(cmd *cobra.Command, _ []string) error {
			fs, err := getFolders(cmd.Parent())
			if err != nil {
				return err
			}

			if err := os.MkdirAll(fs.DotNhostFolder(), 0o755); err != nil { //nolint:gomnd
				return fmt.Errorf("failed to create .nhost folder: %w", err)
			}

			cl := nhostclient.New(cmd.Flag(flagDomain).Value.String())
			_, err = controller.Link(cmd.Context(), cmd, cl, fs)
			return err //nolint:wrapcheck
		},
	}
}

package cmd

import (
	"fmt"
	"os"

	"github.com/nhost/cli/v2/controller"
	"github.com/nhost/cli/v2/nhostclient"
	"github.com/nhost/cli/v2/system"
	"github.com/spf13/cobra"
)

func initCmd() *cobra.Command {
	return &cobra.Command{ //nolint:exhaustruct
		Use:   "init",
		Short: "Initialize current directory as Nhost app",
		Long: `Initialize current working directory as an Nhost application.

Without specifying --remote flag, only a blank Nhost app will be initialized.

Specifying --remote flag will initialize a local app from app.nhost.io
`,
		RunE: func(cmd *cobra.Command, _ []string) error {
			fs, err := getFolders(cmd.Parent())
			if err != nil {
				return err
			}

			remote, err := cmd.Flags().GetBool(flagRemote)
			if err != nil {
				return fmt.Errorf("failed to get local flag: %w", err)
			}

			if system.PathExists(fs.NhostFolder()) {
				return fmt.Errorf("nhost folder already exists") //nolint:goerr113
			}

			if err := os.MkdirAll(fs.NhostFolder(), 0o755); err != nil { //nolint:gomnd
				return fmt.Errorf("failed to create nhost folder: %w", err)
			}

			if remote {
				domain := cmd.Flag(flagDomain).Value.String()
				cl := nhostclient.New(domain)
				return controller.InitRemote( //nolint:wrapcheck
					cmd.Context(),
					cmd,
					cl,
					domain,
					fs,
				)
			}
			return controller.Init(cmd.Context(), fs) //nolint:wrapcheck
		},
	}
}

package cmd

import (
	"fmt"
	"io"
	"os"
	"runtime"

	"github.com/nhost/cli/v2/software"
	"github.com/nhost/cli/v2/tui"
	"github.com/spf13/cobra"
)

const devVersion = "dev"

// upgradeCmd represents the upgrade command.
var upgradeCmd = &cobra.Command{ //nolint:exhaustruct,gochecknoglobals
	Use:        "upgrade",
	SuggestFor: []string{"version"},
	Short:      "Upgrade this version of Nhost CLI to latest version",
	Long: `Automatically check for the latest available version of this
CLI and upgrade to it.`,
	RunE: func(cmd *cobra.Command, _ []string) error {
		mgr := software.NewManager()
		releases, err := mgr.GetReleases(cmd.Context())
		if err != nil {
			return fmt.Errorf("failed to get releases: %w", err)
		}

		latest := releases[0]
		if latest.TagName == Version {
			cmd.Println(tui.Info("You have the latest version. Hurray!"))
			return nil
		}

		curBin, err := os.Executable()
		if err != nil {
			return fmt.Errorf("failed to find installed CLI: %w", err)
		}

		if Version == devVersion {
			// we are in dev mode, we fake curBin for testing
			curBin = "/tmp/nhost"
		}

		want := fmt.Sprintf("cli-%s-%s-%s.tar.gz", latest.TagName, runtime.GOOS, runtime.GOARCH)
		var url string
		for _, asset := range latest.Assets {
			if asset.Name == want {
				url = asset.BrowserDownloadURL
			}
		}

		if url == "" {
			return fmt.Errorf("failed to find asset for %s", want) //nolint:goerr113
		}

		binary, err := mgr.DownloadAsset(cmd.Context(), url)
		if err != nil {
			return fmt.Errorf("failed to download asset: %w", err)
		}

		f, err := os.OpenFile(curBin, os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0o755) //nolint:gomnd
		if err != nil {
			return fmt.Errorf("failed to open file: %w", err)
		}
		defer f.Close()

		if _, err := io.Copy(f, binary); err != nil {
			return fmt.Errorf("failed to write binary: %w", err)
		}

		return nil
	},
}

func init() { //nolint:gochecknoinits
	rootCmd.AddCommand(upgradeCmd)
}

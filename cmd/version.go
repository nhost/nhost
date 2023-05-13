package cmd

import (
	"fmt"
	"runtime"

	"github.com/nhost/cli/v2/software"
	"github.com/nhost/cli/v2/tui"
	"github.com/spf13/cobra"
)

// versionCmd represents the version command.
var versionCmd = &cobra.Command{ //nolint:exhaustruct,gochecknoglobals
	Use:        "version",
	Aliases:    []string{"v"},
	SuggestFor: []string{"upgrade"},
	Short:      "Show the current version of Nhost CLI you have installed",
	Long:       `All softwares have versions. This is Nhost's.`,
	RunE: func(cmd *cobra.Command, _ []string) error {
		if Version == "" {
			Version = devVersion
		}
		cmd.Println(tui.Info("Nhost CLI %s for %s-%s\n", Version, runtime.GOOS, runtime.GOARCH))

		mgr := software.NewManager()
		releases, err := mgr.GetReleases(cmd.Context())
		if err != nil {
			return fmt.Errorf("failed to get releases: %w", err)
		}

		latest := releases[0]
		if latest.TagName == Version {
			return nil
		}

		cmd.Println(tui.Warn("A new version of Nhost CLI is available: %s", latest.TagName))
		cmd.Println("You can upgrade by running `nhost upgrade`")

		if Version == devVersion {
			return nil
		}

		cmd.Println("Changes since your current version:")
		for _, release := range releases {
			if release.Prerelease {
				continue
			}
			cmd.Println(tui.Info("%s", release.TagName))
			cmd.Println(release.Body)
		}

		return nil
	},
}

func init() { //nolint:gochecknoinits
	rootCmd.AddCommand(versionCmd)
}

package software

import (
	"fmt"
	"runtime"

	"github.com/nhost/cli/clienv"
	"github.com/nhost/cli/software"
	"github.com/urfave/cli/v2"
)

func CommandVersion() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "version",
		Aliases: []string{},
		Usage:   "Show the current version of Nhost CLI you have installed",
		Action:  commandVersion,
	}
}

func commandVersion(cCtx *cli.Context) error {
	ce := clienv.FromCLI(cCtx)

	ce.Infoln("Nhost CLI %s for %s-%s", cCtx.App.Version, runtime.GOOS, runtime.GOARCH)

	mgr := software.NewManager()
	releases, err := mgr.GetReleases(cCtx.Context)
	if err != nil {
		return fmt.Errorf("failed to get releases: %w", err)
	}

	latest := releases[0]
	if latest.TagName == cCtx.App.Version {
		return nil
	}

	ce.Warnln("A new version of Nhost CLI is available: %s", latest.TagName)
	ce.Println("You can upgrade by running `nhost sw upgrade`")

	if cCtx.App.Version == devVersion || cCtx.App.Version == "" {
		return nil
	}

	ce.Println("Changes since your current version:")
	for _, release := range releases {
		if release.Prerelease {
			continue
		}
		ce.Infoln("%s", release.TagName)
		ce.Println(release.Body)
	}

	return nil
}

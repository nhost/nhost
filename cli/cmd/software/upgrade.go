package software

import (
	"fmt"
	"os"
	"runtime"

	"github.com/nhost/cli/clienv"
	"github.com/nhost/cli/software"
	"github.com/urfave/cli/v2"
)

func CommandUpgrade() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "upgrade",
		Aliases: []string{},
		Usage:   "Upgrade the CLI to the latest version",
		Action:  commandUpgrade,
	}
}

func commandUpgrade(cCtx *cli.Context) error {
	ce := clienv.FromCLI(cCtx)

	mgr := software.NewManager()

	releases, err := mgr.GetReleases(cCtx.Context, cCtx.App.Version)
	if err != nil {
		return fmt.Errorf("failed to get releases: %w", err)
	}

	if len(releases) == 0 {
		ce.Infoln("You have the latest version. Hurray!")
		return nil
	}

	latest := releases[0]
	if latest.TagName == cCtx.App.Version {
		ce.Infoln("You have the latest version. Hurray!")
		return nil
	}

	ce.Infoln("Upgrading to %s...", latest.TagName)

	want := fmt.Sprintf("cli-%s-%s-%s.tar.gz", latest.TagName, runtime.GOOS, runtime.GOARCH)

	var url string

	for _, asset := range latest.Assets {
		if asset.Name == want {
			url = asset.BrowserDownloadURL
		}
	}

	if url == "" {
		return fmt.Errorf("failed to find asset for %s", want) //nolint:err113
	}

	tmpFile, err := os.CreateTemp(os.TempDir(), "nhost-cli-")
	if err != nil {
		return fmt.Errorf("failed to create temporary file: %w", err)
	}
	defer os.Remove(tmpFile.Name())
	defer tmpFile.Close()

	if err := mgr.DownloadAsset(cCtx.Context, url, tmpFile); err != nil {
		return fmt.Errorf("failed to download asset: %w", err)
	}

	return install(cCtx, ce, tmpFile.Name())
}

func install(cCtx *cli.Context, ce *clienv.CliEnv, tmpFile string) error {
	curBin, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to find installed CLI: %w", err)
	}

	if cCtx.App.Version == devVersion || cCtx.App.Version == "" {
		// we are in dev mode, we fake curBin for testing
		curBin = "/tmp/nhost"
	}

	ce.Infoln("Copying to %s...", curBin)

	if err := os.Rename(tmpFile, curBin); err != nil {
		return fmt.Errorf("failed to rename %s to %s: %w", tmpFile, curBin, err)
	}

	ce.Infoln("Setting permissions...")

	if err := os.Chmod(curBin, 0o755); err != nil { //nolint:mnd
		return fmt.Errorf("failed to set permissions on %s: %w", curBin, err)
	}

	return nil
}

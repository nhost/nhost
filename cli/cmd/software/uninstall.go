package software

import (
	"fmt"
	"os"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/urfave/cli/v2"
)

const (
	forceFlag = "force"
)

func CommandUninstall() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "uninstall",
		Aliases: []string{},
		Usage:   "Remove the installed CLI from system permanently",
		Action:  commandUninstall,
		Flags: []cli.Flag{
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:        forceFlag,
				Usage:       "Force uninstall without confirmation",
				EnvVars:     []string{"NHOST_FORCE_UNINSTALL"},
				DefaultText: "false",
			},
		},
	}
}

func commandUninstall(cCtx *cli.Context) error {
	ce := clienv.FromCLI(cCtx)

	path, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to find installed CLI: %w", err)
	}

	if cCtx.App.Version == devVersion || cCtx.App.Version == "" {
		// we fake it in dev mode
		path = "/tmp/nhost"
	}

	ce.Infoln("Found Nhost cli in %s", path)

	if !cCtx.Bool(forceFlag) {
		ce.PromptMessage("Are you sure you want to uninstall Nhost CLI? [y/N] ")

		resp, err := ce.PromptInput(false)
		if err != nil {
			return fmt.Errorf("failed to read user input: %w", err)
		}

		if resp != "y" && resp != "Y" {
			return nil
		}
	}

	ce.Infoln("Uninstalling Nhost CLI...")

	if err := os.Remove(path); err != nil {
		return fmt.Errorf("failed to remove CLI: %w", err)
	}

	return nil
}

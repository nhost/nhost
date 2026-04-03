package software

import (
	"context"
	"fmt"
	"os"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/tui"
	"github.com/urfave/cli/v3"
	"golang.org/x/term"
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
				Sources:     cli.EnvVars("NHOST_FORCE_UNINSTALL"),
				DefaultText: "false",
			},
		},
	}
}

func commandUninstall(_ context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	path, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to find installed CLI: %w", err)
	}

	if cmd.Root().Version == devVersion || cmd.Root().Version == "" {
		// we fake it in dev mode
		path = "/tmp/nhost"
	}

	ce.Infoln("Found Nhost cli in %s", path)

	if !cmd.Bool(forceFlag) {
		confirmed, err := confirmUninstall(ce)
		if err != nil {
			return fmt.Errorf("failed to read user input: %w", err)
		}

		if !confirmed {
			return nil
		}
	}

	ce.Infoln("Uninstalling Nhost CLI...")

	if err := os.Remove(path); err != nil {
		return fmt.Errorf("failed to remove CLI: %w", err)
	}

	return nil
}

func confirmUninstall(ce *clienv.CliEnv) (bool, error) {
	if term.IsTerminal(int(os.Stdout.Fd())) {
		return tui.RunConfirm("Uninstall Nhost CLI?")
	}

	ce.PromptMessage("Are you sure you want to uninstall Nhost CLI? [y/N] ")

	resp, err := ce.PromptInput(false)
	if err != nil {
		return false, fmt.Errorf("failed to read input: %w", err)
	}

	return resp == "y" || resp == "Y", nil
}

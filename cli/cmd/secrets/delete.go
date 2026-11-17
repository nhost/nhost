package secrets

import (
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/cmd/cmdutil"
	"github.com/nhost/nhost/cli/tui"
	"github.com/urfave/cli/v3"
)

const flagYes = "yes"

func CommandDelete() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:      "delete",
		ArgsUsage: "[NAME]",
		Aliases:   []string{},
		Usage:     "Delete secret in the cloud environment",
		Action:    commandDelete,
		Flags: append(
			commonFlags(),
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:    flagYes,
				Usage:   "Skip confirmation",
				Sources: cli.EnvVars("NHOST_YES"),
			},
			jsonFlag(),
		),
	}
}

func commandDelete(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)
	jsonOutput := cmd.Bool(flagJSON)
	interactive := isTTY() && !jsonOutput

	proj, err := cmdutil.GetAppInfoOrLink(ctx, ce, cmd.String(flagSubdomain), interactive)
	if err != nil {
		return fmt.Errorf("failed to get app info: %w", err)
	}

	name, err := resolveDeleteName(ctx, cmd, ce, proj.ID, interactive)
	if err != nil {
		return err
	}

	if name == "" {
		return nil
	}

	proceed, err := confirmDelete(name, cmd.Bool(flagYes), interactive, tui.RunConfirm)
	if err != nil || !proceed {
		return err
	}

	cl, err := ce.GetNhostClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to get nhost client: %w", err)
	}

	if _, err := cl.DeleteSecret(ctx, proj.ID, name); err != nil {
		return fmt.Errorf("failed to delete secret: %w", err)
	}

	if jsonOutput {
		return printSecretResultJSON(os.Stdout, name, "deleted")
	}

	ce.Infoln("Secret deleted successfully!")

	return nil
}

// confirmDelete reports whether to go ahead with deleting the secret. It only
// prompts when interactive; otherwise it requires --yes, so scripts and agents
// can't delete a secret without asking for it explicitly.
func confirmDelete(
	name string,
	yes bool,
	interactive bool,
	confirm func(message string) (bool, error),
) (bool, error) {
	if yes {
		return true, nil
	}

	if !interactive {
		return false, errors.New("use --yes to skip confirmation") //nolint:err113
	}

	confirmed, err := confirm(fmt.Sprintf("Delete secret %s?", name))
	if err != nil {
		// Closing the prompt (for example with ctrl+c) cancels the deletion.
		return false, nil //nolint:nilerr
	}

	return confirmed, nil
}

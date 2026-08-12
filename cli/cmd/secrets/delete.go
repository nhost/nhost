package secrets

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/cmd/cmdutil"
	"github.com/nhost/nhost/cli/tui"
	"github.com/urfave/cli/v3"
)

func CommandDelete() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:      "delete",
		ArgsUsage: "[NAME]",
		Aliases:   []string{},
		Usage:     "Delete secret in the cloud environment",
		Action:    commandDelete,
		Flags:     commonFlags(),
	}
}

func commandDelete(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	proj, err := cmdutil.GetAppInfoOrLink(ctx, ce, cmd.String(flagSubdomain), true)
	if err != nil {
		return fmt.Errorf("failed to get app info: %w", err)
	}

	name, err := resolveDeleteName(ctx, cmd, ce, proj.ID)
	if err != nil {
		return err
	}

	if name == "" {
		return nil
	}

	if isTTY() {
		confirmed, err := tui.RunConfirm(
			fmt.Sprintf("Delete secret %s?", name),
		)
		if err != nil || !confirmed {
			return nil //nolint:nilerr
		}
	}

	cl, err := ce.GetNhostClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to get nhost client: %w", err)
	}

	if _, err := cl.DeleteSecret(ctx, proj.ID, name); err != nil {
		return fmt.Errorf("failed to delete secret: %w", err)
	}

	ce.Infoln("Secret deleted successfully!")

	return nil
}

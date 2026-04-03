package secrets

import (
	"context"
	"errors"
	"fmt"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/cmd/cmdutil"
	"github.com/urfave/cli/v3"
)

func CommandDelete() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:      "delete",
		ArgsUsage: "NAME",
		Aliases:   []string{},
		Usage:     "Delete secret in the cloud environment",
		Action:    commandDelete,
		Flags:     commonFlags(),
	}
}

func commandDelete(ctx context.Context, cmd *cli.Command) error {
	if cmd.NArg() != 1 {
		return errors.New("expected 1 argument: NAME") //nolint:err113
	}

	ce := clienv.FromCLI(cmd)

	proj, err := cmdutil.GetAppInfoOrLink(ctx, ce, cmd.String(flagSubdomain))
	if err != nil {
		return fmt.Errorf("failed to get app info: %w", err)
	}

	cl, err := ce.GetNhostClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to get nhost client: %w", err)
	}

	if _, err := cl.DeleteSecret(
		ctx,
		proj.ID,
		cmd.Args().Get(0),
	); err != nil {
		return fmt.Errorf("failed to delete secret: %w", err)
	}

	ce.Infoln("Secret deleted successfully!")

	return nil
}

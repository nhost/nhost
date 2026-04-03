package secrets //nolint:dupl

import (
	"context"
	"errors"
	"fmt"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/cmd/cmdutil"
	"github.com/urfave/cli/v3"
)

func CommandUpdate() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:      "update",
		ArgsUsage: "NAME VALUE",
		Aliases:   []string{},
		Usage:     "Update secret in the cloud environment",
		Action:    commandUpdate,
		Flags:     commonFlags(),
	}
}

func commandUpdate(ctx context.Context, cmd *cli.Command) error {
	if cmd.NArg() != 2 { //nolint:mnd
		return errors.New("expected 2 arguments: NAME VALUE") //nolint:err113
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

	if _, err := cl.UpdateSecret(
		ctx,
		proj.ID,
		cmd.Args().Get(0),
		cmd.Args().Get(1),
	); err != nil {
		return fmt.Errorf("failed to update secret: %w", err)
	}

	ce.Infoln("Secret updated successfully!")

	return nil
}

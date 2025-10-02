package secrets //nolint:dupl

import (
	"context"
	"errors"
	"fmt"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/urfave/cli/v3"
)

func CommandCreate() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:      "create",
		ArgsUsage: "NAME VALUE",
		Aliases:   []string{},
		Usage:     "Create secret in the cloud environment",
		Action:    commandCreate,
		Flags:     commonFlags(),
	}
}

func commandCreate(ctx context.Context, cmd *cli.Command) error {
	if cmd.NArg() != 2 { //nolint:mnd
		return errors.New("invalid number of arguments") //nolint:err113
	}

	ce := clienv.FromCLI(cmd)

	proj, err := ce.GetAppInfo(ctx, cmd.String(flagSubdomain))
	if err != nil {
		return fmt.Errorf("failed to get app info: %w", err)
	}

	cl, err := ce.GetNhostClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to get nhost client: %w", err)
	}

	if _, err := cl.CreateSecret(
		ctx,
		proj.ID,
		cmd.Args().Get(0),
		cmd.Args().Get(1),
	); err != nil {
		return fmt.Errorf("failed to create secret: %w", err)
	}

	ce.Infoln("Secret created successfully!")

	return nil
}

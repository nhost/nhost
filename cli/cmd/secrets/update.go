package secrets //nolint:dupl

import (
	"errors"
	"fmt"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/urfave/cli/v2"
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

func commandUpdate(cCtx *cli.Context) error {
	if cCtx.NArg() != 2 { //nolint:mnd
		return errors.New("invalid number of arguments") //nolint:err113
	}

	ce := clienv.FromCLI(cCtx)

	proj, err := ce.GetAppInfo(cCtx.Context, cCtx.String(flagSubdomain))
	if err != nil {
		return fmt.Errorf("failed to get app info: %w", err)
	}

	cl, err := ce.GetNhostClient(cCtx.Context)
	if err != nil {
		return fmt.Errorf("failed to get nhost client: %w", err)
	}

	if _, err := cl.UpdateSecret(
		cCtx.Context,
		proj.ID,
		cCtx.Args().Get(0),
		cCtx.Args().Get(1),
	); err != nil {
		return fmt.Errorf("failed to update secret: %w", err)
	}

	ce.Infoln("Secret updated successfully!")

	return nil
}

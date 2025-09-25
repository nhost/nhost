package secrets

import (
	"errors"
	"fmt"

	"github.com/nhost/cli/clienv"
	"github.com/urfave/cli/v2"
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

func commandDelete(cCtx *cli.Context) error {
	if cCtx.NArg() != 1 {
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

	if _, err := cl.DeleteSecret(
		cCtx.Context,
		proj.ID,
		cCtx.Args().Get(0),
	); err != nil {
		return fmt.Errorf("failed to delete secret: %w", err)
	}

	ce.Infoln("Secret deleted successfully!")

	return nil
}

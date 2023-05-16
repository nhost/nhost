package secrets

import (
	"fmt"

	"github.com/nhost/cli/clienv"
	"github.com/nhost/cli/nhostclient/graphql"
	"github.com/urfave/cli/v2"
)

func CommandDelete() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:      "delete",
		ArgsUsage: "NAME",
		Aliases:   []string{},
		Usage:     "Delete secret in the cloud environment",
		Action:    commandDelete,
		Flags:     []cli.Flag{},
	}
}

func commandDelete(cCtx *cli.Context) error {
	if cCtx.NArg() != 1 {
		return fmt.Errorf("invalid number of arguments") //nolint:goerr113
	}

	ce := clienv.New(cCtx)
	proj, err := ce.GetAppInfo()
	if err != nil {
		return fmt.Errorf("failed to get app info: %w", err)
	}

	session, err := ce.LoadSession(cCtx.Context)
	if err != nil {
		return fmt.Errorf("failed to load session: %w", err)
	}

	cl := ce.GetNhostClient()
	if _, err := cl.DeleteSecret(
		cCtx.Context,
		proj.ID,
		cCtx.Args().Get(0),
		graphql.WithAccessToken(session.Session.AccessToken),
	); err != nil {
		return fmt.Errorf("failed to delete secret: %w", err)
	}

	ce.Infoln("Secret deleted successfully!")

	return nil
}

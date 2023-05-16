package secrets

import (
	"fmt"

	"github.com/nhost/cli/clienv"
	"github.com/nhost/cli/nhostclient/graphql"
	"github.com/urfave/cli/v2"
)

func CommandList() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "list",
		Aliases: []string{},
		Usage:   "List secrets in the cloud environment",
		Action:  commandList,
		Flags:   []cli.Flag{},
	}
}

func commandList(cCtx *cli.Context) error {
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
	secrets, err := cl.GetSecrets(
		cCtx.Context,
		proj.ID,
		graphql.WithAccessToken(session.Session.AccessToken),
	)
	if err != nil {
		return fmt.Errorf("failed to get secrets: %w", err)
	}

	for _, secret := range secrets.GetAppSecrets() {
		ce.Println(secret.Name)
	}

	return nil
}

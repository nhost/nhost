package secrets

import (
	"fmt"

	"github.com/nhost/cli/clienv"
	"github.com/urfave/cli/v2"
)

func CommandList() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "list",
		Aliases: []string{},
		Usage:   "List secrets in the cloud environment",
		Action:  commandList,
		Flags:   commonFlags(),
	}
}

func commandList(cCtx *cli.Context) error {
	ce := clienv.FromCLI(cCtx)

	proj, err := ce.GetAppInfo(cCtx.Context, cCtx.String(flagSubdomain))
	if err != nil {
		return fmt.Errorf("failed to get app info: %w", err)
	}

	cl, err := ce.GetNhostClient(cCtx.Context)
	if err != nil {
		return fmt.Errorf("failed to get nhost client: %w", err)
	}

	secrets, err := cl.GetSecrets(
		cCtx.Context,
		proj.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to get secrets: %w", err)
	}

	for _, secret := range secrets.GetAppSecrets() {
		ce.Println("%s", secret.Name)
	}

	return nil
}

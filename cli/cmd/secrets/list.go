package secrets

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/urfave/cli/v3"
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

func commandList(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	proj, err := ce.GetAppInfo(ctx, cmd.String(flagSubdomain))
	if err != nil {
		return fmt.Errorf("failed to get app info: %w", err)
	}

	cl, err := ce.GetNhostClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to get nhost client: %w", err)
	}

	secrets, err := cl.GetSecrets(
		ctx,
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

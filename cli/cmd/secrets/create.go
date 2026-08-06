package secrets

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/cli/nhostclient/graphql"
	"github.com/urfave/cli/v3"
)

func CommandCreate() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:      "create",
		ArgsUsage: "NAME [VALUE]",
		Aliases:   []string{},
		Usage:     "Create secret in the cloud environment",
		Action:    commandCreate,
		Flags:     commonFlags(),
	}
}

func commandCreate(ctx context.Context, cmd *cli.Command) error {
	return runSecretMutation(
		ctx, cmd, "Secret created successfully!",
		func(cl *graphql.Client, appID, name, value string) error {
			if _, err := cl.CreateSecret(ctx, appID, name, value); err != nil {
				return fmt.Errorf("failed to create secret: %w", err)
			}

			return nil
		},
	)
}

package secrets

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/cli/nhostclient/graphql"
	"github.com/urfave/cli/v3"
)

func CommandUpdate() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:      "update",
		ArgsUsage: "NAME [VALUE]",
		Aliases:   []string{},
		Usage:     "Update secret in the cloud environment",
		Action:    commandUpdate,
		Flags:     commonFlags(),
	}
}

func commandUpdate(ctx context.Context, cmd *cli.Command) error {
	return runSecretMutation(
		ctx, cmd, "Secret updated successfully!",
		func(cl *graphql.Client, appID, name, value string) error {
			if _, err := cl.UpdateSecret(ctx, appID, name, value); err != nil {
				return fmt.Errorf("failed to update secret: %w", err)
			}

			return nil
		},
	)
}

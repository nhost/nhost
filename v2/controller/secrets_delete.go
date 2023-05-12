package controller

import (
	"context"
	"fmt"

	"github.com/nhost/cli/v2/nhostclient/graphql"
	"github.com/nhost/cli/v2/tui"
)

func SecretsDelete(
	ctx context.Context,
	p Printer,
	cl NhostClient,
	name string,
) error {
	proj, err := GetAppInfo(ctx, p, cl)
	if err != nil {
		return err
	}

	session, err := LoadSession(ctx, p, cl)
	if err != nil {
		return fmt.Errorf("failed to load session: %w", err)
	}

	if _, err := cl.DeleteSecret(
		ctx,
		proj.ID,
		name,
		graphql.WithAccessToken(session.Session.AccessToken),
	); err != nil {
		return fmt.Errorf("failed to get secrets: %w", err)
	}

	p.Println(tui.Info("Secret deleted successfully!"))

	return nil
}

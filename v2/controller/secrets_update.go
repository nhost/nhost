package controller

import (
	"context"
	"fmt"

	"github.com/nhost/cli/v2/nhostclient/graphql"
	"github.com/nhost/cli/v2/system"
	"github.com/nhost/cli/v2/tui"
)

func SecretsUpdate(
	ctx context.Context,
	p Printer,
	cl NhostClient,
	name string,
	value string,
	fs *system.PathStructure,
) error {
	proj, err := GetAppInfo(ctx, p, cl, fs)
	if err != nil {
		return err
	}

	session, err := LoadSession(ctx, p, cl, fs)
	if err != nil {
		return fmt.Errorf("failed to load session: %w", err)
	}

	if _, err := cl.UpdateSecret(
		ctx,
		proj.ID,
		name,
		value,
		graphql.WithAccessToken(session.Session.AccessToken),
	); err != nil {
		return fmt.Errorf("failed to get secrets: %w", err)
	}

	p.Println(tui.Info("Secret updated successfully!"))

	return nil
}

package controller

import (
	"context"
	"fmt"

	"github.com/nhost/cli/v2/nhostclient/graphql"
)

func SecretsList(
	ctx context.Context,
	p Printer,
	cl NhostClient,
) error {
	proj, err := GetAppInfo(ctx, p, cl)
	if err != nil {
		return err
	}

	session, err := LoadSession(ctx, p, cl)
	if err != nil {
		return fmt.Errorf("failed to load session: %w", err)
	}

	secrets, err := cl.GetSecrets(
		ctx,
		proj.ID,
		graphql.WithAccessToken(session.Session.AccessToken),
	)
	if err != nil {
		return fmt.Errorf("failed to get secrets: %w", err)
	}

	for _, secret := range secrets.GetAppSecrets() {
		p.Println(secret.Name)
	}

	return nil
}

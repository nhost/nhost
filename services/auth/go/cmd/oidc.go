package cmd

import (
	"context"
	"errors"
	"fmt"
	"net/url"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/nhost/nhost/services/auth/go/providers"
	"github.com/nhost/nhost/services/auth/go/safehttp"
	"github.com/nhost/nhost/services/auth/go/sql"
	"github.com/urfave/cli/v3"
)

const oidcResponseBodyLimit = 256 << 10

var errOIDCIssuerChanged = errors.New(
	"OIDC provider slug is already registered to a different issuer",
)

func getOIDCRegistry(cmd *cli.Command, serverURL *url.URL) (*providers.OIDCRegistry, error) {
	registry, err := providers.NewOIDCRegistry(
		cmd.String(flagOIDCProviders), serverURL, safehttp.New(safehttp.Config{
			Timeout:              0,
			MaxRedirects:         0,
			MaxResponseBodyBytes: oidcResponseBodyLimit,
			PublicIPsOnly:        true,
			AllowPrivateIPs:      cmd.Bool(flagOIDCAllowPrivateIPs),
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("configuring custom OIDC providers: %w", err)
	}

	return registry, nil
}

func registerOIDCProviders(
	ctx context.Context,
	db *sql.Queries,
	registry *providers.OIDCRegistry,
) error {
	providers := registry.All()
	if len(providers) == 0 {
		return nil
	}

	params := sql.RegisterOIDCProvidersParams{
		ProviderIds: make([]string, 0, len(providers)),
		Issuers:     make([]string, 0, len(providers)),
	}
	for _, provider := range providers {
		params.ProviderIds = append(params.ProviderIds, provider.ID())
		params.Issuers = append(params.Issuers, provider.Issuer())
	}

	if err := db.RegisterOIDCProviders(ctx, params); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.ConstraintName == "user_providers_oidc_issuer_fkey" {
			return fmt.Errorf("%w: %s", errOIDCIssuerChanged, pgErr.Detail)
		}

		return fmt.Errorf("registering OIDC providers: %w", err)
	}

	return nil
}

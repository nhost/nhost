package cmd

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/nhost/nhost/services/auth/go/oidc"
	"github.com/nhost/nhost/services/auth/go/sql"
)

const oidcResponseBodyLimit = 256 << 10

var errOIDCIssuerChanged = errors.New(
	"OIDC provider slug is already registered to a different issuer",
)

func registerOIDCProviders(
	ctx context.Context,
	db *sql.Queries,
	registry *oidc.OIDCRegistry,
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
		if errors.As(err, &pgErr) && pgErr.ConstraintName == "providers_oidc_issuer_check" {
			return errOIDCIssuerChanged
		}

		return fmt.Errorf("registering OIDC providers: %w", err)
	}

	return nil
}

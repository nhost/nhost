package cmd

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/nhost/nhost/services/auth/go/providers"
	"github.com/nhost/nhost/services/auth/go/sql"
)

type oidcRegistrationDB struct {
	sql.DBTX

	err error
}

func (db oidcRegistrationDB) Exec(context.Context, string, ...any) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, db.err
}

func TestRegisterOIDCProvidersIssuerConflict(t *testing.T) {
	t.Parallel()

	registry, err := providers.NewOIDCRegistry(
		`{"example":{"issuer":"https://new.example","clientId":"web","clientSecret":"test-only"}}`,
		&url.URL{Scheme: "https", Host: "auth.example"},
		http.DefaultClient, slog.New(slog.DiscardHandler),
	)
	if err != nil {
		t.Fatal(err)
	}

	const detail = `Key (id, oidc_issuer)=(oidc:example, https://old.example) is still referenced from table "user_providers".`

	for _, tt := range []struct {
		name       string
		constraint string
		conflict   bool
	}{
		{
			name:       "issuer conflict retains provider and stored issuer",
			constraint: "user_providers_oidc_issuer_fkey",
			conflict:   true,
		},
		{
			name:       "other constraint retains original error",
			constraint: "other_constraint",
			conflict:   false,
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			pgErr := &pgconn.PgError{
				ConstraintName: tt.constraint,
				Detail:         detail,
			}
			db := sql.New(oidcRegistrationDB{DBTX: nil, err: pgErr})

			err := registerOIDCProviders(t.Context(), db, registry)
			if errors.Is(err, errOIDCIssuerChanged) != tt.conflict {
				t.Fatalf(
					"issuer conflict match = %v, want %v: %v",
					errors.Is(err, errOIDCIssuerChanged),
					tt.conflict,
					err,
				)
			}

			if tt.conflict {
				if err == nil || !strings.Contains(err.Error(), detail) {
					t.Fatalf("registration error must retain database detail: %v", err)
				}
			} else if !errors.Is(err, pgErr) {
				t.Fatalf("registration error must wrap original database error: %v", err)
			}
		})
	}
}

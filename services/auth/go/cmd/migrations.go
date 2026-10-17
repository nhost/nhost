package cmd

import (
	"context"
	"fmt"
	"log/slog"
	"slices"
	"strings"

	crypto "github.com/nhost/nhost/services/auth/go/cryto"
	"github.com/nhost/nhost/services/auth/go/migrations"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func insertRoles(
	ctx context.Context, opts Options, db *sql.Queries, logger *slog.Logger,
) error {
	logger.InfoContext(ctx, "inserting default roles into the database if needed")

	defaultRoles := append(slices.Clone(opts.DefaultAllowedRoles), opts.DefaultRole)

	roleSet := make(map[string]bool)
	uniqueRoles := make([]string, 0)

	for _, role := range defaultRoles {
		if !roleSet[role] {
			roleSet[role] = true
			uniqueRoles = append(uniqueRoles, role)
		}
	}

	insertedRoles, err := db.UpsertRoles(ctx, uniqueRoles)
	if err != nil {
		logger.ErrorContext(ctx, "failed to upsert roles", slog.String("error", err.Error()))
		return fmt.Errorf("failed to upsert roles: %w", err)
	}

	if len(insertedRoles) > 0 {
		logger.InfoContext(
			ctx, "inserted roles",
			slog.Int("affected_rows", len(insertedRoles)),
			slog.String("roles", strings.Join(insertedRoles, ", ")),
		)
	}

	return nil
}

func applyMigrations(
	ctx context.Context,
	opts Options,
	db *sql.Queries,
	encrypter *crypto.Encrypter,
	logger *slog.Logger,
) error {
	postgresURL := opts.PostgresMigrationsConnection
	if postgresURL == "" {
		postgresURL = opts.PostgresConnection
	}

	if err := migrations.ApplyPostgresMigration(ctx, postgresURL, logger); err != nil {
		logger.ErrorContext(ctx, "failed to apply migrations", slog.String("error", err.Error()))
		return fmt.Errorf("failed to apply migrations: %w", err)
	}

	if err := migrations.ApplyHasuraMetadata(
		ctx,
		strings.Replace(opts.HasuraGraphqlURL, "/v1/graphql", "/v1/metadata", 1),
		opts.HasuraAdminSecret,
		logger,
	); err != nil {
		logger.ErrorContext(
			ctx, "failed to apply hasura metadata", slog.String("error", err.Error()),
		)

		return fmt.Errorf("failed to apply hasura metadata: %w", err)
	}

	if err := migrations.EncryptTOTPSecrets(ctx, db, encrypter, logger); err != nil {
		logger.ErrorContext(
			ctx,
			"failed to encrypt TOTP secrets",
			slog.String("error", err.Error()),
		)

		return fmt.Errorf("failed to encrypt TOTP secrets: %w", err)
	}

	return insertRoles(ctx, opts, db, logger)
}

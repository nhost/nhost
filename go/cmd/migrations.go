package cmd

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/nhost/hasura-auth/go/migrations"
	"github.com/nhost/hasura-auth/go/sql"
	"github.com/urfave/cli/v2"
)

func insertRoles(
	ctx context.Context, cCtx *cli.Context, db *sql.Queries, logger *slog.Logger,
) error {
	logger.Info("inserting default roles into the database if needed")

	defaultRoles := append(
		cCtx.StringSlice(flagDefaultAllowedRoles),
		cCtx.String(flagDefaultRole),
	)

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
		logger.Error("failed to upsert roles", slog.String("error", err.Error()))
		return fmt.Errorf("failed to upsert roles: %w", err)
	}

	if len(insertedRoles) > 0 {
		logger.Info("inserted roles",
			slog.Int("affected_rows", len(insertedRoles)),
			slog.String("roles", strings.Join(insertedRoles, ", ")),
		)
	}

	return nil
}

func applyMigrations(
	ctx context.Context, cCtx *cli.Context, db *sql.Queries, logger *slog.Logger,
) error {
	if err := migrations.ApplyPostgresMigration(
		cCtx.String(flagPostgresConnection), logger,
	); err != nil {
		logger.Error("failed to apply migrations", slog.String("error", err.Error()))
		return fmt.Errorf("failed to apply migrations: %w", err)
	}

	if err := migrations.ApplyHasuraMetadata(
		ctx,
		strings.Replace(cCtx.String(flagGraphqlURL), "/v1/graphql", "/v1/metadata", 1),
		cCtx.String(flagHasuraAdminSecret),
	); err != nil {
		logger.Error("failed to apply hasura metadata", slog.String("error", err.Error()))
		return fmt.Errorf("failed to apply hasura metadata: %w", err)
	}

	return insertRoles(ctx, cCtx, db, logger)
}

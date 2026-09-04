package migrations

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"

	_ "github.com/lib/pq" // Register the PostgreSQL driver with database/sql.
	"github.com/nhost/nhost/internal/lib/pgmigrate"
)

const (
	schemaName                         = "ai"
	postgresMigrationPath              = "postgres"
	postgresMigrationTarget       uint = 7
	postgresSchemaCreateStatement      = "CREATE SCHEMA IF NOT EXISTS ai"
)

//go:embed postgres/*.sql
var postgresMigrations embed.FS

type postgresMigrator func(
	ctx context.Context,
	logger *slog.Logger,
	database pgmigrate.Database,
	fsys fs.FS,
	migrationPath string,
	schema string,
	target uint,
) error

func ApplyPostgresMigration(
	ctx context.Context,
	postgresURL string,
	logger *slog.Logger,
) error {
	database, err := sql.Open("postgres", postgresURL)
	if err != nil {
		return fmt.Errorf("problem connecting to postgres: %w", err)
	}

	if err := runPostgresMigration(
		ctx,
		logger,
		database,
		database.Close,
		func(ctx context.Context) error {
			if _, err := database.ExecContext(ctx, postgresSchemaCreateStatement); err != nil {
				return fmt.Errorf("executing schema creation statement: %w", err)
			}

			return nil
		},
		pgmigrate.Migrate,
	); err != nil {
		return fmt.Errorf("applying postgres migration: %w", err)
	}

	return nil
}

func runPostgresMigration(
	ctx context.Context,
	logger *slog.Logger,
	database pgmigrate.Database,
	closeDatabase func() error,
	createSchema func(context.Context) error,
	migrate postgresMigrator,
) (result error) {
	defer func() {
		if err := closeDatabase(); err != nil {
			result = errors.Join(
				result,
				fmt.Errorf("problem closing postgres migration pool: %w", err),
			)
		}
	}()

	if err := createSchema(ctx); err != nil {
		return fmt.Errorf("problem creating postgres schema: %w", err)
	}

	if err := migrate(
		ctx,
		logger,
		database,
		postgresMigrations,
		postgresMigrationPath,
		schemaName,
		postgresMigrationTarget,
	); err != nil {
		return fmt.Errorf("problem migrating postgres: %w", err)
	}

	return nil
}

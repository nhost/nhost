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
	schemaName                   = "storage"
	postgresMigrationPath        = "postgres"
	postgresMigrationTarget uint = 5
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

	return runPostgresMigration(
		ctx, logger, database, database.Close, pgmigrate.Migrate,
	)
}

func runPostgresMigration(
	ctx context.Context,
	logger *slog.Logger,
	database pgmigrate.Database,
	closeDatabase func() error,
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

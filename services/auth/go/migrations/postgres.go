package migrations

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

const schemaName = "auth"

//go:embed postgres/*.sql
var postgresMigrations embed.FS

func checkIfWeNeedToMigrate(
	ctx context.Context,
	db *sql.DB,
) (int, error) {
	var exists bool

	// we check if golang's migrations table already exists, nothing to do if it does
	if err := db.QueryRowContext(
		ctx,
		"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2)",
		schemaName,
		"schema_migrations",
	).Scan(&exists); err != nil {
		return 0, fmt.Errorf("error checking if migrations table exists: %w", err)
	}

	if exists {
		return 0, nil
	}

	// we check if Node.js's migrations table already exists, nothing to do if it doesn't
	if err := db.QueryRowContext(
		ctx,
		"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2)",
		schemaName,
		"migrations",
	).Scan(&exists); err != nil {
		return 0, fmt.Errorf("error checking if migrations table exists: %w", err)
	}

	if !exists {
		return 0, nil
	}

	var highestVersion int
	if err := db.QueryRowContext(
		ctx, "SELECT MAX(id) FROM auth.migrations",
	).Scan(&highestVersion); err != nil {
		return 0, fmt.Errorf("error getting highest migration version: %w", err)
	}

	return highestVersion, nil
}

func ApplyPostgresMigration( //nolint:cyclop
	ctx context.Context, postgresURL string, logger *slog.Logger,
) error {
	// for backward compatibility, we ensure that the postgresURL contains the sslmode parameter
	// if it doesn't, we default to "disable"
	if !strings.Contains(postgresURL, "sslmode") {
		postgresURL += "?sslmode=disable"
	}

	db, err := sql.Open("postgres", postgresURL)
	if err != nil {
		return fmt.Errorf("problem connecting to postgres: %w", err)
	}

	versionToMigrate, err := checkIfWeNeedToMigrate(ctx, db)
	if err != nil {
		return err
	}

	driver, err := postgres.WithInstance(
		db,
		&postgres.Config{SchemaName: schemaName}, //nolint:exhaustruct
	)
	if err != nil {
		return fmt.Errorf("problem creating postgres driver: %w", err)
	}

	source, err := iofs.New(postgresMigrations, "postgres")
	if err != nil {
		return fmt.Errorf("problem creating mirgations source: %w", err)
	}

	migration, err := migrate.NewWithInstance("iofs", source, "postgres", driver)
	if err != nil {
		return fmt.Errorf("problem migrations: %w", err)
	}

	if versionToMigrate > 0 {
		logger.InfoContext(
			ctx, "migrating migrations from node.js to go", "version", versionToMigrate)

		if err := migration.Force(versionToMigrate); err != nil {
			return fmt.Errorf("error forcing migration to version %d: %w", versionToMigrate, err)
		}
	}

	if err := migration.Up(); err != nil { // or m.Step(2) if you want to explicitly set the number of migrations to run
		if !errors.Is(err, migrate.ErrNoChange) {
			return fmt.Errorf("problem migrating: %w", err)
		}
	}

	return nil
}

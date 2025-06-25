package migrations

import (
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"log/slog"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

const schemaName = "auth"

//go:embed postgres/*.sql
var postgresMigrations embed.FS

func migrateMigrationsFromNodejs(
	db *sql.DB,
	migration *migrate.Migrate,
	logger *slog.Logger,
) error {
	var exists bool

	// we check if golang's migrations table already exists, nothing to do if it does
	if err := db.QueryRow(
		"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2)",
		schemaName,
		"schema_migrations",
	).Scan(&exists); err != nil {
		return fmt.Errorf("error checking if migrations table exists: %w", err)
	}
	if exists {
		return nil
	}

	// we check if Node.js's migrations table already exists, nothing to do if it doesn't
	if err := db.QueryRow(
		"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2)",
		schemaName,
		"migrations",
	).Scan(&exists); err != nil {
		return fmt.Errorf("error checking if migrations table exists: %w", err)
	}
	if !exists {
		return nil
	}

	logger.Info("Migrating from Node.js migrations to Golang migrations")
	var highestVersion int
	if err := db.QueryRow(
		"SELECT MAX(id) FROM auth.migrations",
	).Scan(&highestVersion); err != nil {
		return fmt.Errorf("error getting highest migration version: %w", err)
	}

	logger.Info("Highest migration version found", "version", highestVersion)
	if err := migration.Force(highestVersion); err != nil {
		return fmt.Errorf("error forcing migration to version %d: %w", highestVersion, err)
	}

	// drop the old migrations table - we will do after a while to support downgrades for a while
	// _, err = db.Exec("DROP TABLE auth.migrations")
	// if err != nil {
	// 	return fmt.Errorf("error dropping old migrations table: %w", err)
	// }

	// logger.Info("Old Node.js migrations table dropped successfully")

	return nil
}

func ApplyPostgresMigration(postgresURL string, logger *slog.Logger) error {
	db, err := sql.Open("postgres", postgresURL)
	if err != nil {
		return fmt.Errorf("problem connecting to postgres: %w", err)
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

	if err := migrateMigrationsFromNodejs(db, migration, logger); err != nil {
		return fmt.Errorf("problem migrating from Node.js migrations: %w", err)
	}

	if err := migration.Up(); err != nil { // or m.Step(2) if you want to explicitly set the number of migrations to run
		if !errors.Is(err, migrate.ErrNoChange) {
			return fmt.Errorf("problem migrating: %w", err)
		}
	}

	return nil
}

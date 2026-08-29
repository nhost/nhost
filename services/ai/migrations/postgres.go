package migrations

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

const schemaName = "ai"

//go:embed postgres/*.sql
var postgresMigrations embed.FS

type postgresMigration interface {
	Up() error
	Close() (sourceErr error, databaseErr error)
}

func ApplyPostgresMigration(ctx context.Context, postgresURL string) error {
	migration, err := newPostgresMigration(ctx, postgresURL)
	if err != nil {
		return fmt.Errorf("problem preparing postgres migration: %w", err)
	}

	return runPostgresMigration(migration)
}

func newPostgresMigration(ctx context.Context, postgresURL string) (*migrate.Migrate, error) {
	source, err := iofs.New(postgresMigrations, "postgres")
	if err != nil {
		return nil, fmt.Errorf("problem creating migrations source: %w", err)
	}

	db, err := sql.Open("postgres", postgresURL)
	if err != nil {
		return nil, fmt.Errorf("problem connecting to postgres: %w", err)
	}

	if _, err := db.ExecContext(ctx, "CREATE SCHEMA IF NOT EXISTS "+schemaName); err != nil {
		return nil, errors.Join(fmt.Errorf("problem creating schema: %w", err), db.Close())
	}

	driver, err := postgres.WithInstance(
		db,
		&postgres.Config{SchemaName: schemaName}, //nolint:exhaustruct
	)
	if err != nil {
		return nil, errors.Join(fmt.Errorf("problem creating postgres driver: %w", err), db.Close())
	}

	migration, err := migrate.NewWithInstance("iofs", source, "postgres", driver)
	if err != nil {
		sourceErr := source.Close()
		databaseErr := driver.Close()

		return nil, errors.Join(
			fmt.Errorf("problem creating migration: %w", err),
			sourceErr,
			databaseErr,
		)
	}

	return migration, nil
}

func runPostgresMigration(migration postgresMigration) error {
	var migrationErr error
	if err := migration.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		migrationErr = fmt.Errorf("problem migrating: %w", err)
	}

	sourceErr, databaseErr := migration.Close()
	if closeErr := errors.Join(sourceErr, databaseErr); closeErr != nil {
		closeErr = fmt.Errorf("problem closing migration resources: %w", closeErr)

		return errors.Join(migrationErr, closeErr)
	}

	return migrationErr
}

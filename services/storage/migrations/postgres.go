package migrations

import (
	"database/sql"
	"embed"
	"errors"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

const schemaName = "storage"

//go:embed postgres/*.sql
var postgresMigrations embed.FS

func ApplyPostgresMigration(postgresURL string) error {
	db, err := sql.Open("postgres", postgresURL)
	if err != nil {
		return fmt.Errorf("problem connecting to postgres: %w", err)
	}

	//nolint:exhaustruct
	driver, err := postgres.WithInstance(db, &postgres.Config{SchemaName: schemaName})
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

	if err := migration.Up(); err != nil { // or m.Step(2) if you want to explicitly set the number of migrations to run
		if !errors.Is(err, migrate.ErrNoChange) {
			return fmt.Errorf("problem migrating: %w", err)
		}
	}

	return nil
}

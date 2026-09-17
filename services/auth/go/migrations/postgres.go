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
	"github.com/lib/pq"
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

func ApplyPostgresMigration(
	ctx context.Context, postgresURL string, logger *slog.Logger,
) error {
	// for backward compatibility, we ensure that the postgresURL contains the sslmode parameter
	// if it doesn't, we default to "disable"
	if !strings.Contains(postgresURL, "sslmode") {
		postgresURL += "?sslmode=disable"
	}

	// Connect through pq's Connector rather than sql.Open. pq's Driver does not
	// implement driver.DriverContext, so sql.Open would wrap it in database/sql's
	// dsnConnector, whose Connect discards the context and dials synchronously.
	// That makes the connection attempt uninterruptible, so a termination signal
	// arriving while migrations run is ignored until the TCP connect times out --
	// long past a typical orchestrator's grace period. Connector.Connect passes
	// the context down to the dial instead.
	connector, err := pq.NewConnector(postgresURL)
	if err != nil {
		return fmt.Errorf("problem connecting to postgres: %w", err)
	}

	db := sql.OpenDB(connector)
	// The pool is local to this call: nothing outside it uses db, and auth serves
	// from its own pool built on the non-migrations connection string.
	defer db.Close()

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
	// WithInstance checks out a dedicated connection and holds it for the
	// driver's lifetime. db.Close only closes idle connections, so without this
	// that one stays open for the rest of the process.
	defer driver.Close()

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
			ctx, "migrating migrations from node.js to go", "version", versionToMigrate,
		)

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

//nolint:testpackage // Exercises the package-private embedded migration bundle against PostgreSQL.
package migrations

import (
	"context"
	"database/sql"
	"encoding/hex"
	"io/fs"
	"log/slog"
	"net/url"
	"os"
	"path"
	"testing"
	"testing/fstest"

	"github.com/golang-migrate/migrate/v4/source"
	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/nhost/nhost/internal/lib/pgmigrate"
)

// pi-lens-ignore: go-hardcoded-secrets
const authMigrationTestEnvironmentPrefix = "AUTH_MIGRATION_TEST_"

func TestPostgresMigrationFiveRollsBack(t *testing.T) {
	t.Parallel()

	database := openAuthMigrationTestDatabase(t)
	logger := slog.New(slog.DiscardHandler)

	executeAuthMigrationSQL(t, database, "CREATE SCHEMA auth")

	if err := pgmigrate.Migrate(
		t.Context(),
		logger,
		database,
		authMigrationBundleThrough(t, 5),
		postgresMigrationPath,
		schemaName,
	); err != nil {
		t.Fatalf("pgmigrate.Migrate(through version 5) error = %v", err)
	}

	assertAuthMigrationState(t, database, 5)
	assertLegacyAuthMigrationTableAbsent(t, database)
	assertAuthSchemaMigrationsComment(t, database, true)

	if err := pgmigrate.Migrate(
		t.Context(),
		logger,
		database,
		authMigrationBundleThrough(t, 4),
		postgresMigrationPath,
		schemaName,
	); err != nil {
		t.Fatalf("pgmigrate.Migrate(rollback to version 4) error = %v", err)
	}

	assertAuthMigrationState(t, database, 4)
	assertAuthSchemaMigrationsComment(t, database, false)
}

func openAuthMigrationTestDatabase(t *testing.T) *sql.DB {
	t.Helper()

	dsnEnvironment := authMigrationTestEnvironmentPrefix + "DSN"
	requiredEnvironment := authMigrationTestEnvironmentPrefix + "DATABASE_REQUIRED"

	adminDSN := os.Getenv(dsnEnvironment)
	if adminDSN == "" {
		if os.Getenv(requiredEnvironment) == "1" {
			t.Fatalf("%s must identify a PostgreSQL test database", dsnEnvironment)
		}

		t.Skipf("%s is not set", dsnEnvironment)
	}

	adminDatabase, err := sql.Open("postgres", adminDSN)
	if err != nil {
		t.Fatalf("opening PostgreSQL integration server: %v", err)
	}

	t.Cleanup(func() {
		if err := adminDatabase.Close(); err != nil {
			t.Errorf("closing PostgreSQL integration server: %v", err)
		}
	})

	if err := adminDatabase.PingContext(t.Context()); err != nil {
		t.Fatalf("connecting to PostgreSQL integration server: %v", err)
	}

	databaseName := randomAuthMigrationTestDatabaseName(t)
	quotedDatabase := pq.QuoteIdentifier(databaseName)

	result, err := adminDatabase.ExecContext(
		t.Context(),
		"CREATE DATABASE "+quotedDatabase,
	)
	if err != nil {
		t.Fatalf("creating PostgreSQL integration database %q: %v", databaseName, err)
	}

	if result == nil {
		t.Fatalf("creating PostgreSQL integration database %q returned no result", databaseName)
	}

	testDSN := authMigrationDSNWithDatabase(t, adminDSN, databaseName)

	database, err := sql.Open("postgres", testDSN)
	if err != nil {
		t.Fatalf("opening PostgreSQL integration database %q: %v", databaseName, err)
	}

	database.SetMaxOpenConns(4)

	if err := database.PingContext(t.Context()); err != nil {
		if closeErr := database.Close(); closeErr != nil {
			t.Errorf("closing unreachable PostgreSQL integration database: %v", closeErr)
		}

		t.Fatalf("connecting to PostgreSQL integration database %q: %v", databaseName, err)
	}

	cleanupContext := context.WithoutCancel(t.Context())
	t.Cleanup(func() {
		if err := database.Close(); err != nil {
			t.Errorf("closing PostgreSQL integration database: %v", err)
		}

		result, err := adminDatabase.ExecContext(
			cleanupContext,
			"DROP DATABASE IF EXISTS "+quotedDatabase+" WITH (FORCE)",
		)
		if err != nil {
			t.Errorf("dropping PostgreSQL integration database %q: %v", databaseName, err)
		} else if result == nil {
			t.Errorf("dropping PostgreSQL integration database %q returned no result", databaseName)
		}
	})

	return database
}

func randomAuthMigrationTestDatabaseName(t *testing.T) string {
	t.Helper()

	suffix, err := uuid.NewRandom()
	if err != nil {
		t.Fatalf("generating random PostgreSQL integration database name: %v", err)
	}

	return "auth_migration_test_" + hex.EncodeToString(suffix[:])
}

func authMigrationDSNWithDatabase(t *testing.T, dsn, database string) string {
	t.Helper()

	parsed, err := url.Parse(dsn)
	if err != nil {
		t.Fatalf("parsing PostgreSQL integration DSN: %v", err)
	}

	if parsed.Scheme != "postgres" && parsed.Scheme != "postgresql" {
		t.Fatalf("PostgreSQL integration DSN must be a URL, got scheme %q", parsed.Scheme)
	}

	parsed.Path = "/" + database
	parsed.RawPath = ""

	return parsed.String()
}

func authMigrationBundleThrough(t *testing.T, maximum uint) fstest.MapFS {
	t.Helper()

	entries, err := fs.ReadDir(postgresMigrations, postgresMigrationPath)
	if err != nil {
		t.Fatalf("reading embedded Auth migration directory: %v", err)
	}

	bundle := make(fstest.MapFS)
	for _, entry := range entries {
		parsed, parseErr := source.Parse(entry.Name())
		if parseErr != nil {
			t.Fatalf("parsing Auth migration %q: %v", entry.Name(), parseErr)
		}

		if parsed.Version > maximum {
			continue
		}

		migrationPath := path.Join(postgresMigrationPath, entry.Name())

		body, readErr := fs.ReadFile(postgresMigrations, migrationPath)
		if readErr != nil {
			t.Fatalf("reading embedded Auth migration %q: %v", migrationPath, readErr)
		}

		bundle[migrationPath] = &fstest.MapFile{Data: body}
	}

	return bundle
}

func executeAuthMigrationSQL(t *testing.T, database *sql.DB, statement string) {
	t.Helper()

	result, err := database.ExecContext(t.Context(), statement)
	if err != nil {
		t.Fatalf("executing Auth integration SQL: %v", err)
	}

	if result == nil {
		t.Fatal("executing Auth integration SQL returned no result")
	}
}

func assertAuthMigrationState(t *testing.T, database *sql.DB, wantVersion int) {
	t.Helper()

	var (
		version int
		dirty   bool
	)
	if err := database.QueryRowContext(
		t.Context(),
		"SELECT version, dirty FROM auth.schema_migrations",
	).Scan(&version, &dirty); err != nil {
		t.Fatalf("reading Auth migration state: %v", err)
	}

	if version != wantVersion || dirty {
		t.Fatalf("Auth migration state = (%d, %t), want (%d, false)", version, dirty, wantVersion)
	}
}

func assertLegacyAuthMigrationTableAbsent(t *testing.T, database *sql.DB) {
	t.Helper()

	var exists bool
	if err := database.QueryRowContext(
		t.Context(),
		"SELECT to_regclass('auth.migrations') IS NOT NULL",
	).Scan(&exists); err != nil {
		t.Fatalf("checking for legacy Auth migration table: %v", err)
	}

	if exists {
		t.Fatal("legacy auth.migrations table unexpectedly exists")
	}
}

func assertAuthSchemaMigrationsComment(t *testing.T, database *sql.DB, wantComment bool) {
	t.Helper()

	var comment sql.NullString
	if err := database.QueryRowContext(
		t.Context(),
		"SELECT obj_description('auth.schema_migrations'::regclass, 'pg_class')",
	).Scan(&comment); err != nil {
		t.Fatalf("reading auth.schema_migrations comment: %v", err)
	}

	if comment.Valid != wantComment {
		t.Fatalf("auth.schema_migrations comment present = %t, want %t", comment.Valid, wantComment)
	}
}

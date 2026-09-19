package migrations

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"io/fs"
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/nhost/nhost/internal/lib/pgmigrate"
)

const (
	postgresMigrationTestDSNEnvironment      = "PGMIGRATE_TEST_DSN"
	postgresMigrationTestRequiredEnvironment = "PGMIGRATE_TEST_DATABASE_REQUIRED"
	postgresMigrationCleanupTimeout          = 5 * time.Second
)

var (
	errMigrationFailure = errors.New("migration failed")
	errCloseFailure     = errors.New("close failed")
)

func TestPostgresMigrationBundle(t *testing.T) {
	t.Parallel()

	if err := pgmigrate.ValidateBundle(postgresMigrations, postgresMigrationPath); err != nil {
		t.Fatalf("ValidateBundle() error = %v", err)
	}
}

//go:embed postgres/000001_create-initial-tables.*.sql
var postgresMigrationsAtVersionOne embed.FS

type migrationDatabaseStub struct{}

func (*migrationDatabaseStub) Conn(context.Context) (*sql.Conn, error) {
	return nil, sql.ErrConnDone
}

func TestRunPostgresMigrationDelegatesAndCloses(t *testing.T) {
	t.Parallel()

	ctx := t.Context()
	logger := slog.New(slog.DiscardHandler)
	database := &migrationDatabaseStub{}
	closeCalls := 0
	migrationCalls := 0

	err := runPostgresMigration(
		ctx,
		logger,
		database,
		func() error {
			closeCalls++

			return nil
		},
		func(
			gotContext context.Context,
			gotLogger *slog.Logger,
			gotDatabase pgmigrate.Database,
			gotFS fs.FS,
			gotPath string,
			gotSchema string,
		) error {
			migrationCalls++

			if gotContext != ctx || gotLogger != logger || gotDatabase != database {
				t.Error("migration did not receive the supplied context, logger, and database")
			}

			if gotFS == nil {
				t.Error("migration filesystem is nil")
			}

			if gotPath != postgresMigrationPath || gotSchema != schemaName {
				t.Errorf(
					"migration config = (%q, %q), want (%q, %q)",
					gotPath,
					gotSchema,
					postgresMigrationPath,
					schemaName,
				)
			}

			return nil
		},
	)
	if err != nil {
		t.Fatalf("runPostgresMigration() error = %v", err)
	}

	if migrationCalls != 1 || closeCalls != 1 {
		t.Errorf(
			"calls = (migration: %d, close: %d), want (migration: 1, close: 1)",
			migrationCalls,
			closeCalls,
		)
	}
}

func TestRunPostgresMigrationJoinsMigrationAndCloseErrors(t *testing.T) {
	t.Parallel()

	err := runPostgresMigration(
		t.Context(),
		slog.New(slog.DiscardHandler),
		&migrationDatabaseStub{},
		func() error { return errCloseFailure },
		func(
			context.Context,
			*slog.Logger,
			pgmigrate.Database,
			fs.FS,
			string,
			string,
		) error {
			return errMigrationFailure
		},
	)

	for _, wantErr := range []error{errMigrationFailure, errCloseFailure} {
		if !errors.Is(err, wantErr) {
			t.Errorf("runPostgresMigration() error = %v, want %v", err, wantErr)
		}
	}
}

func TestPostgresMigrationsRoundTrip(t *testing.T) {
	t.Parallel()

	database := openPostgresMigrationTestDatabase(t)

	var storageSchemaExists, publicVirusesTableExists bool
	if err := database.QueryRowContext(t.Context(), `
SELECT
  to_regnamespace('storage') IS NOT NULL,
  to_regclass('public.viruses') IS NOT NULL
`).Scan(&storageSchemaExists, &publicVirusesTableExists); err != nil {
		t.Fatalf("check PostgreSQL test database: %v", err)
	}

	if storageSchemaExists || publicVirusesTableExists {
		t.Fatalf(
			"PostgreSQL test database is not clean: storage schema exists = %t, public.viruses exists = %t",
			storageSchemaExists,
			publicVirusesTableExists,
		)
	}

	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(
			context.WithoutCancel(t.Context()),
			postgresMigrationCleanupTimeout,
		)
		defer cancel()

		if _, err := database.ExecContext(
			ctx,
			"DROP SCHEMA IF EXISTS storage CASCADE; DROP TABLE IF EXISTS public.viruses",
		); err != nil {
			t.Errorf("clean PostgreSQL migration test objects: %v", err)
		}
	})

	if _, err := database.ExecContext(t.Context(), `
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
CREATE SCHEMA storage;
CREATE TABLE public.viruses (marker text NOT NULL);
INSERT INTO public.viruses (marker) VALUES ('unrelated');
`); err != nil {
		t.Fatalf("prepare PostgreSQL migration test database: %v", err)
	}

	migrate := func(fsys fs.FS) {
		t.Helper()

		if err := pgmigrate.Migrate(
			t.Context(),
			slog.New(slog.DiscardHandler),
			database,
			fsys,
			postgresMigrationPath,
			schemaName,
		); err != nil {
			t.Fatalf("migrate PostgreSQL storage schema: %v", err)
		}
	}

	migrate(postgresMigrations)
	assertPostgresMigrationState(t, database, 5, true)

	migrate(postgresMigrationsAtVersionOne)
	assertPostgresMigrationState(t, database, 1, false)

	migrate(postgresMigrations)
	assertPostgresMigrationState(t, database, 5, true)
}

func openPostgresMigrationTestDatabase(t *testing.T) *sql.DB {
	t.Helper()

	dsn := os.Getenv(postgresMigrationTestDSNEnvironment)
	if dsn == "" {
		if os.Getenv(postgresMigrationTestRequiredEnvironment) != "" {
			t.Fatalf(
				"%s is set but %s is empty",
				postgresMigrationTestRequiredEnvironment,
				postgresMigrationTestDSNEnvironment,
			)
		}

		t.Skipf(
			"set %s to run PostgreSQL migration tests",
			postgresMigrationTestDSNEnvironment,
		)
	}

	database, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("open PostgreSQL migration test database: %v", err)
	}

	t.Cleanup(func() {
		if err := database.Close(); err != nil {
			t.Errorf("close PostgreSQL migration test database: %v", err)
		}
	})

	if err := database.PingContext(t.Context()); err != nil {
		t.Fatalf("ping PostgreSQL migration test database: %v", err)
	}

	return database
}

func assertPostgresMigrationState(
	t *testing.T,
	database *sql.DB,
	wantVersion int,
	wantVirusTable bool,
) {
	t.Helper()

	var (
		version    int
		dirty      bool
		virusTable bool
	)

	if err := database.QueryRowContext(
		t.Context(),
		"SELECT version, dirty FROM storage.schema_migrations",
	).Scan(&version, &dirty); err != nil {
		t.Fatalf("read PostgreSQL migration state: %v", err)
	}

	if version != wantVersion || dirty {
		t.Errorf(
			"PostgreSQL migration state = (%d, %t), want (%d, false)",
			version,
			dirty,
			wantVersion,
		)
	}

	if err := database.QueryRowContext(
		t.Context(),
		"SELECT to_regclass('storage.virus') IS NOT NULL",
	).Scan(&virusTable); err != nil {
		t.Fatalf("check storage.virus: %v", err)
	}

	if virusTable != wantVirusTable {
		t.Errorf("storage.virus exists = %t, want %t", virusTable, wantVirusTable)
	}

	var publicMarker string
	if err := database.QueryRowContext(
		t.Context(),
		"SELECT marker FROM public.viruses",
	).Scan(&publicMarker); err != nil {
		t.Fatalf("read unrelated public.viruses table: %v", err)
	}

	if publicMarker != "unrelated" {
		t.Errorf("public.viruses marker = %q, want %q", publicMarker, "unrelated")
	}
}

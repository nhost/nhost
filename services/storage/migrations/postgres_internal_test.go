package migrations

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/nhost/nhost/internal/lib/pgmigrate"
)

const (
	postgresMigrationTestDSNEnvironment      = "PGMIGRATE_TEST_DSN"
	postgresMigrationTestRequiredEnvironment = "PGMIGRATE_TEST_DATABASE_REQUIRED"
	postgresMigrationCleanupTimeout          = 5 * time.Second
)

var (
	errMigrationFailure       = errors.New("migration failed")
	errCloseFailure           = errors.New("close failed")
	errMigrationTestDSNScheme = errors.New("PostgreSQL migration test DSN must be a URL")
)

//go:embed postgres/000001_create-initial-tables.*.sql
var postgresMigrationsAtVersionOne embed.FS

type migrationDatabaseStub struct{}

func (*migrationDatabaseStub) Conn(context.Context) (*sql.Conn, error) {
	return nil, sql.ErrConnDone
}

func TestPostgresMigrationBundle(t *testing.T) {
	t.Parallel()

	const wantTarget = 5

	tests := []struct {
		name string
		fsys fs.FS
	}{
		{
			name: "embedded bundle",
			fsys: postgresMigrations,
		},
		{
			name: "source directory",
			fsys: os.DirFS("."),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			target, err := pgmigrate.ValidateBundle(tt.fsys, postgresMigrationPath)
			if err != nil {
				t.Fatalf("ValidateBundle() error = %v", err)
			}

			if target != wantTarget {
				t.Fatalf("ValidateBundle() target = %d, want %d", target, wantTarget)
			}
		})
	}
}

func TestPostgresMigrationBundleRejectsInvalidSourceFixtures(t *testing.T) {
	t.Parallel()

	const targetDownMigration = "000005_add-viruses-table.down.sql"

	tests := []struct {
		name      string
		mutate    func(*os.Root) error
		wantIssue string
	}{
		{
			name: "missing down migration",
			mutate: func(root *os.Root) error {
				return root.Remove(targetDownMigration)
			},
			wantIssue: "missing its down migration",
		},
		{
			name: "blank down migration",
			mutate: func(root *os.Root) error {
				return root.WriteFile(targetDownMigration, []byte(" \n\t\r\n"), 0o600)
			},
			wantIssue: "must contain SQL beyond comments and whitespace",
		},
		{
			name: "file excluded by embed glob",
			mutate: func(root *os.Root) error {
				return root.WriteFile("README.txt", []byte("not a migration"), 0o600)
			},
			wantIssue: "filename does not follow golang-migrate semantics",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			fixtureRoot := copyPostgresMigrationSource(t)
			if err := tt.mutate(openPostgresMigrationSource(t, fixtureRoot)); err != nil {
				t.Fatalf("mutate migration fixture: %v", err)
			}

			target, err := pgmigrate.ValidateBundle(os.DirFS(fixtureRoot), postgresMigrationPath)
			if err == nil {
				t.Fatalf("ValidateBundle() = (%d, nil), want error", target)
			}

			if target != 0 {
				t.Errorf("ValidateBundle() target = %d, want 0 on error", target)
			}

			if !strings.Contains(err.Error(), tt.wantIssue) {
				t.Fatalf("ValidateBundle() error = %q, want issue %q", err, tt.wantIssue)
			}
		})
	}
}

func copyPostgresMigrationSource(t *testing.T) string {
	t.Helper()

	fixtureRoot := t.TempDir()
	if err := os.CopyFS(
		filepath.Join(fixtureRoot, postgresMigrationPath),
		os.DirFS(postgresMigrationPath),
	); err != nil {
		t.Fatalf("copy postgres migration source: %v", err)
	}

	return fixtureRoot
}

func openPostgresMigrationSource(t *testing.T, fixtureRoot string) *os.Root {
	t.Helper()

	migrationRoot, err := os.OpenRoot(filepath.Join(fixtureRoot, postgresMigrationPath))
	if err != nil {
		t.Fatalf("open migration fixture root: %v", err)
	}

	t.Cleanup(func() {
		if closeErr := migrationRoot.Close(); closeErr != nil {
			t.Errorf("close migration fixture root: %v", closeErr)
		}
	})

	return migrationRoot
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

	adminDatabase, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("open PostgreSQL migration test server: %v", err)
	}

	t.Cleanup(func() {
		if err := adminDatabase.Close(); err != nil {
			t.Errorf("close PostgreSQL migration test server: %v", err)
		}
	})

	if err := adminDatabase.PingContext(t.Context()); err != nil {
		t.Fatalf("ping PostgreSQL migration test server: %v", err)
	}

	databaseID, err := uuid.NewRandom()
	if err != nil {
		t.Fatalf("generate PostgreSQL migration test database name: %v", err)
	}

	databaseName := "storage_migration_test_" + strings.ReplaceAll(databaseID.String(), "-", "")

	testDSN, err := postgresMigrationDSNWithDatabase(dsn, databaseName)
	if err != nil {
		t.Fatalf("configure PostgreSQL migration test database: %v", err)
	}

	quotedDatabase := pq.QuoteIdentifier(databaseName)
	if _, err := adminDatabase.ExecContext(
		t.Context(),
		"CREATE DATABASE "+quotedDatabase,
	); err != nil {
		t.Fatalf("create PostgreSQL migration test database %q: %v", databaseName, err)
	}

	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(
			context.WithoutCancel(t.Context()),
			postgresMigrationCleanupTimeout,
		)
		defer cancel()

		if _, err := adminDatabase.ExecContext(
			ctx,
			"DROP DATABASE IF EXISTS "+quotedDatabase+" WITH (FORCE)",
		); err != nil {
			t.Errorf("drop PostgreSQL migration test database %q: %v", databaseName, err)
		}
	})

	database, err := sql.Open("postgres", testDSN)
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

func postgresMigrationDSNWithDatabase(dsn, database string) (string, error) {
	parsed, err := url.Parse(dsn)
	if err != nil {
		return "", fmt.Errorf("parse PostgreSQL migration test DSN: %w", err)
	}

	if parsed.Scheme != "postgres" && parsed.Scheme != "postgresql" {
		return "", fmt.Errorf(
			"%w: got scheme %q",
			errMigrationTestDSNScheme,
			parsed.Scheme,
		)
	}

	parsed.Path = "/" + database
	parsed.RawPath = ""

	return parsed.String(), nil
}

func TestPostgresMigrationDSNWithDatabase(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		dsn     string
		want    string
		wantErr bool
	}{
		{
			name:    "postgres URL",
			dsn:     "postgres://tester@localhost:5432/admin?sslmode=disable",
			want:    "postgres://tester@localhost:5432/storage_migration_test?sslmode=disable",
			wantErr: false,
		},
		{
			name:    "postgresql URL with encoded database and socket",
			dsn:     "postgresql://tester/original%2Fdatabase?host=%2Ftmp%2Fpostgres&sslmode=disable",
			want:    "postgresql://tester/storage_migration_test?host=%2Ftmp%2Fpostgres&sslmode=disable",
			wantErr: false,
		},
		{
			name:    "malformed URL",
			dsn:     "postgres://%invalid/admin",
			want:    "",
			wantErr: true,
		},
		{
			name:    "non-PostgreSQL URL",
			dsn:     "https://localhost/admin",
			want:    "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := postgresMigrationDSNWithDatabase(tt.dsn, "storage_migration_test")
			if (err != nil) != tt.wantErr {
				t.Fatalf(
					"postgresMigrationDSNWithDatabase() error = %v, want error %t",
					err,
					tt.wantErr,
				)
			}

			if got != tt.want {
				t.Errorf("postgresMigrationDSNWithDatabase() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestPostgresMigrationTestDatabasesAreIsolated(t *testing.T) {
	t.Parallel()

	firstDatabase := openPostgresMigrationTestDatabase(t)
	secondDatabase := openPostgresMigrationTestDatabase(t)

	if _, err := firstDatabase.ExecContext(
		t.Context(),
		"CREATE TABLE public.migration_isolation_marker (id integer)",
	); err != nil {
		t.Fatalf("create marker in first migration test database: %v", err)
	}

	var markerExists bool
	if err := secondDatabase.QueryRowContext(
		t.Context(),
		"SELECT to_regclass('public.migration_isolation_marker') IS NOT NULL",
	).Scan(&markerExists); err != nil {
		t.Fatalf("check marker in second migration test database: %v", err)
	}

	if markerExists {
		t.Error("second migration test database contains first database's marker")
	}
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

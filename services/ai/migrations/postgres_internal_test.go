package migrations

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/golang-migrate/migrate/v4"
	"github.com/lib/pq"
)

type stubPostgresMigration struct {
	upErr            error
	sourceCloseErr   error
	databaseCloseErr error
	upCalls          int
	closeCalls       int
}

func (m *stubPostgresMigration) Up() error {
	m.upCalls++

	return m.upErr
}

func (m *stubPostgresMigration) Close() (error, error) {
	m.closeCalls++

	return m.sourceCloseErr, m.databaseCloseErr
}

func TestAgentsMigrationSchema(t *testing.T) {
	t.Parallel()

	up, err := postgresMigrations.ReadFile("postgres/000006_agents.up.sql")
	if err != nil {
		t.Fatalf("read up migration: %v", err)
	}

	upSQL := strings.Join(strings.Fields(string(up)), " ")
	if !strings.Contains(
		upSQL,
		"provider text NOT NULL CHECK (octet_length(provider) BETWEEN 1 AND 63)",
	) {
		t.Errorf("up migration does not bound provider by 1-63 bytes: %q", upSQL)
	}

	for _, forbidden := range []string{"agent_providers", "FOREIGN KEY (provider)"} {
		if strings.Contains(upSQL, forbidden) {
			t.Errorf("up migration unexpectedly contains %q", forbidden)
		}
	}

	down, err := postgresMigrations.ReadFile("postgres/000006_agents.down.sql")
	if err != nil {
		t.Fatalf("read down migration: %v", err)
	}

	if strings.Contains(string(down), "agent_providers") {
		t.Error("down migration unexpectedly drops agent_providers")
	}

	entries, err := fs.ReadDir(postgresMigrations, "postgres")
	if err != nil {
		t.Fatalf("read migrations directory: %v", err)
	}

	for _, entry := range entries {
		if strings.HasPrefix(entry.Name(), "000008_") {
			t.Errorf("obsolete migration 8 remains: %s", entry.Name())
		}
	}
}

func TestAgentsMigrationProviderConstraintPostgres(t *testing.T) {
	t.Parallel()

	db, databaseURL := openAgentsMigrationTestDatabase(t)

	// The production migration runner creates the ai schema and owns all AI
	// extensions, functions, and tables. auth.users is the only fixture because
	// it is owned by the auth service, but migration 6 references it.
	const externalDependencies = `
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
`
	if _, err := db.ExecContext(t.Context(), externalDependencies); err != nil {
		t.Fatalf("create external migration dependencies: %v", err)
	}

	migration, err := newPostgresMigration(t.Context(), databaseURL)
	if err != nil {
		t.Fatalf("create PostgreSQL migrator: %v", err)
	}

	t.Cleanup(func() {
		sourceErr, databaseErr := migration.Close()
		if err := errors.Join(sourceErr, databaseErr); err != nil {
			t.Errorf("close PostgreSQL migrator: %v", err)
		}
	})

	if err := migration.Migrate(6); err != nil {
		t.Fatalf("migrate through version 6: %v", err)
	}

	var (
		version int
		dirty   bool
	)

	if err := db.QueryRowContext(
		t.Context(), "SELECT version, dirty FROM ai.schema_migrations",
	).Scan(&version, &dirty); err != nil {
		t.Fatalf("read migration state: %v", err)
	}

	if version != 6 || dirty {
		t.Fatalf("migration state = (%d, %t), want (6, false)", version, dirty)
	}

	const insertAgent = `INSERT INTO ai.agents (name, provider, model) VALUES ($1, $2, $3)`
	if _, err := db.ExecContext(
		t.Context(), insertAgent, "configured gateway", "gateway.primary-test", "model",
	); err != nil {
		t.Fatalf("insert dotted/dashed provider: %v", err)
	}

	for _, invalidProvider := range []string{"", strings.Repeat("a", 64)} {
		if _, err := db.ExecContext(
			t.Context(), insertAgent, "invalid gateway", invalidProvider, "model",
		); err == nil {
			t.Errorf(
				"insert provider with %d bytes succeeded, want constraint failure",
				len(invalidProvider),
			)
		}
	}

	var providerTableMissing bool
	if err := db.QueryRowContext(
		t.Context(), "SELECT to_regclass('ai.agent_providers') IS NULL",
	).Scan(&providerTableMissing); err != nil {
		t.Fatalf("check agent_providers table: %v", err)
	}

	if !providerTableMissing {
		t.Error("ai.agent_providers exists after migration 6")
	}

	var providerForeignKeys int
	if err := db.QueryRowContext(t.Context(), `
SELECT count(*)
FROM pg_constraint AS c
JOIN pg_attribute AS a
  ON a.attrelid = c.conrelid
 AND a.attnum = ANY(c.conkey)
WHERE c.conrelid = 'ai.agents'::regclass
  AND c.contype = 'f'
  AND a.attname = 'provider'
`).Scan(&providerForeignKeys); err != nil {
		t.Fatalf("check provider foreign keys: %v", err)
	}

	if providerForeignKeys != 0 {
		t.Errorf("provider foreign keys = %d, want 0", providerForeignKeys)
	}
}

func openAgentsMigrationTestDatabase(t *testing.T) (*sql.DB, string) {
	t.Helper()

	dsn := os.Getenv("POSTGRES_CONNECTION")
	if dsn == "" {
		dsn = "postgres://postgres:postgres@localhost:5432/local?sslmode=disable"
	}

	parsedDSN, err := url.Parse(dsn)
	if err != nil || (parsedDSN.Scheme != "postgres" && parsedDSN.Scheme != "postgresql") {
		t.Skipf("POSTGRES_CONNECTION is not a PostgreSQL URL: %q", dsn)
	}

	adminURL := *parsedDSN
	adminURL.Path = "/postgres"
	adminURL.RawPath = ""

	adminDB, err := sql.Open("postgres", adminURL.String())
	if err != nil {
		t.Skipf("open PostgreSQL admin connection: %v", err)
	}

	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()

	if err := adminDB.PingContext(ctx); err != nil {
		if closeErr := adminDB.Close(); closeErr != nil {
			t.Errorf("close unreachable PostgreSQL admin connection: %v", closeErr)
		}

		t.Skipf("PostgreSQL is unavailable: %v", err)
	}

	databaseName := fmt.Sprintf("ai_migration_test_%d", time.Now().UnixNano())

	quotedDatabaseName := pq.QuoteIdentifier(databaseName)
	if _, err := adminDB.ExecContext(ctx, "CREATE DATABASE "+quotedDatabaseName); err != nil {
		if closeErr := adminDB.Close(); closeErr != nil {
			t.Errorf("close PostgreSQL admin connection: %v", closeErr)
		}

		t.Skipf("cannot create temporary PostgreSQL database: %v", err)
	}

	var db *sql.DB

	t.Cleanup(func() {
		if db != nil {
			if err := db.Close(); err != nil {
				t.Errorf("close temporary PostgreSQL database: %v", err)
			}
		}

		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cleanupCancel()

		if _, err := adminDB.ExecContext(
			cleanupCtx, "DROP DATABASE "+quotedDatabaseName+" WITH (FORCE)",
		); err != nil {
			t.Errorf("drop temporary PostgreSQL database: %v", err)
		}

		if err := adminDB.Close(); err != nil {
			t.Errorf("close PostgreSQL admin connection: %v", err)
		}
	})

	testURL := *parsedDSN
	testURL.Path = "/" + databaseName
	testURL.RawPath = ""

	db, err = sql.Open("postgres", testURL.String())
	if err != nil {
		t.Fatalf("open temporary PostgreSQL database: %v", err)
	}

	if err := db.PingContext(ctx); err != nil {
		t.Fatalf("connect to temporary PostgreSQL database: %v", err)
	}

	return db, testURL.String()
}

func TestRunPostgresMigration(t *testing.T) {
	t.Parallel()

	migrationFailure := io.ErrUnexpectedEOF
	sourceCloseFailure := fs.ErrClosed
	databaseCloseFailure := context.DeadlineExceeded

	testCases := []struct {
		name             string
		upErr            error
		sourceCloseErr   error
		databaseCloseErr error
		wantErrors       []error
	}{
		{
			name:             "success",
			upErr:            nil,
			sourceCloseErr:   nil,
			databaseCloseErr: nil,
			wantErrors:       nil,
		},
		{
			name:             "no migrations to apply",
			upErr:            migrate.ErrNoChange,
			sourceCloseErr:   nil,
			databaseCloseErr: nil,
			wantErrors:       nil,
		},
		{
			name:             "migration fails",
			upErr:            migrationFailure,
			sourceCloseErr:   nil,
			databaseCloseErr: nil,
			wantErrors:       []error{migrationFailure},
		},
		{
			name:             "source close fails",
			upErr:            nil,
			sourceCloseErr:   sourceCloseFailure,
			databaseCloseErr: nil,
			wantErrors:       []error{sourceCloseFailure},
		},
		{
			name:             "database close fails",
			upErr:            nil,
			sourceCloseErr:   nil,
			databaseCloseErr: databaseCloseFailure,
			wantErrors:       []error{databaseCloseFailure},
		},
		{
			name:             "migration and close fail",
			upErr:            migrationFailure,
			sourceCloseErr:   sourceCloseFailure,
			databaseCloseErr: databaseCloseFailure,
			wantErrors: []error{
				migrationFailure,
				sourceCloseFailure,
				databaseCloseFailure,
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			migration := &stubPostgresMigration{
				upErr:            testCase.upErr,
				sourceCloseErr:   testCase.sourceCloseErr,
				databaseCloseErr: testCase.databaseCloseErr,
				upCalls:          0,
				closeCalls:       0,
			}

			err := runPostgresMigration(migration)
			if len(testCase.wantErrors) == 0 && err != nil {
				t.Fatalf("runPostgresMigration() unexpected error: %v", err)
			}

			for _, wantErr := range testCase.wantErrors {
				if !errors.Is(err, wantErr) {
					t.Errorf("runPostgresMigration() error %v does not wrap %v", err, wantErr)
				}
			}

			if migration.upCalls != 1 {
				t.Errorf("Up() calls = %d, want 1", migration.upCalls)
			}

			if migration.closeCalls != 1 {
				t.Errorf("Close() calls = %d, want 1", migration.closeCalls)
			}
		})
	}
}

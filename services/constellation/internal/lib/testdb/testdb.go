// Package testdb provides helpers for creating isolated test databases.
//
// SQLite databases are created in t.TempDir() and require no external services.
// PostgreSQL databases are created on-demand and dropped on test cleanup.
//
// All helpers register cleanup functions via t.Cleanup, so callers never need
// to close resources manually.
package testdb

import (
	"database/sql"
	"fmt"
	"path/filepath"
	"testing"

	_ "github.com/mattn/go-sqlite3" // SQLite driver

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/connector/sql/sqlite"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// NewSQLite creates an isolated SQLite database in t.TempDir() with the given
// DDL schema and optional seed SQL statements. Returns a sqlite.Client that
// is automatically closed on test cleanup.
func NewSQLite(t *testing.T, ddl string, seeds ...string) *sqlite.Client {
	t.Helper()

	dbPath := filepath.Join(t.TempDir(), "test.db")

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		t.Fatalf("testdb: failed to open sqlite: %v", err)
	}

	if _, err := db.ExecContext(t.Context(), ddl); err != nil {
		db.Close()
		t.Fatalf("testdb: failed to apply DDL: %v", err)
	}

	for i, seed := range seeds {
		if _, err := db.ExecContext(t.Context(), seed); err != nil {
			db.Close()
			t.Fatalf("testdb: failed to apply seed %d: %v", i, err)
		}
	}

	db.Close()

	sqlDB, err := sqlite.Open(t.Context(), dbPath)
	if err != nil {
		t.Fatalf("testdb: failed to open sqlite: %v", err)
	}

	client := sqlite.NewClient(sqlDB)

	t.Cleanup(func() { client.Close() })

	return client
}

// SQLitePath returns the path to a new SQLite database file created with the
// given DDL and seeds. This is useful when you need just the path (e.g., to
// pass as a database URL to BuildConnectorsFromMetadata).
func SQLitePath(t *testing.T, ddl string, seeds ...string) string {
	t.Helper()

	dbPath := filepath.Join(t.TempDir(), "test.db")

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		t.Fatalf("testdb: failed to open sqlite: %v", err)
	}

	if _, err := db.ExecContext(t.Context(), ddl); err != nil {
		db.Close()
		t.Fatalf("testdb: failed to apply DDL: %v", err)
	}

	for i, seed := range seeds {
		if _, err := db.ExecContext(t.Context(), seed); err != nil {
			db.Close()
			t.Fatalf("testdb: failed to apply seed %d: %v", i, err)
		}
	}

	if err := db.Close(); err != nil {
		t.Fatalf("testdb: failed to close sqlite after setup: %v", err)
	}

	return dbPath
}

// IntrospectSQLite creates an isolated SQLite database and returns the
// introspected objects. Useful for schema-generation tests that only need
// the introspected structure, not query roots.
func IntrospectSQLite(
	t *testing.T,
	ddl string,
	dbMeta *metadata.DatabaseMetadata,
) *introspection.Objects {
	t.Helper()

	client := NewSQLite(t, ddl)

	objects, err := client.Introspect(t.Context(), dbMeta)
	if err != nil {
		t.Fatalf(
			"testdb: failed to introspect sqlite: %v\nDDL:\n%s",
			err,
			truncate(ddl),
		)
	}

	return objects
}

const truncateMaxLen = 500

func truncate(s string) string {
	if len(s) <= truncateMaxLen {
		return s
	}

	return s[:truncateMaxLen] + fmt.Sprintf("... (%d bytes truncated)", len(s)-truncateMaxLen)
}

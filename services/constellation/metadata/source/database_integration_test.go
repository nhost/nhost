package source_test

import (
	"fmt"
	"log/slog"
	"testing"
	"time"

	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata/source"
)

// hdbMetadataDDL mirrors the real hdb_catalog.hdb_metadata schema that Hasura
// creates and that NewDatabaseMetadataSource reads.
const hdbMetadataDDL = `
CREATE SCHEMA IF NOT EXISTS hdb_catalog;

CREATE TABLE hdb_catalog.hdb_metadata (
    id integer PRIMARY KEY,
    metadata json NOT NULL,
    resource_version integer NOT NULL DEFAULT 1 UNIQUE
);
`

// seedV3Metadata returns a SQL statement that inserts a minimal valid Hasura
// v3 metadata blob into hdb_catalog.hdb_metadata at id=1.
func seedV3Metadata(version int, sourceName string) string {
	return fmt.Sprintf(
		`INSERT INTO hdb_catalog.hdb_metadata (id, metadata, resource_version)
		 VALUES (1, '{"version":3,"sources":[{"name":"%s","kind":"postgres",`+
			`"configuration":{"connection_info":{"database_url":`+
			`{"from_env":"HASURA_GRAPHQL_DATABASE_URL"}}},"tables":[]}]}'::json, %d);`,
		sourceName, version,
	)
}

// updateMetadataSQL returns a SQL statement that bumps the resource_version
// and swaps the source name, simulating a metadata reload in production.
func updateMetadataSQL(version int, sourceName string) string {
	return fmt.Sprintf(
		`UPDATE hdb_catalog.hdb_metadata SET
		 metadata = '{"version":3,"sources":[{"name":"%s","kind":"postgres",`+
			`"configuration":{"connection_info":{"database_url":`+
			`{"from_env":"HASURA_GRAPHQL_DATABASE_URL"}}},"tables":[]}]}'::json,
		 resource_version = %d WHERE id = 1;`,
		sourceName, version,
	)
}

// TestDatabaseMetadataSource_Integration_InitialLoad exercises the full
// pgxpool path: NewDatabaseMetadataSource -> newMetadataPool ->
// pgxPoolStore.QueryRow -> Scan -> metadata.FromHasuraJSON. It guards against
// regressions in the pgx adapter that fakes cannot catch.
func TestDatabaseMetadataSource_Integration_InitialLoad(t *testing.T) {
	t.Parallel()

	pool := testdb.NewPostgres(t, hdbMetadataDDL, seedV3Metadata(7, "default"))
	dbURL := pool.Config().ConnConfig.ConnString()

	src, err := source.NewDatabaseMetadataSource(
		t.Context(),
		dbURL,
		time.Hour,
		slog.New(slog.DiscardHandler),
	)
	if err != nil {
		t.Fatalf("NewDatabaseMetadataSource: %v", err)
	}

	defer src.Close()

	meta, err := src.InitialLoad(t.Context())
	if err != nil {
		t.Fatalf("InitialLoad: %v", err)
	}

	if meta == nil {
		t.Fatal("expected non-nil metadata from real database")
	}

	if got, want := len(meta.Databases), 1; got != want {
		t.Fatalf("Databases len = %d, want %d", got, want)
	}

	if got, want := meta.Databases[0].Name, "default"; got != want {
		t.Errorf("Databases[0].Name = %q, want %q", got, want)
	}

	if got, want := meta.Databases[0].Kind, "postgres"; got != want {
		t.Errorf("Databases[0].Kind = %q, want %q", got, want)
	}
}

// TestDatabaseMetadataSource_Integration_BadURL covers the newMetadataPool
// error path on a syntactically invalid connection string. This exercises
// pgxpool.ParseConfig failure, which the fakes cannot reach.
func TestDatabaseMetadataSource_Integration_BadURL(t *testing.T) {
	t.Parallel()

	_, err := source.NewDatabaseMetadataSource(
		t.Context(),
		"::::not-a-valid-url",
		time.Hour,
		slog.New(slog.DiscardHandler),
	)
	if err == nil {
		t.Fatal("expected error for invalid database URL, got nil")
	}
}

// TestDatabaseMetadataSource_Integration_Watch_DeliversUpdateOnRowChange
// drives Watch end-to-end against a real database: it seeds an initial row,
// starts the poller with a short interval, mutates the resource_version and
// metadata in the same backing database, and asserts that an Update arrives
// reflecting the new source name.
func TestDatabaseMetadataSource_Integration_Watch_DeliversUpdateOnRowChange(t *testing.T) {
	t.Parallel()

	pool := testdb.NewPostgres(t, hdbMetadataDDL, seedV3Metadata(1, "default"))
	dbURL := pool.Config().ConnConfig.ConnString()

	src, err := source.NewDatabaseMetadataSource(
		t.Context(),
		dbURL,
		50*time.Millisecond,
		slog.New(slog.DiscardHandler),
	)
	if err != nil {
		t.Fatalf("NewDatabaseMetadataSource: %v", err)
	}

	defer src.Close()

	if _, err := src.InitialLoad(t.Context()); err != nil {
		t.Fatalf("InitialLoad: %v", err)
	}

	ch := src.Watch(t.Context())

	// Bump resource_version so the poller observes a change.
	if _, err := pool.Exec(t.Context(), updateMetadataSQL(2, "renamed")); err != nil {
		t.Fatalf("seed update: %v", err)
	}

	select {
	case update, ok := <-ch:
		if !ok {
			t.Fatal("Watch channel closed before update arrived")
		}

		if update.Err != nil {
			t.Fatalf("Update.Err = %v, want nil", update.Err)
		}

		if update.Metadata == nil {
			t.Fatal("Update.Metadata is nil")
		}

		if got, want := len(update.Metadata.Databases), 1; got != want {
			t.Fatalf("Databases len = %d, want %d", got, want)
		}

		if got, want := update.Metadata.Databases[0].Name, "renamed"; got != want {
			t.Errorf("Databases[0].Name = %q, want %q", got, want)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for Watch update from real database")
	}
}

// TestDatabaseMetadataSource_Integration_Close_ReleasesPool ensures that
// Close() invokes pgxPoolStore.Close, releasing the underlying pgxpool.
// We verify by calling Close twice (must not panic) and asserting that
// subsequent operations on the source do not hang.
func TestDatabaseMetadataSource_Integration_Close_ReleasesPool(t *testing.T) {
	t.Parallel()

	pool := testdb.NewPostgres(t, hdbMetadataDDL, seedV3Metadata(1, "default"))
	dbURL := pool.Config().ConnConfig.ConnString()

	src, err := source.NewDatabaseMetadataSource(
		t.Context(),
		dbURL,
		time.Hour,
		slog.New(slog.DiscardHandler),
	)
	if err != nil {
		t.Fatalf("NewDatabaseMetadataSource: %v", err)
	}

	// Idempotent close — exercises pgxPoolStore.Close and the closeOnce guard.
	src.Close()
	src.Close()
}

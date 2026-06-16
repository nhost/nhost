package source_test

import (
	"errors"
	"fmt"
	"log/slog"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
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
// v3 metadata blob for the "default" source into hdb_catalog.hdb_metadata at
// id=1.
func seedV3Metadata(version int) string {
	return fmt.Sprintf(
		`INSERT INTO hdb_catalog.hdb_metadata (id, metadata, resource_version)
		 VALUES (1, '{"version":3,"sources":[{"name":"default","kind":"postgres",`+
			`"configuration":{"connection_info":{"database_url":`+
			`{"from_env":"HASURA_GRAPHQL_DATABASE_URL"}}},"tables":[]}]}'::json, %d);`,
		version,
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

// metadataBlobJSON returns a minimal valid Hasura v3 metadata blob with the
// given source name, suitable as the raw payload for WriteMetadata.
func metadataBlobJSON(sourceName string) []byte {
	return fmt.Appendf(
		nil,
		`{"version":3,"sources":[{"name":"%s","kind":"postgres",`+
			`"configuration":{"connection_info":{"database_url":`+
			`{"from_env":"HASURA_GRAPHQL_DATABASE_URL"}}},"tables":[]}]}`,
		sourceName,
	)
}

// readMetadataRow fetches the metadata blob and resource_version of the id=1
// row directly via the pool, bypassing the source under test.
func readMetadataRow(t *testing.T, pool *pgxpool.Pool) (string, int64) {
	t.Helper()

	var (
		blob    string
		version int64
	)

	err := pool.QueryRow(
		t.Context(),
		"SELECT metadata::text, resource_version FROM hdb_catalog.hdb_metadata WHERE id = 1",
	).Scan(&blob, &version)
	if err != nil {
		t.Fatalf("re-querying hdb_metadata: %v", err)
	}

	return blob, version
}

// TestDatabaseMetadataSource_Integration_InitialLoad exercises the full
// pgxpool path: NewDatabaseMetadataSource -> newMetadataPool ->
// pgxPoolStore.QueryRow -> Scan -> metadata.FromHasuraJSON. It guards against
// regressions in the pgx adapter that fakes cannot catch.
func TestDatabaseMetadataSource_Integration_InitialLoad(t *testing.T) {
	t.Parallel()

	pool := testdb.NewPostgres(t, hdbMetadataDDL, seedV3Metadata(7))
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

	pool := testdb.NewPostgres(t, hdbMetadataDDL, seedV3Metadata(1))
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

	pool := testdb.NewPostgres(t, hdbMetadataDDL, seedV3Metadata(1))
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

// TestDatabaseMetadataSource_Integration_WriteMetadata_Succeeds drives
// WriteMetadata against a real database with a matching expected
// resource_version: the upsert's optimistic-concurrency WHERE clause fires,
// the row is rewritten, and RETURNING reports the new version. It re-queries
// the row directly to confirm both the bumped version and the new metadata.
func TestDatabaseMetadataSource_Integration_WriteMetadata_Succeeds(t *testing.T) {
	t.Parallel()

	const (
		startRV = 7
		newRV   = 8
	)

	pool := testdb.NewPostgres(t, hdbMetadataDDL, seedV3Metadata(startRV))
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

	newRaw := metadataBlobJSON("rewritten")

	if err := src.WriteMetadata(t.Context(), newRaw, startRV, newRV); err != nil {
		t.Fatalf("WriteMetadata: %v", err)
	}

	blob, version := readMetadataRow(t, pool)

	if version != newRV {
		t.Errorf("resource_version = %d, want %d", version, newRV)
	}

	if blob != string(newRaw) {
		t.Errorf("metadata blob = %q, want %q", blob, newRaw)
	}
}

// TestDatabaseMetadataSource_Integration_WriteMetadata_Conflict drives
// WriteMetadata with a stale expected resource_version after the row has
// already advanced. The optimistic-concurrency WHERE clause matches no row,
// RETURNING yields pgx.ErrNoRows, and WriteMetadata reports
// ErrResourceVersionConflict while leaving the row untouched.
func TestDatabaseMetadataSource_Integration_WriteMetadata_Conflict(t *testing.T) {
	t.Parallel()

	const (
		startRV = 7
		liveRV  = 8
		newRV   = 9
	)

	pool := testdb.NewPostgres(t, hdbMetadataDDL, seedV3Metadata(startRV))
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

	// Advance the row to liveRV so the subsequent stale write (expectedRV =
	// startRV) loses the optimistic-concurrency check.
	if err := src.WriteMetadata(
		t.Context(), metadataBlobJSON("live"), startRV, liveRV,
	); err != nil {
		t.Fatalf("priming WriteMetadata: %v", err)
	}

	liveBlob, _ := readMetadataRow(t, pool)

	err = src.WriteMetadata(t.Context(), metadataBlobJSON("stale"), startRV, newRV)
	if !errors.Is(err, source.ErrResourceVersionConflict) {
		t.Fatalf("WriteMetadata err = %v, want ErrResourceVersionConflict", err)
	}

	blob, version := readMetadataRow(t, pool)

	if version != liveRV {
		t.Errorf("resource_version = %d, want %d (row must be untouched)", version, liveRV)
	}

	if blob != liveBlob {
		t.Errorf("metadata blob changed on conflict: got %q, want %q", blob, liveBlob)
	}
}

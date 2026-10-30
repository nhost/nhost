package source_test

import (
	"log/slog"
	"strings"
	"testing"
	"time"

	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata/source"
)

// A polled database snapshot reflects raw metadata as soon as polling catches
// up. It does not wait for connector reconciliation or a served-state swap.
func TestComputedDatabaseSnapshotTiming(t *testing.T) {
	t.Parallel()
	pool := testdb.NewPostgres(t, hdbMetadataDDL, seedV3Metadata(1, "computed"))

	src, err := source.NewDatabaseMetadataSource(t.Context(), pool.Config().ConnConfig.ConnString(),
		10*time.Millisecond, slog.New(slog.DiscardHandler))
	if err != nil {
		t.Fatalf("open metadata source: %v", err)
	}
	defer src.Close()

	if _, err := src.InitialLoad(t.Context()); err != nil {
		t.Fatalf("load: %v", err)
	}

	before, version := src.HasuraSnapshotJSON()
	if version != 1 || strings.Contains(string(before), "bad_field") {
		t.Fatalf("initial snapshot: version=%d raw=%s", version, before)
	}

	updates := src.Watch(t.Context())
	// No controller consumes the update; the raw snapshot still advances.
	_, err = pool.Exec(t.Context(), `UPDATE hdb_catalog.hdb_metadata SET resource_version=2,
		metadata='{"version":3,"sources":[{"name":"default","kind":"postgres","configuration":{"connection_info":{"database_url":"unused"}},"tables":[{"table":{"schema":"public","name":"items"},"computed_fields":[{"name":"bad_field","definition":{"function":{"schema":"public","name":"missing"}}}]}]}]}'::json WHERE id=1`)
	if err != nil {
		t.Fatalf("update raw metadata: %v", err)
	}

	select {
	case update := <-updates:
		if update.Err != nil {
			t.Fatalf("polled update: %v", update.Err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("metadata poll timed out")
	}

	after, version := src.HasuraSnapshotJSON()
	if version != 2 || !strings.Contains(string(after), "bad_field") {
		t.Fatalf("raw snapshot did not advance independently: version=%d raw=%s", version, after)
	}
}

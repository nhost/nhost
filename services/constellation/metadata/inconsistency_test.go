package metadata_test

import (
	"log/slog"
	"sync"
	"testing"
	"time"

	"github.com/nhost/nhost/services/constellation/metadata"
)

func discardLogger() *slog.Logger {
	return slog.New(slog.DiscardHandler)
}

func TestInconsistencies_ConcurrentRecord(t *testing.T) {
	t.Parallel()

	const (
		goroutines      = 16
		recordsPerGo    = 64
		expectedRecords = goroutines * recordsPerGo
	)

	ctx := t.Context()
	logger := discardLogger()
	inc := metadata.NewInconsistencies()

	start := time.Now()

	var wg sync.WaitGroup
	wg.Add(goroutines)

	for g := range goroutines {
		go func() {
			defer wg.Done()

			for r := range recordsPerGo {
				_ = r
				_ = g

				inc.RecordTable(
					ctx,
					logger,
					"src",
					"public", "t",
					"boom",
				)
			}
		}()
	}

	wg.Wait()

	if got := inc.Len(); got != expectedRecords {
		t.Fatalf("Len() = %d, want %d", got, expectedRecords)
	}

	snap := inc.Snapshot()
	if len(snap) != expectedRecords {
		t.Fatalf("len(Snapshot()) = %d, want %d", len(snap), expectedRecords)
	}

	for i, entry := range snap {
		if entry.At.Before(start) {
			t.Errorf("snap[%d].At %v is before test start %v", i, entry.At, start)
		}

		if entry.Kind != metadata.InconsistencyKindTable {
			t.Errorf("snap[%d].Kind = %q, want %q", i, entry.Kind, metadata.InconsistencyKindTable)
		}
	}
}

func TestInconsistencies_SnapshotIndependence(t *testing.T) {
	t.Parallel()

	ctx := t.Context()
	logger := discardLogger()
	inc := metadata.NewInconsistencies()

	inc.RecordTable(ctx, logger, "src", "public", "a", "reason-a")

	snap := inc.Snapshot()
	if len(snap) != 1 {
		t.Fatalf("len(Snapshot()) = %d, want 1", len(snap))
	}

	// Mutate the collector after taking the snapshot.
	inc.RecordTable(ctx, logger, "src", "public", "b", "reason-b")

	if len(snap) != 1 {
		t.Fatalf("snapshot grew after collector mutation: len=%d, want 1", len(snap))
	}

	if snap[0].Name != "public.a" {
		t.Errorf("snap[0].Name = %q, want %q", snap[0].Name, "public.a")
	}

	// Mutating the snapshot must not affect the collector.
	snap[0].Reason = "tampered"

	collectorSnap := inc.Snapshot()
	if len(collectorSnap) != 2 {
		t.Fatalf("len(collector Snapshot) = %d, want 2", len(collectorSnap))
	}

	if collectorSnap[0].Reason != "reason-a" {
		t.Errorf("collector reason mutated via snapshot: got %q, want %q",
			collectorSnap[0].Reason, "reason-a")
	}
}

func TestInconsistencies_NilLoggerTolerance(t *testing.T) {
	t.Parallel()

	ctx := t.Context()
	inc := metadata.NewInconsistencies()

	// Must not panic with a nil logger.
	inc.RecordRole(ctx, nil, "admin", "merge conflict")

	if got := inc.Len(); got != 1 {
		t.Fatalf("Len() = %d, want 1", got)
	}

	snap := inc.Snapshot()
	if snap[0].Kind != metadata.InconsistencyKindRole {
		t.Errorf("Kind = %q, want %q", snap[0].Kind, metadata.InconsistencyKindRole)
	}

	if snap[0].Name != "admin" {
		t.Errorf("Name = %q, want %q", snap[0].Name, "admin")
	}
}

func TestInconsistencies_NilReceiverTolerance(t *testing.T) {
	t.Parallel()

	ctx := t.Context()
	logger := discardLogger()

	var inc *metadata.Inconsistencies

	// Must not panic and must be a no-op.
	inc.RecordDatabase(ctx, logger, "src", "factory error")
}

func TestInconsistencies_AtStampedByRecord(t *testing.T) {
	t.Parallel()

	ctx := t.Context()
	logger := discardLogger()
	inc := metadata.NewInconsistencies()

	start := time.Now()

	inc.RecordColumn(ctx, logger, "src", "public", "t", "c", "missing")
	inc.RecordFunction(ctx, logger, "src", "public", "f", "missing")

	end := time.Now()

	snap := inc.Snapshot()
	if len(snap) != 2 {
		t.Fatalf("len(Snapshot()) = %d, want 2", len(snap))
	}

	for i, entry := range snap {
		if entry.At.IsZero() {
			t.Errorf("snap[%d].At is zero", i)
		}

		if entry.At.Before(start) {
			t.Errorf("snap[%d].At %v is before test start %v", i, entry.At, start)
		}

		if entry.At.After(end) {
			t.Errorf("snap[%d].At %v is after test end %v", i, entry.At, end)
		}
	}

	// Entries should be ordered by insertion; At is monotonically non-decreasing.
	if snap[1].At.Before(snap[0].At) {
		t.Errorf("snap[1].At %v is before snap[0].At %v", snap[1].At, snap[0].At)
	}
}

func TestInconsistencies_LenMatchesSnapshot(t *testing.T) {
	t.Parallel()

	ctx := t.Context()
	logger := discardLogger()
	inc := metadata.NewInconsistencies()

	if got := inc.Len(); got != 0 {
		t.Fatalf("initial Len() = %d, want 0", got)
	}

	if got := len(inc.Snapshot()); got != 0 {
		t.Fatalf("initial len(Snapshot()) = %d, want 0", got)
	}

	for i := range 5 {
		inc.RecordTable(
			ctx,
			logger,
			"src",
			"public", "t",
			"reason",
		)

		wantLen := i + 1
		if got := inc.Len(); got != wantLen {
			t.Errorf("Len() = %d, want %d", got, wantLen)
		}

		if got := len(inc.Snapshot()); got != wantLen {
			t.Errorf("len(Snapshot()) = %d, want %d", got, wantLen)
		}
	}
}

// TestInconsistencies_PerKindHelpers locks in the per-kind helper API: each
// helper must populate Kind with the matching constant, Source with the
// owning source ("" for source-level / role kinds), and Name with the
// per-kind qualified format. A swap between source and a sub-source name
// would change the expected values here.
func TestInconsistencies_PerKindHelpers(t *testing.T) {
	t.Parallel()

	ctx := t.Context()
	logger := discardLogger()

	tests := []struct {
		name       string
		record     func(*metadata.Inconsistencies)
		wantKind   string
		wantSource string
		wantName   string
	}{
		{
			name: "database",
			record: func(i *metadata.Inconsistencies) {
				i.RecordDatabase(ctx, logger, "main", "factory error")
			},
			wantKind:   metadata.InconsistencyKindDatabase,
			wantSource: "",
			wantName:   "main",
		},
		{
			name: "remote_schema",
			record: func(i *metadata.Inconsistencies) {
				i.RecordRemoteSchema(ctx, logger, "rs", "introspection failed")
			},
			wantKind:   metadata.InconsistencyKindRemoteSchema,
			wantSource: "",
			wantName:   "rs",
		},
		{
			name: "role",
			record: func(i *metadata.Inconsistencies) {
				i.RecordRole(ctx, logger, "user", "merge conflict")
			},
			wantKind:   metadata.InconsistencyKindRole,
			wantSource: "",
			wantName:   "user",
		},
		{
			name: "table",
			record: func(i *metadata.Inconsistencies) {
				i.RecordTable(ctx, logger, "src", "public", "users", "missing")
			},
			wantKind:   metadata.InconsistencyKindTable,
			wantSource: "src",
			wantName:   "public.users",
		},
		{
			name: "table_no_schema",
			record: func(i *metadata.Inconsistencies) {
				i.RecordTable(ctx, logger, "src", "", "users", "missing")
			},
			wantKind:   metadata.InconsistencyKindTable,
			wantSource: "src",
			wantName:   "users",
		},
		{
			name: "enum_values",
			record: func(i *metadata.Inconsistencies) {
				i.RecordEnumValues(ctx, logger, "src", "public", "kind", "no rows")
			},
			wantKind:   metadata.InconsistencyKindEnumValues,
			wantSource: "src",
			wantName:   "public.kind",
		},
		{
			name: "column",
			record: func(i *metadata.Inconsistencies) {
				i.RecordColumn(ctx, logger, "src", "public", "users", "email", "missing")
			},
			wantKind:   metadata.InconsistencyKindColumn,
			wantSource: "src",
			wantName:   "public.users.email",
		},
		{
			name: "function",
			record: func(i *metadata.Inconsistencies) {
				i.RecordFunction(ctx, logger, "src", "public", "fn", "missing")
			},
			wantKind:   metadata.InconsistencyKindFunction,
			wantSource: "src",
			wantName:   "public.fn",
		},
		{
			name: "relationship",
			record: func(i *metadata.Inconsistencies) {
				i.RecordRelationship(ctx, logger, "src", "public", "users", "posts", "missing")
			},
			wantKind:   metadata.InconsistencyKindRelationship,
			wantSource: "src",
			wantName:   "public.users.posts",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			inc := metadata.NewInconsistencies()
			tt.record(inc)

			snap := inc.Snapshot()
			if len(snap) != 1 {
				t.Fatalf("len(Snapshot()) = %d, want 1", len(snap))
			}

			got := snap[0]
			if got.Kind != tt.wantKind {
				t.Errorf("Kind = %q, want %q", got.Kind, tt.wantKind)
			}

			if got.Source != tt.wantSource {
				t.Errorf("Source = %q, want %q", got.Source, tt.wantSource)
			}

			if got.Name != tt.wantName {
				t.Errorf("Name = %q, want %q", got.Name, tt.wantName)
			}
		})
	}
}

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

				inc.Record(
					ctx,
					logger,
					metadata.InconsistencyKindTable,
					"src",
					"public.t",
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

	inc.Record(ctx, logger, metadata.InconsistencyKindTable, "src", "public.a", "reason-a")

	snap := inc.Snapshot()
	if len(snap) != 1 {
		t.Fatalf("len(Snapshot()) = %d, want 1", len(snap))
	}

	// Mutate the collector after taking the snapshot.
	inc.Record(ctx, logger, metadata.InconsistencyKindTable, "src", "public.b", "reason-b")

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
	inc.Record(ctx, nil, metadata.InconsistencyKindRole, "", "admin", "merge conflict")

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
	inc.Record(ctx, logger, metadata.InconsistencyKindDatabase, "", "src", "factory error")
}

func TestInconsistencies_AtStampedByRecord(t *testing.T) {
	t.Parallel()

	ctx := t.Context()
	logger := discardLogger()
	inc := metadata.NewInconsistencies()

	start := time.Now()

	inc.Record(ctx, logger, metadata.InconsistencyKindColumn, "src", "public.t.c", "missing")
	inc.Record(ctx, logger, metadata.InconsistencyKindFunction, "src", "public.f", "missing")

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
		inc.Record(
			ctx,
			logger,
			metadata.InconsistencyKindTable,
			"src",
			"public.t",
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

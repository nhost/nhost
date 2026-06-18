package source //nolint:testpackage // exercises unexported Store internals + fakes

import (
	"context"
	"sync/atomic"
	"testing"

	"github.com/jackc/pgx/v5"
)

// reconcileQueryer serves the snapshot read ReloadMetadata issues (QueryRow)
// and records the pg_notify round-trip ReconcileAfterProxy issues on the
// version-advanced branch (Query), so both arms can be asserted without a live
// database. Distinct from fakeStore (whose Query is a no-op stub) and
// notifyQueryer (whose QueryRow always returns ErrNoRows): this test needs both
// halves to succeed in one queryer.
type reconcileQueryer struct {
	metadataRows []fakeRow
	metadataIdx  atomic.Int32

	notifyCount atomic.Int32
	notifyArgs  []any
}

func (q *reconcileQueryer) QueryRow(_ context.Context, _ string, _ ...any) pgx.Row {
	i := int(q.metadataIdx.Add(1)) - 1
	if i >= len(q.metadataRows) {
		return fakeRow{err: pgx.ErrNoRows}
	}

	return q.metadataRows[i]
}

func (q *reconcileQueryer) Query(
	_ context.Context, _ string, args ...any,
) (pgx.Rows, error) {
	q.notifyCount.Add(1)
	q.notifyArgs = args
	closed := false

	return &fakeNotifyRows{closed: &closed}, nil
}

func TestReconcileAfterProxy_NotifiesWhenVersionAdvanced(t *testing.T) {
	t.Parallel()

	q := &reconcileQueryer{
		metadataRows: []fakeRow{
			{dest: []any{[]byte(trackedSnapshotJSON), int64(9)}},
		},
	}
	s := bootstrappedStoreWithQueryer(t, q) // bootstrapped at rv=7

	if err := s.ReconcileAfterProxy(t.Context()); err != nil {
		t.Fatalf("ReconcileAfterProxy: %v", err)
	}

	if got := s.ResourceVersion(); got != 9 {
		t.Errorf("ResourceVersion = %d, want 9 after reconcile", got)
	}

	if n := q.notifyCount.Load(); n != 1 {
		t.Fatalf("notify issued %d times, want 1 (rv advanced 7->9)", n)
	}

	if len(q.notifyArgs) != 2 ||
		q.notifyArgs[0] != metadataChannel ||
		q.notifyArgs[1] != "9" {
		t.Errorf("notify args = %v, want [%q \"9\"]", q.notifyArgs, metadataChannel)
	}
}

func TestReconcileAfterProxy_NoNotifyWhenVersionUnchanged(t *testing.T) {
	t.Parallel()

	q := &reconcileQueryer{
		metadataRows: []fakeRow{
			{dest: []any{[]byte(trackedSnapshotJSON), int64(7)}},
		},
	}
	s := bootstrappedStoreWithQueryer(t, q) // bootstrapped at rv=7

	if err := s.ReconcileAfterProxy(t.Context()); err != nil {
		t.Fatalf("ReconcileAfterProxy: %v", err)
	}

	if got := s.ResourceVersion(); got != 7 {
		t.Errorf("ResourceVersion = %d, want 7 (unchanged)", got)
	}

	if n := q.notifyCount.Load(); n != 0 {
		t.Errorf("notify issued %d times, want 0 (rv unchanged, branch skipped)", n)
	}
}

func TestReconcileAfterProxy_NoQueryerIsNoOp(t *testing.T) {
	t.Parallel()

	// A file-source Store has no database handle: nothing to reconcile.
	s := bootstrappedStore(t, &fakeWriter{}) // queryer == nil

	if err := s.ReconcileAfterProxy(t.Context()); err != nil {
		t.Fatalf("ReconcileAfterProxy with nil queryer: %v", err)
	}
}

package source

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

// discardLogger is a no-op logger for the dispatch error path, which logs
// rather than propagates; listenOnce always passes a non-nil logger.
func discardLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

// notifyQueryer captures the args passed to Query and returns a fakeNotifyRows
// whose Close/Err behavior is configurable, so notifyMetadataChange can be
// exercised without a database.
type notifyQueryer struct {
	gotSQL   string
	gotArgs  []any
	queryErr error
	rowsErr  error
	closed   bool
}

func (q *notifyQueryer) QueryRow(_ context.Context, _ string, _ ...any) pgx.Row {
	return fakeRow{err: pgx.ErrNoRows}
}

func (q *notifyQueryer) Query(
	_ context.Context, sql string, args ...any,
) (pgx.Rows, error) {
	q.gotSQL = sql
	q.gotArgs = args

	if q.queryErr != nil {
		return nil, q.queryErr
	}

	return &fakeNotifyRows{err: q.rowsErr, closed: &q.closed}, nil
}

// fakeNotifyRows implements just the pgx.Rows methods notifyMetadataChange
// uses (Close, Err); the embedded interface panics on any other call, which
// would surface an unexpected dependency rather than silently pass.
type fakeNotifyRows struct {
	pgx.Rows

	err    error
	closed *bool
}

func (r *fakeNotifyRows) Close()     { *r.closed = true }
func (r *fakeNotifyRows) Err() error { return r.err }

func TestNotifyMetadataChange_PassesChannelAndVersion(t *testing.T) {
	t.Parallel()

	q := &notifyQueryer{}

	if err := notifyMetadataChange(t.Context(), q, 42); err != nil {
		t.Fatalf("notifyMetadataChange: %v", err)
	}

	if q.gotSQL != notifyMetadataSQL {
		t.Errorf("SQL = %q, want %q", q.gotSQL, notifyMetadataSQL)
	}

	if len(q.gotArgs) != 2 {
		t.Fatalf("args len = %d, want 2 (%v)", len(q.gotArgs), q.gotArgs)
	}

	if ch, _ := q.gotArgs[0].(string); ch != metadataChannel {
		t.Errorf("channel arg = %v, want %q", q.gotArgs[0], metadataChannel)
	}

	if payload, _ := q.gotArgs[1].(string); payload != "42" {
		t.Errorf("payload arg = %v, want %q", q.gotArgs[1], "42")
	}

	if !q.closed {
		t.Error("rows were not closed")
	}
}

func TestNotifyMetadataChange_WrapsQueryError(t *testing.T) {
	t.Parallel()

	sentinel := errors.New("boom")
	q := &notifyQueryer{queryErr: sentinel}

	err := notifyMetadataChange(t.Context(), q, 1)
	if !errors.Is(err, sentinel) {
		t.Fatalf("err = %v, want wrapped %v", err, sentinel)
	}
}

func TestNotifyMetadataChange_WrapsRowsError(t *testing.T) {
	t.Parallel()

	sentinel := errors.New("late failure")
	q := &notifyQueryer{rowsErr: sentinel}

	err := notifyMetadataChange(t.Context(), q, 1)
	if !errors.Is(err, sentinel) {
		t.Fatalf("err = %v, want wrapped %v", err, sentinel)
	}

	if !q.closed {
		t.Error("rows were not closed before checking Err")
	}
}

// recordingReloader captures every notifiedRV listenOnce dispatches, so the
// payload-parsing branch (numeric vs unparseable → 0) can be asserted without
// a live LISTEN connection.
type recordingReloader struct {
	gotRVs []int64
	err    error
}

func (r *recordingReloader) ReloadIfStale(
	_ context.Context, notifiedRV int64,
) (int64, IdempotencyCode, error) {
	r.gotRVs = append(r.gotRVs, notifiedRV)

	return notifiedRV, "", r.err
}

func TestDispatchNotification_ParsesPayload(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		payload string
		wantRV  int64
	}{
		{name: "numeric payload forwarded", payload: "57", wantRV: 57},
		{name: "unparseable payload forces unconditional reload", payload: "nope", wantRV: 0},
		{name: "empty payload forces unconditional reload", payload: "", wantRV: 0},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			r := &recordingReloader{}
			dispatchNotification(t.Context(), tc.payload, r, nil)

			if len(r.gotRVs) != 1 || r.gotRVs[0] != tc.wantRV {
				t.Fatalf("dispatched RVs = %v, want [%d]", r.gotRVs, tc.wantRV)
			}
		})
	}
}

func TestDispatchNotification_SwallowsReloadError(t *testing.T) {
	t.Parallel()

	// A reload failure must not panic or propagate; listenOnce keeps running.
	r := &recordingReloader{err: errors.New("reload failed")}
	dispatchNotification(t.Context(), "9", r, discardLogger())

	if len(r.gotRVs) != 1 {
		t.Fatalf("ReloadIfStale called %d times, want 1", len(r.gotRVs))
	}
}

func bootstrappedStoreWithQueryer(t *testing.T, q Queryer) *Store {
	t.Helper()

	h, err := hasura.FromJSON([]byte(trackedSnapshotJSON))
	if err != nil {
		t.Fatalf("hasura.FromJSON: %v", err)
	}

	s := NewStore(&fakeWriter{}, q, nil)
	if err := s.Bootstrap(h, 7); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}

	return s
}

func TestReloadIfStale_SkipsWhenNotNewer(t *testing.T) {
	t.Parallel()

	// No metadataRows configured: any DB read would return ErrNoRows and fail,
	// so a successful no-op proves the stale path never touched the database.
	q := &fakeStore{}
	s := bootstrappedStoreWithQueryer(t, q)

	rv, _, err := s.ReloadIfStale(t.Context(), 5)
	if err != nil {
		t.Fatalf("ReloadIfStale(stale): %v", err)
	}

	if rv != 7 {
		t.Errorf("rv = %d, want 7 (unchanged)", rv)
	}

	if q.metadataIdx.Load() != 0 {
		t.Errorf("metadata query issued %d times, want 0 on stale skip", q.metadataIdx.Load())
	}
}

func TestReloadIfStale_ReloadsWhenNewer(t *testing.T) {
	t.Parallel()

	q := &fakeStore{
		metadataRows: []fakeRow{
			{dest: []any{[]byte(trackedSnapshotJSON), int64(9)}},
		},
	}
	s := bootstrappedStoreWithQueryer(t, q)

	rv, _, err := s.ReloadIfStale(t.Context(), 9)
	if err != nil {
		t.Fatalf("ReloadIfStale(newer): %v", err)
	}

	if rv != 9 {
		t.Errorf("rv = %d, want 9 after reload", rv)
	}

	if q.metadataIdx.Load() != 1 {
		t.Errorf("metadata query issued %d times, want 1", q.metadataIdx.Load())
	}
}

func TestReloadIfStale_ZeroForcesReload(t *testing.T) {
	t.Parallel()

	q := &fakeStore{
		metadataRows: []fakeRow{
			{dest: []any{[]byte(trackedSnapshotJSON), int64(11)}},
		},
	}
	s := bootstrappedStoreWithQueryer(t, q)

	// notifiedRV 0 (unparseable payload) must reload even though 0 <= current.
	rv, _, err := s.ReloadIfStale(t.Context(), 0)
	if err != nil {
		t.Fatalf("ReloadIfStale(0): %v", err)
	}

	if rv != 11 {
		t.Errorf("rv = %d, want 11 after forced reload", rv)
	}

	if q.metadataIdx.Load() != 1 {
		t.Errorf("metadata query issued %d times, want 1", q.metadataIdx.Load())
	}
}

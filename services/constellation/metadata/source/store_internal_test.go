package source

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

// fakeWriter is a MetadataWriter that records calls and can inject a
// conflict on the Nth call.
type fakeWriter struct {
	mu             sync.Mutex
	calls          [][]byte
	expectedRVs    []int64
	newRVs         []int64
	conflictOnCall int // 1-based; 0 = never
}

func (w *fakeWriter) WriteMetadata(
	_ context.Context, newRaw []byte, expectedRV, newRV int64,
) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.calls = append(w.calls, append([]byte(nil), newRaw...))
	w.expectedRVs = append(w.expectedRVs, expectedRV)
	w.newRVs = append(w.newRVs, newRV)

	if w.conflictOnCall != 0 && len(w.calls) == w.conflictOnCall {
		return ErrResourceVersionConflict
	}

	return nil
}

func (w *fakeWriter) callCount() int {
	w.mu.Lock()
	defer w.mu.Unlock()

	return len(w.calls)
}

const trackedSnapshotJSON = `{
  "version": 3,
  "sources": [
    {
      "name": "default",
      "kind": "postgres",
      "tables": [],
      "configuration": {
        "connection_info": {
          "database_url": {"from_env": "PG_URL"},
          "isolation_level": "read-committed",
          "use_prepared_statements": true
        }
      }
    }
  ]
}`

func bootstrappedStore(t *testing.T, w *fakeWriter) *Store {
	t.Helper()

	h, err := hasura.FromJSON([]byte(trackedSnapshotJSON))
	if err != nil {
		t.Fatalf("hasura.FromJSON: %v", err)
	}

	s := NewStore(w, nil, nil)
	if err := s.Bootstrap(h, 7); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}

	return s
}

func TestStore_Apply_BumpsResourceVersionAndPersists(t *testing.T) {
	t.Parallel()

	w := &fakeWriter{}
	s := bootstrappedStore(t, w)

	rv, code, err := s.PgTrackTable(t.Context(), []byte(
		`{"source":"default","table":{"schema":"public","name":"users"}}`,
	))
	if err != nil {
		t.Fatalf("PgTrackTable: %v", err)
	}

	if code != "" {
		t.Errorf("unexpected idempotency code: %q", code)
	}

	if rv != 8 {
		t.Errorf("returned rv = %d, want 8", rv)
	}

	if got := s.ResourceVersion(); got != 8 {
		t.Errorf("ResourceVersion = %d, want 8", got)
	}

	if w.callCount() != 1 {
		t.Errorf("writer calls = %d, want 1", w.callCount())
	}

	if w.expectedRVs[0] != 7 || w.newRVs[0] != 8 {
		t.Errorf("rv pair = (%d, %d), want (7, 8)", w.expectedRVs[0], w.newRVs[0])
	}
}

func TestStore_Apply_IdempotentTrackReturnsCode(t *testing.T) {
	t.Parallel()

	w := &fakeWriter{}
	s := bootstrappedStore(t, w)

	args := []byte(`{"source":"default","table":{"schema":"public","name":"users"}}`)

	if _, _, err := s.PgTrackTable(t.Context(), args); err != nil {
		t.Fatalf("first PgTrackTable: %v", err)
	}

	_, code, err := s.PgTrackTable(t.Context(), args)
	if err != nil {
		t.Fatalf("second PgTrackTable: %v", err)
	}

	if code != CodeAlreadyTracked {
		t.Errorf("code = %q, want %q", code, CodeAlreadyTracked)
	}

	if got := s.ResourceVersion(); got != 8 {
		t.Errorf("ResourceVersion = %d, want 8 (idempotent no-op should not bump)", got)
	}

	if w.callCount() != 1 {
		t.Errorf("writer calls = %d, want 1 (no write on idempotent no-op)", w.callCount())
	}
}

func TestStore_Apply_PropagatesConflict(t *testing.T) {
	t.Parallel()

	w := &fakeWriter{conflictOnCall: 1}
	s := bootstrappedStore(t, w)

	_, _, err := s.PgTrackTable(t.Context(), []byte(
		`{"source":"default","table":{"schema":"public","name":"users"}}`,
	))
	if !errors.Is(err, ErrResourceVersionConflict) {
		t.Fatalf("err = %v, want ErrResourceVersionConflict", err)
	}

	if got := s.ResourceVersion(); got != 7 {
		t.Errorf("ResourceVersion = %d, want 7 (RV unchanged on conflict)", got)
	}
}

func TestStore_Apply_RejectsUnknownSource(t *testing.T) {
	t.Parallel()

	w := &fakeWriter{}
	s := bootstrappedStore(t, w)

	_, _, err := s.PgTrackTable(t.Context(), []byte(
		`{"source":"other","table":{"schema":"public","name":"users"}}`,
	))
	if !errors.Is(err, ErrSourceNotFound) {
		t.Fatalf("err = %v, want ErrSourceNotFound", err)
	}

	if w.callCount() != 0 {
		t.Errorf("writer calls = %d, want 0 (validation failed before write)", w.callCount())
	}
}

func TestStore_Watch_BroadcastsAfterApply(t *testing.T) {
	t.Parallel()

	w := &fakeWriter{}
	s := bootstrappedStore(t, w)

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	ch := s.Watch(ctx)

	if _, _, err := s.PgTrackTable(ctx, []byte(
		`{"source":"default","table":{"schema":"public","name":"users"}}`,
	)); err != nil {
		t.Fatalf("PgTrackTable: %v", err)
	}

	select {
	case u := <-ch:
		if u.Err != nil {
			t.Errorf("update err: %v", u.Err)
		}

		if u.Metadata == nil {
			t.Error("update Metadata is nil")
		}
	case <-time.After(time.Second):
		t.Fatal("expected Update on Watch channel within 1s")
	}
}

func TestStore_ApplyAfterClose_StillWritesNoBroadcast(t *testing.T) {
	t.Parallel()

	w := &fakeWriter{}
	s := bootstrappedStore(t, w)
	s.Close()

	if _, _, err := s.PgTrackTable(t.Context(), []byte(
		`{"source":"default","table":{"schema":"public","name":"users"}}`,
	)); err != nil {
		t.Fatalf("PgTrackTable after Close: %v", err)
	}

	if got := s.ResourceVersion(); got != 8 {
		t.Errorf("ResourceVersion = %d, want 8", got)
	}
}

func TestStore_ApplyBeforeBootstrap_Errors(t *testing.T) {
	t.Parallel()

	s := NewStore(&fakeWriter{}, nil, nil)

	_, _, err := s.PgTrackTable(t.Context(), []byte(
		`{"source":"default","table":{"schema":"public","name":"users"}}`,
	))
	if !errors.Is(err, ErrStoreNotInitialized) {
		t.Fatalf("err = %v, want ErrStoreNotInitialized", err)
	}
}

func TestStore_ReadOnly_ApplyErrors(t *testing.T) {
	t.Parallel()

	h, err := hasura.FromJSON([]byte(trackedSnapshotJSON))
	if err != nil {
		t.Fatalf("hasura.FromJSON: %v", err)
	}

	s := NewStore(nil, nil, nil)
	if err := s.Bootstrap(h, 7); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}

	_, _, err = s.PgTrackTable(t.Context(), []byte(
		`{"source":"default","table":{"schema":"public","name":"users"}}`,
	))
	if !errors.Is(err, ErrStoreReadOnly) {
		t.Fatalf("err = %v, want ErrStoreReadOnly", err)
	}
}

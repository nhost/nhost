// White-box test file: accesses unexported state (poll, src.snapshot).
// See fake_store_test.go for the same-package fake of the metadataStore interface.

package source

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/nhost/nhost/services/constellation/metadata"
)

const validV3JSON = `{"version":3,"sources":[]}`

// Test sentinel errors used to verify error propagation through the
// metadata source's polling and load paths.
var (
	errBoom            = errors.New("boom")
	errConnectionReset = errors.New("connection reset")
	errTableMissing    = errors.New("table missing")
)

func newTestSource(store metadataStore, pollInterval time.Duration) *DatabaseMetadataSource {
	return newDatabaseMetadataSource(
		store,
		pollInterval,
		slog.New(slog.DiscardHandler),
	)
}

func TestDatabaseMetadataSource_InitialLoad(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		store       *fakeStore
		wantErr     bool
		wantVersion int64
	}{
		{
			name: "success",
			store: &fakeStore{
				metadataRows: []fakeRow{
					{dest: []any{[]byte(validV3JSON), int64(7)}},
				},
			},
			wantErr:     false,
			wantVersion: 7,
		},
		{
			name: "query error propagates",
			store: &fakeStore{
				metadataRows: []fakeRow{
					{err: errBoom},
				},
			},
			wantErr: true,
		},
		{
			name: "invalid metadata JSON",
			store: &fakeStore{
				metadataRows: []fakeRow{
					{dest: []any{[]byte(`{"version":2}`), int64(1)}},
				},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			src := newTestSource(tt.store, time.Hour)
			defer src.Close()

			meta, err := src.InitialLoad(t.Context())
			if (err != nil) != tt.wantErr {
				t.Fatalf("InitialLoad err = %v, wantErr=%v", err, tt.wantErr)
			}

			if tt.wantErr {
				return
			}

			if meta == nil {
				t.Fatal("expected non-nil metadata")
			}

			snap := src.snapshot.Load()
			if snap == nil {
				t.Fatal("snapshot was not stored after successful InitialLoad")
			}

			if snap.version != tt.wantVersion {
				t.Errorf("snapshot.version = %d, want %d", snap.version, tt.wantVersion)
			}
		})
	}
}

// TestDatabaseMetadataSource_HasuraSnapshotJSON_AfterInitialLoad verifies
// that HasuraSnapshotJSON returns the MarshalHasura form of the metadata
// just loaded, paired with the scanned resource_version.
func TestDatabaseMetadataSource_HasuraSnapshotJSON_AfterInitialLoad(t *testing.T) {
	t.Parallel()

	store := &fakeStore{
		metadataRows: []fakeRow{
			{dest: []any{[]byte(validV3JSON), int64(42)}},
		},
	}

	src := newTestSource(store, time.Hour)
	defer src.Close()

	if _, err := src.InitialLoad(t.Context()); err != nil {
		t.Fatalf("InitialLoad: %v", err)
	}

	// Recompute the expected snapshot by parsing the same input the source
	// loaded, then re-marshaling through MarshalHasura — mirroring what the
	// source does internally so the assertion is byte-for-byte exact.
	_, h, err := metadata.FromHasuraJSONWithHasura([]byte(validV3JSON))
	if err != nil {
		t.Fatalf("FromHasuraJSONWithHasura: %v", err)
	}

	want, err := metadata.MarshalHasura(h)
	if err != nil {
		t.Fatalf("MarshalHasura: %v", err)
	}

	gotRaw, gotVersion := src.HasuraSnapshotJSON()
	if !bytes.Equal(gotRaw, want) {
		t.Errorf("HasuraSnapshotJSON bytes = %q; want %q", gotRaw, want)
	}

	if gotVersion != 42 {
		t.Errorf("HasuraSnapshotJSON version = %d; want 42", gotVersion)
	}
}

// TestDatabaseMetadataSource_HasuraSnapshotJSON_NilBeforeLoad covers the
// pre-InitialLoad state: getter returns (nil, 0).
func TestDatabaseMetadataSource_HasuraSnapshotJSON_NilBeforeLoad(t *testing.T) {
	t.Parallel()

	src := newTestSource(&fakeStore{}, time.Hour)
	defer src.Close()

	gotRaw, gotVersion := src.HasuraSnapshotJSON()
	if gotRaw != nil {
		t.Errorf("HasuraSnapshotJSON bytes = %q; want nil", gotRaw)
	}

	if gotVersion != 0 {
		t.Errorf("HasuraSnapshotJSON version = %d; want 0", gotVersion)
	}
}

func TestDatabaseMetadataSource_Poll_UnchangedVersion(t *testing.T) {
	t.Parallel()

	store := &fakeStore{
		metadataRows: []fakeRow{
			{dest: []any{[]byte(validV3JSON), int64(5)}},
		},
		versionRows: []fakeRow{
			{dest: []any{int64(5)}},
		},
	}

	src := newTestSource(store, time.Hour)
	defer src.Close()

	if _, err := src.InitialLoad(t.Context()); err != nil {
		t.Fatalf("InitialLoad: %v", err)
	}

	if update := src.poll(t.Context()); update != nil {
		t.Errorf("expected nil update on unchanged version, got %+v", update)
	}
}

func TestDatabaseMetadataSource_Poll_VersionChanged(t *testing.T) {
	t.Parallel()

	store := &fakeStore{
		metadataRows: []fakeRow{
			{dest: []any{[]byte(validV3JSON), int64(5)}},
			{dest: []any{[]byte(validV3JSON), int64(6)}},
		},
		versionRows: []fakeRow{
			{dest: []any{int64(6)}},
		},
	}

	src := newTestSource(store, time.Hour)
	defer src.Close()

	if _, err := src.InitialLoad(t.Context()); err != nil {
		t.Fatalf("InitialLoad: %v", err)
	}

	update := src.poll(t.Context())
	if update == nil {
		t.Fatal("expected update, got nil")
	}

	if update.Err != nil {
		t.Errorf("expected nil Err, got %v", update.Err)
	}

	if update.Metadata == nil {
		t.Error("expected non-nil Metadata")
	}

	snap := src.snapshot.Load()
	if snap == nil {
		t.Fatal("snapshot was not stored after poll")
	}

	if snap.version != 6 {
		t.Errorf("snapshot.version = %d, want 6", snap.version)
	}
}

func TestDatabaseMetadataSource_Poll_VersionFetchErrorLogsAndReturnsNil(t *testing.T) {
	t.Parallel()

	store := &fakeStore{
		versionRows: []fakeRow{
			{err: errConnectionReset},
		},
	}

	src := newTestSource(store, time.Hour)
	defer src.Close()

	if update := src.poll(t.Context()); update != nil {
		t.Errorf("expected nil update on version fetch error, got %+v", update)
	}
}

func TestDatabaseMetadataSource_Poll_LoadErrorReturnsUpdateWithErr(t *testing.T) {
	t.Parallel()

	store := &fakeStore{
		metadataRows: []fakeRow{
			{err: errTableMissing},
		},
		versionRows: []fakeRow{{dest: []any{int64(99)}}},
	}

	src := newTestSource(store, time.Hour)
	defer src.Close()

	update := src.poll(t.Context())
	if update == nil {
		t.Fatal("expected update with error, got nil")
	}

	if update.Err == nil {
		t.Error("expected non-nil Err")
	}

	if update.Metadata != nil {
		t.Error("expected nil Metadata")
	}
}

func TestDatabaseMetadataSource_Close_StopsWatchAndClosesStore(t *testing.T) {
	t.Parallel()

	store := &fakeStore{}
	src := newTestSource(store, time.Millisecond)

	ch := src.Watch(t.Context())

	src.Close()

	select {
	case _, ok := <-ch:
		if ok {
			t.Error("expected channel to be closed by Close")
		}
	case <-time.After(time.Second):
		t.Fatal("Watch channel was not closed within 1s")
	}

	if !store.closed.Load() {
		t.Error("expected store.Close to be invoked")
	}
}

func TestDatabaseMetadataSource_Close_Idempotent(t *testing.T) {
	t.Parallel()

	store := &fakeStore{}
	src := newTestSource(store, time.Hour)

	src.Close()
	src.Close() // must not panic
}

func TestDatabaseMetadataSource_Watch_CtxCancelClosesChannel(t *testing.T) {
	t.Parallel()

	store := &fakeStore{}

	src := newTestSource(store, time.Millisecond)
	defer src.Close()

	ctx, cancel := context.WithCancel(t.Context())
	ch := src.Watch(ctx)

	cancel()

	select {
	case _, ok := <-ch:
		if ok {
			t.Error("expected channel closed after ctx cancel")
		}
	case <-time.After(time.Second):
		t.Fatal("Watch channel was not closed within 1s of ctx cancel")
	}
}

func TestDatabaseMetadataSource_Watch_DeliversUpdate(t *testing.T) {
	t.Parallel()

	store := &fakeStore{
		metadataRows: []fakeRow{
			{dest: []any{[]byte(validV3JSON), int64(2)}},
		},
		versionRows: []fakeRow{
			{dest: []any{int64(2)}},
		},
	}

	src := newTestSource(store, time.Millisecond)
	defer src.Close()

	ch := src.Watch(t.Context())

	select {
	case update, ok := <-ch:
		if !ok {
			t.Fatal("channel closed before delivering update")
		}

		if update.Err != nil {
			t.Errorf("unexpected error: %v", update.Err)
		}

		if update.Metadata == nil {
			t.Error("expected non-nil Metadata")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("did not receive update within 2s")
	}
}

// TestDatabaseMetadataSource_ResourceVersion_ConcurrentAccess drives the
// Watch poller (which reads/writes the snapshot pointer) concurrently with
// direct poll calls and a snapshot rewrite, so the race detector flags any
// unsynchronised access. It guards the atomic.Pointer[snapshot] invariant
// even under the unsupported "second poller" call pattern the Watch godoc
// warns about.
func TestDatabaseMetadataSource_ResourceVersion_ConcurrentAccess(t *testing.T) {
	t.Parallel()

	const iterations = 200

	rows := make([]fakeRow, 0, iterations+1)
	for v := range int64(iterations + 1) {
		rows = append(rows, fakeRow{dest: []any{[]byte(validV3JSON), v}, err: nil})
	}

	store := &fakeStore{
		versionRows:  []fakeRow{},
		metadataRows: rows,
		versionIdx:   atomic.Int32{},
		metadataIdx:  atomic.Int32{},
		closed:       atomic.Bool{},
	}

	src := newTestSource(store, time.Millisecond)
	defer src.Close()

	if _, err := src.InitialLoad(t.Context()); err != nil {
		t.Fatalf("InitialLoad: %v", err)
	}

	// Spawn a background poller via Watch, racing with the direct poll/Store
	// loop below. Both touch the snapshot pointer concurrently.
	ch := src.Watch(t.Context())

	var wg sync.WaitGroup

	wg.Go(func() {
		for range ch { //nolint:revive // drain until Close shuts the channel
		}
	})

	for range iterations {
		_ = src.poll(t.Context())

		cur := src.snapshot.Load()
		next := &snapshot{raw: nil, version: 0}

		if cur != nil {
			next.raw = cur.raw
			next.version = cur.version + 1
		}

		src.snapshot.Store(next)
	}

	src.Close()
	wg.Wait()
}

func TestLoadMetadataFromStore_PropagatesParseError(t *testing.T) {
	t.Parallel()

	store := &fakeStore{
		metadataRows: []fakeRow{
			{dest: []any{[]byte(`{not json`), int64(1)}},
		},
	}

	if _, _, _, err := loadMetadataFromStore(t.Context(), store); err == nil {
		t.Fatal("expected parse error, got nil")
	}
}

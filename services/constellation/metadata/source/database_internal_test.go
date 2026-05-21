// White-box test file: accesses unexported state (poll, src.resourceVersion).
// See fake_store_test.go for the same-package fake of the metadataStore interface.

package source

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

const validV3JSON = `{"version":3,"sources":[]}`

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
				metadataRows: []fakeRow{{err: errors.New("boom")}},
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

			if got := src.resourceVersion.Load(); got != tt.wantVersion {
				t.Errorf("resourceVersion = %d, want %d", got, tt.wantVersion)
			}
		})
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

	if got := src.resourceVersion.Load(); got != 6 {
		t.Errorf("resourceVersion = %d, want 6", got)
	}
}

func TestDatabaseMetadataSource_Poll_VersionFetchErrorLogsAndReturnsNil(t *testing.T) {
	t.Parallel()

	store := &fakeStore{
		versionRows: []fakeRow{{err: errors.New("connection reset")}},
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
		metadataRows: []fakeRow{{err: errors.New("table missing")}},
		versionRows:  []fakeRow{{dest: []any{int64(99)}}},
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
// Watch poller (which reads/writes resourceVersion) concurrently with direct
// poll calls and a Store, so the race detector flags any unsynchronised
// access to resourceVersion. It guards the atomic.Int64 invariant even under
// the unsupported "second poller" call pattern the Watch godoc warns about.
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
	// loop below. Both touch resourceVersion concurrently.
	ch := src.Watch(t.Context())

	var wg sync.WaitGroup

	wg.Go(func() {
		for range ch { //nolint:revive // drain until Close shuts the channel
		}
	})

	for range iterations {
		_ = src.poll(t.Context())

		src.resourceVersion.Store(src.resourceVersion.Load() + 1)
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

	if _, _, err := loadMetadataFromStore(t.Context(), store); err == nil {
		t.Fatal("expected parse error, got nil")
	}
}

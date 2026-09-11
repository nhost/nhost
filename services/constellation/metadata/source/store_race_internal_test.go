package source

import (
	"context"
	"fmt"
	"slices"
	"sync"
	"testing"
)

// TestStore_Apply_ConcurrentMutationsAndReads is the -race regression guard for
// the documented "all derived state swapped together under s.mu" invariant. It
// hammers one bootstrapped Store with concurrent Applies (PgTrackTable on
// distinct tables) interleaved with snapshot reads and an active Watch
// consumer. It asserts the final resource_version equals the number of
// mutating applies (no lost or double-counted bump) and that no two writer
// calls ever observed the same expectedRV (every apply read-modify-wrote a
// distinct version — the OCC precondition the swap protects).
//
// Run with -race to catch any unsynchronised access to the swapped state.
func TestStore_Apply_ConcurrentMutationsAndReads(t *testing.T) {
	t.Parallel()

	const writers = 50

	w := &fakeWriter{}
	s := bootstrappedStore(t, w) // bootstrapped at rv=7

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	// Active Watch consumer: drains broadcasts so broadcastLocked's send path
	// runs concurrently with the writers and readers.
	watchDone := make(chan struct{})
	ch := s.Watch(ctx)

	go func() {
		defer close(watchDone)

		//nolint:revive // intentional drain: consume broadcasts until Watch closes ch.
		for range ch {
		}
	}()

	// Concurrent readers: ResourceVersion and HasuraSnapshotJSON must never race
	// the writers' swap. They run until readerStop closes.
	var readerWG sync.WaitGroup

	readerStop := make(chan struct{})

	for range 4 {
		readerWG.Go(func() {
			for {
				select {
				case <-readerStop:
					return
				default:
					_ = s.ResourceVersion()
					_, _ = s.HasuraSnapshotJSON()
				}
			}
		})
	}

	// Concurrent writers: each tracks a distinct table, so every apply succeeds
	// and bumps the version exactly once.
	var writerWG sync.WaitGroup

	for i := range writers {
		writerWG.Add(1)

		go func(n int) {
			defer writerWG.Done()

			args := fmt.Appendf(nil,
				`{"source":"default","table":{"schema":"public","name":"t_%d"}}`, n)
			if _, _, err := s.PgTrackTable(ctx, args); err != nil {
				t.Errorf("PgTrackTable(t_%d): %v", n, err)
			}
		}(i)
	}

	writerWG.Wait()
	close(readerStop)
	readerWG.Wait()
	cancel()
	<-watchDone

	const wantRV = 7 + writers
	if got := s.ResourceVersion(); got != wantRV {
		t.Errorf("final ResourceVersion = %d, want %d (one bump per apply)", got, wantRV)
	}

	w.mu.Lock()
	expected := append([]int64(nil), w.expectedRVs...)
	w.mu.Unlock()

	if len(expected) != writers {
		t.Fatalf("writer calls = %d, want %d", len(expected), writers)
	}

	slices.Sort(expected)

	for i, rv := range expected {
		want := int64(7 + i)
		if rv != want {
			t.Fatalf("expectedRVs not a contiguous unique sequence: got %v at index %d (want %d)",
				expected, i, want)
		}
	}
}

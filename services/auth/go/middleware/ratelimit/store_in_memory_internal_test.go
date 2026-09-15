package ratelimit

import (
	"slices"
	"strconv"
	"sync"
	"testing"
	"time"
)

func assertInMemoryStoreInvariant(t *testing.T, store *InMemoryStore) {
	t.Helper()

	store.mx.Lock()
	defer store.mx.Unlock()

	if len(store.data) > store.maxEntries {
		t.Errorf("entry count %d exceeds capacity %d", len(store.data), store.maxEntries)
	}

	if len(store.data) == 0 {
		if store.newest != nil || store.oldest != nil {
			t.Errorf(
				"empty map has non-nil list endpoints: newest=%p oldest=%p",
				store.newest,
				store.oldest,
			)
		}

		return
	}

	if store.newest == nil || store.oldest == nil {
		t.Fatalf(
			"non-empty map has nil list endpoint: newest=%p oldest=%p",
			store.newest,
			store.oldest,
		)
	}

	if store.newest.newer != nil {
		t.Errorf("newest entry %q has a newer neighbor", store.newest.key)
	}

	if store.oldest.older != nil {
		t.Errorf("oldest entry %q has an older neighbor", store.oldest.key)
	}

	newestToOldest := collectNewestToOldest(t, store)
	oldestToNewest := collectOldestToNewest(t, store)
	assertInMemoryStoreBijection(t, store, newestToOldest, oldestToNewest)
}

func collectNewestToOldest(t *testing.T, store *InMemoryStore) []*inMemoryStoreEntry {
	t.Helper()

	entries := make([]*inMemoryStoreEntry, 0, len(store.data))
	seen := make(map[*inMemoryStoreEntry]struct{}, len(store.data))

	var newer *inMemoryStoreEntry
	for entry := store.newest; entry != nil; entry = entry.older {
		if _, duplicate := seen[entry]; duplicate {
			t.Fatalf("cycle or duplicate at entry %q while traversing newest to oldest", entry.key)
		}

		seen[entry] = struct{}{}
		entries = append(entries, entry)

		if entry.newer != newer {
			t.Errorf("entry %q has newer=%p, want %p", entry.key, entry.newer, newer)
		}

		if mapped, ok := store.data[entry.key]; !ok || mapped != entry {
			t.Errorf("list entry %q does not have the same node in the map", entry.key)
		}

		newer = entry
	}

	if entries[len(entries)-1] != store.oldest {
		t.Errorf(
			"newest-to-oldest traversal did not terminate at oldest entry %q",
			store.oldest.key,
		)
	}

	return entries
}

func collectOldestToNewest(t *testing.T, store *InMemoryStore) []*inMemoryStoreEntry {
	t.Helper()

	entries := make([]*inMemoryStoreEntry, 0, len(store.data))
	seen := make(map[*inMemoryStoreEntry]struct{}, len(store.data))

	var older *inMemoryStoreEntry
	for entry := store.oldest; entry != nil; entry = entry.newer {
		if _, duplicate := seen[entry]; duplicate {
			t.Fatalf("cycle or duplicate at entry %q while traversing oldest to newest", entry.key)
		}

		seen[entry] = struct{}{}
		entries = append(entries, entry)

		if entry.older != older {
			t.Errorf("entry %q has older=%p, want %p", entry.key, entry.older, older)
		}

		older = entry
	}

	if entries[len(entries)-1] != store.newest {
		t.Errorf(
			"oldest-to-newest traversal did not terminate at newest entry %q",
			store.newest.key,
		)
	}

	return entries
}

func assertInMemoryStoreBijection(
	t *testing.T,
	store *InMemoryStore,
	newestToOldest []*inMemoryStoreEntry,
	oldestToNewest []*inMemoryStoreEntry,
) {
	t.Helper()

	if len(newestToOldest) != len(store.data) || len(oldestToNewest) != len(store.data) {
		t.Errorf(
			"map/list entry counts differ: map=%d newest-to-oldest=%d oldest-to-newest=%d",
			len(store.data), len(newestToOldest), len(oldestToNewest),
		)
	}

	for key, entry := range store.data {
		if entry.key != key {
			t.Errorf("map key %q points to an entry with key %q", key, entry.key)
		}

		if !slices.Contains(newestToOldest, entry) {
			t.Errorf("map entry %q is absent from the newest-to-oldest traversal", key)
		}

		if !slices.Contains(oldestToNewest, entry) {
			t.Errorf("map entry %q is absent from the oldest-to-newest traversal", key)
		}
	}

	if len(newestToOldest) == len(oldestToNewest) {
		for idx, entry := range newestToOldest {
			if reverse := oldestToNewest[len(oldestToNewest)-1-idx]; entry != reverse {
				t.Errorf(
					"list traversals disagree at index %d: newest-to-oldest=%q oldest-to-newest-reversed=%q",
					idx,
					entry.key,
					reverse.key,
				)
			}
		}
	}
}

func TestInMemoryStoreGetExpirationBoundary(t *testing.T) {
	t.Parallel()

	deadline := time.Unix(1_700_000_000, 0)
	tests := []struct {
		name        string
		now         time.Time
		want        int
		wantPresent bool
	}{
		{
			name:        "deadline is inclusive",
			now:         deadline,
			want:        7,
			wantPresent: true,
		},
		{
			name:        "after deadline is expired and reclaimed",
			now:         deadline.Add(time.Nanosecond),
			want:        0,
			wantPresent: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			store := newInMemoryStore(2)
			store.Increment(t.Context(), "key", time.Hour)
			store.data["key"].value = InMemoryStoreValue{v: 7, time: deadline}

			if got := store.get("key", tt.now); got != tt.want {
				t.Errorf("get() = %d, want %d", got, tt.want)
			}

			if _, present := store.data["key"]; present != tt.wantPresent {
				t.Errorf("entry presence after get() = %v, want %v", present, tt.wantPresent)
			}

			assertInMemoryStoreInvariant(t, store)
		})
	}
}

func TestInMemoryStoreIncrementRefreshesDeadline(t *testing.T) {
	t.Parallel()

	store := newInMemoryStore(2)
	store.Increment(t.Context(), "key", time.Hour)

	const expire = 2 * time.Hour

	before := time.Now()

	if got := store.Increment(t.Context(), "key", expire); got != 2 {
		t.Fatalf("second Increment() = %d, want 2", got)
	}

	after := time.Now()

	deadline := store.data["key"].value.time
	if deadline.Before(before.Add(expire)) || deadline.After(after.Add(expire)) {
		t.Errorf(
			"deadline after Increment() = %s, want between %s and %s",
			deadline,
			before.Add(expire),
			after.Add(expire),
		)
	}
}

func TestInMemoryStoreIncrementRestartsExpiredKey(t *testing.T) {
	t.Parallel()

	store := newInMemoryStore(2)
	if got := store.Increment(t.Context(), "key", time.Hour); got != 1 {
		t.Fatalf("first Increment() = %d, want 1", got)
	}

	if got := store.Increment(t.Context(), "key", time.Hour); got != 2 {
		t.Fatalf("second Increment() = %d, want 2", got)
	}

	staleEntry := store.data["key"]
	staleEntry.value.time = time.Time{}

	if got := store.Increment(t.Context(), "key", time.Hour); got != 1 {
		t.Errorf("Increment() after expiry = %d, want 1", got)
	}

	if got := store.data["key"].value.v; got != 1 {
		t.Errorf("stored value after expiry = %d, want 1", got)
	}

	if store.data["key"] == staleEntry {
		t.Error("expired entry was updated in place instead of being reclaimed")
	}

	assertInMemoryStoreInvariant(t, store)
}

// The subtests share one store and run in order, each building on the state the
// previous one left behind, so they cannot be parallel.
//
//nolint:tparallel
func TestInMemoryStoreMaintainsListInvariantsAcrossRemovalPaths(t *testing.T) {
	t.Parallel()

	const capacity = 4

	store := newInMemoryStore(capacity)
	expiredAt := time.Unix(1_700_000_000, 0)
	operations := []struct {
		name string
		run  func(*testing.T, *InMemoryStore)
	}{
		{name: "insert a", run: func(t *testing.T, store *InMemoryStore) {
			t.Helper()

			store.Increment(t.Context(), "a", time.Hour)
		}},
		{name: "insert b", run: func(t *testing.T, store *InMemoryStore) {
			t.Helper()

			store.Increment(t.Context(), "b", time.Hour)
		}},
		{name: "insert c", run: func(t *testing.T, store *InMemoryStore) {
			t.Helper()

			store.Increment(t.Context(), "c", time.Hour)
		}},
		{name: "insert d", run: func(t *testing.T, store *InMemoryStore) {
			t.Helper()

			store.Increment(t.Context(), "d", time.Hour)
		}},
		{name: "reclaim expired middle entry", run: func(t *testing.T, store *InMemoryStore) {
			t.Helper()

			store.data["b"].value.time = expiredAt
			if got := store.get("b", expiredAt.Add(time.Nanosecond)); got != 0 {
				t.Errorf("get(expired middle entry) = %d, want 0", got)
			}
		}},
		{name: "fill capacity after reclamation", run: func(t *testing.T, store *InMemoryStore) {
			t.Helper()

			store.Increment(t.Context(), "e", time.Hour)
		}},
		{name: "refresh interior entry", run: func(t *testing.T, store *InMemoryStore) {
			t.Helper()

			if got := store.Get("c"); got != 1 {
				t.Errorf("Get(c) = %d, want 1", got)
			}
		}},
		{name: "evict oldest after reclamation", run: func(t *testing.T, store *InMemoryStore) {
			t.Helper()

			store.Increment(t.Context(), "f", time.Hour)

			if _, present := store.data["a"]; present {
				t.Error("oldest entry a was not evicted")
			}
		}},
		{name: "reclaim expired newest entry", run: func(t *testing.T, store *InMemoryStore) {
			t.Helper()

			store.data["f"].value.time = expiredAt
			if got := store.get("f", expiredAt.Add(time.Nanosecond)); got != 0 {
				t.Errorf("get(expired newest entry) = %d, want 0", got)
			}
		}},
		{name: "refill after newest reclamation", run: func(t *testing.T, store *InMemoryStore) {
			t.Helper()

			store.Increment(t.Context(), "g", time.Hour)
		}},
		{name: "continue evicting", run: func(t *testing.T, store *InMemoryStore) {
			t.Helper()

			store.Increment(t.Context(), "h", time.Hour)

			if _, present := store.data["d"]; present {
				t.Error("oldest entry d was not evicted")
			}
		}},
	}

	for _, operation := range operations {
		if ok := t.Run(operation.name, func(t *testing.T) {
			operation.run(t, store)
			assertInMemoryStoreInvariant(t, store)
		}); !ok {
			return
		}
	}
}

func TestInMemoryStoreStaysBounded(t *testing.T) {
	t.Parallel()

	const capacity = 3

	store := newInMemoryStore(capacity)
	for key := range capacity {
		store.Increment(t.Context(), strconv.Itoa(key), time.Hour)
		assertInMemoryStoreInvariant(t, store)
	}

	// Refresh the first key so the second key is now the least recently used.
	store.Get("0")
	assertInMemoryStoreInvariant(t, store)
	store.Increment(t.Context(), "overflow", time.Hour)
	assertInMemoryStoreInvariant(t, store)

	if got := len(store.data); got != capacity {
		t.Fatalf("expected at most %d entries, got %d", capacity, got)
	}

	if got := store.Get("1"); got != 0 {
		t.Errorf("expected the least recently used entry to be evicted, got %d", got)
	}

	if got := store.Get("0"); got != 1 {
		t.Errorf("expected the recently used entry to remain, got %d", got)
	}
}

func TestInMemoryStoreConcurrentAccess(t *testing.T) {
	t.Parallel()

	const (
		capacity   = 8
		goroutines = 12
		iterations = 1_000
		keyCount   = capacity * 2
	)

	store := newInMemoryStore(capacity)
	ctx := t.Context()
	start := make(chan struct{})

	var waitGroup sync.WaitGroup
	waitGroup.Add(goroutines)

	for worker := range goroutines {
		go func() {
			defer waitGroup.Done()

			<-start

			for iteration := range iterations {
				key := strconv.Itoa((worker + iteration) % keyCount)
				store.Increment(ctx, key, time.Minute)
				store.Get(key)
			}
		}()
	}

	close(start)
	waitGroup.Wait()
	assertInMemoryStoreInvariant(t, store)
}

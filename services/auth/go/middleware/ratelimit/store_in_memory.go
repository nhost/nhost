package ratelimit

import (
	"context"
	"sync"
	"time"
)

// defaultInMemoryStoreMaxEntries allows about 14 new client/window keys per
// second over the two-hour expiry used by the largest default limiter window.
// This keeps the degraded-mode fallback useful for normal traffic while
// bounding its process-local memory to tens of megabytes during an outage.
const defaultInMemoryStoreMaxEntries = 100_000

type InMemoryStoreValue struct {
	v    int
	time time.Time
}

type inMemoryStoreEntry struct {
	key   string
	value InMemoryStoreValue
	newer *inMemoryStoreEntry
	older *inMemoryStoreEntry
}

// InMemoryStore counts requests in a process-local LRU, bounding the memory a
// memcache outage can cost a single replica.
//
// The list is ordered from oldest to newest: newer points toward newest,
// newest.newer is nil, and oldest.older is nil. The list and data map contain
// exactly the same entries.
type InMemoryStore struct {
	data       map[string]*inMemoryStoreEntry
	mx         sync.Mutex
	maxEntries int
	newest     *inMemoryStoreEntry
	oldest     *inMemoryStoreEntry
}

func NewInMemoryStore() *InMemoryStore {
	return newInMemoryStore(defaultInMemoryStoreMaxEntries)
}

func newInMemoryStore(maxEntries int) *InMemoryStore {
	if maxEntries <= 0 {
		panic("in-memory rate-limit store capacity must be positive")
	}

	return &InMemoryStore{
		data:       make(map[string]*inMemoryStoreEntry),
		mx:         sync.Mutex{},
		maxEntries: maxEntries,
		newest:     nil,
		oldest:     nil,
	}
}

func (i *InMemoryStore) remove(entry *inMemoryStoreEntry) {
	if entry.newer != nil {
		entry.newer.older = entry.older
	} else {
		i.newest = entry.older
	}

	if entry.older != nil {
		entry.older.newer = entry.newer
	} else {
		i.oldest = entry.newer
	}

	delete(i.data, entry.key)
}

func (i *InMemoryStore) markNewest(entry *inMemoryStoreEntry) {
	if entry == i.newest {
		return
	}

	if entry.newer != nil {
		entry.newer.older = entry.older
	}

	if entry.older != nil {
		entry.older.newer = entry.newer
	} else if i.oldest == entry {
		i.oldest = entry.newer
	}

	entry.newer = nil

	entry.older = i.newest
	if i.newest != nil {
		i.newest.newer = entry
	} else {
		i.oldest = entry
	}

	i.newest = entry
}

func (i *InMemoryStore) get(key string, now time.Time) int {
	entry, ok := i.data[key]
	if !ok {
		return 0
	}

	if now.After(entry.value.time) {
		i.remove(entry)

		return 0
	}

	i.markNewest(entry)

	return entry.value.v
}

func (i *InMemoryStore) Get(key string) int {
	i.mx.Lock()
	defer i.mx.Unlock()

	return i.get(key, time.Now())
}

func (i *InMemoryStore) Increment(_ context.Context, key string, expire time.Duration) int {
	i.mx.Lock()
	defer i.mx.Unlock()

	now := time.Now()
	// Increment depends on get both for expiry reclamation and for refreshing
	// the recency of an existing entry.
	value := i.get(key, now) + 1

	if entry, ok := i.data[key]; ok {
		entry.value = InMemoryStoreValue{
			v:    value,
			time: now.Add(expire),
		}

		return value
	}

	// At capacity, admit the new key and evict the least recently used one.
	// This bounds memory and avoids an O(n) expiry sweep under the mutex. An
	// attacker who can rotate more than maxEntries client IPs can evict an
	// active counter and reset it, weakening rate limiting under saturation.
	// Returning zero for untracked keys would bypass their limits entirely,
	// while treating every new key as limited would deny legitimate traffic.
	// This store backs all six limiters, each of which may retain two windows,
	// so one active client IP can use roughly 12 entries: 100,000 entries is
	// therefore closer to 8,000 maximally active clients than 100,000 clients.
	if len(i.data) >= i.maxEntries {
		i.remove(i.oldest)
	}

	entry := &inMemoryStoreEntry{
		key: key,
		value: InMemoryStoreValue{
			v:    value,
			time: now.Add(expire),
		},
		newer: nil,
		older: nil,
	}
	i.data[key] = entry
	i.markNewest(entry)

	return value
}

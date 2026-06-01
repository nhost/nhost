// Package lru provides a typed, concurrency-safe LRU cache with a fixed
// maximum size. The implementation pairs a map for O(1) lookup with a
// doubly-linked list ordered by recency; eviction removes from the back.
// Used by the controller for its per-state parsed-query cache.
package lru

import (
	"container/list"
	"fmt"
	"sync"
)

// Cache is a concurrency-safe LRU cache with a fixed maximum size.
// When the cache is full, the least recently used entry is evicted.
type Cache[K comparable, V any] struct {
	mu      sync.Mutex
	maxSize int
	items   map[K]*list.Element
	order   *list.List // front = most recently used
}

// entry is the payload stored in each list element, pairing the key with its
// value so eviction from the back of the list can also delete the matching
// map entry in O(1).
type entry[K comparable, V any] struct {
	key   K
	value V
}

// entryOf extracts the *entry[K, V] payload from a list element. The assertion
// is safe because c.order only ever stores *entry[K, V] values, pushed via
// PushFront in Put.
func entryOf[K comparable, V any](e *list.Element) *entry[K, V] {
	return e.Value.(*entry[K, V]) //nolint:forcetypeassert // see entryOf doc
}

// New creates a new LRU cache with the given maximum size. It panics if
// maxSize is not positive: maxSize == 0 would make every Put evict its own
// entry on the next insert, and maxSize < 0 would panic deep inside the
// runtime when allocating the backing map. Both are caller bugs that should
// surface loudly at construction time rather than degrade silently or fail
// with an unrelated stack trace.
func New[K comparable, V any](maxSize int) *Cache[K, V] {
	if maxSize < 1 {
		panic(fmt.Sprintf("lru.New: maxSize must be > 0, got %d", maxSize))
	}

	return &Cache[K, V]{
		mu:      sync.Mutex{},
		maxSize: maxSize,
		items:   make(map[K]*list.Element, maxSize),
		order:   list.New(),
	}
}

// Get retrieves a value from the cache. If found, the entry is promoted
// to the most recently used position.
func (c *Cache[K, V]) Get(key K) (V, bool) { //nolint:ireturn,nolintlint
	c.mu.Lock()
	defer c.mu.Unlock()

	elem, ok := c.items[key]
	if !ok {
		var zero V

		return zero, false
	}

	c.order.MoveToFront(elem)

	return entryOf[K, V](elem).value, true
}

// Put inserts or updates the entry for key.
func (c *Cache[K, V]) Put(key K, value V) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if elem, ok := c.items[key]; ok {
		c.order.MoveToFront(elem)
		entryOf[K, V](elem).value = value

		return
	}

	if c.order.Len() >= c.maxSize {
		c.evictOldest()
	}

	elem := c.order.PushFront(&entry[K, V]{key: key, value: value})
	c.items[key] = elem
}

func (c *Cache[K, V]) evictOldest() {
	oldest := c.order.Back()
	if oldest == nil {
		return
	}

	c.order.Remove(oldest)
	delete(c.items, entryOf[K, V](oldest).key)
}

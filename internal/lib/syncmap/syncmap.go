// Package syncmap provides a typed generic concurrent map guarded by a
// sync.RWMutex; unlike the stdlib sync.Map (amortised lock-free but untyped),
// this implementation is fully typed but always takes the mutex.
package syncmap

import "sync"

// Map is a typed generic concurrent map keyed by any comparable type and
// guarded by a sync.RWMutex.
type Map[K comparable, V any] struct {
	m  map[K]V
	mu sync.RWMutex
}

// New returns an empty Map ready for concurrent use.
func New[K comparable, V any]() *Map[K, V] {
	return &Map[K, V]{
		m:  make(map[K]V),
		mu: sync.RWMutex{},
	}
}

// Load returns the value stored under key and a boolean indicating whether the
// key was present. If the key is absent the zero value of V is returned.
func (s *Map[K, V]) Load(key K) (V, bool) { //nolint:ireturn,nolintlint
	s.mu.RLock()
	defer s.mu.RUnlock()

	v, ok := s.m[key]

	return v, ok
}

// Store sets the value for key, overwriting any previous value.
func (s *Map[K, V]) Store(key K, value V) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.m[key] = value
}

// Delete removes key from the map. It returns the previously-stored value and
// true if the key was present, or the zero value and false otherwise. The
// (V, bool) return is unusual for delete APIs and exists so callers can act on
// the freed value without a separate Load (see controller/websocket.go which
// closes the removed subscription).
func (s *Map[K, V]) Delete(key K) (V, bool) { //nolint:ireturn,nolintlint
	s.mu.Lock()
	defer s.mu.Unlock()

	v, ok := s.m[key]
	if ok {
		delete(s.m, key)
	}

	return v, ok
}

// Range calls f for each key/value pair in the map. Iteration stops when f
// returns false. The map is held under a read lock for the duration of the
// call, so f must not call Store, Delete, or Clear on the same Map.
func (s *Map[K, V]) Range(f func(K, V) bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for k, v := range s.m {
		if !f(k, v) {
			break
		}
	}
}

// Clear removes all entries from the map.
func (s *Map[K, V]) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.m = make(map[K]V)
}

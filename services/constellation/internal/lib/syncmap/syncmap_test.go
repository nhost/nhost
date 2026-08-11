package syncmap_test

import (
	"sync"
	"testing"

	"github.com/nhost/nhost/services/constellation/internal/lib/syncmap"
)

func TestNewReturnsEmptyMap(t *testing.T) {
	t.Parallel()

	m := syncmap.New[string, int]()
	if m == nil {
		t.Fatal("New returned nil")
	}

	count := 0

	m.Range(func(_ string, _ int) bool {
		count++

		return true
	})

	if count != 0 {
		t.Fatalf("expected empty map, found %d entries", count)
	}
}

func TestStoreAndLoad(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name  string
		key   string
		value int
	}{
		{name: "single entry", key: "a", value: 1},
		{name: "zero value stored", key: "b", value: 0},
		{name: "negative value", key: "c", value: -42},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			m := syncmap.New[string, int]()
			m.Store(tc.key, tc.value)

			v, ok := m.Load(tc.key)
			if !ok {
				t.Fatalf("expected key %q to be present", tc.key)
			}

			if v != tc.value {
				t.Fatalf("expected value %d, got %d", tc.value, v)
			}
		})
	}
}

func TestLoadAbsentReturnsZero(t *testing.T) {
	t.Parallel()

	m := syncmap.New[string, int]()

	v, ok := m.Load("missing")
	if ok {
		t.Fatal("expected ok=false for absent key")
	}

	if v != 0 {
		t.Fatalf("expected zero value, got %d", v)
	}
}

func TestStoreOverwrites(t *testing.T) {
	t.Parallel()

	m := syncmap.New[string, int]()
	m.Store("a", 1)
	m.Store("a", 99)

	v, ok := m.Load("a")
	if !ok || v != 99 {
		t.Fatalf("expected (99, true), got (%d, %v)", v, ok)
	}
}

func TestDeletePresent(t *testing.T) {
	t.Parallel()

	m := syncmap.New[string, int]()
	m.Store("a", 7)

	v, ok := m.Delete("a")
	if !ok {
		t.Fatal("expected ok=true on delete of present key")
	}

	if v != 7 {
		t.Fatalf("expected prior value 7, got %d", v)
	}

	if _, stillThere := m.Load("a"); stillThere {
		t.Fatal("expected key to be removed after Delete")
	}
}

func TestDeleteAbsent(t *testing.T) {
	t.Parallel()

	m := syncmap.New[string, int]()

	v, ok := m.Delete("missing")
	if ok {
		t.Fatal("expected ok=false for absent key")
	}

	if v != 0 {
		t.Fatalf("expected zero value, got %d", v)
	}
}

func TestRangeVisitsAllEntries(t *testing.T) {
	t.Parallel()

	m := syncmap.New[string, int]()

	want := map[string]int{"a": 1, "b": 2, "c": 3}
	for k, v := range want {
		m.Store(k, v)
	}

	got := map[string]int{}

	m.Range(func(k string, v int) bool {
		got[k] = v

		return true
	})

	if len(got) != len(want) {
		t.Fatalf("expected %d entries, got %d", len(want), len(got))
	}

	for k, v := range want {
		if got[k] != v {
			t.Fatalf("entry %q: expected %d, got %d", k, v, got[k])
		}
	}
}

func TestRangeEarlyExit(t *testing.T) {
	t.Parallel()

	m := syncmap.New[string, int]()
	m.Store("a", 1)
	m.Store("b", 2)
	m.Store("c", 3)

	visited := 0

	m.Range(func(_ string, _ int) bool {
		visited++

		return false // stop after first
	})

	if visited != 1 {
		t.Fatalf("expected Range to stop after 1 visit, got %d", visited)
	}
}

func TestClear(t *testing.T) {
	t.Parallel()

	m := syncmap.New[string, int]()
	m.Store("a", 1)
	m.Store("b", 2)

	m.Clear()

	if _, ok := m.Load("a"); ok {
		t.Fatal("expected 'a' to be cleared")
	}

	if _, ok := m.Load("b"); ok {
		t.Fatal("expected 'b' to be cleared")
	}

	count := 0

	m.Range(func(_ string, _ int) bool {
		count++

		return true
	})

	if count != 0 {
		t.Fatalf("expected empty map after Clear, got %d entries", count)
	}
}

// TestConcurrentAccess is a torture test designed to be run with -race. It
// makes no assertions about outcome; it exists to surface data races in the
// underlying locking when many goroutines interleave Store/Load/Delete on
// overlapping keys.
func TestConcurrentAccess(t *testing.T) {
	t.Parallel()

	const (
		goroutines = 16
		iterations = 1000
		keySpace   = 8
	)

	m := syncmap.New[int, int]()

	var wg sync.WaitGroup

	for g := range goroutines {
		wg.Add(1)

		go func(seed int) {
			defer wg.Done()

			for i := range iterations {
				key := (seed + i) % keySpace

				switch i % 4 {
				case 0:
					m.Store(key, i)
				case 1:
					_, _ = m.Load(key)
				case 2:
					_, _ = m.Delete(key)
				case 3:
					m.Range(func(_, _ int) bool {
						return true
					})
				}
			}
		}(g)
	}

	wg.Wait()
}

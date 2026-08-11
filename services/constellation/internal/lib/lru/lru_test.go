package lru_test

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/internal/lib/lru"
)

type opKind int

const (
	opPut opKind = iota
	opGet
)

type op struct {
	kind  opKind
	key   string
	value int
}

type lruCase struct {
	name        string
	maxSize     int
	ops         []op
	wantPresent map[string]int
	wantAbsent  []string
}

func applyOp(c *lru.Cache[string, int], o op) {
	switch o.kind {
	case opPut:
		c.Put(o.key, o.value)
	case opGet:
		c.Get(o.key)
	}
}

func runLRUCase(t *testing.T, tt lruCase) {
	t.Helper()

	c := lru.New[string, int](tt.maxSize)
	for _, o := range tt.ops {
		applyOp(c, o)
	}

	for key, want := range tt.wantPresent {
		got, ok := c.Get(key)
		if !ok || got != want {
			t.Fatalf("Get(%q) = (%d, %v), want (%d, true)", key, got, ok, want)
		}
	}

	for _, key := range tt.wantAbsent {
		if _, ok := c.Get(key); ok {
			t.Fatalf("Get(%q) = present, want absent", key)
		}
	}
}

func TestLRU(t *testing.T) {
	t.Parallel()

	tests := []lruCase{
		{
			name:        "get miss on empty cache",
			maxSize:     4,
			ops:         nil,
			wantPresent: nil,
			wantAbsent:  []string{"missing"},
		},
		{
			name:    "put and get",
			maxSize: 4,
			ops: []op{
				{kind: opPut, key: "a", value: 1},
			},
			wantPresent: map[string]int{"a": 1},
			wantAbsent:  nil,
		},
		{
			name:    "eviction removes oldest",
			maxSize: 2,
			ops: []op{
				{kind: opPut, key: "a", value: 1},
				{kind: opPut, key: "b", value: 2},
				{kind: opPut, key: "c", value: 3},
			},
			wantPresent: map[string]int{"b": 2, "c": 3},
			wantAbsent:  []string{"a"},
		},
		{
			name:    "access promotes entry",
			maxSize: 2,
			ops: []op{
				{kind: opPut, key: "a", value: 1},
				{kind: opPut, key: "b", value: 2},
				{kind: opGet, key: "a"},
				{kind: opPut, key: "c", value: 3},
			},
			wantPresent: map[string]int{"a": 1, "c": 3},
			wantAbsent:  []string{"b"},
		},
		{
			name:    "put updates existing entry",
			maxSize: 2,
			ops: []op{
				{kind: opPut, key: "a", value: 1},
				{kind: opPut, key: "a", value: 42},
			},
			wantPresent: map[string]int{"a": 42},
			wantAbsent:  []string{"b"},
		},
		{
			name:    "size observable via gets",
			maxSize: 4,
			ops: []op{
				{kind: opPut, key: "a", value: 1},
				{kind: opPut, key: "b", value: 2},
			},
			wantPresent: map[string]int{"a": 1, "b": 2},
			wantAbsent:  []string{"c"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			runLRUCase(t, tt)
		})
	}
}

func TestNewPanicsOnNonPositiveMaxSize(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		maxSize int
	}{
		{name: "zero", maxSize: 0},
		{name: "negative", maxSize: -1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			defer func() {
				if r := recover(); r == nil {
					t.Fatalf("lru.New(%d) did not panic", tt.maxSize)
				}
			}()

			_ = lru.New[string, int](tt.maxSize)
		})
	}
}

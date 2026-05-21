package lru

import (
	"testing"
)

type internalOpKind int

const (
	internalOpPut internalOpKind = iota
	internalOpGet
	internalOpEvictOldest
)

type internalOp struct {
	kind  internalOpKind
	key   string
	value int
}

type internalCase struct {
	name         string
	maxSize      int
	ops          []internalOp
	wantOrderLen int
	wantItemsLen int
	wantBackKey  string // empty means "expect no back element"
	wantAbsent   []string
}

func applyInternalOp(c *Cache[string, int], o internalOp) {
	switch o.kind {
	case internalOpPut:
		c.Put(o.key, o.value)
	case internalOpGet:
		c.Get(o.key)
	case internalOpEvictOldest:
		c.evictOldest()
	}
}

func assertBackKey(t *testing.T, back *backElement, wantKey string) {
	t.Helper()

	if wantKey == "" {
		if back != nil {
			t.Fatalf("order.Back() = %v, want nil", back.value)
		}

		return
	}

	if back == nil {
		t.Fatalf("order.Back() = nil, want entry with key %q", wantKey)
	}

	if back.key != wantKey {
		t.Fatalf("back key = %q, want %q", back.key, wantKey)
	}
}

type backElement struct {
	key   string
	value int
}

func backOf(c *Cache[string, int]) *backElement {
	back := c.order.Back()
	if back == nil {
		return nil
	}

	ent, ok := back.Value.(*entry[string, int])
	if !ok {
		return nil
	}

	return &backElement{key: ent.key, value: ent.value}
}

func runInternalCase(t *testing.T, tt internalCase) {
	t.Helper()

	c := New[string, int](tt.maxSize)
	for _, o := range tt.ops {
		applyInternalOp(c, o)
	}

	if got := c.order.Len(); got != tt.wantOrderLen {
		t.Fatalf("order.Len() = %d, want %d", got, tt.wantOrderLen)
	}

	if got := len(c.items); got != tt.wantItemsLen {
		t.Fatalf("len(items) = %d, want %d", got, tt.wantItemsLen)
	}

	assertBackKey(t, backOf(c), tt.wantBackKey)

	for _, key := range tt.wantAbsent {
		if _, ok := c.items[key]; ok {
			t.Fatalf("items[%q] = present, want absent", key)
		}
	}
}

func TestCacheInternalOrdering(t *testing.T) {
	t.Parallel()

	tests := []internalCase{
		{
			name:         "evict on empty cache is a no-op",
			maxSize:      2,
			ops:          []internalOp{{kind: internalOpEvictOldest}},
			wantOrderLen: 0,
			wantItemsLen: 0,
			wantBackKey:  "",
			wantAbsent:   nil,
		},
		{
			name:    "evict removes least recently used",
			maxSize: 3,
			ops: []internalOp{
				{kind: internalOpPut, key: "a", value: 1},
				{kind: internalOpPut, key: "b", value: 2},
				{kind: internalOpPut, key: "c", value: 3},
				{kind: internalOpEvictOldest},
			},
			wantOrderLen: 2,
			wantItemsLen: 2,
			wantBackKey:  "b",
			wantAbsent:   []string{"a"},
		},
		{
			name:    "get promotes so back tracks lru",
			maxSize: 4,
			ops: []internalOp{
				{kind: internalOpPut, key: "a", value: 1},
				{kind: internalOpPut, key: "b", value: 2},
				{kind: internalOpPut, key: "c", value: 3},
				{kind: internalOpPut, key: "d", value: 4},
				{kind: internalOpGet, key: "a"},
				{kind: internalOpGet, key: "c"},
				{kind: internalOpEvictOldest},
			},
			wantOrderLen: 3,
			wantItemsLen: 3,
			wantBackKey:  "d",
			wantAbsent:   []string{"b"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			runInternalCase(t, tt)
		})
	}
}

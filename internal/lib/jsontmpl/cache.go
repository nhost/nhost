package jsontmpl

import (
	"container/list"
	"os"
	"strconv"
	"sync"

	"github.com/nhost/nhost/internal/lib/jsontmpl/ast"
)

// defaultCacheSize matches the plan §7.7 target. Override at process
// start via KRITI_CACHE_SIZE.
const defaultCacheSize = 1024

// astCache caches lex+parse output by the template string. Concurrent
// renders share a single process-wide cache: admin-authored templates
// are stable and have low cardinality (typical: dozens, not thousands).
type astCache struct {
	mu       sync.Mutex
	capacity int
	order    *list.List
	entries  map[string]*list.Element
}

type cacheEntry struct {
	key string
	ast ast.Node
}

func newASTCache(cap int) *astCache {
	if cap <= 0 {
		cap = 1
	}
	return &astCache{
		capacity: cap,
		order:    list.New(),
		entries:  make(map[string]*list.Element, cap),
	}
}

func (c *astCache) get(key string) (ast.Node, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	el, ok := c.entries[key]
	if !ok {
		return nil, false
	}
	c.order.MoveToFront(el)
	entry, _ := el.Value.(*cacheEntry)
	return entry.ast, true
}

func (c *astCache) put(key string, n ast.Node) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if el, ok := c.entries[key]; ok {
		c.order.MoveToFront(el)
		entry, _ := el.Value.(*cacheEntry)
		entry.ast = n
		return
	}
	el := c.order.PushFront(&cacheEntry{key: key, ast: n})
	c.entries[key] = el
	if c.order.Len() > c.capacity {
		oldest := c.order.Back()
		if oldest != nil {
			c.order.Remove(oldest)
			entry, _ := oldest.Value.(*cacheEntry)
			delete(c.entries, entry.key)
		}
	}
}

// renderCache is the singleton process-wide AST cache. Lazily
// initialised at first Render call to honour KRITI_CACHE_SIZE.
var (
	renderCacheOnce sync.Once
	renderCacheImpl *astCache
)

func cache() *astCache {
	renderCacheOnce.Do(func() {
		cap := defaultCacheSize
		if v, ok := os.LookupEnv("KRITI_CACHE_SIZE"); ok {
			if parsed, err := strconv.Atoi(v); err == nil && parsed > 0 {
				cap = parsed
			}
		}
		renderCacheImpl = newASTCache(cap)
	})
	return renderCacheImpl
}

package controller

import (
	"github.com/nhost/nhost/services/constellation/internal/lib/lru"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/gqlerror"
	"golang.org/x/sync/singleflight"
)

const defaultQueryCacheSize = 512

type queryCacheKey struct {
	query string
	role  string
}

type queryCacheEntry struct {
	doc  *ast.QueryDocument
	errs gqlerror.List
}

// queryCache is an LRU cache for parsed and validated GraphQL queries.
// It is keyed by (query string, role) since different roles have different schemas.
// The cache is tied to controllerState so it is naturally invalidated on metadata reload.
// Concurrent misses for the same key share a single parse through inflight.
type queryCache struct {
	entries  *lru.Cache[queryCacheKey, queryCacheEntry]
	inflight singleflight.Group
}

func newQueryCache() *queryCache {
	return &queryCache{
		entries:  lru.New[queryCacheKey, queryCacheEntry](defaultQueryCacheSize),
		inflight: singleflight.Group{},
	}
}

// getOrLoad returns the cached entry for key, calling load on a miss.
func (c *queryCache) getOrLoad(key queryCacheKey, load func() queryCacheEntry) queryCacheEntry {
	if cached, ok := c.entries.Get(key); ok {
		return cached
	}

	v, _, _ := c.inflight.Do(key.role+"\x00"+key.query, func() (any, error) {
		// Another caller may have filled the cache since our miss.
		if cached, ok := c.entries.Get(key); ok {
			return cached, nil
		}

		entry := load()
		c.entries.Put(key, entry)

		return entry, nil
	})

	return v.(queryCacheEntry) //nolint:forcetypeassert // the Do callback above only returns queryCacheEntry
}

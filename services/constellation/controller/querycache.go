package controller

import (
	"fmt"
	"strconv"
	"sync"

	"github.com/nhost/nhost/services/constellation/internal/lib/lru"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/gqlerror"
	"github.com/vektah/gqlparser/v2/validator/rules"
	"golang.org/x/sync/singleflight"
)

const defaultQueryCacheSize = 512

// defaultRules returns the cached default validator rules. We resolve them
// once on first call instead of allocating a fresh set per request; using
// sync.OnceValue keeps the value behind a function rather than a mutable
// package variable.
//
//nolint:gochecknoglobals // sync.OnceValue is the idiomatic memoised-constant pattern.
var defaultRules = sync.OnceValue(rules.NewDefaultRules)

type queryCacheKey struct {
	query string
	role  string
}

type queryCacheEntry struct {
	doc  *ast.QueryDocument
	errs gqlerror.List
}

// queryCache caches parsed and validated GraphQL queries by exact query text
// and role. Both completed entries and in-flight loads belong to one
// controllerState, so metadata reloads cannot reuse old-schema validations.
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

// loadMiss coalesces misses without adding work to the warm-hit path.
func (c *queryCache) loadMiss(key queryCacheKey, load func() queryCacheEntry) queryCacheEntry {
	// Length-prefixing the role is unambiguous even if either string contains
	// separators or NUL bytes. Construct this key only after an LRU miss.
	flightKey := strconv.Itoa(len(key.role)) + ":" + key.role + key.query

	value, err, _ := c.inflight.Do(flightKey, func() (any, error) {
		// Another load may have completed after the caller's initial miss.
		if cached, ok := c.entries.Get(key); ok {
			return cached, nil
		}

		entry := load()
		c.entries.Put(key, entry)

		return entry, nil
	})
	if err != nil {
		// Validation errors live in the entry; the callback never returns an error.
		panic(fmt.Errorf("unexpected query cache load error: %w", err))
	}

	return value.(queryCacheEntry) //nolint:forcetypeassert // The callback only returns queryCacheEntry.
}

// loadQuery caches parsing and validation, including errors. Warm hits bypass
// singleflight; overlapping misses share a read-only document and errors.
// Operation selection, variable coercion, and execution remain request-local.
func loadQuery(
	cache *queryCache,
	schema *ast.Schema,
	queryStr string,
	role string,
) (*ast.QueryDocument, gqlerror.List) {
	key := queryCacheKey{query: queryStr, role: role}

	if cached, ok := cache.entries.Get(key); ok {
		return cached.doc, cached.errs
	}

	entry := cache.loadMiss(key, func() queryCacheEntry {
		doc, errs := gqlparser.LoadQueryWithRules(schema, queryStr, defaultRules())

		return queryCacheEntry{doc: doc, errs: errs}
	})

	return entry.doc, entry.errs
}

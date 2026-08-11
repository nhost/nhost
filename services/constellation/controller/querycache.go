package controller

import (
	"github.com/nhost/nhost/services/constellation/internal/lib/lru"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/gqlerror"
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
type queryCache = lru.Cache[queryCacheKey, queryCacheEntry]

func newQueryCache() *queryCache {
	return lru.New[queryCacheKey, queryCacheEntry](defaultQueryCacheSize)
}

package controller

import (
	"fmt"
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/gqlerror"
)

func queryCacheBenchmarkInput(b *testing.B) (*ast.Schema, string) {
	b.Helper()

	schema := queryCacheSchema(b, `
		type Query { users(limit: Int): [User!]! }
		type User { id: ID! name: String! }
	`)

	var query strings.Builder
	query.WriteString(`query Users($limit: Int) {`)

	for i := range 32 {
		fmt.Fprintf(&query, "u%d: users(limit: $limit) { id name }\n", i)
	}

	query.WriteByte('}')

	return schema, query.String()
}

func BenchmarkLoadQueryWarm(b *testing.B) {
	schema, query := queryCacheBenchmarkInput(b)

	cache := newQueryCache()
	if _, errs := loadQuery(cache, schema, query, "admin"); len(errs) != 0 {
		b.Fatalf("loadQuery: %v", errs)
	}

	b.ReportAllocs()
	b.ResetTimer()

	for b.Loop() {
		if _, errs := loadQuery(cache, schema, query, "admin"); len(errs) != 0 {
			b.Fatalf("loadQuery: %v", errs)
		}
	}
}

// benchmarkLoadQueryUncoalesced preserves the old miss path as a comparison
// for cold bursts. Both variants use the same LRU and parser/validator rules.
func benchmarkLoadQueryUncoalesced(
	cache *queryCache,
	schema *ast.Schema,
	query string,
	role string,
) (*ast.QueryDocument, gqlerror.List) {
	key := queryCacheKey{query: query, role: role}
	if cached, ok := cache.entries.Get(key); ok {
		return cached.doc, cached.errs
	}

	doc, errs := gqlparser.LoadQueryWithRules(schema, query, defaultRules())
	cache.entries.Put(key, queryCacheEntry{doc: doc, errs: errs})

	return doc, errs
}

func BenchmarkLoadQueryColdBurst(b *testing.B) {
	schema, query := queryCacheBenchmarkInput(b)

	cases := []struct {
		name string
		load func(*queryCache, *ast.Schema, string, string) (*ast.QueryDocument, gqlerror.List)
	}{
		{name: "uncoalesced", load: benchmarkLoadQueryUncoalesced},
		{name: "coalesced", load: loadQuery},
	}
	for _, bc := range cases {
		b.Run(bc.name, func(b *testing.B) {
			b.ReportAllocs()

			var parses int
			for b.Loop() {
				parses += queryCacheColdBurst(b, schema, []string{query}, 32, bc.load)
			}

			b.ReportMetric(float64(parses)/float64(b.N), "parses/burst")
		})
	}
}

func BenchmarkLoadQueryRealistic(b *testing.B) {
	schema, queries := queryCacheWorkload(b, 16)

	b.Run("warm_parallel", func(b *testing.B) {
		cache := newQueryCache()
		if _, errs := loadQuery(cache, schema, queries[0], "user"); len(errs) != 0 {
			b.Fatalf("warming cache: %v", errs)
		}

		b.ReportAllocs()
		b.ResetTimer()
		b.RunParallel(func(pb *testing.PB) {
			for pb.Next() {
				if _, errs := loadQuery(cache, schema, queries[0], "user"); len(errs) != 0 {
					b.Errorf("loadQuery: %v", errs)
				}
			}
		})
	})

	bursts := []struct {
		queries int
		workers int
	}{
		{queries: 1, workers: 1},
		{queries: 1, workers: 16},
		{queries: 1, workers: 64},
		{queries: 1, workers: 256},
		{queries: 16, workers: 512},
	}

	implementations := []struct {
		name string
		load func(*queryCache, *ast.Schema, string, string) (*ast.QueryDocument, gqlerror.List)
	}{
		{name: "uncoalesced", load: benchmarkLoadQueryUncoalesced},
		{name: "singleflight", load: loadQuery},
	}
	for _, burst := range bursts {
		name := fmt.Sprintf("cold_burst/queries=%d/callers=%d", burst.queries, burst.workers)
		b.Run(name, func(b *testing.B) {
			for _, implementation := range implementations {
				b.Run(implementation.name, func(b *testing.B) {
					b.ReportAllocs()

					var parses int
					for b.Loop() {
						parses += queryCacheColdBurst(
							b,
							schema,
							queries[:burst.queries],
							burst.workers,
							implementation.load,
						)
					}

					b.ReportMetric(float64(parses)/float64(b.N), "parses/burst")
				})
			}
		})
	}
}

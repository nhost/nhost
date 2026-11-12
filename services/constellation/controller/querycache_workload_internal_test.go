package controller

import (
	"fmt"
	"strings"
	"sync"
	"testing"

	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/gqlerror"
)

const (
	queryCacheWorkloadTables  = 60
	queryCacheWorkloadColumns = 20
	queryCacheWorkloadRoots   = 8
)

// queryCacheWorkload models generated table schemas, filters, ordering,
// fragments, and nested relationships rather than only flat scalar fields.
func queryCacheWorkload(tb testing.TB, count int) (*ast.Schema, []string) {
	tb.Helper()

	var sdl strings.Builder
	sdl.WriteString(`
		input String_comparison_exp { _eq: String _neq: String _in: [String!] _like: String }
		enum order_by { asc desc }
		schema { query: query_root }
		type query_root {
	`)

	for table := range queryCacheWorkloadTables {
		fmt.Fprintf(
			&sdl,
			"table%[1]d(where: table%[1]d_bool_exp, order_by: [table%[1]d_order_by!], limit: Int): [table%[1]d!]!\n",
			table,
		)
	}

	sdl.WriteString("}\n")

	for table := range queryCacheWorkloadTables {
		next := (table + 1) % queryCacheWorkloadTables
		fmt.Fprintf(&sdl, "type table%d {\n", table)

		for column := range queryCacheWorkloadColumns {
			fmt.Fprintf(&sdl, "col%d: String\n", column)
		}

		fmt.Fprintf(
			&sdl,
			"parent: table%[1]d children(where: table%[1]d_bool_exp, limit: Int): [table%[1]d!]!\n}\n",
			next,
		)
		fmt.Fprintf(
			&sdl,
			"input table%[1]d_bool_exp { _and: [table%[1]d_bool_exp!] _or: [table%[1]d_bool_exp!] _not: table%[1]d_bool_exp\n",
			table,
		)

		for column := range queryCacheWorkloadColumns {
			fmt.Fprintf(&sdl, "col%d: String_comparison_exp\n", column)
		}

		fmt.Fprintf(&sdl, "parent: table%d_bool_exp\n}\ninput table%d_order_by {\n", next, table)

		for column := range queryCacheWorkloadColumns {
			fmt.Fprintf(&sdl, "col%d: order_by\n", column)
		}

		sdl.WriteString("}\n")
	}

	schema := queryCacheSchema(tb, sdl.String())

	queries := make([]string, count)
	for variant := range queries {
		queries[variant] = queryCacheWorkloadQuery(variant)
		if _, errs := gqlparser.LoadQueryWithRules(
			schema,
			queries[variant],
			defaultRules(),
		); len(
			errs,
		) != 0 {
			tb.Fatalf("workload query %d: %v", variant, errs)
		}
	}

	return schema, queries
}

func queryCacheWorkloadQuery(variant int) string {
	var query strings.Builder
	fmt.Fprintf(&query, "query Q%d(", variant)

	for root := range queryCacheWorkloadRoots {
		fmt.Fprintf(&query, "$v%d: String, ", root)
	}

	query.WriteString("$limit: Int) {\n")

	for root := range queryCacheWorkloadRoots {
		fmt.Fprintf(&query, `r%[1]d: table%[1]d(
			where: {_or: [{col0: {_eq: $v%[1]d}}, {col1: {_like: $v%[1]d}, parent: {col2: {_neq: $v%[1]d}}}]}
			order_by: [{col0: asc}, {col3: desc}]
			limit: $limit
		) {
			...table%[1]dFields
			parent { ...table%[2]dFields }
			children(where: {col4: {_eq: $v%[1]d}}, limit: $limit) {
				...table%[2]dFields
				children(limit: $limit) { col0 col1 col2 parent { col0 col5 } }
			}
		}
`, root, root+1)
	}

	query.WriteString("}\n")

	for table := range queryCacheWorkloadRoots + 1 {
		fmt.Fprintf(&query, "fragment table%[1]dFields on table%[1]d {", table)

		for column := range queryCacheWorkloadColumns {
			fmt.Fprintf(&query, " col%d", column)
		}

		query.WriteString(" }\n")
	}

	return query.String()
}

// queryCacheColdBurst counts distinct returned documents, which correspond to
// separate parses. Invalid fixture queries fail the test instead of letting
// nil documents hide duplicate work.
func queryCacheColdBurst(
	tb testing.TB,
	schema *ast.Schema,
	queries []string,
	workers int,
	load func(*queryCache, *ast.Schema, string, string) (*ast.QueryDocument, gqlerror.List),
) int {
	tb.Helper()

	cache := newQueryCache()
	docs := make([]*ast.QueryDocument, workers)
	start := make(chan struct{})

	var wg sync.WaitGroup
	for i := range workers {
		wg.Go(func() {
			<-start

			doc, errs := load(cache, schema, queries[i%len(queries)], "user")
			if len(errs) != 0 {
				tb.Errorf("cold burst loadQuery: %v", errs)
			}

			docs[i] = doc
		})
	}

	close(start)
	wg.Wait()

	unique := make(map[*ast.QueryDocument]struct{}, len(queries))
	for _, doc := range docs {
		unique[doc] = struct{}{}
	}

	return len(unique)
}

func TestLoadQueryColdBurstParsesOncePerQuery(t *testing.T) {
	t.Parallel()

	schema, queries := queryCacheWorkload(t, 16)

	tests := []struct {
		name    string
		queries int
		workers int
	}{
		{name: "one query, 64 callers", queries: 1, workers: 64},
		{name: "16 queries, 512 callers", queries: 16, workers: 512},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			for range 3 {
				if got := queryCacheColdBurst(
					t,
					schema,
					queries[:tt.queries],
					tt.workers,
					loadQuery,
				); got != tt.queries {
					t.Fatalf("parsed %d times for %d distinct queries", got, tt.queries)
				}
			}
		})
	}
}

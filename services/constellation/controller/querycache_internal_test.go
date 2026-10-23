package controller

import (
	"fmt"
	"strings"
	"sync"
	"testing"

	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
)

const (
	loadTestTables     = 60
	loadTestColumns    = 20
	loadTestRootFields = 8
)

// loadTestSchema builds a Hasura-shaped schema large enough to make parsing
// realistically expensive.
func loadTestSchema(tb testing.TB) *ast.Schema {
	tb.Helper()

	var sb strings.Builder

	sb.WriteString(
		"input String_comparison_exp { _eq: String _neq: String _in: [String!] _like: String }\n",
	)
	sb.WriteString("enum order_by { asc desc }\n")
	sb.WriteString("schema { query: query_root }\n")
	sb.WriteString("type query_root {\n")

	for t := range loadTestTables {
		fmt.Fprintf(
			&sb,
			"  table%[1]d(where: table%[1]d_bool_exp, order_by: [table%[1]d_order_by!], limit: Int, offset: Int): [table%[1]d!]!\n",
			t,
		)
	}

	sb.WriteString("}\n")

	for t := range loadTestTables {
		next := (t + 1) % loadTestTables

		fmt.Fprintf(&sb, "type table%d {\n", t)

		for c := range loadTestColumns {
			fmt.Fprintf(&sb, "  col%d: String\n", c)
		}

		fmt.Fprintf(
			&sb,
			"  parent: table%[1]d\n  children(where: table%[1]d_bool_exp, limit: Int): [table%[1]d!]!\n}\n",
			next,
		)

		fmt.Fprintf(
			&sb,
			"input table%[1]d_bool_exp {\n  _and: [table%[1]d_bool_exp!]\n  _or: [table%[1]d_bool_exp!]\n  _not: table%[1]d_bool_exp\n",
			t,
		)

		for c := range loadTestColumns {
			fmt.Fprintf(&sb, "  col%d: String_comparison_exp\n", c)
		}

		fmt.Fprintf(&sb, "  parent: table%d_bool_exp\n}\n", next)
		fmt.Fprintf(&sb, "input table%d_order_by {\n", t)

		for c := range loadTestColumns {
			fmt.Fprintf(&sb, "  col%d: order_by\n", c)
		}

		sb.WriteString("}\n")
	}

	schema, err := gqlparser.LoadSchema(&ast.Source{Name: "load_test", Input: sb.String()})
	if err != nil {
		tb.Fatalf("LoadSchema: %v", err)
	}

	return schema
}

// loadTestQuery returns a nested query; each variant gets its own cache entry.
func loadTestQuery(variant int) string {
	var sb strings.Builder

	fmt.Fprintf(&sb, "query Q%d(", variant)

	for i := range loadTestRootFields {
		fmt.Fprintf(&sb, "$v%d: String, ", i)
	}

	sb.WriteString("$limit: Int) {\n")

	for i := range loadTestRootFields {
		next := i + 1
		fmt.Fprintf(&sb, `  r%[1]d: table%[1]d(
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
`, i, next)
	}

	sb.WriteString("}\n")

	for t := range loadTestRootFields + 1 {
		fmt.Fprintf(&sb, "fragment table%[1]dFields on table%[1]d {", t)

		for c := range loadTestColumns {
			fmt.Fprintf(&sb, " col%d", c)
		}

		sb.WriteString(" }\n")
	}

	return sb.String()
}

// loadTestQueries builds n queries and fails if any is invalid, since invalid
// queries return nil documents and would hide extra parses.
func loadTestQueries(tb testing.TB, schema *ast.Schema, n int) []string {
	tb.Helper()

	queries := make([]string, n)
	for i := range queries {
		queries[i] = loadTestQuery(i)

		_, errs := gqlparser.LoadQueryWithRules(schema, queries[i], defaultRules())
		if len(errs) > 0 {
			tb.Fatalf("load test query %d is invalid: %v", i, errs)
		}
	}

	return queries
}

// coldBurst sends concurrency simultaneous requests to an empty cache and
// returns the number of parses, counted as distinct documents returned.
func coldBurst(schema *ast.Schema, queries []string, concurrency int) int {
	cache := newQueryCache()
	docs := make([]*ast.QueryDocument, concurrency)
	start := make(chan struct{})

	var wg sync.WaitGroup

	for i := range concurrency {
		wg.Go(func() {
			<-start

			docs[i], _ = loadQuery(cache, schema, queries[i%len(queries)], "user")
		})
	}

	close(start)
	wg.Wait()

	parsed := make(map[*ast.QueryDocument]struct{}, len(queries))
	for _, doc := range docs {
		parsed[doc] = struct{}{}
	}

	return len(parsed)
}

func TestLoadQuery_ColdBurstParsesOncePerQuery(t *testing.T) {
	t.Parallel()

	schema := loadTestSchema(t)

	cases := []struct {
		name        string
		queries     int
		concurrency int
	}{
		{name: "one query, 64 callers", queries: 1, concurrency: 64},
		{name: "16 queries, 512 callers", queries: 16, concurrency: 512},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			queries := loadTestQueries(t, schema, tc.queries)

			for range 5 {
				if got := coldBurst(schema, queries, tc.concurrency); got != tc.queries {
					t.Fatalf("parsed %d times for %d distinct queries", got, tc.queries)
				}
			}
		})
	}
}

func TestLoadQuery_ConcurrentCallersShareValidationErrors(t *testing.T) {
	t.Parallel()

	schema := loadTestSchema(t)
	cache := newQueryCache()
	query := `query { table0 { doesNotExist } }`

	var wg sync.WaitGroup

	for range 32 {
		wg.Go(func() {
			doc, errs := loadQuery(cache, schema, query, "user")
			if doc != nil || len(errs) == 0 {
				t.Errorf("expected validation errors, got doc=%v errs=%v", doc, errs)
			}
		})
	}

	wg.Wait()
}

func BenchmarkLoadQuery(b *testing.B) {
	schema := loadTestSchema(b)

	b.Run("warm", func(b *testing.B) {
		cache := newQueryCache()
		query := loadTestQueries(b, schema, 1)[0]

		if _, errs := loadQuery(cache, schema, query, "user"); len(errs) > 0 {
			b.Fatalf("warming cache: %v", errs)
		}

		b.ReportAllocs()
		b.RunParallel(func(pb *testing.PB) {
			for pb.Next() {
				_, _ = loadQuery(cache, schema, query, "user")
			}
		})
	})

	bursts := []struct {
		queries     int
		concurrency int
	}{
		{queries: 1, concurrency: 1},
		{queries: 1, concurrency: 16},
		{queries: 1, concurrency: 64},
		{queries: 1, concurrency: 256},
		{queries: 16, concurrency: 512},
	}

	for _, burst := range bursts {
		queries := loadTestQueries(b, schema, burst.queries)

		name := fmt.Sprintf("cold_burst/queries=%d/callers=%d", burst.queries, burst.concurrency)
		b.Run(name, func(b *testing.B) {
			b.ReportAllocs()

			parses := 0
			for b.Loop() {
				parses += coldBurst(schema, queries, burst.concurrency)
			}

			b.ReportMetric(float64(parses)/float64(b.N), "parses/op")
		})
	}
}

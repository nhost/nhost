// Package queries translates GraphQL operations (queries, mutations, subscriptions)
// into parameterized SQL. It abstracts PostgreSQL vs SQLite syntax differences
// through the Dialect interface.
//
// The build pipeline is: BuildRoots (one-time setup from metadata/introspection) →
// Roots.BuildQuery (per-request, routes each GraphQL field to its Operation) →
// SQLOperation (parameterized SQL ready for execution).
//
// All user-provided values are passed through the placeholder helpers on the
// Dialect interface (returning $N for PostgreSQL or ? for SQLite). SQL is
// never built by string concatenation with user values.
//
// Subpackages:
//   - arguments: GraphQL argument parsing (where, order_by, limit, offset,
//     distinct_on, insert/update inputs).
//   - core: shared value types (Operation, SQLOperation, Column) referenced
//     across the build pipeline.
//   - dialect: PostgreSQL vs SQLite syntax abstraction.
//   - groupedaggregate: cross-database grouped-aggregate batching.
//   - multiplexed: SQL rewriting for multiplexed subscription polling.
//   - permissions: per-role row-level WHERE clauses, presets, and check
//     constraints.
//   - values: GraphQL→Go value resolution (variables, literals, defaults).
//   - where: WHERE clause parsing and rendering, including session-variable
//     substitution.
package queries

import (
	"strings"
	"sync"
)

// builderPool reuses strings.Builder instances across SQL generation calls
// to keep allocations down on hot paths. Each builder is pre-grown to 256
// bytes (a typical query size); callers must call putBuilder before reading
// or sharing the returned SQL string further.
var builderPool = sync.Pool{ //nolint:gochecknoglobals
	New: func() any {
		b := &strings.Builder{}
		b.Grow(256) //nolint:mnd

		return b
	},
}

func getBuilder() *strings.Builder {
	b, _ := builderPool.Get().(*strings.Builder)
	b.Reset()

	return b
}

func putBuilder(b *strings.Builder) {
	builderPool.Put(b)
}

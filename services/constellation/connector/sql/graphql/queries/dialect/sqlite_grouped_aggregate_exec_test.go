package dialect_test

import (
	"database/sql"
	"encoding/json"
	"slices"
	"strings"
	"testing"

	_ "github.com/mattn/go-sqlite3" // SQLite driver for the execution regression test

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
)

// groupedAggregateRow is one group object decoded from the grouped-aggregate
// statement's single JSON-array result: { "_join_key", "aggregate", "nodes" }.
type groupedAggregateRow struct {
	JoinKey   int64 `json:"_join_key"`
	Aggregate struct {
		Count int64 `json:"count"`
	} `json:"aggregate"`
	Nodes []struct {
		Score int64 `json:"score"`
	} `json:"nodes"`
}

// writeGroupedAggregateExecStmt assembles the SQLite grouped-aggregate statement
// shape that connector/sql/graphql/queries/root_query_grouped_aggregate.go emits
// when a per-group limit/offset is active, using the same public dialect methods
// the production builder calls (WriteGroupKeysFrom, MaterializedCTE,
// JSONBuildObject, JSONAggQuotedAlias, JSONAggRawExpr, EmptyJSONArray, the
// WriteJSONRow* helpers, Placeholder). The statement counts/aggregates a
// "comments"(post_id, score) table grouped by parent join key:
//
//   - WITH "_root.base" LEFT JOINs the join keys (WriteGroupKeysFrom) onto
//     "comments", preserving keys with no matching rows (COMMENT_1 syntax).
//   - "_root.windowed" numbers each base row per group with row_number().
//   - the outer SELECT LEFT JOINs the windowed rows back onto
//     (SELECT DISTINCT "__cs_join_key" FROM "_root.windowed") so every requested
//     key survives even when its window is empty (COMMENT_2 group preservation),
//     applying the per-group window predicate in the JOIN's ON clause.
//
// It returns the SQL and the ordered bind params: one per join key, then the
// window's offset lower bound, then (when limit is given) the offset+limit upper
// bound.
func writeGroupedAggregateExecStmt(
	d *dialect.SQLiteDialect,
	joinValues []any,
	offset int,
	limit int,
	hasLimit bool,
) (string, []any) {
	const (
		baseAlias     = "_root.base"
		windowedAlias = "_root.windowed"
		keysAlias     = "_root.keys"
		grpKeysAlias  = "__cs_grp_keys"
		joinKeyCol    = "__cs_join_key"
		grpKeyCol     = "_join_key"
		rowNumberCol  = "__cs_rn"
		joinCol       = "post_id"
		table         = "comments"
	)

	var b strings.Builder

	params := []any{}
	paramIndex := 1

	// Base CTE: LEFT JOIN the join-key derived table onto the target table.
	b.WriteString(`WITH "`)
	b.WriteString(baseAlias)
	b.WriteString(`" `)
	b.WriteString(d.MaterializedCTE())
	b.WriteString(` (SELECT `)
	b.WriteString(core.QuoteIdentifier(table))
	b.WriteString(`.*, "`)
	b.WriteString(grpKeysAlias)
	b.WriteString(`"."`)
	b.WriteString(grpKeyCol)
	b.WriteString(`" AS "`)
	b.WriteString(joinKeyCol)
	b.WriteString(`" FROM `)

	params, paramIndex = d.WriteGroupKeysFrom(
		&b, grpKeysAlias, grpKeyCol, "INTEGER", joinValues, params, paramIndex,
	)

	b.WriteString(` LEFT JOIN `)
	b.WriteString(core.QuoteIdentifier(table))
	b.WriteString(` ON `)
	core.WriteQualifiedColumn(&b, core.QuoteIdentifier(table), joinCol)
	b.WriteString(` = "`)
	b.WriteString(grpKeysAlias)
	b.WriteString(`"."`)
	b.WriteString(grpKeyCol)
	b.WriteString(`") `)

	// Windowed CTE: number each base row within its group. Never drops rows.
	b.WriteString(`, "`)
	b.WriteString(windowedAlias)
	b.WriteString(`" `)
	b.WriteString(d.MaterializedCTE())
	b.WriteString(` (SELECT "`)
	b.WriteString(baseAlias)
	b.WriteString(`".*, row_number() OVER (PARTITION BY `)
	core.WriteQuotedIdentifier(&b, joinKeyCol)
	b.WriteString(" ORDER BY ")
	core.WriteQualifiedColumn(&b, `"`+baseAlias+`"`, joinKeyCol)
	b.WriteString(`) AS "`)
	b.WriteString(rowNumberCol)
	b.WriteString(`" FROM "`)
	b.WriteString(baseAlias)
	b.WriteString(`") `)

	// Outer SELECT: one JSON object per group { _join_key, aggregate, nodes }.
	keysRef := `"` + keysAlias + `"`

	b.WriteString(`SELECT coalesce(`)
	b.WriteString(d.JSONAggQuotedAlias("per_group"))
	b.WriteString(", ")
	b.WriteString(d.EmptyJSONArray())
	b.WriteString(`) AS "result" FROM (SELECT `)
	b.WriteString(d.JSONBuildObject())
	b.WriteByte('(')
	b.WriteByte('\'')
	b.WriteString(grpKeyCol)
	b.WriteString(`', `)
	core.WriteQualifiedColumn(&b, keysRef, joinKeyCol)

	// aggregate: { count } -> COUNT(<join_col>) so empty groups count 0.
	b.WriteString(`, 'aggregate', `)
	b.WriteString(d.JSONBuildObject())
	b.WriteString(`('count', COUNT(`)
	core.WriteQualifiedColumn(&b, `"`+windowedAlias+`"`, joinCol)
	b.WriteString(`))`)

	// nodes: json_group_array of a row object, FILTERed so empty groups -> [].
	b.WriteString(`, 'nodes', coalesce(`)

	var rowB strings.Builder

	d.WriteJSONRowPrefix(&rowB)
	rowB.WriteString(`'score', `)
	core.WriteQualifiedColumn(&rowB, `"`+windowedAlias+`"`, "score")
	d.WriteJSONRowSuffixNoAlias(&rowB)

	b.WriteString(d.JSONAggRawExpr(rowB.String()))
	b.WriteString(` FILTER (WHERE `)
	core.WriteQualifiedColumn(&b, `"`+windowedAlias+`"`, joinCol)
	b.WriteString(" IS NOT NULL), ")
	b.WriteString(d.EmptyJSONArray())
	b.WriteByte(')')

	b.WriteString(`) AS "per_group" FROM `)

	// Windowed FROM: keep every requested join key (LEFT JOIN onto DISTINCT keys)
	// even when the window removes all of a group's rows.
	windowedRef := `"` + windowedAlias + `"`

	b.WriteString(`(SELECT DISTINCT `)
	core.WriteQuotedIdentifier(&b, joinKeyCol)
	b.WriteString(` FROM `)
	b.WriteString(windowedRef)
	b.WriteString(`) AS `)
	b.WriteString(keysRef)
	b.WriteString(` LEFT JOIN `)
	b.WriteString(windowedRef)
	b.WriteString(` ON `)
	core.WriteQualifiedColumn(&b, keysRef, joinKeyCol)
	b.WriteString(` = `)
	core.WriteQualifiedColumn(&b, windowedRef, joinKeyCol)
	b.WriteString(` AND `)
	core.WriteQualifiedColumn(&b, windowedRef, joinCol)
	b.WriteString(` IS NOT NULL AND `)
	core.WriteQuotedIdentifier(&b, rowNumberCol)
	b.WriteString(" > ")
	b.WriteString(d.Placeholder(paramIndex))

	params = append(params, offset)
	paramIndex++

	if hasLimit {
		b.WriteString(` AND `)
		core.WriteQuotedIdentifier(&b, rowNumberCol)
		b.WriteString(" <= ")
		b.WriteString(d.Placeholder(paramIndex))

		params = append(params, offset+limit)
	}

	b.WriteString(` GROUP BY `)
	core.WriteQualifiedColumn(&b, keysRef, joinKeyCol)
	b.WriteString(`) AS "_groups"`)

	return b.String(), params
}

// TestSQLiteDialect_GroupedAggregateWindowed_Executes is a regression guard for
// the SQLite grouped-aggregate query path. The string-golden tests only BUILD
// SQL; this test EXECUTES the per-group-limit/offset statement shape against a
// real in-memory SQLite engine so two production fixes stay verified on SQLite:
//
//   - COMMENT_1: the join-key derived table uses the SQLite UNION-ALL form
//     ("SELECT ? AS \"_join_key\" UNION ALL SELECT ? ...") instead of the
//     PostgreSQL "(VALUES ...) AS alias(col)" form, which SQLite rejects at
//     PREPARE time. Every case here prepares the full statement, so the old
//     VALUES form would fail PrepareContext before any row is read.
//   - COMMENT_2: the outer query LEFT JOINs the windowed rows onto
//     (SELECT DISTINCT "__cs_join_key" FROM "_root.windowed"), so a group whose
//     window is empty (limit: 0, or an offset past the group size) still emits a
//     row with count 0 / nodes []. The pre-fix outer WHERE on the row-number
//     bound removed those rows, dropping the whole group; the "all keys present"
//     assertion below would then see fewer than len(joinValues) groups and fail.
func TestSQLiteDialect_GroupedAggregateWindowed_Executes(t *testing.T) {
	t.Parallel()

	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}

	t.Cleanup(func() {
		if err := db.Close(); err != nil {
			t.Errorf("close sqlite: %v", err)
		}
	})

	// go-sqlite3 gives each pooled connection its own private :memory: database,
	// so pin the pool to one connection; otherwise the seed and the later query
	// can land on different (empty) databases.
	db.SetMaxOpenConns(1)

	if _, err := db.ExecContext(
		t.Context(),
		`CREATE TABLE "comments" ("post_id" INTEGER, "score" INTEGER)`,
	); err != nil {
		t.Fatalf("create table: %v", err)
	}

	// Seed: post 10 has three rows, post 20 has one row, post 30 has none.
	if _, err := db.ExecContext(
		t.Context(),
		`INSERT INTO "comments" ("post_id", "score") VALUES `+
			`(10, 1), (10, 2), (10, 3), (20, 7)`,
	); err != nil {
		t.Fatalf("seed: %v", err)
	}

	// Join keys batched by the resolver. 30 has no matching rows in the table,
	// so it only exists as a synthesized empty group from the base LEFT JOIN.
	joinValues := []any{int64(10), int64(20), int64(30)}

	tests := []struct {
		name     string
		offset   int
		limit    int
		hasLimit bool
		// want maps each join key to its expected group result. count and nodes
		// are bounded by the SAME per-group window (matching the Postgres path:
		// limit/offset bound both), so a key with an empty window is {0, nil}.
		// count is always asserted exactly and len(nodes) must equal count. The node
		// scores are checked exactly (scores) only when the window is fully
		// determined — it keeps the whole group or the group has <=1 matching row;
		// when the window keeps a strict subset of a multi-row group the scores are
		// instead asserted as a duplicate-free SUBSET (scoreSubset), because the
		// nil-order_by window orders only by the join key and leaves WHICH rows
		// survive unspecified. See assertGroup.
		want map[int64]wantGroup
	}{
		{
			// limit 0 keeps zero rows per group, so EVERY requested key — even the
			// ones with seeded rows — collapses to count 0 / nodes []. This is the
			// strongest COMMENT_2 guard: all three groups would be dropped by the
			// pre-fix row-removing outer WHERE, so "all keys present" would fail.
			// Derived from the Postgres semantics in
			// integration/query_cross_db_aggregate_test.go (limit bounds both count
			// and nodes) and testdata/.../limit_one_per_group_data.json.
			name:     "limit zero empties every window",
			offset:   0,
			limit:    0,
			hasLimit: true,
			want: map[int64]wantGroup{
				10: {count: 0, scores: nil},
				20: {count: 0, scores: nil},
				30: {count: 0, scores: nil},
			},
		},
		{
			// limit 2 keeps min(limit, group_size) rows per group: post 10 -> 2 of its
			// 3 rows, post 20 -> its only row (7), post 30 -> empty. Mixes a
			// clamped-by-limit group, a fully-kept group, and an always-empty group in
			// one statement. The window's row_number() orders only by the join key
			// (the nil-order_by production fallback shape), which is constant within a
			// group, so WHICH 2 of post 10's 3 rows survive is unspecified — count and
			// node cardinality are guaranteed (count == len(nodes) == 2), but the
			// scores are only asserted as a duplicate-free SUBSET of {1,2,3} via
			// scoreSubset. Post 20 keeps all its rows so its single score {7} is exact.
			name:     "limit two clamps and preserves",
			offset:   0,
			limit:    2,
			hasLimit: true,
			want: map[int64]wantGroup{
				10: {count: 2, scoreSubset: []int64{1, 2, 3}},
				20: {count: 1, scores: []int64{7}},
				30: {count: 0, scores: nil},
			},
		},
		{
			// offset 1 + limit 5 keeps min(limit, max(0, group_size-offset)) rows per
			// group. post 10 -> 2 of its 3 rows (3 rows, skip 1, cap 5); post 20's
			// single row is skipped so its window is EMPTY -> count 0 / nodes []; post
			// 30 stays empty. This proves the "offset past the group size" empty-window
			// survives for a key (20) that DOES have a matching row, a case distinct
			// from the never-matched key (30). As in the limit-2 case the row_number()
			// window orders only by the join key (the nil-order_by fallback), so WHICH
			// 2 of post 10's rows survive is unspecified — only the cardinality
			// (count == len(nodes) == 2) is guaranteed and the scores are asserted as a
			// duplicate-free SUBSET of {1,2,3} via scoreSubset, not as a fixed order.
			name:     "offset past group size empties a matched key",
			offset:   1,
			limit:    5,
			hasLimit: true,
			want: map[int64]wantGroup{
				10: {count: 2, scoreSubset: []int64{1, 2, 3}},
				20: {count: 0, scores: nil},
				30: {count: 0, scores: nil},
			},
		},
	}

	d := &dialect.SQLiteDialect{}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			query, params := writeGroupedAggregateExecStmt(
				d, joinValues, tt.offset, tt.limit, tt.hasLimit,
			)

			byKey := runGroupedAggregateStmt(t, db, query, params)

			// COMMENT_2 guard: every requested join key must be present, including
			// the empty-window groups. Pre-fix code dropped those rows.
			if len(byKey) != len(tt.want) {
				t.Fatalf(
					"group count = %d, want %d (every join key must survive)",
					len(byKey), len(tt.want),
				)
			}

			for key, want := range tt.want {
				assertGroup(t, byKey, key, want)
			}
		})
	}
}

// wantGroup is the expected per-key result of a grouped-aggregate case. count is
// always asserted exactly, and len(nodes) must equal count. Exactly one of scores
// or scoreSubset describes the node scores: scores is an exact, order-insensitive
// set match for windows whose contents are fully determined (the whole group is
// kept, or the group has <=1 matching row); scoreSubset is the group's full seeded
// score set for windows that keep a strict subset of a multi-row group, where the
// nil-order_by window leaves WHICH rows survive unspecified — the returned scores
// must then be a duplicate-free subset of scoreSubset of the right cardinality.
type wantGroup struct {
	count int64
	// scores, when non-nil, is matched exactly against the returned node scores
	// (order-insensitive). A nil scores with a nil scoreSubset means no nodes.
	scores []int64
	// scoreSubset, when non-nil, is the group's seeded score set; the returned
	// scores must be a duplicate-free subset of it (cardinality is pinned by count).
	scoreSubset []int64
}

// runGroupedAggregateStmt prepares and executes query against db, decodes the
// single JSON-array result, and returns the groups keyed by join key. It fails
// the test on a prepare error (the COMMENT_1 guard: the pre-fix PostgreSQL
// VALUES form errors here on SQLite) or a duplicate join key.
func runGroupedAggregateStmt(
	t *testing.T, db *sql.DB, query string, params []any,
) map[int64]groupedAggregateRow {
	t.Helper()

	stmt, err := db.PrepareContext(t.Context(), query)
	if err != nil {
		t.Fatalf(
			"prepare failed for SQLite grouped-aggregate SQL:\n%s\nerror: %v",
			query, err,
		)
	}

	t.Cleanup(func() {
		if err := stmt.Close(); err != nil {
			t.Errorf("close statement: %v", err)
		}
	})

	var raw string
	if err := stmt.QueryRowContext(t.Context(), params...).Scan(&raw); err != nil {
		t.Fatalf("query failed:\n%s\nerror: %v", query, err)
	}

	var groups []groupedAggregateRow
	if err := json.Unmarshal([]byte(raw), &groups); err != nil {
		t.Fatalf("decode result %q: %v", raw, err)
	}

	byKey := make(map[int64]groupedAggregateRow, len(groups))

	for _, g := range groups {
		if _, dup := byKey[g.JoinKey]; dup {
			t.Fatalf("duplicate join key %d in result: %q", g.JoinKey, raw)
		}

		byKey[g.JoinKey] = g
	}

	return byKey
}

// assertGroup checks that the group decoded for key matches want. count is
// asserted exactly and len(nodes) must equal count (the per-group window bounds
// both on this path, so this is deterministic). The node scores are then checked
// order-insensitively against whichever of want.scores / want.scoreSubset is set:
// an exact set match for fully determined windows, or a duplicate-free subset for
// windows that keep a strict subset of a multi-row group (where the nil-order_by
// window leaves WHICH rows survive unspecified).
func assertGroup(
	t *testing.T, byKey map[int64]groupedAggregateRow, key int64, want wantGroup,
) {
	t.Helper()

	got, ok := byKey[key]
	if !ok {
		t.Fatalf("join key %d missing from result", key)
	}

	if got.Aggregate.Count != want.count {
		t.Errorf("key %d count = %d, want %d", key, got.Aggregate.Count, want.count)
	}

	gotScores := make([]int64, len(got.Nodes))
	for i, n := range got.Nodes {
		gotScores[i] = n.Score
	}

	// count bounds nodes on this path, so len(nodes) must equal count regardless of
	// which rows the window kept.
	if int64(len(gotScores)) != want.count {
		t.Errorf("key %d node count = %d, want %d", key, len(gotScores), want.count)
	}

	switch {
	case want.scoreSubset != nil:
		assertScoreSubset(t, key, gotScores, want.scoreSubset)
	default:
		assertScoreSet(t, key, gotScores, want.scores)
	}
}

// assertScoreSet checks that got and want hold the same scores regardless of
// order, treating a nil and an empty slice as the empty set.
func assertScoreSet(t *testing.T, key int64, got, want []int64) {
	t.Helper()

	gotSorted := slices.Sorted(slices.Values(got))
	wantSorted := slices.Sorted(slices.Values(want))

	if !slices.Equal(gotSorted, wantSorted) {
		t.Errorf("key %d node scores = %v, want set %v", key, gotSorted, wantSorted)
	}
}

// assertScoreSubset checks that got is a duplicate-free subset of subset. The
// caller has already pinned len(got) via the count assertion, so this guards only
// that the kept rows are real group rows and none repeats — it deliberately does
// NOT assert WHICH rows, because the nil-order_by window does not specify that.
func assertScoreSubset(t *testing.T, key int64, got, subset []int64) {
	t.Helper()

	seen := make(map[int64]struct{}, len(got))

	for _, s := range got {
		if _, dup := seen[s]; dup {
			t.Errorf("key %d node scores = %v contain a duplicate (%d)", key, got, s)
		}

		seen[s] = struct{}{}

		if !slices.Contains(subset, s) {
			t.Errorf(
				"key %d node score %d not in seeded group %v", key, s, subset,
			)
		}
	}
}

package dialect_test

import (
	"database/sql"
	"strings"
	"testing"

	_ "github.com/mattn/go-sqlite3" // SQLite driver for the prepare regression test

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
)

func TestSQLiteDialect_Placeholder(t *testing.T) {
	t.Parallel()

	d := &dialect.SQLiteDialect{}
	if got := d.Placeholder(1); got != "?" {
		t.Fatalf("Placeholder(1) = %q, want ?", got)
	}

	if got := d.Placeholder(42); got != "?" {
		t.Fatalf("Placeholder(42) = %q, want ?", got)
	}
}

func TestSQLiteDialect_TypeCast(t *testing.T) {
	t.Parallel()

	d := &dialect.SQLiteDialect{}
	if got := d.TypeCast("?", "uuid"); got != "?" {
		t.Fatalf("TypeCast strips type, got %q", got)
	}
}

func TestSQLiteDialect_WriteArrayIn(t *testing.T) {
	t.Parallel()

	d := &dialect.SQLiteDialect{}

	var b strings.Builder

	params, next := d.WriteArrayIn(&b, `"u"`, "user_id", "TEXT", []any{"a", "b", "c"}, nil, 5)

	const want = `"u"."user_id" IN (?, ?, ?)`
	if got := b.String(); got != want {
		t.Fatalf("SQL = %q, want %q", got, want)
	}

	if next != 8 {
		t.Fatalf("next paramIndex = %d, want 8 (5 + 3 expanded binds)", next)
	}

	if len(params) != 3 {
		t.Fatalf("params len = %d, want 3 (one per value)", len(params))
	}
}

func TestSQLiteDialect_WriteArrayNotIn(t *testing.T) {
	t.Parallel()

	d := &dialect.SQLiteDialect{}

	var b strings.Builder

	params, next := d.WriteArrayNotIn(&b, `"t"`, "id", "INTEGER", []any{1, 2}, nil, 1)

	const want = `"t"."id" NOT IN (?, ?)`
	if got := b.String(); got != want {
		t.Fatalf("SQL = %q, want %q", got, want)
	}

	if next != 3 {
		t.Fatalf("next paramIndex = %d, want 3", next)
	}

	if len(params) != 2 {
		t.Fatalf("params len = %d, want 2", len(params))
	}
}

func TestSQLiteDialect_WriteArrayInEmpty(t *testing.T) {
	t.Parallel()

	d := &dialect.SQLiteDialect{}

	var b strings.Builder

	params, next := d.WriteArrayIn(&b, `"u"`, "user_id", "TEXT", nil, nil, 5)

	const want = `1 = 0`
	if got := b.String(); got != want {
		t.Fatalf("SQL = %q, want %q (must not emit invalid IN ())", got, want)
	}

	if next != 5 {
		t.Fatalf("next paramIndex = %d, want 5 (no params consumed)", next)
	}

	if len(params) != 0 {
		t.Fatalf("params len = %d, want 0", len(params))
	}
}

func TestSQLiteDialect_WriteArrayNotInEmpty(t *testing.T) {
	t.Parallel()

	d := &dialect.SQLiteDialect{}

	var b strings.Builder

	params, next := d.WriteArrayNotIn(&b, `"t"`, "id", "INTEGER", nil, nil, 1)

	const want = `1 = 1`
	if got := b.String(); got != want {
		t.Fatalf("SQL = %q, want %q (must not emit invalid NOT IN ())", got, want)
	}

	if next != 1 {
		t.Fatalf("next paramIndex = %d, want 1 (no params consumed)", next)
	}

	if len(params) != 0 {
		t.Fatalf("params len = %d, want 0", len(params))
	}
}

func TestSQLiteDialect_JSONHelpers(t *testing.T) {
	t.Parallel()

	d := &dialect.SQLiteDialect{}

	tests := []struct {
		name string
		got  string
		want string
	}{
		{
			"JSONAggQuotedAlias wraps with json()",
			d.JSONAggQuotedAlias("a"),
			`json_group_array(json("a"))`,
		},
		{
			"JSONAggRawExpr is raw",
			d.JSONAggRawExpr(`"t"."x"`),
			`json_group_array("t"."x")`,
		},
		{
			"CoalesceJSONArray",
			d.CoalesceJSONArray("a"),
			`coalesce(json_group_array(json("a")), '[]')`,
		},
		{"JSONBuildObject", d.JSONBuildObject(), "json_object"},
		{"ToJSON", d.ToJSON("x"), "json(x)"},
		{"EmptyJSONArray", d.EmptyJSONArray(), "'[]'"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if tt.got != tt.want {
				t.Fatalf("got %q, want %q", tt.got, tt.want)
			}
		})
	}
}

func TestSQLiteDialect_TableRef(t *testing.T) {
	t.Parallel()

	d := &dialect.SQLiteDialect{}
	// Schema is ignored on SQLite (single-database namespace).
	if got := d.TableRef("public", "users"); got != `"users"` {
		t.Fatalf("TableRef = %q, want \"users\"", got)
	}
}

func TestSQLiteDialect_LikeOps(t *testing.T) {
	t.Parallel()

	d := &dialect.SQLiteDialect{}
	// SQLite LIKE is already case-insensitive for ASCII.
	if d.ILike() != "LIKE" {
		t.Fatalf("ILike = %q, want LIKE", d.ILike())
	}

	if d.NotILike() != "NOT LIKE" {
		t.Fatalf("NotILike = %q, want NOT LIKE", d.NotILike())
	}
}

func TestSQLiteDialect_Capabilities(t *testing.T) {
	t.Parallel()

	d := &dialect.SQLiteDialect{}

	tests := map[string]bool{
		"SupportsLateral":            d.SupportsLateral(),
		"SupportsRegex":              d.SupportsRegex(),
		"SupportsDistinctOn":         d.SupportsDistinctOn(),
		"SupportsJSONB":              d.SupportsJSONB(),
		"SupportsFunctions":          d.SupportsFunctions(),
		"SupportsArrays":             d.SupportsArrays(),
		"SupportsVarianceAggregates": d.SupportsVarianceAggregates(),
		"SupportsUpsertUpdateAction": d.SupportsUpsertUpdateAction(),
	}

	for name, got := range tests {
		if got {
			t.Errorf("%s = true, want false (SQLite supports none)", name)
		}
	}
}

func TestSQLiteDialect_BoolFuncs(t *testing.T) {
	t.Parallel()

	d := &dialect.SQLiteDialect{}

	tests := []struct {
		name string
		got  string
		want string
	}{
		// SQLite has no bool_and/bool_or; over its 0/1 boolean storage min/max
		// reproduce their semantics.
		{"BoolAndFunc", d.BoolAndFunc(), "min"},
		{"BoolOrFunc", d.BoolOrFunc(), "max"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if tt.got != tt.want {
				t.Fatalf("got %q, want %q", tt.got, tt.want)
			}
		})
	}
}

func TestSQLiteDialect_ThrowError(t *testing.T) {
	t.Parallel()

	d := &dialect.SQLiteDialect{}

	tests := []struct {
		name    string
		message string
		code    string
		want    string
	}{
		{
			name:    "plain (code is ignored)",
			message: "oops",
			code:    "ignored",
			want:    `(SELECT RAISE(ABORT, 'oops'))`,
		},
		{
			name:    "escapes apostrophes in message",
			message: "it's bad",
			code:    "",
			want:    `(SELECT RAISE(ABORT, 'it''s bad'))`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := d.ThrowError(tt.message, tt.code); got != tt.want {
				t.Errorf("ThrowError = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestSQLiteDialect_MaterializedCTE(t *testing.T) {
	t.Parallel()

	d := &dialect.SQLiteDialect{}
	// SQLite does not support AS MATERIALIZED; CTEs are always inlined.
	if got := d.MaterializedCTE(); got != "AS" {
		t.Fatalf("MaterializedCTE = %q, want AS", got)
	}
}

func TestSQLiteDialect_ArrayOps_Panic(t *testing.T) {
	t.Parallel()

	d := &dialect.SQLiteDialect{}

	// SQLite has no array columns. Reaching these methods means a caller
	// skipped the SupportsArrays() gate; the dialect panics to make that
	// programming error loud rather than producing silently broken SQL.
	tests := []struct {
		name string
		call func()
	}{
		{
			name: "WriteArrayContains panics",
			call: func() {
				var b strings.Builder
				d.WriteArrayContains(&b, `"t"."tags"`, "?")
			},
		},
		{
			name: "WriteArrayContainedIn panics",
			call: func() {
				var b strings.Builder
				d.WriteArrayContainedIn(&b, `"t"."tags"`, "?")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			defer func() {
				if r := recover(); r == nil {
					t.Fatalf("%s: expected panic, got none", tt.name)
				}
			}()

			tt.call()
		})
	}
}

// TestSQLiteDialect_WriteUpsertUpdateAction_Panic pins the ungated contract:
// SQLite has no xmax equivalent, so SupportsUpsertUpdateAction reports false and
// any caller reaching WriteUpsertUpdateAction skipped that gate. The dialect
// panics to surface that programming error loudly instead of emitting SQL that
// cannot report which rows took the UPDATE branch.
func TestSQLiteDialect_WriteUpsertUpdateAction_Panic(t *testing.T) {
	t.Parallel()

	d := &dialect.SQLiteDialect{}

	if d.SupportsUpsertUpdateAction() {
		t.Fatal("SupportsUpsertUpdateAction = true, want false for SQLite")
	}

	defer func() {
		if r := recover(); r == nil {
			t.Fatal("WriteUpsertUpdateAction: expected panic, got none")
		}
	}()

	var b strings.Builder

	d.WriteUpsertUpdateAction(&b)
}

func TestSQLiteDialect_CountAndAggregateOrderBy(t *testing.T) {
	t.Parallel()

	d := &dialect.SQLiteDialect{}

	countTests := []struct {
		name        string
		distinct    bool
		expressions []string
		want        string
	}{
		{name: "star", distinct: true, expressions: nil, want: `COUNT(*)`},
		{
			name:        "single",
			distinct:    false,
			expressions: []string{`"t"."id"`},
			want:        `COUNT(("t"."id"))`,
		},
		{
			name:        "multi distinct",
			distinct:    true,
			expressions: []string{`"t"."role"`, `"t"."active"`},
			want:        `COUNT(DISTINCT json_array(quote("t"."role"), quote("t"."active")))`,
		},
	}

	for _, tt := range countTests {
		t.Run("count "+tt.name, func(t *testing.T) {
			t.Parallel()

			var b strings.Builder
			d.WriteCountAggregate(&b, tt.distinct, tt.expressions)

			if got := b.String(); got != tt.want {
				t.Fatalf("WriteCountAggregate = %q, want %q", got, tt.want)
			}
		})
	}

	// Only avg/sum/min/max reach the dialect; the stddev/variance family is
	// rejected upstream (SupportsStableVarianceOrderBy returns false) because the
	// one-pass identity that would emulate it is numerically unstable.
	aggregateTests := []struct {
		function string
		want     string
	}{
		{function: "avg", want: `AVG("t"."score")`},
		{function: "sum", want: `SUM("t"."score")`},
		{function: "min", want: `MIN("t"."score")`},
		{function: "max", want: `MAX("t"."score")`},
	}

	for _, tt := range aggregateTests {
		t.Run("aggregate "+tt.function, func(t *testing.T) {
			t.Parallel()

			var b strings.Builder
			d.WriteAggregateOrderByExpr(&b, tt.function, `"t"."score"`)

			if got := b.String(); got != tt.want {
				t.Fatalf("WriteAggregateOrderByExpr = %q, want %q", got, tt.want)
			}
		})
	}

	if d.SupportsStableVarianceOrderBy() {
		t.Fatal("SupportsStableVarianceOrderBy = true, want false for SQLite")
	}
}

func TestSQLiteDialect_JSONRow(t *testing.T) {
	t.Parallel()

	d := &dialect.SQLiteDialect{}

	var b strings.Builder

	d.WriteJSONRowPrefix(&b)
	d.WriteJSONRowColumn(&b, "id", `"t"."id"`)
	b.WriteString(", ")
	d.WriteJSONRowColumn(&b, "name", `"t"."name"`)
	d.WriteJSONRowSuffix(&b, "user")

	const want = `json_object('id', "t"."id", 'name', "t"."name") AS "user"`
	if got := b.String(); got != want {
		t.Fatalf("JSONRow with alias:\n got  %q\n want %q", got, want)
	}

	b.Reset()
	d.WriteJSONRowPrefix(&b)
	d.WriteJSONRowColumn(&b, "id", `"t"."id"`)
	d.WriteJSONRowSuffixNoAlias(&b)

	const wantNoAlias = `json_object('id', "t"."id")`
	if got := b.String(); got != wantNoAlias {
		t.Fatalf("JSONRow no alias:\n got  %q\n want %q", got, wantNoAlias)
	}
}

func TestSQLiteDialect_WriteGroupKeysFrom(t *testing.T) {
	t.Parallel()

	d := &dialect.SQLiteDialect{}

	var b strings.Builder

	params, next := d.WriteGroupKeysFrom(
		&b,
		"keys",
		"user_id",
		"TEXT",
		[]any{"a", "b", "c"},
		nil,
		5,
	)

	const want = `(SELECT ? AS "user_id" UNION ALL SELECT ? UNION ALL SELECT ?) AS "keys"`
	if got := b.String(); got != want {
		t.Fatalf("WriteGroupKeysFrom:\n got  %q\n want %q", got, want)
	}

	if next != 8 {
		t.Fatalf("next paramIndex = %d, want 8 (5 + 3 expanded binds)", next)
	}

	if len(params) != 3 {
		t.Fatalf("params len = %d, want 3 (one per value)", len(params))
	}
}

func TestSQLiteDialect_WriteGroupKeysFrom_Empty(t *testing.T) {
	t.Parallel()

	d := &dialect.SQLiteDialect{}

	var b strings.Builder

	params, next := d.WriteGroupKeysFrom(&b, "keys", "user_id", "TEXT", nil, nil, 5)

	const want = `(SELECT NULL AS "user_id" WHERE 0) AS "keys"`
	if got := b.String(); got != want {
		t.Fatalf("WriteGroupKeysFrom empty:\n got  %q\n want %q", got, want)
	}

	if next != 5 {
		t.Fatalf("next paramIndex = %d, want 5 (no binds for empty values)", next)
	}

	if len(params) != 0 {
		t.Fatalf("params len = %d, want 0 (no values)", len(params))
	}
}

// TestSQLiteDialect_WriteGroupKeysFrom_Prepares is a regression guard for the
// grouped-aggregate join-key derived table: SQLite rejects the PostgreSQL
// "(VALUES ...) AS alias(column)" form at prepare time, so the rendered SQL is
// embedded in a representative grouped-aggregate statement and prepared against
// a real SQLite connection. A prepare failure here means the cross-database
// aggregate path would error before execution on SQLite targets.
func TestSQLiteDialect_WriteGroupKeysFrom_Prepares(t *testing.T) {
	t.Parallel()

	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}

	t.Cleanup(func() { _ = db.Close() })

	// go-sqlite3 gives each pooled connection its own private :memory: database,
	// so pin the pool to a single connection; otherwise the CREATE TABLE and the
	// later prepare can land on different (empty) databases.
	db.SetMaxOpenConns(1)

	if _, err := db.ExecContext(
		t.Context(),
		`CREATE TABLE "comments" ("post_id" INTEGER, "score" INTEGER)`,
	); err != nil {
		t.Fatalf("create table: %v", err)
	}

	tests := []struct {
		name   string
		values []any
	}{
		{name: "multiple keys", values: []any{int64(10), int64(20), int64(30)}},
		{name: "single key", values: []any{int64(10)}},
		{name: "empty keys", values: nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			d := &dialect.SQLiteDialect{}

			var b strings.Builder

			b.WriteString(
				`SELECT "k"."_join_key" AS "__cs_join_key", COUNT(*) ` +
					`FROM `,
			)

			params, _ := d.WriteGroupKeysFrom(
				&b, "k", "_join_key", "INTEGER", tt.values, nil, 1,
			)

			b.WriteString(
				` LEFT JOIN "comments" ON "comments"."post_id" = "k"."_join_key" ` +
					`GROUP BY "__cs_join_key"`,
			)

			query := b.String()

			stmt, err := db.PrepareContext(t.Context(), query)
			if err != nil {
				t.Fatalf(
					"prepare failed for SQLite-generated grouped-aggregate SQL:\n%s\nerror: %v",
					query,
					err,
				)
			}

			t.Cleanup(func() { _ = stmt.Close() })

			rows, err := stmt.QueryContext(t.Context(), params...)
			if err != nil {
				t.Fatalf("query failed:\n%s\nerror: %v", query, err)
			}

			t.Cleanup(func() { _ = rows.Close() })

			if err := rows.Err(); err != nil {
				t.Fatalf("rows error: %v", err)
			}
		})
	}
}

// TestSQLiteDialect_WriteOnConflictTarget pins the column-list conflict target.
// SQLite has no "ON CONFLICT ON CONSTRAINT <name>" form, so it ignores the
// constraint name and lists the index columns. An empty column list is rejected
// instead of degrading to bare "ON CONFLICT" (any unique conflict).
func TestSQLiteDialect_WriteOnConflictTarget(t *testing.T) {
	t.Parallel()

	d := &dialect.SQLiteDialect{}

	tests := []struct {
		name    string
		columns []string
		want    string
		wantErr bool
	}{
		{name: "single column", columns: []string{"username"}, want: ` ON CONFLICT ("username")`},
		{
			name:    "composite columns",
			columns: []string{"tenant", "email"},
			want:    ` ON CONFLICT ("tenant", "email")`,
		},
		{name: "no columns errors", columns: nil, want: "", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var b strings.Builder

			err := d.WriteOnConflictTarget(&b, "ignored_constraint_name", tt.columns)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error")
				}

				if b.Len() != 0 {
					t.Fatalf("WriteOnConflictTarget wrote %q on error", b.String())
				}

				return
			}

			if err != nil {
				t.Fatalf("WriteOnConflictTarget: %v", err)
			}

			if got := b.String(); got != tt.want {
				t.Fatalf("WriteOnConflictTarget:\n got  %q\n want %q", got, tt.want)
			}
		})
	}
}

// TestSQLiteDialect_WriteOnConflictTarget_Prepares proves the rendered conflict
// target is valid SQLite by preparing a real INSERT ... ON CONFLICT (...) DO
// UPDATE against an in-memory database. This is the executable backstop for the
// conflict-target rendering; it deliberately uses a plain INSERT, not the
// data-modifying-CTE wrapper Constellation emits, because SQLite cannot parse
// "WITH ... AS (INSERT ...)" at all (a separate, broader limitation).
func TestSQLiteDialect_WriteOnConflictTarget_Prepares(t *testing.T) {
	t.Parallel()

	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}

	t.Cleanup(func() { _ = db.Close() })

	db.SetMaxOpenConns(1)

	if _, err := db.ExecContext(
		t.Context(),
		`CREATE TABLE "users" ("id" TEXT PRIMARY KEY, "username" TEXT);
		 CREATE UNIQUE INDEX "users_username_key" ON "users"("username");`,
	); err != nil {
		t.Fatalf("create table: %v", err)
	}

	d := &dialect.SQLiteDialect{}

	var b strings.Builder

	b.WriteString(`INSERT INTO "users" ("id", "username") VALUES (?, ?)`)

	if err := d.WriteOnConflictTarget(&b, "users_username_key", []string{"username"}); err != nil {
		t.Fatalf("WriteOnConflictTarget: %v", err)
	}

	b.WriteString(` DO UPDATE SET "id" = EXCLUDED."id"`)

	query := b.String()

	stmt, err := db.PrepareContext(t.Context(), query)
	if err != nil {
		t.Fatalf(
			"prepare failed for SQLite-generated upsert conflict target:\n%s\nerror: %v",
			query,
			err,
		)
	}

	t.Cleanup(func() { _ = stmt.Close() })
}

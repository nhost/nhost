package dialect_test

import (
	"strings"
	"testing"

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
		{"JSONBuildArray", d.JSONBuildArray(), "json_array"},
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
		"SupportsLateral":    d.SupportsLateral(),
		"SupportsRegex":      d.SupportsRegex(),
		"SupportsDistinctOn": d.SupportsDistinctOn(),
		"SupportsJSONB":      d.SupportsJSONB(),
		"SupportsFunctions":  d.SupportsFunctions(),
		"SupportsArrays":     d.SupportsArrays(),
	}

	for name, got := range tests {
		if got {
			t.Errorf("%s = true, want false (SQLite supports none)", name)
		}
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

	const want = `(VALUES (?), (?), (?)) AS "keys"("user_id")`
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

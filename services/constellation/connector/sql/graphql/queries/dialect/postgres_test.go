package dialect_test

import (
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
)

func TestPostgresDialect_Placeholder(t *testing.T) {
	t.Parallel()

	d := &dialect.PostgresDialect{}
	if got := d.Placeholder(1); got != "$1" {
		t.Fatalf("Placeholder(1) = %q, want $1", got)
	}

	if got := d.Placeholder(42); got != "$42" {
		t.Fatalf("Placeholder(42) = %q, want $42", got)
	}
}

func TestPostgresDialect_TypeCast(t *testing.T) {
	t.Parallel()

	d := &dialect.PostgresDialect{}
	if got := d.TypeCast("$1", "uuid"); got != "$1::uuid" {
		t.Fatalf("TypeCast(\"$1\", \"uuid\") = %q, want $1::uuid", got)
	}
}

func TestPostgresDialect_WriteArrayIn(t *testing.T) {
	t.Parallel()

	d := &dialect.PostgresDialect{}
	values := []any{"a", "b", "c"}

	var b strings.Builder

	params, next := d.WriteArrayIn(&b, `"u"`, "user_id", "uuid", values, nil, 3)

	const want = `"u"."user_id" = ANY($3::uuid[])`
	if got := b.String(); got != want {
		t.Fatalf("SQL = %q, want %q", got, want)
	}

	if next != 4 {
		t.Fatalf("next paramIndex = %d, want 4", next)
	}

	if len(params) != 1 {
		t.Fatalf("params len = %d, want 1 (single array bind)", len(params))
	}

	got, ok := params[0].([]any)
	if !ok {
		t.Fatalf("params[0] type = %T, want []any", params[0])
	}

	if len(got) != 3 {
		t.Fatalf("array param len = %d, want 3", len(got))
	}
}

func TestPostgresDialect_WriteArrayNotIn(t *testing.T) {
	t.Parallel()

	d := &dialect.PostgresDialect{}

	var b strings.Builder

	params, next := d.WriteArrayNotIn(&b, `"t"`, "id", "int", []any{1, 2}, nil, 1)

	const want = `"t"."id" != ALL($1::int[])`
	if got := b.String(); got != want {
		t.Fatalf("SQL = %q, want %q", got, want)
	}

	if next != 2 {
		t.Fatalf("next paramIndex = %d, want 2", next)
	}

	if len(params) != 1 {
		t.Fatalf("params len = %d, want 1", len(params))
	}
}

func TestPostgresDialect_WriteArrayInEmpty(t *testing.T) {
	t.Parallel()

	d := &dialect.PostgresDialect{}

	var b strings.Builder

	params, next := d.WriteArrayIn(&b, `"u"`, "user_id", "uuid", nil, nil, 3)

	const want = `"u"."user_id" = ANY($3::uuid[])`
	if got := b.String(); got != want {
		t.Fatalf("SQL = %q, want %q", got, want)
	}

	if next != 4 {
		t.Fatalf("next paramIndex = %d, want 4", next)
	}

	if len(params) != 1 {
		t.Fatalf("params len = %d, want 1 (empty array bind is well-defined)", len(params))
	}
}

func TestPostgresDialect_WriteArrayNotInEmpty(t *testing.T) {
	t.Parallel()

	d := &dialect.PostgresDialect{}

	var b strings.Builder

	params, next := d.WriteArrayNotIn(&b, `"t"`, "id", "int", nil, nil, 1)

	const want = `"t"."id" != ALL($1::int[])`
	if got := b.String(); got != want {
		t.Fatalf("SQL = %q, want %q", got, want)
	}

	if next != 2 {
		t.Fatalf("next paramIndex = %d, want 2", next)
	}

	if len(params) != 1 {
		t.Fatalf("params len = %d, want 1 (empty array bind is well-defined)", len(params))
	}
}

func TestPostgresDialect_SpatialExpressions(t *testing.T) {
	t.Parallel()

	d := &dialect.PostgresDialect{}

	if got := d.SpatialOutputExpression(
		`"t"."geom"`,
		"geometry",
	); got != `ST_AsGeoJSON("t"."geom", 15, 4)::jsonb` {
		t.Fatalf("SpatialOutputExpression geometry = %q", got)
	}

	if got := d.SpatialValueExpression("$1", "geometry"); got != "ST_GeomFromGeoJSON($1)" {
		t.Fatalf("SpatialValueExpression geometry = %q", got)
	}

	if got := d.SpatialValueExpression(
		"$2",
		"geography",
	); got != "ST_GeomFromGeoJSON($2)::geography" {
		t.Fatalf("SpatialValueExpression geography = %q", got)
	}

	if got := d.SpatialOutputExpression(`"t"."id"`, "uuid"); got != `"t"."id"` {
		t.Fatalf("SpatialOutputExpression non-spatial = %q", got)
	}

	if got := d.SpatialCastExpression("$1", "text", "geometry"); got != "($1)::geometry" {
		t.Fatalf("SpatialCastExpression geometry = %q", got)
	}

	if got := d.SpatialCastExpression("$2", "text", "geography"); got != "($2)::geography" {
		t.Fatalf("SpatialCastExpression geography = %q", got)
	}

	if got := d.SpatialCastExpression("$3", "text", "uuid"); got != "$3" {
		t.Fatalf("SpatialCastExpression non-spatial = %q", got)
	}
}

func TestPostgresDialect_WriteSpatialArrayIn(t *testing.T) {
	t.Parallel()

	d := &dialect.PostgresDialect{}

	var b strings.Builder

	params, next := d.WriteSpatialArrayIn(
		&b, `"t"`, "geom", "geometry", []any{"a", "b"}, nil, 2,
	)

	const want = `"t"."geom" = ANY(ARRAY[ST_GeomFromGeoJSON($2), ST_GeomFromGeoJSON($3)]::geometry[])`
	if got := b.String(); got != want {
		t.Fatalf("SQL = %q, want %q", got, want)
	}

	if next != 4 {
		t.Fatalf("next paramIndex = %d, want 4", next)
	}

	if len(params) != 2 {
		t.Fatalf("params len = %d, want 2", len(params))
	}
}

func TestPostgresDialect_WriteSpatialArrayEmpty(t *testing.T) {
	t.Parallel()

	d := &dialect.PostgresDialect{}

	var b strings.Builder

	params, next := d.WriteSpatialArrayIn(&b, `"t"`, "geom", "geometry", nil, nil, 2)
	if got := b.String(); got != "1 = 0" {
		t.Fatalf("empty _in SQL = %q, want 1 = 0", got)
	}

	if next != 2 || len(params) != 0 {
		t.Fatalf("empty _in next/params = %d/%d, want 2/0", next, len(params))
	}

	b.Reset()

	params, next = d.WriteSpatialArrayNotIn(&b, `"t"`, "geom", "geometry", nil, nil, 2)
	if got := b.String(); got != "1 = 1" {
		t.Fatalf("empty _nin SQL = %q, want 1 = 1", got)
	}

	if next != 2 || len(params) != 0 {
		t.Fatalf("empty _nin next/params = %d/%d, want 2/0", next, len(params))
	}
}

func TestPostgresDialect_JSONHelpers(t *testing.T) {
	t.Parallel()

	d := &dialect.PostgresDialect{}

	tests := []struct {
		name string
		got  string
		want string
	}{
		{"JSONAggQuotedAlias quotes alias", d.JSONAggQuotedAlias("a"), `json_agg("a")`},
		{"JSONAggRawExpr raw", d.JSONAggRawExpr(`"t"."x"`), `json_agg("t"."x")`},
		{"CoalesceJSONArray", d.CoalesceJSONArray("a"), `coalesce(json_agg("a"), '[]')`},
		{"JSONBuildObject", d.JSONBuildObject(), "json_build_object"},
		{"ToJSON", d.ToJSON("x"), "to_jsonb(x)"},
		{"EmptyJSONArray", d.EmptyJSONArray(), "'[]'::json"},
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

func TestPostgresDialect_TableRef(t *testing.T) {
	t.Parallel()

	d := &dialect.PostgresDialect{}
	if got := d.TableRef("public", "users"); got != `"public"."users"` {
		t.Fatalf("TableRef = %q, want \"public\".\"users\"", got)
	}
}

func TestPostgresDialect_LikeOps(t *testing.T) {
	t.Parallel()

	d := &dialect.PostgresDialect{}
	if d.Like() != "LIKE" {
		t.Fatalf("Like = %q, want LIKE", d.Like())
	}

	if d.NotLike() != "NOT LIKE" {
		t.Fatalf("NotLike = %q, want NOT LIKE", d.NotLike())
	}

	var b strings.Builder
	d.WriteILikeCondition(&b, `"t"`, "name", "$1")

	if got := b.String(); got != `"t"."name" ILIKE $1` {
		t.Fatalf("WriteILikeCondition = %q, want qualified ILIKE", got)
	}

	b.Reset()
	d.WriteNotILikeCondition(&b, `"t"`, "name", "$1")

	if got := b.String(); got != `"t"."name" NOT ILIKE $1` {
		t.Fatalf("WriteNotILikeCondition = %q, want qualified NOT ILIKE", got)
	}
}

func TestPostgresDialect_Capabilities(t *testing.T) {
	t.Parallel()

	d := &dialect.PostgresDialect{}

	tests := map[string]bool{
		"SupportsLateral":            d.SupportsLateral(),
		"SupportsRegex":              d.SupportsRegex(),
		"SupportsDistinctOn":         d.SupportsDistinctOn(),
		"SupportsJSONB":              d.SupportsJSONB(),
		"SupportsFunctions":          d.SupportsFunctions(),
		"SupportsArrays":             d.SupportsArrays(),
		"SupportsSpatialTypes":       d.SupportsSpatialTypes(),
		"SupportsVarianceAggregates": d.SupportsVarianceAggregates(),
		"SupportsUpsertUpdateAction": d.SupportsUpsertUpdateAction(),
	}

	for name, got := range tests {
		if !got {
			t.Errorf("%s = false, want true (Postgres supports all)", name)
		}
	}
}

func TestPostgresDialect_BoolFuncs(t *testing.T) {
	t.Parallel()

	d := &dialect.PostgresDialect{}

	tests := []struct {
		name string
		got  string
		want string
	}{
		{"BoolAndFunc", d.BoolAndFunc(), "bool_and"},
		{"BoolOrFunc", d.BoolOrFunc(), "bool_or"},
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

func TestPostgresDialect_ThrowError(t *testing.T) {
	t.Parallel()

	d := &dialect.PostgresDialect{}

	tests := []struct {
		name    string
		message string
		code    string
		want    string
	}{
		{
			name:    "plain",
			message: "oops",
			code:    "ERR_X",
			want:    `constellation_throw_error('oops', 'ERR_X')`,
		},
		{
			name:    "escapes apostrophes on both arguments",
			message: "it's bad",
			code:    "code's",
			want:    `constellation_throw_error('it''s bad', 'code''s')`,
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

func TestPostgresDialect_MaterializedCTE(t *testing.T) {
	t.Parallel()

	d := &dialect.PostgresDialect{}
	if got := d.MaterializedCTE(); got != "AS MATERIALIZED" {
		t.Fatalf("MaterializedCTE = %q, want AS MATERIALIZED", got)
	}
}

func TestPostgresDialect_ArrayOps(t *testing.T) {
	t.Parallel()

	d := &dialect.PostgresDialect{}

	var b strings.Builder

	d.WriteArrayContains(&b, `"t"."tags"`, "$1::text[]")

	if got := b.String(); got != `"t"."tags" @> $1::text[]` {
		t.Fatalf("WriteArrayContains = %q", got)
	}

	b.Reset()
	d.WriteArrayContainedIn(&b, `"t"."tags"`, "$1::text[]")

	if got := b.String(); got != `"t"."tags" <@ $1::text[]` {
		t.Fatalf("WriteArrayContainedIn = %q", got)
	}
}

func TestPostgresDialect_CountAndAggregateOrderBy(t *testing.T) {
	t.Parallel()

	d := &dialect.PostgresDialect{}

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
			want:        `COUNT(DISTINCT ("t"."role", "t"."active"))`,
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

	var b strings.Builder
	d.WriteAggregateOrderByExpr(&b, "stddev_pop", `"t"."score"`)

	if got := b.String(); got != `STDDEV_POP("t"."score")` {
		t.Fatalf("WriteAggregateOrderByExpr = %q", got)
	}

	if !d.SupportsStableVarianceOrderBy() {
		t.Fatal("SupportsStableVarianceOrderBy = false, want true for PostgreSQL")
	}
}

func TestPostgresDialect_JSONRow(t *testing.T) {
	t.Parallel()

	d := &dialect.PostgresDialect{}

	var b strings.Builder

	d.WriteJSONRowPrefix(&b)
	d.WriteJSONRowColumn(&b, "id", `"t"."id"`)
	b.WriteString(", ")
	d.WriteJSONRowColumn(&b, "name", `"t"."name"`)
	d.WriteJSONRowSuffix(&b, "user")

	const want = `row_to_json((SELECT "_e" FROM (SELECT "t"."id" AS "id", "t"."name" AS "name") AS "_e")) AS "user"`
	if got := b.String(); got != want {
		t.Fatalf("JSONRow with alias:\n got  %q\n want %q", got, want)
	}

	b.Reset()
	d.WriteJSONRowPrefix(&b)
	d.WriteJSONRowColumn(&b, "id", `"t"."id"`)
	d.WriteJSONRowSuffixNoAlias(&b)

	const wantNoAlias = `row_to_json((SELECT "_e" FROM (SELECT "t"."id" AS "id") AS "_e"))`
	if got := b.String(); got != wantNoAlias {
		t.Fatalf("JSONRow no alias:\n got  %q\n want %q", got, wantNoAlias)
	}
}

func TestPostgresDialect_WriteGroupKeysFrom(t *testing.T) {
	t.Parallel()

	d := &dialect.PostgresDialect{}

	var b strings.Builder

	params, next := d.WriteGroupKeysFrom(&b, "keys", "user_id", "uuid", []any{"a", "b"}, nil, 5)

	const want = `unnest($5::uuid[]) AS "keys"("user_id")`
	if got := b.String(); got != want {
		t.Fatalf("WriteGroupKeysFrom:\n got  %q\n want %q", got, want)
	}

	if next != 6 {
		t.Fatalf("next paramIndex = %d, want 6", next)
	}

	if len(params) != 1 {
		t.Fatalf("params len = %d, want 1 (single array bind)", len(params))
	}
}

// TestPostgresDialect_WriteOnConflictTarget pins the constraint-name conflict
// target: PostgreSQL names the constraint and ignores the supplied columns.
func TestPostgresDialect_WriteOnConflictTarget(t *testing.T) {
	t.Parallel()

	d := &dialect.PostgresDialect{}

	var b strings.Builder

	if err := d.WriteOnConflictTarget(&b, "users_pkey", []string{"id", "tenant"}); err != nil {
		t.Fatalf("WriteOnConflictTarget: %v", err)
	}

	const want = ` ON CONFLICT ON CONSTRAINT "users_pkey"`
	if got := b.String(); got != want {
		t.Fatalf("WriteOnConflictTarget:\n got  %q\n want %q", got, want)
	}
}

// TestPostgresDialect_WriteUpsertUpdateAction pins the RETURNING marker that
// reports whether each row took the ON CONFLICT DO UPDATE branch. PostgreSQL
// reads the xmax system column, which is non-zero for rows that were updated.
func TestPostgresDialect_WriteUpsertUpdateAction(t *testing.T) {
	t.Parallel()

	d := &dialect.PostgresDialect{}

	if !d.SupportsUpsertUpdateAction() {
		t.Fatal("SupportsUpsertUpdateAction = false, want true for PostgreSQL")
	}

	var b strings.Builder

	d.WriteUpsertUpdateAction(&b)

	const want = `(xmax <> 0)`
	if got := b.String(); got != want {
		t.Fatalf("WriteUpsertUpdateAction:\n got  %q\n want %q", got, want)
	}
}

// TestPostgresDialect_WriteSpatialPredicate pins the SpatialPredicate -> ST_*
// function mapping and the two-argument call shape. A wrong entry here (e.g.
// Touches resolving to ST_Within) would otherwise only surface in the
// database-backed golden suite; this test guards the mapping without a DB.
func TestPostgresDialect_WriteSpatialPredicate(t *testing.T) {
	t.Parallel()

	d := &dialect.PostgresDialect{}

	tests := []struct {
		predicate dialect.SpatialPredicate
		want      string
	}{
		{dialect.SpatialPredicateContains, `ST_Contains("t"."geom", ST_GeomFromGeoJSON($1))`},
		{dialect.SpatialPredicateCrosses, `ST_Crosses("t"."geom", ST_GeomFromGeoJSON($1))`},
		{dialect.SpatialPredicateEquals, `ST_Equals("t"."geom", ST_GeomFromGeoJSON($1))`},
		{dialect.SpatialPredicateIntersects, `ST_Intersects("t"."geom", ST_GeomFromGeoJSON($1))`},
		{dialect.SpatialPredicateOverlaps, `ST_Overlaps("t"."geom", ST_GeomFromGeoJSON($1))`},
		{dialect.SpatialPredicateTouches, `ST_Touches("t"."geom", ST_GeomFromGeoJSON($1))`},
		{dialect.SpatialPredicateWithin, `ST_Within("t"."geom", ST_GeomFromGeoJSON($1))`},
		{
			dialect.SpatialPredicate3DIntersects,
			`ST_3DIntersects("t"."geom", ST_GeomFromGeoJSON($1))`,
		},
	}

	for _, tt := range tests {
		t.Run(string(tt.predicate), func(t *testing.T) {
			t.Parallel()

			var b strings.Builder

			d.WriteSpatialPredicate(&b, tt.predicate, `"t"."geom"`, "ST_GeomFromGeoJSON($1)")

			if got := b.String(); got != tt.want {
				t.Fatalf(
					"WriteSpatialPredicate(%q):\n got  %q\n want %q",
					tt.predicate,
					got,
					tt.want,
				)
			}
		})
	}
}

// TestPostgresDialect_WriteSpatialPredicate_UnknownPanics asserts the mapping
// fails loud on an unrecognised predicate rather than emitting an empty
// function name; the predicate set is closed and internal, so reaching the
// default branch is a programming error.
func TestPostgresDialect_WriteSpatialPredicate_UnknownPanics(t *testing.T) {
	t.Parallel()

	d := &dialect.PostgresDialect{}

	defer func() {
		if r := recover(); r == nil {
			t.Fatal("expected panic for unknown spatial predicate, got none")
		}
	}()

	var b strings.Builder

	d.WriteSpatialPredicate(&b, dialect.SpatialPredicate("not_a_predicate"), "a", "b")
}

// TestPostgresDialect_WriteSpatialDWithinPredicate pins ST_DWithin/ST_3DDWithin
// rendering, including the geography-only fourth use_spheroid argument and the
// rule that a non-nil use_spheroid expression is ignored for geometry.
func TestPostgresDialect_WriteSpatialDWithinPredicate(t *testing.T) {
	t.Parallel()

	d := &dialect.PostgresDialect{}
	spheroid := "$3"

	tests := []struct {
		name             string
		threeDimensional bool
		sqlType          string
		useSpheroidExpr  *string
		want             string
	}{
		{
			name:    "geometry 2d",
			sqlType: "geometry",
			want:    `ST_DWithin("t"."geom", ST_GeomFromGeoJSON($1), $2)`,
		},
		{
			name:             "geometry 3d",
			threeDimensional: true,
			sqlType:          "geometry",
			want:             `ST_3DDWithin("t"."geom", ST_GeomFromGeoJSON($1), $2)`,
		},
		{
			name:            "geography with use_spheroid",
			sqlType:         "geography",
			useSpheroidExpr: &spheroid,
			want:            `ST_DWithin("t"."geog", ST_GeomFromGeoJSON($1)::geography, $2, $3)`,
		},
		{
			name:    "geography without use_spheroid expr omits fourth arg",
			sqlType: "geography",
			want:    `ST_DWithin("t"."geog", ST_GeomFromGeoJSON($1)::geography, $2)`,
		},
		{
			name:            "geometry ignores use_spheroid expr",
			sqlType:         "geometry",
			useSpheroidExpr: &spheroid,
			want:            `ST_DWithin("t"."geom", ST_GeomFromGeoJSON($1), $2)`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			left := `"t"."geom"`
			right := "ST_GeomFromGeoJSON($1)"

			if tt.sqlType == "geography" {
				left = `"t"."geog"`
				right = "ST_GeomFromGeoJSON($1)::geography"
			}

			var b strings.Builder

			d.WriteSpatialDWithinPredicate(
				&b, tt.threeDimensional, left, right, "$2", tt.sqlType, tt.useSpheroidExpr,
			)

			if got := b.String(); got != tt.want {
				t.Fatalf("WriteSpatialDWithinPredicate:\n got  %q\n want %q", got, tt.want)
			}
		})
	}
}

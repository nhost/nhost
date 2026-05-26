package where

import (
	"strings"
	"testing"

	"go.uber.org/mock/gomock"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	dialectmock "github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect/mock"
)

func newColumn(sql, sqlType string) *core.Column {
	return &core.Column{
		SQLName:     sql,
		GraphqlName: sql,
		SQLType:     sqlType,
		IsArray:     false,
	}
}

//nolint:unparam // source is always `"t"` today but documenting intent for future cases.
func runStatement(t *testing.T, stmt Statement, source string) (string, []any) {
	t.Helper()

	var b strings.Builder

	params, _, err := stmt.WriteCondition(&b, source, nil, 1)
	if err != nil {
		t.Fatalf("Writecondition: %v", err)
	}

	return b.String(), params
}

func TestEqualsFilter_WriteCondition(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(1).Return("$1")
	d.EXPECT().TypeCast("$1", "uuid").Return("$1::uuid")

	f := &equalsFilter{column: newColumn("id", "uuid"), value: "abc", dialect: d}
	sql, params := runStatement(t, f, `"t"`)

	if want := `"t"."id" = $1::uuid`; sql != want {
		t.Errorf("sql = %q, want %q", sql, want)
	}

	if len(params) != 1 || params[0] != "abc" {
		t.Errorf("params = %v, want [abc]", params)
	}
}

func TestNotequalsFilter_WriteCondition(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(1).Return("$1")
	d.EXPECT().TypeCast("$1", "int").Return("$1::int")

	f := &notEqualsFilter{column: newColumn("age", "int"), value: 30, dialect: d}
	sql, _ := runStatement(t, f, `"t"`)

	if !strings.Contains(sql, ` != `) {
		t.Errorf("expected != operator, got %q", sql)
	}
}

func TestGreaterThanLessThanFilters(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		make func(*dialectmock.MockDialect) Statement
		op   string
	}{
		{"gt", func(d *dialectmock.MockDialect) Statement {
			return &greaterThanFilter{column: newColumn("n", "int"), value: 1, dialect: d}
		}, ` > `},
		{"gte", func(d *dialectmock.MockDialect) Statement {
			return &greaterThanOrEqualFilter{column: newColumn("n", "int"), value: 1, dialect: d}
		}, ` >= `},
		{"lt", func(d *dialectmock.MockDialect) Statement {
			return &lessThanFilter{column: newColumn("n", "int"), value: 1, dialect: d}
		}, ` < `},
		{"lte", func(d *dialectmock.MockDialect) Statement {
			return &lessThanOrEqualFilter{column: newColumn("n", "int"), value: 1, dialect: d}
		}, ` <= `},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			d := dialectmock.NewMockDialect(ctrl)
			d.EXPECT().Placeholder(1).Return("$1")
			d.EXPECT().TypeCast("$1", "int").Return("$1::int")

			sql, _ := runStatement(t, tc.make(d), `"t"`)
			if !strings.Contains(sql, tc.op) {
				t.Errorf("expected %q operator in %q", tc.op, sql)
			}
		})
	}
}

func TestLikeFilters_CaseSensitiveVsInsensitive(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		// makeFilter constructs the filter; primeDialect sets up dialect mock
		// expectations for the case-insensitive branch.
		makeFilter    func(d *dialectmock.MockDialect, caseSensitive bool) Statement
		primeDialect  func(d *dialectmock.MockDialect)
		caseSensitive bool
		wantOp        string
	}{
		{
			name: "like sensitive",
			makeFilter: func(d *dialectmock.MockDialect, cs bool) Statement {
				return &likeFilter{column: "name", pattern: "%foo%", caseSensitive: cs, dialect: d}
			},
			caseSensitive: true,
			wantOp:        " LIKE ",
		},
		{
			name: "like insensitive",
			makeFilter: func(d *dialectmock.MockDialect, cs bool) Statement {
				return &likeFilter{column: "name", pattern: "%foo%", caseSensitive: cs, dialect: d}
			},
			primeDialect:  func(d *dialectmock.MockDialect) { d.EXPECT().ILike().Return("ILIKE") },
			caseSensitive: false,
			wantOp:        " ILIKE ",
		},
		{
			name: "not like sensitive",
			makeFilter: func(d *dialectmock.MockDialect, cs bool) Statement {
				return &notLikeFilter{
					column:        "name",
					pattern:       "%foo%",
					caseSensitive: cs,
					dialect:       d,
				}
			},
			caseSensitive: true,
			wantOp:        " NOT LIKE ",
		},
		{
			name: "not like insensitive",
			makeFilter: func(d *dialectmock.MockDialect, cs bool) Statement {
				return &notLikeFilter{
					column:        "name",
					pattern:       "%foo%",
					caseSensitive: cs,
					dialect:       d,
				}
			},
			primeDialect:  func(d *dialectmock.MockDialect) { d.EXPECT().NotILike().Return("NOT ILIKE") },
			caseSensitive: false,
			wantOp:        " NOT ILIKE ",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			d := dialectmock.NewMockDialect(ctrl)
			d.EXPECT().Placeholder(1).Return("$1")

			if tc.primeDialect != nil {
				tc.primeDialect(d)
			}

			sql, _ := runStatement(t, tc.makeFilter(d, tc.caseSensitive), `"t"`)
			if !strings.Contains(sql, tc.wantOp) {
				t.Errorf("expected %q in %q", tc.wantOp, sql)
			}
		})
	}
}

func TestRegexFilter_CaseSensitiveVsInsensitive(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name          string
		caseSensitive bool
		wantOp        string
	}{
		{"case sensitive", true, " ~ "},
		{"case insensitive", false, " ~* "},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			d := dialectmock.NewMockDialect(ctrl)
			d.EXPECT().Placeholder(1).Return("$1")

			f := &regexFilter{
				column:        "name",
				pattern:       "^a",
				caseSensitive: tc.caseSensitive,
				dialect:       d,
			}
			sql, _ := runStatement(t, f, `"t"`)

			if !strings.Contains(sql, tc.wantOp) {
				t.Errorf("expected %q in %q", tc.wantOp, sql)
			}
		})
	}
}

func TestNotRegexFilter_CaseSensitiveVsInsensitive(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name          string
		caseSensitive bool
		wantOp        string
	}{
		{"case sensitive", true, " !~ "},
		{"case insensitive", false, " !~* "},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			d := dialectmock.NewMockDialect(ctrl)
			d.EXPECT().Placeholder(1).Return("$1")

			f := &notRegexFilter{
				column:        "n",
				pattern:       "x",
				caseSensitive: tc.caseSensitive,
				dialect:       d,
			}
			sql, _ := runStatement(t, f, `"t"`)

			if !strings.Contains(sql, tc.wantOp) {
				t.Errorf("expected %q in %q", tc.wantOp, sql)
			}
		})
	}
}

func TestIsNullFilter_TrueVsFalse(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name   string
		isNull bool
		want   string
	}{
		{"is null", true, "IS NULL"},
		{"is not null", false, "IS NOT NULL"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			f := &isNullFilter{column: "deleted_at", isNull: tc.isNull}
			sql, params := runStatement(t, f, `"t"`)

			if !strings.Contains(sql, tc.want) {
				t.Errorf("expected %q in %q", tc.want, sql)
			}

			if params != nil {
				t.Errorf("isNullFilter must not produce params, got %v", params)
			}
		})
	}
}

func TestRawFilter_WritesCondition(t *testing.T) {
	t.Parallel()

	f := &rawFilter{condition: `"t"."x" = 1`}
	sql, params := runStatement(t, f, `"t"`)

	if sql != `"t"."x" = 1` {
		t.Errorf("rawFilter sql = %q", sql)
	}

	if params != nil {
		t.Errorf("rawFilter must not produce params, got %v", params)
	}
}

func TestAndFilter_JoinsConditions(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(gomock.Any()).
		DoAndReturn(func(i int) string { return "$" + string(rune('0'+i)) }).Times(2)
	d.EXPECT().TypeCast(gomock.Any(), gomock.Any()).
		DoAndReturn(func(p, s string) string { return p + "::" + s }).Times(2)

	f := &andFilter{
		conditions: []Statement{
			&equalsFilter{column: newColumn("a", "int"), value: 1, dialect: d},
			&equalsFilter{column: newColumn("b", "int"), value: 2, dialect: d},
		},
	}

	sql, params := runStatement(t, f, `"t"`)

	if !strings.Contains(sql, ` AND `) {
		t.Errorf("expected AND in %q", sql)
	}

	if len(params) != 2 {
		t.Errorf("expected 2 params, got %v", params)
	}
}

func TestOrFilter_WrapsAndJoins(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(gomock.Any()).
		DoAndReturn(func(i int) string { return "$" + string(rune('0'+i)) }).Times(2)
	d.EXPECT().TypeCast(gomock.Any(), gomock.Any()).
		DoAndReturn(func(p, s string) string { return p + "::" + s }).Times(2)

	f := &orFilter{
		conditions: []Statement{
			&equalsFilter{column: newColumn("a", "int"), value: 1, dialect: d},
			&equalsFilter{column: newColumn("b", "int"), value: 2, dialect: d},
		},
	}

	sql, _ := runStatement(t, f, `"t"`)

	if !strings.HasPrefix(sql, "(") || !strings.HasSuffix(sql, ")") {
		t.Errorf("orFilter must wrap in parens, got %q", sql)
	}

	if !strings.Contains(sql, ` OR `) {
		t.Errorf("expected OR in %q", sql)
	}
}

func TestNotFilter_WrapsCondition(t *testing.T) {
	t.Parallel()

	f := &notFilter{condition: &rawFilter{condition: "x = 1"}}
	sql, _ := runStatement(t, f, `"t"`)

	if !strings.HasPrefix(sql, "NOT (") || !strings.HasSuffix(sql, ")") {
		t.Errorf("notFilter must emit NOT (...), got %q", sql)
	}
}

func TestClause_AndJoins(t *testing.T) {
	t.Parallel()

	c := Clause{
		&rawFilter{condition: "a"},
		&rawFilter{condition: "b"},
		&rawFilter{condition: "c"},
	}

	sql, _ := runStatement(t, c, `"t"`)

	if want := "a AND b AND c"; sql != want {
		t.Errorf("Clause.WriteCondition = %q, want %q", sql, want)
	}
}

func TestClause_EmptyEmitsNothing(t *testing.T) {
	t.Parallel()

	c := Clause{}
	sql, params := runStatement(t, c, `"t"`)

	if sql != "" {
		t.Errorf("empty Clause sql = %q, want empty", sql)
	}

	if params != nil {
		t.Errorf("empty Clause params = %v, want nil", params)
	}
}

func TestJSONBContainsFilter(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(1).Return("$1")
	d.EXPECT().TypeCast("$1", "jsonb").Return("$1::jsonb")

	f := &jsonbContainsFilter{column: "data", value: map[string]any{"a": 1}, dialect: d}
	sql, _ := runStatement(t, f, `"t"`)

	if !strings.Contains(sql, " @> ") {
		t.Errorf("expected @> in %q", sql)
	}
}

func TestJSONBContainedInFilter(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(1).Return("$1")
	d.EXPECT().TypeCast("$1", "jsonb").Return("$1::jsonb")

	f := &jsonbContainedInFilter{column: "data", value: map[string]any{"a": 1}, dialect: d}
	sql, _ := runStatement(t, f, `"t"`)

	if !strings.Contains(sql, " <@ ") {
		t.Errorf("expected <@ in %q", sql)
	}
}

func TestJSONBHasKeyFilter(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(1).Return("$1")

	f := &jsonbHasKeyFilter{column: "data", key: "k", dialect: d}
	sql, params := runStatement(t, f, `"t"`)

	if !strings.Contains(sql, " ? ") {
		t.Errorf("expected ? in %q", sql)
	}

	if len(params) != 1 || params[0] != "k" {
		t.Errorf("params = %v, want [k]", params)
	}
}

func TestJSONBHasKeysAllFilter(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(1).Return("$1")
	d.EXPECT().TypeCast("$1", "text[]").Return("$1::text[]")

	f := &jsonbHasKeysAllFilter{column: "data", keys: []string{"a", "b"}, dialect: d}
	sql, _ := runStatement(t, f, `"t"`)

	if !strings.Contains(sql, " ?& ") {
		t.Errorf("expected ?& in %q", sql)
	}
}

func TestJSONBHasKeysAnyFilter(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(1).Return("$1")
	d.EXPECT().TypeCast("$1", "text[]").Return("$1::text[]")

	f := &jsonbHasKeysAnyFilter{column: "data", keys: []string{"a", "b"}, dialect: d}
	sql, _ := runStatement(t, f, `"t"`)

	if !strings.Contains(sql, " ?| ") {
		t.Errorf("expected ?| in %q", sql)
	}
}

func TestArrayContainmentFilters(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name       string
		makeFilter func(d *dialectmock.MockDialect) Statement
		// primeWrite mirrors the dialect's WriteArray{Contains,ContainedIn}
		// side effect: write `<col> <op> <placeholder>` into the builder.
		primeWrite func(d *dialectmock.MockDialect, op string)
		op         string
	}{
		{
			name: "contains",
			makeFilter: func(d *dialectmock.MockDialect) Statement {
				return &arrayContainsFilter{
					column: "tags", sqlType: "text[]", value: []any{"a"}, dialect: d,
				}
			},
			primeWrite: func(d *dialectmock.MockDialect, op string) {
				d.EXPECT().WriteArrayContains(gomock.Any(), gomock.Any(), gomock.Any()).
					Do(func(b *strings.Builder, col, ph string) {
						b.WriteString(col)
						b.WriteString(" ")
						b.WriteString(op)
						b.WriteString(" ")
						b.WriteString(ph)
					})
			},
			op: "@>",
		},
		{
			name: "contained_in",
			makeFilter: func(d *dialectmock.MockDialect) Statement {
				return &arrayContainedInFilter{
					column: "tags", sqlType: "text[]", value: []any{"a"}, dialect: d,
				}
			},
			primeWrite: func(d *dialectmock.MockDialect, op string) {
				d.EXPECT().WriteArrayContainedIn(gomock.Any(), gomock.Any(), gomock.Any()).
					Do(func(b *strings.Builder, col, ph string) {
						b.WriteString(col)
						b.WriteString(" ")
						b.WriteString(op)
						b.WriteString(" ")
						b.WriteString(ph)
					})
			},
			op: "<@",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			d := dialectmock.NewMockDialect(ctrl)
			d.EXPECT().Placeholder(1).Return("$1")
			d.EXPECT().TypeCast("$1", "text[]").Return("$1::text[]")
			tc.primeWrite(d, tc.op)

			sql, _ := runStatement(t, tc.makeFilter(d), `"t"`)
			if !strings.Contains(sql, tc.op) {
				t.Errorf("expected %q in %q", tc.op, sql)
			}
		})
	}
}

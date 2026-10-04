package where_test

import (
	"reflect"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
)

func TestComputedOperatorsUseTypedParameters(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name, sqlType string
		filter        map[string]any
		sql           string
		params        []any
	}{
		{"similar", "text", map[string]any{"label": map[string]any{"_similar": "a%(x|y)"}}, `"t"."label" SIMILAR TO $1::text`, []any{"a%(x|y)"}},
		{"nsimilar", "text", map[string]any{"label": map[string]any{"$nsimilar": "a%"}}, `"t"."label" NOT SIMILAR TO $1::text`, []any{"a%"}},
		{"ltree ancestor", "ltree", map[string]any{"label": map[string]any{"_ancestor": "a.b"}}, `"t"."label" @> $1::ltree`, []any{"a.b"}},
		{"ltree matches any", "ltree", map[string]any{"label": map[string]any{"_matches_any": []any{"a.*"}}}, `"t"."label" ? ARRAY[$1::text]::text[]::lquery[]`, []any{"a.*"}},
		{"ltree whole-array session", "ltree", map[string]any{"label": map[string]any{"_matches_any": "x-hasura-paths"}}, `"t"."label" ? $1::text::lquery[]`, []any{"x-hasura-paths"}},
		{"current column", "text", map[string]any{"label": map[string]any{"_cneq": "other"}}, `"t"."label" <> "t"."other"`, nil},
		{"root column", "text", map[string]any{"label": map[string]any{"_ceq": []any{"$", "other"}}}, `"t"."label" = "t"."other"`, nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			tbl := &parseTestTable{
				d: dialect.NewPostgresDialect(),
				columns: map[string]*core.Column{
					"label": {SQLName: "label", GraphqlName: "label", SQLType: tc.sqlType},
					"other": {SQLName: "other", GraphqlName: "other", SQLType: tc.sqlType},
				},
			}

			value, err := values.GoValueToAST(tc.filter)
			if err != nil {
				t.Fatal(err)
			}

			clause, err := where.Parse(tbl, value, nil, "", nil, 0, where.QueryAliases)
			if err != nil {
				t.Fatal(err)
			}

			var b strings.Builder

			params, _, err := clause.WriteCondition(&b, `"t"`, nil, 1)
			if err != nil {
				t.Fatal(err)
			}

			if b.String() != tc.sql || !reflect.DeepEqual(params, tc.params) {
				t.Fatalf(
					"sql = %q, params = %#v; want %q, %#v",
					b.String(),
					params,
					tc.sql,
					tc.params,
				)
			}
		})
	}
}

func TestComputedOperatorsRejectSQLite(t *testing.T) {
	t.Parallel()

	for _, filter := range []map[string]any{
		{"label": map[string]any{"_similar": "a%"}},
		{"label": map[string]any{"_ceq": "label"}},
		{"path": map[string]any{"_ancestor": "a"}},
	} {
		tbl := &parseTestTable{d: dialect.NewSQLiteDialect(), columns: map[string]*core.Column{
			"label": {SQLName: "label", GraphqlName: "label", SQLType: "text"},
			"path":  {SQLName: "path", GraphqlName: "path", SQLType: "ltree"},
		}}

		value, err := values.GoValueToAST(filter)
		if err != nil {
			t.Fatal(err)
		}

		if _, err := where.Parse(tbl, value, nil, "", nil, 0, where.QueryAliases); err == nil {
			t.Fatalf("SQLite accepted PostgreSQL operator: %v", filter)
		}
	}
}

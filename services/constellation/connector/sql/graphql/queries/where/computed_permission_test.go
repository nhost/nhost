package where_test

import (
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
)

type computedExpressionStub struct{}

func (computedExpressionStub) SQLType() string         { return "text" }
func (computedExpressionStub) SourceColumns() []string { return nil }
func (computedExpressionStub) WriteExpression(
	_ *strings.Builder, _ string, _ map[string]any, params []any, paramIndex int,
) ([]any, int, error) {
	return params, paramIndex, nil
}

func TestContainsComputedParsedFilter(t *testing.T) {
	t.Parallel()

	tbl := &parseTestTable{
		d: dialect.NewPostgresDialect(),
		columns: map[string]*core.Column{"name": {
			SQLName: "name", GraphqlName: "name", SQLType: "text",
		}},
		computed: map[string]core.ComputedExpression{"computed_name": computedExpressionStub{}},
	}

	for _, tc := range []struct {
		name   string
		filter map[string]any
		want   bool
	}{
		{"computed comparison", map[string]any{"computed_name": map[string]any{"_eq": "a"}}, true},
		{"ordinary column", map[string]any{"name": map[string]any{"_eq": "a"}}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			value, err := values.GoValueToAST(tc.filter)
			if err != nil {
				t.Fatal(err)
			}

			clause, err := where.Parse(tbl, value, nil, "", nil, 0, where.PermissionAliases)
			if err != nil {
				t.Fatal(err)
			}

			if got := where.ContainsComputed(clause); got != tc.want {
				t.Errorf("ContainsComputed(parsed filter) = %t, want %t", got, tc.want)
			}
		})
	}
}

func TestSupportedComputedPermissionComparison(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name, sqlType string
		comparison    map[string]any
		want          bool
	}{
		{"empty tautology", "text", map[string]any{}, true},
		{"text like", "text", map[string]any{"_like": "f%"}, true},
		{"ne alias", "text", map[string]any{"_ne": "x"}, true},
		{"dollar ne alias", "text", map[string]any{"$ne": "x"}, true},
		{"dollar eq alias", "text", map[string]any{"$eq": "x"}, true},
		{"dollar regex wrong return", "jsonb", map[string]any{"$regex": "x"}, false},
		{"text object operand", "text", map[string]any{"_eq": map[string]any{"x": 1}}, false},
		{"text list operand", "text", map[string]any{"_eq": []any{"x"}}, false},
		{"text list with object", "text", map[string]any{"_in": []any{map[string]any{"x": 1}}}, false},
		{"text list membership", "text", map[string]any{"_in": []any{"x"}}, true},
		{"missing session variable", "text", map[string]any{"_eq": "x-hasura-missing"}, true},
		{"jsonb object operand", "jsonb", map[string]any{"_eq": map[string]any{"x": 1}}, true},
		{"jsonb array operand", "jsonb", map[string]any{"_contains": []any{"x"}}, true},
		{"similar", "text", map[string]any{"_similar": "f%"}, true},
		{"nsimilar", "text", map[string]any{"_nsimilar": "f%"}, true},
		{"dollar similar", "text", map[string]any{"$similar": "f%"}, true},
		{"similar wrong type", "jsonb", map[string]any{"_similar": "f%"}, false},
		{"ltree ancestor", "ltree", map[string]any{"_ancestor": "top.first"}, true},
		{"ltree descendant any", "ltree", map[string]any{"$descendant_any": []any{"top", "here"}}, true},
		{"ltree matches any", "ltree", map[string]any{"_matches_any": []any{"top.*"}}, true},
		{"ltree fulltext", "ltree", map[string]any{"_matches_fulltext": "first"}, true},
		{"ltree malformed list", "ltree", map[string]any{"_matches_any": []any{map[string]any{"x": 1}}}, false},
		{"ltree on text", "text", map[string]any{"_matches": "top.*"}, false},
		{"text cast", "text", map[string]any{"_cast": map[string]any{"String": map[string]any{}}}, false},
		{"jsonb cast", "jsonb", map[string]any{"_cast": map[string]any{"String": map[string]any{"_eq": "value"}}}, true},
		{"jsonb wrong cast target", "jsonb", map[string]any{"_cast": map[string]any{"geometry": map[string]any{}}}, false},
		{"jsonb contains", "jsonb", map[string]any{"_contains": map[string]any{"status": "ok"}}, true},
		{"text contains", "text", map[string]any{"_contains": "ok"}, false},
		{"geometry distance", "geometry", map[string]any{"_st_d_within": map[string]any{"from": map[string]any{"type": "Point", "coordinates": []any{1, 1}}, "distance": 0.1}}, true},
		{"geography distance", "geography", map[string]any{"_st_d_within": map[string]any{"from": map[string]any{"type": "Point", "coordinates": []any{1, 1}}, "distance": 0.1}}, true},
		{"malformed spatial distance", "geometry", map[string]any{"_st_d_within": map[string]any{}}, false},
		{"geography 3d", "geography", map[string]any{"_st_3d_d_within": map[string]any{}}, false},
		{"geometry cast", "geometry", map[string]any{"_cast": map[string]any{"geography": map[string]any{"_st_intersects": "point"}}}, true},
		{"geometry same cast", "geometry", map[string]any{"_cast": map[string]any{"geometry": map[string]any{}}}, false},
		{"spatial on text", "text", map[string]any{"_st_intersects": "point"}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := where.SupportedComputedPermissionComparison(
				tc.sqlType,
				tc.comparison,
			); got != tc.want {
				t.Fatalf("support = %v, want %v", got, tc.want)
			}
		})
	}
}

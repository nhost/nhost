package integration_test

import "testing"

// TestSelectWhereVariable pins constellation's resolution of GraphQL `$variable`
// values supplied at operator positions in the where/bool_exp builder, against
// live Hasura. These forms previously misbehaved because the parser inspected
// the raw AST without first substituting the variable:
//
//   - `_is_null: $v` was read as the literal variable *name*, so any variable
//     produced IS NOT NULL regardless of $v (BUG_MEDIUM_1).
//   - `_and: $conds` / `_or: $conds` supplied as a single list variable hit a
//     Kind switch that rejected ast.Variable outright, erroring on a query that
//     succeeds on Hasura (INCON_LOW_1).
//
// The null-rejection forms (`_is_null: null`, `_is_null: $v` with $v=null) are
// covered by the where package unit tests instead: Hasura rejects them at
// validation ("expected a boolean for type 'Boolean', but found null") while
// constellation rejects them in the where builder, so the error text differs and
// they are not suited to this response-diffing harness — mirroring how the null
// `_and`/`_or` cases are handled in query_where_null_empty_test.go.
func TestSelectWhereVariable(t *testing.T) { //nolint:paralleltest
	cases := []TestCase{
		{
			name: "_is_null variable true",
			query: query{
				Query: `query($v: Boolean) {
					departments(
						where: {description: {_is_null: $v}}, order_by: {id: asc}
					) { id name }
				}`,
				Variables: map[string]any{"v": true},
				Role:      "admin",
			},
		},
		{
			name: "_is_null variable false",
			query: query{
				Query: `query($v: Boolean) {
					departments(
						where: {description: {_is_null: $v}}, order_by: {id: asc}
					) { id name }
				}`,
				Variables: map[string]any{"v": false},
				Role:      "admin",
			},
		},
		{
			name: "_and whole-list variable",
			query: query{
				Query: `query($c: [departments_bool_exp!]) {
					departments(where: {_and: $c}, order_by: {name: asc}) { name }
				}`,
				Variables: map[string]any{
					"c": []any{
						map[string]any{"name": map[string]any{"_eq": "Sales"}},
					},
				},
				Role: "admin",
			},
		},
		{
			name: "_or whole-list variable",
			query: query{
				Query: `query($c: [departments_bool_exp!]) {
					departments(where: {_or: $c}, order_by: {name: asc}) { name }
				}`,
				Variables: map[string]any{
					"c": []any{
						map[string]any{"name": map[string]any{"_eq": "Sales"}},
						map[string]any{"name": map[string]any{"_eq": "Finance"}},
					},
				},
				Role: "admin",
			},
		},
		{
			name: "_and whole-list variable combined with a sibling predicate",
			query: query{
				Query: `query($c: [departments_bool_exp!]) {
					departments(
						where: {_and: $c, name: {_neq: "Operations"}},
						order_by: {name: asc}
					) { name }
				}`,
				Variables: map[string]any{
					"c": []any{
						map[string]any{"budget": map[string]any{"_gt": "300000"}},
					},
				},
				Role: "admin",
			},
		},
	}

	RunGraphQLTests(t, cases, TestConfig{IsMutation: false, ReinitBetweenQueries: false})
}

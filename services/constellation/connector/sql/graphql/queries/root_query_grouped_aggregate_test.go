package queries_test

import (
	"errors"
	"fmt"
	"path/filepath"
	"sort"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	groupedaggdispatch "github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/groupedaggregate"
)

// groupedAggregateTestCase exercises BuildGroupedAggregateSQL on a single
// target table by parsing a synthetic aggregate query, extracting the
// aggregate field, and invoking the builder directly. This bypasses the
// normal root-dispatch path because grouped aggregates are invoked by the
// cross-database resolver, not the GraphQL root resolver.
type groupedAggregateTestCase struct {
	name              string
	tableSchema       string
	tableName         string
	joinColumnSQLName string
	// joinValues are the parent join keys to batch. Use a mix of values that
	// match seeded data and a value that won't to exercise the empty-group
	// branch.
	joinValues []any
	// query must be a single-operation query whose root field's selection
	// set is treated as the aggregate's selection set. The root field is
	// ignored — only its SelectionSet is used.
	query       string
	role        string
	expectError error
}

// Stable UUIDs from the test seed data (auth.users).
var (
	testUser1 = "550e8400-e29b-41d4-a716-446655440001" //nolint:gochecknoglobals
	testUser2 = "550e8400-e29b-41d4-a716-446655440002" //nolint:gochecknoglobals
	// testUserMissing has the right UUID shape but is not seeded, so it
	// exercises the empty-group code path.
	testUserMissing = "00000000-0000-0000-0000-000000000099" //nolint:gochecknoglobals
)

func TestGroupedAggregateBuildQuery(t *testing.T) { //nolint:paralleltest,maintidx
	cases := []groupedAggregateTestCase{
		{
			name:              "count_only",
			tableSchema:       "public",
			tableName:         "user_departments",
			joinColumnSQLName: "user_id",
			joinValues:        []any{testUser1, testUser2, testUserMissing},
			query: `
				query {
					_root {
						aggregate { count }
					}
				}`,
		},
		{
			// Aliased counts in the grouped writer must key by the alias. The
			// bare count goes through the COUNT(<join_col>) empty-group branch and
			// the column-scoped count through writeFiltered; both must honor the
			// response name so the two entries get distinct JSON keys.
			name:              "count_aliased_multiple_variants",
			tableSchema:       "public",
			tableName:         "user_departments",
			joinColumnSQLName: "user_id",
			joinValues:        []any{testUser1, testUser2, testUserMissing},
			query: `
				query {
					_root {
						aggregate {
							total: count
							distinct_role: count(columns: [role], distinct: true)
						}
					}
				}`,
		},
		{
			// Column-scoped distinct count over the grouped LEFT JOIN; the writer
			// filters out the synthesized empty-group row so a missing parent key
			// still counts 0.
			name:              "count_with_distinct_column",
			tableSchema:       "public",
			tableName:         "user_departments",
			joinColumnSQLName: "user_id",
			joinValues:        []any{testUser1, testUser2, testUserMissing},
			query: `
				query {
					_root {
						aggregate {
							count(columns: [role], distinct: true)
						}
					}
				}`,
		},
		{
			// Multi-column counts use non-null row/tuple values; the grouped writer
			// must explicitly filter out the synthetic LEFT JOIN row for missing
			// parent keys so empty groups still count as 0.
			name:              "count_with_distinct_multiple_columns",
			tableSchema:       "public",
			tableName:         "user_departments",
			joinColumnSQLName: "user_id",
			joinValues:        []any{testUser1, testUser2, testUserMissing},
			query: `
				query {
					_root {
						aggregate {
							count(columns: [role, is_active], distinct: true)
						}
					}
				}`,
		},
		{
			// "role" is a stable text column; "joined_at" defaults to now() in
			// seeds and would drift between runs.
			name:              "count_with_max_and_min",
			tableSchema:       "public",
			tableName:         "user_departments",
			joinColumnSQLName: "user_id",
			joinValues:        []any{testUser1, testUser2, testUserMissing},
			query: `
				query {
					_root {
						aggregate {
							count
							max { role }
							min { role }
						}
					}
				}`,
		},
		{
			// Aliased function aggregates through the grouped writer. The
			// grouped path renders non-count selections with
			// aggregateFunctionSelection.write so it can qualify the active
			// source alias, while each GraphQL alias must become the JSON key.
			// Two "max" selections distinguished only by alias must render two
			// distinct keys, not a collapsed "max".
			name:              "function_aliased_multiple_variants",
			tableSchema:       "public",
			tableName:         "user_departments",
			joinColumnSQLName: "user_id",
			joinValues:        []any{testUser1, testUser2, testUserMissing},
			query: `
				query {
					_root {
						aggregate {
							highest_role: max { role }
							lowest_role: min { role }
							a: max { role }
							b: max { role }
						}
					}
				}`,
		},
		{
			name:              "aggregate_with_nodes",
			tableSchema:       "public",
			tableName:         "user_departments",
			joinColumnSQLName: "user_id",
			joinValues:        []any{testUser1, testUser2, testUserMissing},
			query: `
				query {
					_root {
						aggregate { count }
						nodes { role }
					}
				}`,
		},
		{
			name:              "where_filter",
			tableSchema:       "public",
			tableName:         "user_departments",
			joinColumnSQLName: "user_id",
			joinValues:        []any{testUser1, testUser2, testUserMissing},
			query: `
				query {
					_root(where: { is_active: { _eq: true } }) {
						aggregate { count }
						nodes { role }
					}
				}`,
		},
		// __typename at the outer grouped-aggregate scope. Exercises the
		// writeGroupedAggregateOuter emission of outer typenames into the
		// per-group json_build_object.
		{
			name:              "typename_outer",
			tableSchema:       "public",
			tableName:         "user_departments",
			joinColumnSQLName: "user_id",
			joinValues:        []any{testUser1, testUser2, testUserMissing},
			query: `
				query {
					_root {
						__typename
						aggregate { count }
					}
				}`,
		},
		// __typename inside aggregate { ... } scope. Exercises the same
		// aggregate-fields collector reached via the grouped path.
		{
			name:              "typename_in_aggregate_fields",
			tableSchema:       "public",
			tableName:         "user_departments",
			joinColumnSQLName: "user_id",
			joinValues:        []any{testUser1, testUser2, testUserMissing},
			query: `
				query {
					_root {
						aggregate {
							__typename
							count
						}
					}
				}`,
		},
		// __typename inside an aggregate function scope (max). user_departments
		// has no numeric columns suitable for sum/avg, so we use max over the
		// text "role" column.
		{
			name:              "typename_in_function_scope",
			tableSchema:       "public",
			tableName:         "user_departments",
			joinColumnSQLName: "user_id",
			joinValues:        []any{testUser1, testUser2, testUserMissing},
			query: `
				query {
					_root {
						__typename
						aggregate {
							__typename
							count
							max {
								__typename
								role
							}
						}
					}
				}`,
		},
		{
			// Per-group limit: each parent's target rows are independently
			// numbered (ORDER BY department_id) and capped at 1, so the count
			// drops to 1 and exactly one node survives — matching Hasura, which
			// applies limit per group to BOTH the aggregate and the nodes.
			// testUser1/testUser2 each have 2 rows → count 1; testUserMissing
			// stays count 0 (the synthesized empty-group row bypasses the window).
			name:              "limit_one_per_group",
			tableSchema:       "public",
			tableName:         "user_departments",
			joinColumnSQLName: "user_id",
			joinValues:        []any{testUser1, testUser2, testUserMissing},
			query: `
				query {
					_root(limit: 1, order_by: { department_id: asc }) {
						aggregate { count }
						nodes { role department_id }
					}
				}`,
		},
		{
			// Per-group limit+offset: skip the first row then keep one. Each
			// parent has 2 rows ordered by department_id, so offset 1 + limit 1
			// keeps the second row (count 1, one node) and the offset shifts which
			// row survives versus limit_one_per_group. testUserMissing stays 0.
			name:              "limit_offset_per_group",
			tableSchema:       "public",
			tableName:         "user_departments",
			joinColumnSQLName: "user_id",
			joinValues:        []any{testUser1, testUser2, testUserMissing},
			query: `
				query {
					_root(limit: 1, offset: 1, order_by: { department_id: asc }) {
						aggregate { count }
						nodes { role department_id }
					}
				}`,
		},
		{
			// Function aggregates must read the same per-group window as count and
			// nodes. For testUser1, the full group has min(role) = "manager", but
			// offset 1 + limit 1 leaves only the second ordered row ("member"), so
			// executing this golden catches regressions that aggregate the base CTE.
			name:              "limit_offset_function_aggregate",
			tableSchema:       "public",
			tableName:         "user_departments",
			joinColumnSQLName: "user_id",
			joinValues:        []any{testUser1, testUser2, testUserMissing},
			query: `
				query {
					_root(limit: 1, offset: 1, order_by: { department_id: asc }) {
						aggregate {
							count
							min { role }
						}
					}
				}`,
		},
		{
			// Offset-only (no upper bound): skip the first row per group, keep the
			// rest. With 2 rows per parent the count becomes 1; testUserMissing
			// stays 0. Verifies the window predicate omits the upper bound.
			name:              "offset_only_per_group",
			tableSchema:       "public",
			tableName:         "user_departments",
			joinColumnSQLName: "user_id",
			joinValues:        []any{testUser1, testUser2, testUserMissing},
			query: `
				query {
					_root(offset: 1, order_by: { department_id: asc }) {
						aggregate { count }
						nodes { role department_id }
					}
				}`,
		},
		{
			// distinct_on combined with a per-group limit: Hasura applies
			// DISTINCT → ORDER BY → LIMIT per group. testUser1 has two distinct
			// roles (manager, member); ordered by role asc and capped at 1 keeps
			// "manager" (count 1). testUser2's rows share role "member" → distinct
			// collapses to 1, limit 1 keeps it (count 1). testUserMissing stays 0.
			name:              "distinct_on_role_limit_one",
			tableSchema:       "public",
			tableName:         "user_departments",
			joinColumnSQLName: "user_id",
			joinValues:        []any{testUser1, testUser2, testUserMissing},
			query: `
				query {
					_root(distinct_on: [role], limit: 1, order_by: { role: asc }) {
						aggregate { count }
						nodes { role }
					}
				}`,
		},
		{
			// limit: 0 is a valid request meaning "no rows": Hasura still emits
			// every parent group with count 0 / nodes [] (verified live against the
			// cross-db aggregate relationship), so a parent WITH matching rows must
			// not vanish just because its whole window is filtered out. testUser1/
			// testUser2 have 2 rows each → count 0; testUserMissing stays count 0.
			name:              "limit_zero_per_group",
			tableSchema:       "public",
			tableName:         "user_departments",
			joinColumnSQLName: "user_id",
			joinValues:        []any{testUser1, testUser2, testUserMissing},
			query: `
				query {
					_root(limit: 0, order_by: { department_id: asc }) {
						aggregate { count }
						nodes { role department_id }
					}
				}`,
		},
		{
			// An offset past every group's size filters out all windowed rows, but
			// like limit: 0 each parent group must still appear with count 0 /
			// nodes [] — matching Hasura. testUser1/testUser2 have 2 rows each, so
			// offset 5 leaves nothing in the window; testUserMissing stays count 0.
			name:              "offset_beyond_group_size",
			tableSchema:       "public",
			tableName:         "user_departments",
			joinColumnSQLName: "user_id",
			joinValues:        []any{testUser1, testUser2, testUserMissing},
			query: `
				query {
					_root(offset: 5, order_by: { department_id: asc }) {
						aggregate { count }
						nodes { role department_id }
					}
				}`,
		},
		{
			// limit: 0 combined with an offset: still no rows in any window, and
			// every parent group is preserved with count 0 / nodes [] — matching
			// Hasura's limit/offset-on-nodes semantics on the cross-db aggregate.
			name:              "limit_zero_offset_per_group",
			tableSchema:       "public",
			tableName:         "user_departments",
			joinColumnSQLName: "user_id",
			joinValues:        []any{testUser1, testUser2, testUserMissing},
			query: `
				query {
					_root(limit: 0, offset: 1, order_by: { department_id: asc }) {
						aggregate { count }
						nodes { role department_id }
					}
				}`,
		},
		{
			// distinct_on partitions the DISTINCT ON by the parent join key so
			// each group dedupes independently, reshaping the rows that feed both
			// the count and nodes. testUser1 has two distinct roles (count 2);
			// testUser2 has two rows that share role "member" (count collapses to
			// 1) — matching Hasura's per-parent-row distinct_on on the cross-db
			// aggregate relationship.
			name:              "distinct_on_role",
			tableSchema:       "public",
			tableName:         "user_departments",
			joinColumnSQLName: "user_id",
			joinValues:        []any{testUser1, testUser2, testUserMissing},
			query: `
				query {
					_root(distinct_on: [role]) {
						aggregate { count }
						nodes { role }
					}
				}`,
		},
		{
			// order_by only orders the per-group nodes; the count is unchanged
			// (order_by does not reshape the aggregated row set), matching Hasura.
			// The ordering is applied inside the nodes json_agg because the
			// GROUP BY discards the base CTE row order.
			name:              "order_by_role_desc",
			tableSchema:       "public",
			tableName:         "user_departments",
			joinColumnSQLName: "user_id",
			joinValues:        []any{testUser1, testUser2, testUserMissing},
			query: `
				query {
					_root(order_by: { role: desc }) {
						aggregate { count }
						nodes { role department_id }
					}
				}`,
		},
		{
			// distinct_on combined with an order_by that leads with the distinct
			// column: the trailing order_by term resolves the DISTINCT ON tiebreak
			// (department_id DESC) and orders the nodes, matching Hasura.
			name:              "distinct_on_role_order_by_role_dept",
			tableSchema:       "public",
			tableName:         "user_departments",
			joinColumnSQLName: "user_id",
			joinValues:        []any{testUser1, testUser2, testUserMissing},
			query: `
				query {
					_root(distinct_on: [role], order_by: [{ role: asc }, { department_id: desc }]) {
						aggregate { count }
						nodes { role department_id }
					}
				}`,
		},
	}

	testBuildGroupedAggregate(t, cases)
}

// testBuildGroupedAggregate is the harness for grouped aggregate tests. It
// parses each query, extracts the aggregate field selection, builds the SQL,
// compares to a golden file, and executes the SQL against an isolated DB,
// comparing the result data to a second golden.
func testBuildGroupedAggregate( //nolint:gocognit
	t *testing.T, cases []groupedAggregateTestCase,
) {
	t.Helper()

	res := setupIsolatedDB(t)

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			doc, gqlErr := parser.ParseQuery(&ast.Source{Input: tc.query})
			if gqlErr != nil {
				t.Fatalf("failed to parse query: %v", gqlErr)
			}

			if len(doc.Operations) == 0 || len(doc.Operations[0].SelectionSet) == 0 {
				t.Fatal("query must contain at least one root field")
			}

			rootField, ok := doc.Operations[0].SelectionSet[0].(*ast.Field)
			if !ok {
				t.Fatal("expected root selection to be a Field")
			}

			role := tc.role
			if role == "" {
				role = "admin"
			}

			op, err := res.groupedAggOp.BuildGroupedAggregateSQL(groupedaggdispatch.BuildInput{
				TableSchema:       tc.tableSchema,
				TableName:         tc.tableName,
				Field:             rootField,
				Fragments:         doc.Fragments,
				Variables:         nil,
				Role:              role,
				SessionVariables:  nil,
				JoinColumnSQLName: tc.joinColumnSQLName,
				JoinValues:        tc.joinValues,
			})
			if !errors.Is(err, tc.expectError) {
				t.Fatalf("expected error %v, got %v", tc.expectError, err)
			}

			if tc.expectError != nil {
				return
			}

			goldenFileOp := filepath.Join("testdata", t.Name()+".json")
			if *updateGolden {
				updateGoldenFile(t, []core.SQLOperation{op}, goldenFileOp)
			}

			var expected []core.SQLOperation
			getData(t, goldenFileOp, &expected)

			gotOps := []core.SQLOperation{op}

			normalize(expected)
			normalize(gotOps)

			if diff := cmp.Diff(expected, gotOps, cmpopts.EquateEmpty()); diff != "" {
				t.Errorf("SQL mismatch (-want +got):\n%s", diff)
			}

			// Execute and check the data shape too. Group order out of the
			// GROUP BY is undefined, so sort the groups before writing the
			// golden (so the file on disk is deterministic) and before
			// comparing (so a re-planned run still matches).
			data := sortGroupedAggregateGroups(execureOperation(t, res.pool, op))

			goldenFileData := filepath.Join("testdata", t.Name()+"_data.json")
			if *updateGolden {
				updateGoldenFile(t, data, goldenFileData)
			}

			var expectedData any
			getData(t, goldenFileData, &expectedData)

			expectedData = sortGroupedAggregateGroups(normalizeValue(expectedData))
			data = sortGroupedAggregateGroups(normalizeValue(data))

			if diff := cmp.Diff(expectedData, data, cmpopts.EquateEmpty()); diff != "" {
				t.Errorf("data mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

// sortGroupedAggregateGroups recursively sorts every grouped-aggregate group
// array (a slice whose elements are objects carrying a "_join_key") by the
// stringified join key, returning v with those slices reordered in place.
//
// The grouped-aggregate SQL builds json_agg over a GROUP BY with no ORDER BY,
// so PostgreSQL is free to emit groups in any order and that order varies
// across plans/versions. Production never observes it: the executor
// (connector/sql.parseGroupedAggregateResult) immediately rekeys the array
// into a map[join_key]entry and the resolver stitches each entry back onto its
// parent row by key, so the user-visible order is the parent query's order,
// not the array's. Adding ORDER BY to the SQL would sort rows whose order is
// then discarded — pure overhead on every cross-database aggregate fetch — so
// the determinism is restored here in the test instead.
func sortGroupedAggregateGroups(v any) any {
	switch val := v.(type) {
	case map[string]any:
		for k, mapVal := range val {
			val[k] = sortGroupedAggregateGroups(mapVal)
		}

		return val
	case []any:
		for i, sliceVal := range val {
			val[i] = sortGroupedAggregateGroups(sliceVal)
		}

		if isGroupedAggregateGroupSlice(val) {
			sort.SliceStable(val, func(i, j int) bool {
				return groupJoinKey(val[i]) < groupJoinKey(val[j])
			})
		}

		return val
	default:
		return v
	}
}

// isGroupedAggregateGroupSlice reports whether every element of s is a group
// object (a map carrying a "_join_key"), identifying the json_agg group array.
func isGroupedAggregateGroupSlice(s []any) bool {
	if len(s) == 0 {
		return false
	}

	for _, elem := range s {
		m, ok := elem.(map[string]any)
		if !ok {
			return false
		}

		if _, ok := m["_join_key"]; !ok {
			return false
		}
	}

	return true
}

// groupJoinKey returns the stringified "_join_key" of a group object, matching
// the keying that connector/sql.parseGroupedAggregateResult applies in
// production so the test sort mirrors the real lookup key.
func groupJoinKey(group any) string {
	m, ok := group.(map[string]any)
	if !ok {
		return ""
	}

	return fmt.Sprintf("%v", m["_join_key"])
}

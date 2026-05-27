package queries_test

import (
	"errors"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
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

func TestGroupedAggregateBuildQuery(t *testing.T) { //nolint:paralleltest
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
			name:              "limit_rejected",
			tableSchema:       "public",
			tableName:         "user_departments",
			joinColumnSQLName: "user_id",
			joinValues:        []any{testUser1},
			query: `
				query {
					_root(limit: 5) {
						aggregate { count }
					}
				}`,
			expectError: queries.ErrGroupedAggregateLimitOffsetUnsupported,
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

			// Execute and check the data shape too.
			data := execureOperation(t, res.pool, op)

			goldenFileData := filepath.Join("testdata", t.Name()+"_data.json")
			if *updateGolden {
				updateGoldenFile(t, data, goldenFileData)
			}

			var expectedData any
			getData(t, goldenFileData, &expectedData)

			expectedData = normalizeValue(expectedData)
			data = normalizeValue(data)

			if diff := cmp.Diff(expectedData, data, cmpopts.EquateEmpty()); diff != "" {
				t.Errorf("data mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

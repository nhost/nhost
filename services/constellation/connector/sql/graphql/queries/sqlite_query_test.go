package queries_test

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/sqlite"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// testBuildQuerySQLite builds SQL operations using SQLiteDialect and compares
// them against golden files. It does NOT execute the SQL — it loads a SQLite
// schema mirroring the integration Postgres database, introspects it, then
// generates SQL using SQLiteDialect: ? placeholders, json_group_array,
// correlated subqueries instead of LATERAL, IN instead of ANY, etc.
func testBuildQuerySQLite( //nolint:gocognit
	t *testing.T, cases []buildQueryTestCase,
) {
	t.Helper()

	md, err := metadata.FromDetect(t.Context(), "../../../../integration/nhost/metadata/")
	if err != nil {
		t.Fatalf("failed to load metadata: %v", err)
	}

	sqlite.FlattenMetadata(&md.Databases[0])

	ddl, err := os.ReadFile("testdata/sqlite_schema.sql")
	if err != nil {
		t.Fatalf("failed to read sqlite schema: %v", err)
	}

	client := testdb.NewSQLite(t, string(ddl))

	objects, err := client.Introspect(t.Context(), &md.Databases[0])
	if err != nil {
		t.Fatalf("failed to introspect database: %v", err)
	}

	roots, _, err := queries.BuildRoots(objects, &md.Databases[0], &dialect.SQLiteDialect{})
	if err != nil {
		t.Fatalf("failed to build roots: %v", err)
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			doc, gqlErr := parser.ParseQuery(&ast.Source{Input: tc.query.Query})
			if gqlErr != nil {
				t.Fatalf("failed to parse query: %v", gqlErr)
			}

			if len(doc.Operations) == 0 {
				t.Fatal("no operations found in query")
			}

			role := tc.query.Role
			if role == "" {
				role = "admin"
			}

			var (
				diff       string
				operations []core.SQLOperation
			)

			for range 30 {
				operations, err = roots.BuildQuery(
					doc.Operations[0],
					doc.Fragments,
					tc.query.Variables,
					role,
					tc.query.SessionVariables,
				)
				if !errors.Is(err, tc.expectError) {
					t.Fatalf("expected error %v, got %v", tc.expectError, err)
				}

				goldenFileOp := filepath.Join("testdata", t.Name()+".json")
				if *updateGolden {
					updateGoldenFile(t, operations, goldenFileOp)
				}

				var expected []core.SQLOperation
				getData(t, goldenFileOp, &expected)

				normalize(expected)
				normalize(operations)

				diff = cmp.Diff(expected, operations, cmpopts.EquateEmpty())
				if diff == "" {
					break
				}
			}

			if diff != "" {
				t.Errorf("expected (-want +got):\n%s", diff)
			}
		})
	}
}

func TestBuildSelectionSQL_SQLite(t *testing.T) { //nolint:paralleltest
	cases := []buildQueryTestCase{
		{
			name: "simple select",
			query: query{
				Query: `
					query {
						departments {
							id
							name
							budget
						}
					}`,
				Role: "admin",
			},
		},

		{
			name: "relationships",
			query: query{
				Query: `
					query {
						departments {
							id
							name
							employees {
								user_id
								user {
								  defaultRoleByRole {
							   	    role
								  }
								}
							}
						}
					}`,
				Role: "admin",
			},
		},

		{
			name: "simple where clause with _eq",
			query: query{
				Query: `
					query {
						departments(where: {name: {_eq: "Sales"}}) {
							id
							name
						}
					}`,
				Role: "admin",
			},
		},

		{
			name: "where clause with _in",
			query: query{
				Query: `
					query {
						departments(where: {name: {_in: ["Sales", "Marketing", "Engineering"]}}) {
							id
							name
						}
					}`,
				Role: "admin",
			},
		},

		{
			name: "where clause with _and",
			query: query{
				Query: `
					query {
						departments(where: {_and: [{name: {_eq: "Sales"}}, {budget: {_eq: 100000}}]}) {
							id
							name
						}
					}`,
				Role: "admin",
			},
		},

		{
			name: "where clause with variables",
			query: query{
				Query: `
					query($dept_name: String!) {
						departments(where: {name: {_eq: $dept_name}}) {
							id
							name
						}
					}`,
				Role: "admin",
				Variables: map[string]any{
					"dept_name": "Sales",
				},
			},
		},

		{
			name: "relationship with where clause",
			query: query{
				Query: `
					query {
						departments {
							id
							name
							employees(where: {user_id: {_eq: "123e4567-e89b-12d3-a456-426614174000"}}) {
								user_id
							}
						}
					}`,
				Role: "admin",
			},
		},

		{
			name: "order by single column ascending",
			query: query{
				Query: `
					query {
						departments(order_by: {name: asc}) {
							id
							name
						}
					}`,
				Role: "admin",
			},
		},

		{
			name: "order by multiple columns",
			query: query{
				Query: `
					query {
						departments(order_by: [{name: desc}, {created_at: asc}]) {
							id
							name
						}
					}`,
				Role: "admin",
			},
		},

		{
			name: "limit and offset",
			query: query{
				Query: `
					query {
						departments(limit: 10, offset: 5) {
							id
							name
						}
					}`,
				Role: "admin",
			},
		},

		{
			name: "combined where, order by, limit",
			query: query{
				Query: `
					query {
						departments(where: {budget: {_gt: 100000}}, order_by: {budget: desc}, limit: 5) {
							id
							name
							budget
						}
					}`,
				Role: "admin",
			},
		},

		{
			name: "nested query with limit - three levels",
			query: query{
				Query: `query {
					users(limit: 2) {
						id
						displayName
						departments(limit: 3) {
							department {
								id
								name
								files(limit: 5) {
									id
									description
								}
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "departments with aliased employee sets",
			query: query{
				Query: `query {
					departments(limit: 3) {
						id
						name
						activeEmployees: employees(where: {is_active: {_eq: true}}, limit: 10) {
							role
							user {
								id
								displayName
							}
						}
						inactiveEmployees: employees(where: {is_active: {_eq: false}}, limit: 10) {
							role
							user {
								id
								displayName
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "user: simple select",
			query: query{
				Query: `
					query {
						departments {
							id
							name
						}
					}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id":     "550e8400-e29b-41d4-a716-446655440001",
					"x-hasura-departments": "{2db9de0a-b9ba-416e-8619-783a399ae2b3,fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
				},
			},
		},
	}

	testBuildQuerySQLite(t, cases)
}

func TestAggregateBuildQuery_SQLite(t *testing.T) { //nolint:paralleltest
	cases := []buildQueryTestCase{
		{
			name: "count only",
			query: query{
				Query: `
					query {
						departments_aggregate {
							aggregate {
								count
							}
						}
					}`,
			},
		},
		{
			name: "count with nodes",
			query: query{
				Query: `
					query {
						departments_aggregate(limit: 5) {
							aggregate {
								count
							}
							nodes {
								id
								name
							}
						}
					}`,
			},
		},
		{
			name: "sum aggregate",
			query: query{
				Query: `
					query {
						departments_aggregate {
							aggregate {
								sum {
									budget
								}
							}
						}
					}`,
			},
		},
		{
			name: "multiple aggregate functions",
			query: query{
				Query: `
					query {
						departments_aggregate {
							aggregate {
								count
								sum {
									budget
								}
								avg {
									budget
								}
								max {
									budget
								}
								min {
									budget
								}
								stddev {
									budget
								}
								stddev_pop {
									budget
								}
								stddev_samp {
									budget
								}
								variance {
									budget
								}
								var_pop {
									budget
								}
								var_samp {
									budget
								}
							}
						}
					}`,
			},
		},
		{
			name: "aggregate with WHERE clause",
			query: query{
				Query: `
					query {
						departments_aggregate(where: {budget: {_gt: 1000}}) {
							aggregate {
								count
							}
						}
					}`,
			},
		},
		{
			name: "nested",
			query: query{
				Query: `
				{
				  departments {
				    name
					files_aggregate {
					  aggregate {
					    count
					  }
					}
				  }
				}`,
			},
		},
	}

	testBuildQuerySQLite(t, cases)
}

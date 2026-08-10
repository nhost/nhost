package integration_test

import (
	"testing"
)

func TestQueryAggregates(t *testing.T) { //nolint:paralleltest,maintidx
	ReinitializeTestData(t)

	cases := []TestCase{
		{
			name: "count only",
			query: query{
				Query: `query {
					departments_aggregate {
						aggregate {
							count
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "count with column",
			query: query{
				Query: `query {
					departments_aggregate {
						aggregate {
							count(columns: [id])
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "count with nullable column",
			query: query{
				Query: `query {
					departments_aggregate {
						aggregate {
							count(columns: [budget])
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "count distinct single column",
			query: query{
				Query: `query {
					user_departments_aggregate {
						aggregate {
							count(columns: [role], distinct: true)
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "count distinct multiple columns",
			query: query{
				Query: `query {
					user_departments_aggregate {
						aggregate {
							count(columns: [role, is_active], distinct: true)
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "count columns via variable",
			query: query{
				Query: `query Q($cols: [user_departments_select_column!], $d: Boolean) {
					user_departments_aggregate {
						aggregate {
							count(columns: $cols, distinct: $d)
						}
					}
				}`,
				Variables: map[string]any{
					"cols": []any{"role"},
					"d":    true,
				},
				Role: "admin",
			},
		},
		{
			name: "aggregate aliases at every scope",
			query: query{
				Query: `query {
					depts: departments_aggregate(order_by: {name: asc}, limit: 3) {
						summary: aggregate {
							total: count
							distinct_ids: count(columns: [id], distinct: true)
							budget_total: sum {
								amount: budget
							}
						}
						extremes: aggregate {
							budget_high: max {
								value: budget
							}
						}
						rows: nodes {
							dept_id: id
							label: name
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "sum aggregate",
			query: query{
				Query: `query {
					departments_aggregate {
						aggregate {
							sum {
								budget
							}
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "avg aggregate",
			query: query{
				Query: `query {
					departments_aggregate {
						aggregate {
							avg {
								budget
							}
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "max aggregate",
			query: query{
				Query: `query {
					departments_aggregate {
						aggregate {
							max {
								budget
							}
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "min aggregate",
			query: query{
				Query: `query {
					departments_aggregate {
						aggregate {
							min {
								budget
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Combined aggregates
		{
			name: "multiple aggregate functions",
			query: query{
				Query: `query {
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
				Role: "admin",
			},
		},

		// Aggregates with nodes
		{
			name: "count with nodes",
			query: query{
				Query: `query {
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
				Role: "admin",
			},
		},
		{
			name: "aggregates with nodes",
			query: query{
				Query: `query {
					departments_aggregate(limit: 3) {
						aggregate {
							count
							sum {
								budget
							}
							avg {
								budget
							}
						}
						nodes {
							id
							name
							budget
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Aggregates with WHERE clause
		{
			name: "aggregate with WHERE",
			query: query{
				Query: `query {
					departments_aggregate(where: {budget: {_gt: 1000}}) {
						aggregate {
							count
							avg {
								budget
							}
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "aggregate with complex WHERE",
			query: query{
				Query: `query {
					departments_aggregate(
						where: {
							_and: [
								{budget: {_gte: 500}},
								{budget: {_lte: 5000}}
							]
						}
					) {
						aggregate {
							count
							sum {
								budget
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Aggregates with WHERE and nodes
		{
			name: "aggregate with WHERE and nodes",
			query: query{
				Query: `query {
					departments_aggregate(
						where: {budget: {_gte: 500}},
						limit: 5
					) {
						aggregate {
							count
							avg {
								budget
							}
						}
						nodes {
							id
							name
							budget
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Aggregates with ORDER BY and LIMIT in nodes
		{
			name: "aggregate with ORDER BY and LIMIT in nodes",
			query: query{
				Query: `query {
					departments_aggregate(
						order_by: {budget: desc},
						limit: 3
					) {
						aggregate {
							count
							max {
								budget
							}
							min {
								budget
							}
						}
						nodes {
							id
							name
							budget
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Aggregates with OFFSET
		{
			name: "aggregate with OFFSET",
			query: query{
				Query: `query {
					departments_aggregate(
						order_by: {name: asc},
						limit: 5,
						offset: 2
					) {
						aggregate {
							count
						}
						nodes {
							id
							name
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Nodes only (no aggregate fields)
		{
			name: "nodes only without aggregate fields",
			query: query{
				Query: `query {
					departments_aggregate(limit: 3) {
						nodes {
							id
							name
							budget
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Aggregate with distinct_on
		{
			name: "aggregate with distinct_on",
			query: query{
				Query: `query {
					usersAggregate(
						distinct_on: defaultRole,
						order_by: {defaultRole: asc},
						limit: 10
					) {
						aggregate {
							count
						}
						nodes {
							id
							displayName
							defaultRole
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Multiple columns in aggregates
		{
			name: "multiple columns in min",
			query: query{
				Query: `{
				  departments_aggregate {
					aggregate {
					  min {
						budget
						created_at
					  }
					}
				  }
				}
				`,
				Role: "admin",
			},
		},

		// Aggregates with variables
		{
			name: "aggregate with variables in WHERE",
			query: query{
				Query: `query($minBudget: numeric!) {
					departments_aggregate(where: {budget: {_gte: $minBudget}}) {
						aggregate {
							count
							avg {
								budget
							}
						}
					}
				}`,
				Variables: map[string]any{
					"minBudget": 1000,
				},
				Role: "admin",
			},
		},
		{
			name: "aggregate with variables in limit and offset",
			query: query{
				Query: `query($limit: Int!, $offset: Int!) {
					departments_aggregate(
						limit: $limit,
						offset: $offset,
						order_by: {name: asc}
					) {
						aggregate {
							count
						}
						nodes {
							id
							name
						}
					}
				}`,
				Variables: map[string]any{
					"limit":  3,
					"offset": 1,
				},
				Role: "admin",
			},
		},

		// Edge cases
		{
			name: "empty result set with filters",
			query: query{
				Query: `query {
					departments_aggregate(where: {name: {_eq: "NonexistentDepartment"}}) {
						aggregate {
							count
							sum {
								budget
							}
						}
						nodes {
							id
							name
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "limit 0 on nodes",
			query: query{
				Query: `query {
					departments_aggregate(limit: 0) {
						aggregate {
							count
						}
						nodes {
							id
							name
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "nested",
			query: query{
				Query: `query {
				  departments {
					name
					files_aggregate {
					  aggregate {
						count
					  }
					}
				  }
				}`,
				Role: "admin",
			},
		},

		{
			name: "permissions: simple",
			query: query{
				Query: `query {
					departments_aggregate {
						aggregate {
							count
						}
						nodes {
							id
							name
						}
					}
				}`,
				Role: "user",
				SessionVariables: map[string]string{
					"user-id":     "550e8400-e29b-41d4-a716-446655440001",
					"departments": `{"2db9de0a-b9ba-416e-8619-783a399ae2b3","fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
				},
			},
		},

		{
			name: "permissions: nested",
			query: query{
				Query: `query {
					departments {
						files_aggregate {
							aggregate {
							    count
						    }
						}
					}
				}`,
				Role: "user",
				SessionVariables: map[string]string{
					"user-id":     "550e8400-e29b-41d4-a716-446655440001",
					"departments": `{"2db9de0a-b9ba-416e-8619-783a399ae2b3","fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
				},
			},
		},

		{
			name: "permissions: nested with filter",
			query: query{
				Query: `query {
					departments {
						files_aggregate(where: {file: {bucketId: {_eq: "default"}}}) {
							aggregate {
							    count
						    }
							nodes {
								file {
									id
								}
							}
						}
					}
				}`,
				Role: "user",
				SessionVariables: map[string]string{
					"user-id":     "550e8400-e29b-41d4-a716-446655440001",
					"departments": `{"2db9de0a-b9ba-416e-8619-783a399ae2b3","fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
				},
			},
		},

		{
			name: "nested aggregate",
			query: query{
				Query: `{
					  departments_aggregate {
						aggregate {
						  count
						}
						nodes {
						  files_aggregate {
							aggregate {
							  count
							}
							nodes {
							  file {
								name
							  }
							}
						  }
						  employees_aggregate {
							aggregate {
							  count
							}
							nodes {
							  user {
								displayName
							  }
							}
						  }
						}
						nodes {
						  name
						}
					  }
					}`,
				Role:             "admin",
				SessionVariables: map[string]string{},
			},
		},

		{
			name: "aggregate with fragment in aggregate fields",
			query: query{
				Query: `
					fragment AggFields on departments_aggregate_fields {
						sum {
							budget
						}
						avg {
							budget
						}
					}

					query {
						departments_aggregate {
							aggregate {
								count
								...AggFields
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
			name: "aggregate with fragment in nodes",
			query: query{
				Query: `
					fragment DeptFields on departments {
						id
						name
						budget
					}

					query {
						departments_aggregate(limit: 5) {
							aggregate {
								count
							}
							nodes {
								...DeptFields
							}
						}
					}`,
			},
		},

		{
			name: "aggregate with inline fragment",
			query: query{
				Query: `
					query {
						departments_aggregate {
							aggregate {
								count
								... {
									sum {
										budget
									}
								}
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
			name: "aggregate with multiple fragments merged",
			query: query{
				Query: `
					fragment AggCount on departments_aggregate_fields {
						count
					}

					fragment AggSum on departments_aggregate_fields {
						sum {
							budget
						}
					}

					query {
						departments_aggregate {
							aggregate {
								...AggCount
								...AggSum
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
			name: "nested aggregate with fragments",
			query: query{
				Query: `
					fragment FileAggFields on department_files_aggregate_fields {
						count
					}

					fragment EmpAggFields on user_departments_aggregate_fields {
						count
					}

					fragment DeptNodeFields on departments {
						name
					}

					query {
						departments_aggregate {
							aggregate {
								count
							}
							nodes {
								files_aggregate {
									aggregate {
										...FileAggFields
									}
									nodes {
										file {
											name
										}
									}
								}
								employees_aggregate {
									aggregate {
										...EmpAggFields
									}
									nodes {
										user {
											displayName
										}
									}
								}
								...DeptNodeFields
							}
						}
					}`,
				Role: "admin",
			},
		},

		{
			name: "aggregate with duplicate fields via fragments (merging)",
			query: query{
				Query: `
					fragment NodesFields1 on departments {
						id
						name
					}

					fragment NodesFields2 on departments {
						budget
					}

					query {
						departments_aggregate(limit: 3) {
							aggregate {
								count
							}
							nodes {
								...NodesFields1
							}
							nodes {
								...NodesFields2
							}
						}
					}`,
			},
		},
	}

	RunGraphQLTests(t, cases, TestConfig{
		IsMutation: false,
	})
}

func TestQueryAggregateBoolExpFilter(t *testing.T) { //nolint:paralleltest
	ReinitializeTestData(t)

	cases := []TestCase{
		{
			name: "count predicate filters parents",
			query: query{
				Query: `query {
					departments(order_by: {name: asc}, where: {
						employees_aggregate: {count: {predicate: {_gt: 7}}}
					}) {
						name
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "count predicate equality",
			query: query{
				Query: `query {
					departments(order_by: {name: asc}, where: {
						employees_aggregate: {count: {predicate: {_eq: 8}}}
					}) {
						name
					}
				}`,
				Role: "admin",
			},
		},
		{
			// The filter sub-clause must actually trim the counted rows: role
			// splits the seed (each department has one manager row), so
			// filtering to members lowers every department's distinct-user count
			// by one and changes which departments clear the _gte: 8 predicate.
			// An all-matching filter would leave the count untouched and never
			// exercise this branch.
			name: "count with arguments, distinct and filter",
			query: query{
				Query: `query {
					departments(order_by: {name: asc}, where: {
						employees_aggregate: {count: {
							arguments: [user_id]
							distinct: true
							predicate: {_gte: 8}
							filter: {role: {_eq: member}}
						}}
					}) {
						name
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "bool_and predicate",
			query: query{
				Query: `query {
					departments(order_by: {name: asc}, where: {
						employees_aggregate: {bool_and: {arguments: is_active, predicate: {_eq: true}}}
					}) {
						name
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "bool_or predicate",
			query: query{
				Query: `query {
					departments(order_by: {name: asc}, where: {
						employees_aggregate: {bool_or: {arguments: is_active, predicate: {_eq: false}}}
					}) {
						name
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "combined with scalar where",
			query: query{
				Query: `query {
					departments(order_by: {name: asc}, where: {
						budget: {_gt: 0}
						employees_aggregate: {count: {predicate: {_lt: 8}}}
					}) {
						name
					}
				}`,
				Role: "admin",
			},
		},
		{
			// Non-admin role: the aggregate subquery must honour the target
			// table's row-level permissions, and the parent's. Verified equal to
			// Hasura, which applies the same permissions.
			name: "user role applies row-level permissions",
			query: query{
				Query: `query {
					departments(order_by: {name: asc}, where: {
						employees_aggregate: {count: {predicate: {_gt: 7}}}
					}) {
						name
					}
				}`,
				Role: "user",
				SessionVariables: map[string]string{
					"user-id":     "550e8400-e29b-41d4-a716-446655440011",
					"departments": "{023d4410-715e-4675-96a5-a58fd50ef33c,24e9b8db-acf8-439f-9d63-7f83de523fb3,fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
				},
			},
		},
	}

	RunGraphQLTests(t, cases, TestConfig{
		IsMutation: false,
	})
}

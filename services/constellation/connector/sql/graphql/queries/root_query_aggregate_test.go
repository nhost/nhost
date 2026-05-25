package queries_test

import (
	"testing"
)

func TestAggregateBuildQuery(t *testing.T) { //nolint:paralleltest,maintidx
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
			name: "avg aggregate",
			query: query{
				Query: `
					query {
						departments_aggregate {
							aggregate {
								avg {
									budget
								}
							}
						}
					}`,
			},
		},
		{
			name: "max aggregate",
			query: query{
				Query: `
					query {
						departments_aggregate {
							aggregate {
								max {
									budget
								}
							}
						}
					}`,
			},
		},
		{
			name: "min aggregate",
			query: query{
				Query: `
					query {
						departments_aggregate {
							aggregate {
								min {
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
			name: "aggregate with nodes and WHERE clause",
			query: query{
				Query: `
					query {
						departments_aggregate(where: {budget: {_gt: 1000}}) {
							aggregate {
								count
								sum {
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
			},
		},
		{
			name: "aggregate with nodes, WHERE, ORDER BY, and LIMIT",
			query: query{
				Query: `
					query {
						departments_aggregate(
							where: {budget: {_gte: 500}},
							order_by: {budget: desc},
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
			},
		},
		{
			name: "aggregate with nodes and OFFSET",
			query: query{
				Query: `
					query {
						departments_aggregate(
							order_by: {name: asc},
							limit: 10,
							offset: 5
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
			},
		},
		{
			name: "aggregate with complex WHERE conditions",
			query: query{
				Query: `
					query {
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
								avg {
									budget
								}
							}
						}
					}`,
			},
		},
		{
			name: "aggregate nodes only (no aggregate fields)",
			query: query{
				Query: `
					query {
						departments_aggregate(limit: 3) {
							nodes {
								id
								name
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
				SessionVariables: map[string]any{
					"x-hasura-user-id":     "550e8400-e29b-41d4-a716-446655440001",
					"x-hasura-departments": "{2db9de0a-b9ba-416e-8619-783a399ae2b3,fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
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
				SessionVariables: map[string]any{
					"x-hasura-user-id":     "550e8400-e29b-41d4-a716-446655440001",
					"x-hasura-departments": "{2db9de0a-b9ba-416e-8619-783a399ae2b3,fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
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
				SessionVariables: map[string]any{
					"x-hasura-user-id":     "550e8400-e29b-41d4-a716-446655440001",
					"x-hasura-departments": "{2db9de0a-b9ba-416e-8619-783a399ae2b3,fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
				},
			},
		},

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
				Role: "admin",
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
			name: "aggregate with __typename at every scope",
			query: query{
				Query: `
					query {
						departments_aggregate {
							__typename
							aggregate {
								__typename
								count
								sum {
									__typename
									budget
								}
								max {
									__typename
									budget
								}
							}
							nodes {
								__typename
								id
							}
						}
					}`,
			},
		},

		{
			name: "aggregate with __typename only",
			query: query{
				Query: `
					query {
						departments_aggregate {
							__typename
						}
					}`,
			},
		},

		{
			name: "aggregate with __typename and aliased",
			query: query{
				Query: `
					query {
						departments_aggregate {
							kind: __typename
							aggregate {
								innerKind: __typename
								count
							}
						}
					}`,
			},
		},

		{
			name: "aggregate with __typename via fragment spread",
			query: query{
				Query: `
					fragment AggTypename on departments_aggregate_fields {
						__typename
					}

					query {
						departments_aggregate {
							aggregate {
								count
								...AggTypename
							}
						}
					}`,
			},
		},

		{
			name: "aggregate with __typename via inline fragment",
			query: query{
				Query: `
					query {
						departments_aggregate {
							aggregate {
								count
								... {
									__typename
								}
							}
						}
					}`,
			},
		},

		{
			name: "aggregate with aliased __typename inside function scope",
			query: query{
				Query: `
					query {
						departments_aggregate {
							aggregate {
								sum {
									kind: __typename
									budget
								}
								max {
									kind: __typename
									budget
								}
							}
						}
					}`,
			},
		},

		{
			name: "aggregate with duplicate __typename at every scope",
			query: query{
				Query: `
					query {
						departments_aggregate {
							__typename
							__typename
							aggregate {
								__typename
								__typename
								count
								sum {
									__typename
									__typename
									budget
								}
							}
						}
					}`,
			},
		},

		{
			name: "aggregate with duplicate __typename via fragments",
			query: query{
				Query: `
					fragment AggTypename1 on departments_aggregate_fields {
						__typename
					}

					fragment AggTypename2 on departments_aggregate_fields {
						__typename
					}

					query {
						departments_aggregate {
							aggregate {
								...AggTypename1
								...AggTypename2
								count
							}
						}
					}`,
			},
		},

		// Nested aggregate relationship reached via relationship.go (which also
		// calls writeQueryAggregateSQL). Verifies __typename emission on the
		// inner aggregate's outer scope, aggregate_fields scope, and
		// max_fields scope — all generated relative to the *related* table's
		// graphqlTypeName (department_files / user_departments), not the
		// parent's. count_only is used for files because department_files has
		// no numeric columns.
		{
			name: "nested aggregate with __typename at every scope",
			query: query{
				Query: `{
					  departments_aggregate {
						aggregate {
						  count
						}
						nodes {
						  __typename
						  files_aggregate {
							__typename
							aggregate {
							  __typename
							  count
							}
						  }
						  employees_aggregate {
							__typename
							aggregate {
							  __typename
							  count
							  max {
								__typename
								role
							  }
							}
							nodes {
							  __typename
							  role
							}
						  }
						}
					  }
					}`,
				Role: "admin",
			},
		},

		// Fragments inside an aggregate-function scope (sum / max) must be
		// expanded the same way they are at the outer and aggregate-fields
		// scopes. Without recursion, __typename and column selections nested
		// inside ...Frag or inline fragments would be silently dropped.
		{
			name: "aggregate with fragments inside function scope",
			query: query{
				Query: `
					fragment SumFields on departments_sum_fields {
						__typename
						budget
					}

					query {
						departments_aggregate {
							aggregate {
								sum {
									...SumFields
								}
								max {
									... {
										__typename
										budget
									}
								}
							}
						}
					}`,
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

	testBuildQuery(t, cases, true)
}

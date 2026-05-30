package integration_test

import (
	"testing"
)

func TestQueryFeatures(t *testing.T) { //nolint:maintidx,paralleltest
	cases := []TestCase{
		// Single object/value syntax tests
		{
			name: "order_by single object syntax",
			query: query{
				Query: `query {
					users(order_by: {displayName: asc}, limit: 5) {
						id
						displayName
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "order_by array syntax",
			query: query{
				Query: `query {
					users(order_by: [{displayName: asc}], limit: 5) {
						id
						displayName
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "distinct_on single enum syntax",
			query: query{
				Query: `query {
					departments(distinct_on: name, order_by: {name: asc}, limit: 5) {
						id
						name
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "distinct_on array syntax",
			query: query{
				Query: `query {
					departments(distinct_on: [name], order_by: [{name: asc}], limit: 5) {
						id
						name
					}
				}`,
				Role: "admin",
			},
		},

		// Hasura rejects negative limit/offset values during query validation with
		// a validation-failed error envelope; compare the full HTTP response so
		// message, extensions.code, and extensions.path cannot drift.
		{
			name: "negative limit validation error",
			query: query{
				Query: `query {
					departments(limit: -1) {
						id
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "negative offset validation error",
			query: query{
				Query: `query {
					departments(offset: -1) {
						id
					}
				}`,
				Role: "admin",
			},
		},

		// Nested queries with limit at multiple levels
		{
			name: "nested query with limit - single level",
			query: query{
				Query: `query {
					users(limit: 3) {
						id
						displayName
						departments(limit: 5) {
							role
							is_active
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "nested query with limit - two levels",
			query: query{
				Query: `query {
					users(limit: 2) {
						id
						displayName
						departments(limit: 3) {
							role
							department {
								id
								name
								budget
							}
						}
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
			name: "nested query with limit - complex path",
			query: query{
				Query: `query {
					departments(limit: 2) {
						id
						name
						files(limit: 3) {
							id
							file {
								id
								name
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Relationship traversal in WHERE clauses
		{
			name: "WHERE with relationship traversal - single level",
			query: query{
				Query: `query {
					departments(where: {employees: {is_active: {_eq: true}}}, limit: 5) {
						id
						name
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "WHERE with relationship traversal - multiple levels",
			query: query{
				Query: `query {
					departments(where: {files: {file: {name: {_eq: "test.pdf"}}}}, limit: 5) {
						id
						name
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "WHERE with relationship and _or",
			query: query{
				Query: `query {
					departments(
						where: {
							_or: [
								{employees: {role: {_eq: manager}}},
								{employees: {role: {_eq: member}}}
							]
						},
						limit: 5
					) {
						id
						name
					}
				}`,
				Role: "admin",
			},
		},

		// Combined: nested relationships with WHERE and LIMIT
		{
			name: "nested with WHERE and LIMIT at each level",
			query: query{
				Query: `query {
					users(
						where: {disabled: {_eq: false}},
						order_by: {displayName: asc},
						limit: 3
					) {
						id
						displayName
						departments(
							where: {is_active: {_eq: true}},
							order_by: {joined_at: desc},
							limit: 5
						) {
							role
							joined_at
							department {
								id
								name
							}
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "nested with filtering on multiple levels",
			query: query{
				Query: `query {
					departments(
						where: {budget: {_gt: 1000}},
						limit: 3
					) {
						id
						name
						budget
						employees(
							where: {is_active: {_eq: true}},
							limit: 5
						) {
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

		// Single value syntax for operators
		{
			name: "_in with single value",
			query: query{
				Query: `query {
					users(where: {defaultRole: {_in: "user"}}, limit: 5) {
						id
						displayName
						defaultRole
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "_in with array",
			query: query{
				Query: `query {
					users(where: {defaultRole: {_in: ["user", "admin"]}}, limit: 5) {
						id
						displayName
						defaultRole
					}
				}`,
				Role: "admin",
			},
		},

		// _and/_or with single object
		{
			name: "_and with single object",
			query: query{
				Query: `query {
					users(
						where: {
							_and: {disabled: {_eq: false}}
						},
						limit: 5
					) {
						id
						displayName
						disabled
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "_and with array",
			query: query{
				Query: `query {
					users(
						where: {
							_and: [
								{disabled: {_eq: false}},
								{emailVerified: {_eq: true}}
							]
						},
						limit: 5
					) {
						id
						displayName
						disabled
						emailVerified
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "_or with single object",
			query: query{
				Query: `query {
					users(
						where: {
							_or: {disabled: {_eq: true}}
						},
						limit: 5
					) {
						id
						displayName
						disabled
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "_or with array",
			query: query{
				Query: `query {
					users(
						where: {
							_or: [
								{disabled: {_eq: true}},
								{emailVerified: {_eq: false}}
							]
						},
						limit: 5
					) {
						id
						displayName
						disabled
						emailVerified
					}
				}`,
				Role: "admin",
			},
		},

		// Complex queries combining all features
		{
			name: "complex: all features combined",
			query: query{
				Query: `query {
					users(
						where: {
							_and: [
								{disabled: {_eq: false}},
								{emailVerified: {_eq: true}}
							]
						},
						order_by: {displayName: asc},
						limit: 2
					) {
						id
						displayName
						email
						roles(
							where: {role: {_in: ["user", "admin"]}},
							order_by: {createdAt: desc},
							limit: 5
						) {
							id
							role
							createdAt
						}
						departments(
							where: {is_active: {_eq: true}},
							order_by: {joined_at: desc},
							limit: 3
						) {
							role
							joined_at
							department {
								id
								name
								employees(
									where: {is_active: {_eq: true}},
									limit: 5
								) {
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
			name: "complex: nested with relationship traversal in WHERE",
			query: query{
				Query: `query {
					files(
						where: {
							department_file: {
								department: {
									name: {_eq: "Engineering"}
								}
							}
						},
						limit: 5
					) {
						id
						name
						bucket {
							id
						}
						department_file {
							id
							department {
								id
								name
								files(limit: 3) {
									id
								}
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Order by with different directions and null handling
		{
			name: "order_by with multiple columns",
			query: query{
				Query: `query {
					departments(
						order_by: [{budget: desc}, {name: asc}],
						limit: 5
					) {
						id
						name
						budget
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "order_by with nulls first",
			query: query{
				Query: `query {
					departments(
						order_by: [{budget: desc_nulls_first}],
						limit: 5
					) {
						id
						name
						budget
					}
				}`,
				Role: "admin",
			},
		},

		// Distinct on with multiple columns
		{
			name: "distinct_on with multiple columns",
			query: query{
				Query: `query {
					departments(
						distinct_on: [name, budget],
						order_by: [{name: asc}, {budget: desc}],
						limit: 5
					) {
						id
						name
						budget
					}
				}`,
				Role: "admin",
			},
		},

		// distinct_on column differs from the leading order_by column. Hasura
		// rejects this at validation with a "validation-failed" error
		// ("distinct_on" columns must match initial "order_by" columns) rather
		// than reconciling; this asserts Constellation returns the same error
		// envelope instead of silently reordering the order_by.
		{
			name: "distinct_on with mismatched order_by",
			query: query{
				Query: `query {
					departments(
						distinct_on: name,
						order_by: {budget: desc}
					) {
						id
						name
						budget
					}
				}`,
				Role: "admin",
			},
		},
		// The top-level aggregate path is generated separately from the collection
		// path above. Diff the full validation error against live Hasura so the
		// message, code, and extensions.path stay parity-pinned.
		{
			name: "distinct_on aggregate with mismatched order_by",
			query: query{
				Query: `query {
					departments_aggregate(
						distinct_on: name,
						order_by: {budget: desc}
					) {
						aggregate {
							count
						}
						nodes {
							id
						}
					}
				}`,
				Role: "admin",
			},
		},
		// distinct_on without any order_by: the distinct columns must still lead
		// a synthesised ORDER BY so row selection / output ordering is
		// deterministic and matches Hasura.
		{
			name: "distinct_on without order_by",
			query: query{
				Query: `query {
					departments(distinct_on: name) {
						id
						name
						budget
					}
				}`,
				Role: "admin",
			},
		},
		// Multi-column distinct_on whose order_by prefix does not match the
		// distinct columns (order_by leads with a non-distinct column). Hasura
		// rejects this at validation; Constellation must return the same
		// "validation-failed" error envelope.
		{
			name: "distinct_on multiple columns with non-matching order_by prefix",
			query: query{
				// order_by leads with createdAt (a non-distinct column); Hasura
				// rejects the request, so the row-determinism tiebreaker only
				// matters for the rendered query, not the (error) result.
				Query: `query {
					users(
						distinct_on: [disabled, emailVerified],
						order_by: [{createdAt: desc}, {id: asc}]
					) {
						id
						disabled
						emailVerified
						displayName
					}
				}`,
				Role: "admin",
			},
		},
		// PostgreSQL and Hasura allow the distinct_on columns to appear in any
		// order within the leading order_by prefix; only non-distinct columns in
		// that prefix are rejected.
		{
			name: "distinct_on multiple columns with permuted order_by prefix",
			query: query{
				Query: `query {
					users(
						distinct_on: [disabled, emailVerified],
						order_by: [{emailVerified: desc}, {disabled: asc}, {id: asc}]
					) {
						id
						disabled
						emailVerified
						displayName
					}
				}`,
				Role: "admin",
			},
		},

		// Nested with all query arguments
		{
			name: "nested with all arguments",
			query: query{
				Query: `query {
					departments(limit: 3) {
						id
						name
						employees(
							distinct_on: role,
							where: {is_active: {_eq: true}},
							order_by: {role: asc},
							limit: 5
						) {
							role
							is_active
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Edge cases
		{
			name: "empty nested results with filters",
			query: query{
				Query: `query {
					users(limit: 5) {
						id
						displayName
						roles(where: {role: {_eq: "nonexistent_role"}}) {
							id
							role
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "limit 0 on nested query",
			query: query{
				Query: `query {
					users(limit: 3) {
						id
						displayName
						roles(limit: 0) {
							id
							role
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Variables support
		{
			name: "order_by with variable",
			query: query{
				Query: `query($orderBy: [users_order_by!]) {
					users(order_by: $orderBy, limit: 5) {
						id
						displayName
					}
				}`,
				Variables: map[string]any{
					"orderBy": []map[string]any{
						{"displayName": "asc"},
					},
				},
				Role: "admin",
			},
		},
		{
			name: "WHERE with variables",
			query: query{
				Query: `query($isActive: Boolean!) {
					departments(
						where: {employees: {is_active: {_eq: $isActive}}},
						limit: 5
					) {
						id
						name
					}
				}`,
				Variables: map[string]any{
					"isActive": true,
				},
				Role: "admin",
			},
		},
		{
			name: "nested with variables at multiple levels",
			query: query{
				Query: `query($userLimit: Int!, $deptLimit: Int!, $disabled: Boolean!) {
					users(
						where: {disabled: {_eq: $disabled}},
						limit: $userLimit
					) {
						id
						displayName
						departments(limit: $deptLimit) {
							role
						}
					}
				}`,
				Variables: map[string]any{
					"userLimit": 3,
					"deptLimit": 5,
					"disabled":  false,
				},
				Role: "admin",
			},
		},
	}

	RunGraphQLTests(t, cases, TestConfig{
		IsMutation: false,
	})
}

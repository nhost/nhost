package integration_test

import (
	"testing"
)

func TestDeleteMutations(t *testing.T) { //nolint:paralleltest,maintidx
	cases := []TestCase{
		// Basic delete operations
		{
			name: "delete with simple WHERE clause",
			query: query{
				Query: `mutation {
					delete_departments(
						where: { name: { _eq: "Temp" } }
					) {
						returning {
							id
							name
							budget
						}
						affected_rows
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "delete without affected_rows",
			query: query{
				Query: `mutation {
					deleteUsers(
						where: { disabled: { _eq: true } }
					) {
						returning {
							id
							displayName
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "delete without returning",
			query: query{
				Query: `mutation {
					deleteUsers(
						where: { disabled: { _eq: true } }
					) {
						affected_rows
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "delete returning only affected_rows",
			query: query{
				Query: `mutation {
					delete_departments(
						where: { budget: { _lt: 10000 } }
					) {
						affected_rows
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "delete with variables",
			query: query{
				Query: `mutation DeleteDept($where: departments_bool_exp!) {
					delete_departments(where: $where) {
						returning {
							id
							name
						}
						affected_rows
					}
				}`,
				Variables: map[string]any{
					"where": map[string]any{
						"name": map[string]any{
							"_eq": "ToDelete",
						},
					},
				},
				Role: "admin",
			},
		},

		// Complex WHERE clauses
		{
			name: "delete with _and WHERE clause",
			query: query{
				Query: `mutation {
					delete_departments(
						where: {
							_and: [
								{ budget: { _lt: 50000 } }
								{ name: { _like: "%Temp%" } }
							]
						}
					) {
						affected_rows
						returning {
							id
							name
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "delete with _or WHERE clause",
			query: query{
				Query: `mutation {
					delete_departments(
						where: {
							_or: [
								{ name: { _eq: "Temp1" } }
								{ name: { _eq: "Temp2" } }
							]
						}
					) {
						affected_rows
						returning {
							id
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "delete with _not condition",
			query: query{
				Query: `mutation {
					delete_departments(
						where: {
							_not: { budget: { _gt: 100000 } }
						}
					) {
						affected_rows
						returning {
							id
							name
							budget
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "delete with _in operator",
			query: query{
				Query: `mutation($ids: [uuid!]!) {
					delete_departments(
						where: { id: { _in: $ids } }
					) {
						affected_rows
						returning {
							id
							name
						}
					}
				}`,
				Variables: map[string]any{
					"ids": []any{
						"00000000-0000-0000-0000-000000000001",
						"00000000-0000-0000-0000-000000000002",
					},
				},
				Role: "admin",
			},
		},

		{
			name: "delete with _nin operator",
			query: query{
				Query: `mutation {
					delete_departments(
						where: { name: { _nin: ["Engineering", "Marketing"] } }
					) {
						affected_rows
						returning {
							id
							name
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "delete with _ilike operator",
			query: query{
				Query: `mutation {
					delete_departments(
						where: { name: { _ilike: "%TEMP%" } }
					) {
						affected_rows
						returning {
							id
							name
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "delete with _gt operator",
			query: query{
				Query: `mutation {
					delete_departments(
						where: { budget: { _gt: 100000 } }
					) {
						affected_rows
						returning {
							id
							name
							budget
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "delete with _lt operator",
			query: query{
				Query: `mutation {
					delete_departments(
						where: { budget: { _lt: 50000 } }
					) {
						affected_rows
						returning {
							id
							name
							budget
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "delete with _is_null operator",
			query: query{
				Query: `mutation {
					delete_departments(
						where: { description: { _is_null: true } }
					) {
						affected_rows
						returning {
							id
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "delete with nested _and and _or",
			query: query{
				Query: `mutation {
					delete_departments(
						where: {
							_and: [
								{
									_or: [
										{ budget: { _lt: 50000 } }
										{ name: { _like: "%Temp%" } }
									]
								}
								{ description: { _is_null: false } }
							]
						}
					) {
						affected_rows
						returning {
							id
							name
							budget
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Edge cases
		{
			name: "delete with empty WHERE clause",
			query: query{
				Query: `mutation {
					delete_departments(
						where: {}
					) {
						affected_rows
						returning {
							id
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "delete with alias",
			query: query{
				Query: `mutation {
					myDelete: delete_departments(
						where: { name: { _eq: "ToDelete" } }
					) {
						affected_rows
					}
				}`,
				Role: "admin",
			},
		},

		// Nested relationships in returning
		{
			name: "delete with nested relationships in returning",
			query: query{
				Query: `mutation {
					delete_departments(
						where: { name: { _eq: "ToDelete" } }
					) {
						affected_rows
						returning {
							id
							name
							employees {
								user_id
								role
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Permission tests
		{
			name: "permissions: delete department (allowed)",
			query: query{
				Query: `mutation {
					delete_departments(
						where: { id: { _eq: "2db9de0a-b9ba-416e-8619-783a399ae2b3" } }
					) {
						affected_rows
						returning {
							id
							name
						}
					}
				}`,
				Role: "user",
				SessionVariables: map[string]string{
					"user-id":            "550e8400-e29b-41d4-a716-446655440001",
					"department-manager": `{"2db9de0a-b9ba-416e-8619-783a399ae2b3"}`,
				},
			},
		},

		{
			name: "permissions: delete department (denied - not manager)",
			query: query{
				Query: `mutation {
					delete_departments(
						where: { id: { _eq: "2db9de0a-b9ba-416e-8619-783a399ae2b3" } }
					) {
						affected_rows
						returning {
							id
							name
						}
					}
				}`,
				Role: "user",
				SessionVariables: map[string]string{
					"user-id":            "550e8400-e29b-41d4-a716-446655440001",
					"department-manager": `{"fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
				},
			},
		},
	}

	RunGraphQLTests(t, cases, TestConfig{
		IsMutation:           true,
		ReinitBetweenQueries: true,
	})
}

// TestDeleteReturningRelationships verifies that delete mutations return real
// relationship data in `returning` rather than hardcoded empty arrays. An
// OBJECT relationship must serialise as a single object/null — never `[]` — and
// must return the related (non-deleted) parent row, matching Hasura; this is the
// case the old empty-array stub got wrong (wrong JSON shape). See INCON_HIGH_3.
//
// DIVERGENCE: a delete that cascade-deletes an array relationship's rows
// intentionally differs from Hasura. Deleting a parent makes Constellation
// return the about-to-be-cascade-deleted child rows in `returning` — the
// relationship LATERAL join reads the pre-delete MVCC snapshot within the single
// statement — whereas Hasura resolves the relationship post-cascade and returns
// []. This is a documented known difference (KNOWN_DIFFERENCES.md,
// "Relationships in delete returning"), so the two cascade cases below assert
// Constellation's behaviour via a fixed expected response instead of diffing
// against Hasura; order_by + limit keep the asserted row deterministic. All array
// relationships in this schema use ON DELETE CASCADE foreign keys, so a
// non-cascade array relationship returning surviving rows is not expressible here.
func TestDeleteReturningRelationships(t *testing.T) { //nolint:paralleltest
	cases := []TestCase{
		{
			// Deleting a user_departments join row returns its `department` and
			// `user` object relationships — the parent rows, which are NOT
			// deleted. Each must be a single object, never an array.
			name: "delete returning object relationships (department, user)",
			query: query{
				Query: `mutation {
					delete_user_departments(
						where: {
							user_id: { _eq: "550e8400-e29b-41d4-a716-446655440001" }
							department_id: { _eq: "2db9de0a-b9ba-416e-8619-783a399ae2b3" }
						}
					) {
						affected_rows
						returning {
							role
							department {
								id
								name
							}
							user {
								id
								email
							}
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			// Cascade DIVERGENCE (collection delete path, selection.WriteSQL):
			// deleting a department cascade-deletes its user_departments rows, but
			// the `employees` relationship still resolves to them in Constellation
			// (pre-cascade snapshot). Hasura returns employees: []. Asserted via a
			// fixed expected response (see the function doc / KNOWN_DIFFERENCES.md).
			name: "delete returning cascade array relationship (collection) returns pre-cascade rows",
			query: query{
				Query: `mutation {
					delete_departments(
						where: { id: { _eq: "2db9de0a-b9ba-416e-8619-783a399ae2b3" } }
					) {
						affected_rows
						returning {
							id
							name
							employees(order_by: { user_id: asc }, limit: 1) {
								user_id
								role
							}
						}
					}
				}`,
				Role: "admin",
			},
			expected: map[string]any{
				"data": map[string]any{
					"delete_departments": map[string]any{
						"affected_rows": float64(1),
						"returning": []any{
							map[string]any{
								"id":   "2db9de0a-b9ba-416e-8619-783a399ae2b3",
								"name": "Human Resources",
								"employees": []any{
									map[string]any{
										"user_id": "550e8400-e29b-41d4-a716-446655440001",
										"role":    "manager",
									},
								},
							},
						},
					},
				},
			},
		},
		{
			// Same cascade DIVERGENCE via the delete_by_pk path (buildFinalSelect).
			name: "delete_by_pk returning cascade array relationship returns pre-cascade rows",
			query: query{
				Query: `mutation {
					delete_departments_by_pk(id: "2db9de0a-b9ba-416e-8619-783a399ae2b3") {
						id
						name
						employees(order_by: { user_id: asc }, limit: 1) {
							user_id
							role
						}
					}
				}`,
				Role: "admin",
			},
			expected: map[string]any{
				"data": map[string]any{
					"delete_departments_by_pk": map[string]any{
						"id":   "2db9de0a-b9ba-416e-8619-783a399ae2b3",
						"name": "Human Resources",
						"employees": []any{
							map[string]any{
								"user_id": "550e8400-e29b-41d4-a716-446655440001",
								"role":    "manager",
							},
						},
					},
				},
			},
		},
	}

	RunGraphQLTests(t, cases, TestConfig{
		IsMutation:           true,
		ReinitBetweenQueries: true,
	})
}

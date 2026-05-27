package queries_test

import (
	"testing"
)

func TestBuildMutationDeleteSQL(t *testing.T) { //nolint:paralleltest,maintidx
	cases := []buildQueryTestCase{
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
						where: { id: { _eq: "550e8400-e29b-41d4-a716-446655440054" } }
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
						where: { id: { _eq: "550e8400-e29b-41d4-a716-446655440054" } }
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
				SessionVariables: map[string]any{
					"x-hasura-user-id":            "550e8400-e29b-41d4-a716-446655440001",
					"x-hasura-department-manager": "{2db9de0a-b9ba-416e-8619-783a399ae2b3}",
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
				SessionVariables: map[string]any{
					"x-hasura-user-id":            "550e8400-e29b-41d4-a716-446655440001",
					"x-hasura-department-manager": "{fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
				},
			},
		},
	}

	testBuildQuery(t, cases, false)
}

package queries_test

import (
	"testing"
)

func TestBuildMutationUpdateManySQL(t *testing.T) { //nolint:paralleltest,maintidx
	cases := []buildQueryTestCase{
		// Basic update_many operations
		{
			name: "update_many with single update object (not array)",
			query: query{
				Query: `mutation {
					update_departments_many(
						updates: {
							where: { name: { _eq: "Engineering" } }
							_set: { budget: 200000 }
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
			name: "update_many with two updates",
			query: query{
				Query: `mutation {
					update_departments_many(
						updates: [
							{
								where: { name: { _eq: "Engineering" } }
								_set: { budget: 200000 }
							},
							{
								where: { name: { _eq: "Sales" } }
								_set: { budget: 150000 }
							}
						]
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
			name: "update_many with two updates (one matching no rows)",
			query: query{
				Query: `mutation {
					update_departments_many(
						updates: [
							{
								where: { id: { _eq: "2db9de0a-b9ba-416e-8619-783a399ae2b3" } }
								_set: { name: "HR Department" }
							},
							{
								where: { id: { _eq: "a7e1c8f0-5a3b-4d2e-9f8c-1b4a5c6d7e8f" } }
								_set: { name: "IT Department", budget: 120000 }
							}
						]
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
			name: "update_many with variables",
			query: query{
				Query: `mutation UpdateMany($updates: [departments_updates!]!) {
					update_departments_many(updates: $updates) {
						affected_rows
						returning {
							id
							name
							budget
						}
					}
				}`,
				Variables: map[string]any{
					"updates": []map[string]any{
						{
							"where": map[string]any{
								"name": map[string]any{"_eq": "Engineering"},
							},
							"_set": map[string]any{
								"budget": 250000,
							},
						},
						{
							"where": map[string]any{
								"budget": map[string]any{"_lt": 50000},
							},
							"_set": map[string]any{
								"budget": 75000,
							},
						},
					},
				},
				Role: "admin",
			},
		},

		{
			name: "update_many returning only affected_rows",
			query: query{
				Query: `mutation {
					update_departments_many(
						updates: [
							{
								where: { name: { _like: "%Eng%" } }
								_set: { budget: 100000 }
							}
						]
					) {
						affected_rows
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "update_many with three updates",
			query: query{
				Query: `mutation {
					update_departments_many(
						updates: [
							{
								where: { name: { _eq: "Engineering" } }
								_set: { description: "Eng Dept" }
							},
							{
								where: { name: { _eq: "Sales" } }
								_set: { description: "Sales Dept" }
							},
							{
								where: { name: { _eq: "Marketing" } }
								_set: { description: "Marketing Dept" }
							}
						]
					) {
						affected_rows
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "update_many with _inc",
			query: query{
				Query: `mutation {
					update_departments_many(
						updates: [
							{
								where: { name: { _eq: "Engineering" } }
								_inc: { budget: 10000 }
							},
							{
								where: { name: { _eq: "Sales" } }
								_inc: { budget: -5000 }
							}
						]
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
			name: "update_many with _set and _inc combined",
			query: query{
				Query: `mutation {
					update_departments_many(
						updates: [
							{
								where: { name: { _eq: "Engineering" } }
								_set: { description: "Updated Engineering" }
								_inc: { budget: 20000 }
							}
						]
					) {
						affected_rows
						returning {
							id
							name
							description
							budget
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "update_many with complex where",
			query: query{
				Query: `mutation {
					update_departments_many(
						updates: [
							{
								where: {
									_and: [
										{ budget: { _gte: 250000 } }
										{ budget: { _lte: 400000 } }
									]
								}
								_set: { description: "Mid-sized department" }
							}
						]
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
			name: "update_many with empty where",
			query: query{
				Query: `mutation {
					update_departments_many(
						updates: [
							{
								where: {}
								_set: { description: "All departments" }
							}
						]
					) {
						affected_rows
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "update_many with single update",
			query: query{
				Query: `mutation {
					update_departments_many(
						updates: [
							{
								where: { name: { _eq: "Engineering" } }
								_set: { budget: 300000 }
							}
						]
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
			name: "update_many with nested relationships in returning",
			query: query{
				Query: `mutation {
					update_departments_many(
						updates: [
							{
								where: { id: { _eq: "2db9de0a-b9ba-416e-8619-783a399ae2b3" } }
								_set: { description: "Updated department" }
							}
						]
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

		{
			name: "update_many with alias",
			query: query{
				Query: `mutation {
					myUpdates: update_departments_many(
						updates: [
							{
								where: { name: { _eq: "Engineering" } }
								_set: { budget: 500000 }
							}
						]
					) {
						affected_rows
					}
				}`,
				Role: "admin",
			},
		},

		// Permission tests
		{
			name: "permissions: update_many (allowed)",
			query: query{
				Query: `mutation {
					update_departments_many(
						updates: [
							{
								where: { id: { _eq: "2db9de0a-b9ba-416e-8619-783a399ae2b3" } }
								_set: { description: "Updated by manager" }
							}
						]
					) {
						affected_rows
						returning {
							id
							name
							description
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
			name: "permissions: update_many (denied)",
			query: query{
				Query: `mutation {
					update_departments_many(
						updates: [
							{
								where: { id: { _eq: "2db9de0a-b9ba-416e-8619-783a399ae2b3" } }
								_set: { description: "Should not update" }
							}
						]
					) {
						affected_rows
						returning {
							id
							name
							description
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

		{
			name: "permissions: update_many multiple with mixed access",
			query: query{
				Query: `mutation {
					update_departments_many(
						updates: [
							{
								where: { id: { _eq: "2db9de0a-b9ba-416e-8619-783a399ae2b3" } }
								_set: { description: "First update" }
							},
							{
								where: { id: { _eq: "fd1e6bba-c292-4b2f-872e-ae16146cdd82" } }
								_set: { description: "Second update" }
							}
						]
					) {
						affected_rows
						returning {
							id
							description
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

		// update_many against a table whose update permission has a non-empty
		// "check" (users: check {id _eq x-hasura-user-id}). Confirms each
		// per-update CTE on the update_many path carries the post-update check.
		{
			name: "permissions: update_many own user with check (allowed)",
			query: query{
				Query: `mutation {
					update_users_many(
						updates: [
							{
								where: { id: { _eq: "550e8400-e29b-41d4-a716-446655440001" } }
								_set: { displayName: "Renamed Self" }
							}
						]
					) {
						affected_rows
						returning {
							id
							displayName
						}
					}
				}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},
	}

	testBuildQuery(t, cases, false)
}

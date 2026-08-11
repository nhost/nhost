package integration_test

import (
	"testing"
)

func TestUpdateByPkMutations(t *testing.T) { //nolint:paralleltest
	cases := []TestCase{
		// Basic update_by_pk operations
		{
			name: "basic update_by_pk with _set",
			query: query{
				Query: `mutation {
					update_departments_by_pk(
						pk_columns: { id: "2db9de0a-b9ba-416e-8619-783a399ae2b3" }
						_set: { name: "Engineering Team" }
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
			name: "update_by_pk with _inc",
			query: query{
				Query: `mutation {
					update_departments_by_pk(
						pk_columns: { id: "2db9de0a-b9ba-416e-8619-783a399ae2b3" }
						_inc: { budget: 10000 }
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
			name: "update_by_pk with both _set and _inc",
			query: query{
				Query: `mutation {
					update_departments_by_pk(
						pk_columns: { id: "2db9de0a-b9ba-416e-8619-783a399ae2b3" }
						_set: { description: "Updated description" }
						_inc: { budget: 5000 }
					) {
						id
						name
						description
						budget
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "update_by_pk with variables for pk_columns",
			query: query{
				Query: `mutation UpdateDept($pk: departments_pk_columns_input!, $set: departments_set_input!) {
					update_departments_by_pk(
						pk_columns: $pk
						_set: $set
					) {
						id
						name
						budget
					}
				}`,
				Variables: map[string]any{
					"pk": map[string]any{
						"id": "2db9de0a-b9ba-416e-8619-783a399ae2b3",
					},
					"set": map[string]any{
						"name": "Sales Team",
					},
				},
				Role: "admin",
			},
		},

		{
			name: "update_by_pk with variables for _inc",
			query: query{
				Query: `mutation UpdateDept($pk: departments_pk_columns_input!, $inc: departments_inc_input!) {
					update_departments_by_pk(
						pk_columns: $pk
						_inc: $inc
					) {
						id
						name
						budget
					}
				}`,
				Variables: map[string]any{
					"pk": map[string]any{
						"id": "2db9de0a-b9ba-416e-8619-783a399ae2b3",
					},
					"inc": map[string]any{
						"budget": 15000,
					},
				},
				Role: "admin",
			},
		},

		{
			name: "update_by_pk with scalar variable inside pk_columns",
			query: query{
				Query: `mutation UpdateDept($id: uuid!, $set: departments_set_input!) {
					update_departments_by_pk(
						pk_columns: { id: $id }
						_set: $set
					) {
						id
						name
						budget
					}
				}`,
				Variables: map[string]any{
					"id": "2db9de0a-b9ba-416e-8619-783a399ae2b3",
					"set": map[string]any{
						"name": "Updated Name",
					},
				},
				Role: "admin",
			},
		},

		{
			name: "update_by_pk nonexistent record",
			query: query{
				Query: `mutation {
					update_departments_by_pk(
						pk_columns: { id: "00000000-0000-0000-0000-000000000000" }
						_set: { name: "Should Not Exist" }
					) {
						id
						name
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "update_by_pk with alias",
			query: query{
				Query: `mutation {
					myUpdate: update_departments_by_pk(
						pk_columns: { id: "2db9de0a-b9ba-416e-8619-783a399ae2b3" }
						_set: { name: "HR Team" }
					) {
						id
						name
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "update_by_pk returning multiple fields",
			query: query{
				Query: `mutation {
					update_departments_by_pk(
						pk_columns: { id: "2db9de0a-b9ba-416e-8619-783a399ae2b3" }
						_set: { description: "Full description" }
					) {
						id
						name
						description
						budget
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "update_by_pk with null value in _set",
			query: query{
				Query: `mutation {
					update_departments_by_pk(
						pk_columns: { id: "2db9de0a-b9ba-416e-8619-783a399ae2b3" }
						_set: { description: null }
					) {
						id
						name
						description
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "update_by_pk with negative _inc (decrement)",
			query: query{
				Query: `mutation {
					update_departments_by_pk(
						pk_columns: { id: "2db9de0a-b9ba-416e-8619-783a399ae2b3" }
						_inc: { budget: -5000 }
					) {
						id
						budget
					}
				}`,
				Role: "admin",
			},
		},

		// Nested relationships
		{
			name: "update_by_pk with nested relationships in selection",
			query: query{
				Query: `mutation {
					update_departments_by_pk(
						pk_columns: { id: "2db9de0a-b9ba-416e-8619-783a399ae2b3" }
						_set: { description: "Updated" }
					) {
						id
						name
						employees {
							user_id
							role
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Permission tests
		{
			name: "permissions: update_by_pk (allowed)",
			query: query{
				Query: `mutation {
					update_departments_by_pk(
						pk_columns: { id: "2db9de0a-b9ba-416e-8619-783a399ae2b3" }
						_set: { description: "Updated by manager" }
					) {
						id
						name
						description
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
			name: "permissions: update_by_pk (denied - not manager)",
			query: query{
				Query: `mutation {
					update_departments_by_pk(
						pk_columns: { id: "2db9de0a-b9ba-416e-8619-783a399ae2b3" }
						_set: { description: "Should not update" }
					) {
						id
						name
						description
					}
				}`,
				Role: "user",
				SessionVariables: map[string]string{
					"user-id":            "550e8400-e29b-41d4-a716-446655440001",
					"department-manager": `{"fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
				},
			},
		},

		{
			name: "permissions: update_by_pk with _inc (allowed)",
			query: query{
				Query: `mutation {
					update_departments_by_pk(
						pk_columns: { id: "2db9de0a-b9ba-416e-8619-783a399ae2b3" }
						_inc: { budget: 1000 }
					) {
						id
						name
						budget
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
			name: "permissions: update_by_pk with _inc (denied)",
			query: query{
				Query: `mutation {
					update_departments_by_pk(
						pk_columns: { id: "2db9de0a-b9ba-416e-8619-783a399ae2b3" }
						_inc: { budget: 1000 }
					) {
						id
						name
						budget
					}
				}`,
				Role: "user",
				SessionVariables: map[string]string{
					"user-id":            "550e8400-e29b-41d4-a716-446655440001",
					"department-manager": `{"fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
				},
			},
		},

		// presets
		{
			name: "update_by_pk with preset from session variable",
			query: query{
				Query: `mutation {
					updateFile(
						pk_columns: { id: "22222222-2222-2222-2222-222222222222" }
						_set: { name: "renamed-by-pk.txt" }
					) {
						id
						name
						uploadedByUserId
					}
				}`,
				Role: "user",
				SessionVariables: map[string]string{
					"user-id": "550e8400-e29b-41d4-a716-446655440002",
				},
			},
		},

		{
			name: "update_by_pk with preset only from session variable",
			query: query{
				Query: `mutation {
					updateFile(
						pk_columns: { id: "f1e9b8db-2222-439f-9d63-7f83de523fb2" }
					) {
						id
						uploadedByUserId
					}
				}`,
				Role: "user",
				SessionVariables: map[string]string{
					"user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},
	}

	RunGraphQLTests(t, cases, TestConfig{
		IsMutation:           true,
		ReinitBetweenQueries: true,
	})
}

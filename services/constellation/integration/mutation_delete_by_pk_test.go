package integration_test

import (
	"testing"
)

func TestDeleteByPkMutations(t *testing.T) { //nolint:paralleltest
	cases := []TestCase{
		// Basic delete_by_pk operations
		{
			name: "basic delete_by_pk",
			query: query{
				Query: `mutation {
					delete_departments_by_pk(
						id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
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
			name: "delete_by_pk with scalar variable inside pk_columns",
			query: query{
				Query: `mutation DeleteDept($id: uuid!) {
					delete_departments_by_pk(
						id: $id
					) {
						id
						name
						budget
					}
				}`,
				Variables: map[string]any{
					"id": "2db9de0a-b9ba-416e-8619-783a399ae2b3",
				},
				Role: "admin",
			},
		},

		{
			name: "delete_by_pk with alias",
			query: query{
				Query: `mutation {
					myDelete: delete_departments_by_pk(
						id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
					) {
						id
						name
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "delete_by_pk returning multiple fields",
			query: query{
				Query: `mutation {
					delete_departments_by_pk(
						id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
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
			name: "delete_by_pk nonexistent record",
			query: query{
				Query: `mutation {
					delete_departments_by_pk(
						id: "00000000-0000-0000-0000-000000000000"
					) {
						id
						name
					}
				}`,
				Role: "admin",
			},
		},

		// Nested relationships
		{
			name: "delete_by_pk with nested relationships in selection",
			query: query{
				Query: `mutation {
					delete_departments_by_pk(
						id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
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
			name: "permissions: delete_by_pk (allowed)",
			query: query{
				Query: `mutation {
					delete_departments_by_pk(
						id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
					) {
						id
						name
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
			name: "permissions: delete_by_pk (denied - not manager)",
			query: query{
				Query: `mutation {
					delete_departments_by_pk(
						id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
					) {
						id
						name
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

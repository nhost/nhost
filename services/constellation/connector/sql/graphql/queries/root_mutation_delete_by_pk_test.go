package queries_test

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
)

func TestBuildMutationDeleteByPkSQL(t *testing.T) { //nolint:paralleltest
	cases := []buildQueryTestCase{
		// Basic delete_by_pk operations
		{
			name: "basic delete_by_pk",
			query: query{
				Query: `mutation {
					delete_departments_by_pk(id: "2db9de0a-b9ba-416e-8619-783a399ae2b3") {
						id
						name
						budget
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "delete_by_pk with variable",
			query: query{
				Query: `mutation DeleteDept($id: uuid!) {
					delete_departments_by_pk(id: $id) {
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
					myDelete: delete_departments_by_pk(id: "2db9de0a-b9ba-416e-8619-783a399ae2b3") {
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
					delete_departments_by_pk(id: "2db9de0a-b9ba-416e-8619-783a399ae2b3") {
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
					delete_departments_by_pk(id: "00000000-0000-0000-0000-000000000000") {
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
					delete_departments_by_pk(id: "2db9de0a-b9ba-416e-8619-783a399ae2b3") {
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

		// Invalid arguments on a nested relationship must reject the whole
		// delete_by_pk before the DELETE executes (no row deleted), matching
		// Hasura. delete_by_pk builds the same relationship subqueries as
		// insert/update returning, so invalid arguments are rejected by the shared
		// SELECT-path parser before execution.
		{
			name: "delete_by_pk relationship with negative limit rejected",
			query: query{
				Query: `mutation {
					delete_departments_by_pk(id: "2db9de0a-b9ba-416e-8619-783a399ae2b3") {
						id
						employees(limit: -1) {
							user_id
						}
					}
				}`,
				Role: "admin",
			},
			expectError: arguments.ErrInvalidArgument,
		},

		{
			name: "delete_by_pk relationship with distinct_on order_by mismatch rejected",
			query: query{
				Query: `mutation {
					delete_departments_by_pk(id: "2db9de0a-b9ba-416e-8619-783a399ae2b3") {
						id
						employees(distinct_on: user_id, order_by: {department_id: asc}) {
							user_id
						}
					}
				}`,
				Role: "admin",
			},
			expectError: arguments.ErrInvalidArgument,
		},

		// Permission tests
		{
			name: "permissions: delete_by_pk (allowed)",
			query: query{
				Query: `mutation {
					delete_departments_by_pk(id: "2db9de0a-b9ba-416e-8619-783a399ae2b3") {
						id
						name
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
			name: "permissions: delete_by_pk (denied - not manager)",
			query: query{
				Query: `mutation {
					delete_departments_by_pk(id: "2db9de0a-b9ba-416e-8619-783a399ae2b3") {
						id
						name
					}
				}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id":            "550e8400-e29b-41d4-a716-446655440001",
					"x-hasura-department-manager": "{fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
				},
			},
		},

		// Variable handling tests (verifies fix for proper variable resolution)
		{
			name: "delete_by_pk with missing variable returns error",
			query: query{
				Query: `mutation DeleteDept($id: uuid!) {
					delete_departments_by_pk(id: $id) {
						id
						name
					}
				}`,
				Variables: map[string]any{
					// Note: "id" variable is intentionally missing
					"other": "value",
				},
				Role: "admin",
			},
			expectError: values.ErrVariableNotFound,
		},

		{
			name: "delete_by_pk with uuid variable extracts proper type",
			query: query{
				Query: `mutation DeleteDept($id: uuid!) {
					delete_departments_by_pk(id: $id) {
						id
						name
					}
				}`,
				Variables: map[string]any{
					"id": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
				},
				Role: "admin",
			},
		},
	}

	testBuildQuery(t, cases, false)
}

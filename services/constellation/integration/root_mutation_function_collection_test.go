package integration_test

import (
	"testing"
)

func TestBuildMutationFunctionCollectionSQL(t *testing.T) { //nolint:paralleltest
	cases := []TestCase{
		{
			name: "simple mutation (custom name)",
			query: query{
				Query: `
					mutation {
					  deactivateDepartment(
						args: {
						  p_department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
						}
					  ) {
						user_id
						department_id
						is_active
					  }
					}`,
				Role: "admin",
			},
		},

		{
			name: "with limit and order",
			query: query{
				Query: `
					mutation {
					  deactivateDepartment(
						args: {
						  p_department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
						},
						limit: 2,
						order_by: {joined_at: asc}
					  ) {
						user_id
						department_id
						is_active
					  }
					}`,
				Role: "admin",
			},
		},

		{
			name: "with nested relationship",
			query: query{
				Query: `
					mutation {
					  deactivateDepartment(
						args: {
						  p_department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
						}
					  ) {
						is_active
						role
						user {
						  displayName
						}
						department {
						  name
						}
					  }
					}`,
				Role: "admin",
			},
		},

		{
			name: "permissions: user with where clause",
			query: query{
				Query: `
					mutation {
					  deactivateDepartment(
						args: {
						  p_department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3",
						}
						where: {role: {_eq: manager}}
					  ) {
						  user {
							displayName
						  }
						  department {
							name
						  }
						}
					}`,
				Role: "user",
				SessionVariables: map[string]string{
					"departments":        `{"2db9de0a-b9ba-416e-8619-783a399ae2b3","fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
					"department-manager": `{"2db9de0a-b9ba-416e-8619-783a399ae2b3"}`,
				},
			},
		},

		{
			name: "permissions: user with where clause (no access)",
			query: query{
				Query: `
					mutation {
					  deactivateDepartment(
						args: {
						  p_department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3",
						}
						where: {role: {_eq: manager}}
					  ) {
						  user {
							displayName
						  }
						  department {
							name
						  }
						}
					}`,
				Role: "user",
				SessionVariables: map[string]string{
					"departments": `{"fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
				},
			},
			expected: map[string]any{
				"errors": []any{
					map[string]any{
						"message": "failed to execute operations: failed to execute operation deactivateDepartment: failed to scan result row: ERROR: Permission denied: not a manager of department 2db9de0a-b9ba-416e-8619-783a399ae2b3 (SQLSTATE P0001)",
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

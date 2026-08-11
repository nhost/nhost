package integration_test

import (
	"testing"
)

func TestBuildMutationFunctionOneSQL(t *testing.T) { //nolint:paralleltest
	cases := []TestCase{
		{
			name: "simple mutation",
			query: query{
				Query: `
					mutation {
					  set_department_manager(
						args: {
						  p_user_id: "550e8400-e29b-41d4-a716-446655440001",
						  p_department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
						}
					  ) {
						department_id
						user_id
						role
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
					  set_department_manager(
						args: {
						  p_user_id: "550e8400-e29b-41d4-a716-446655440001",
						  p_department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
						}
					  ) {
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
			name: "permissions: user",
			query: query{
				Query: `
					mutation {
					  set_department_manager(
						args: {
						  p_user_id: "550e8400-e29b-41d4-a716-446655440001",
						  p_department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
						}
					  ) {
						department_id
						user_id
						role
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
			name: "permissions: user denied (department not in session)",
			query: query{
				Query: `
					mutation {
					  set_department_manager(
						args: {
						  p_user_id: "550e8400-e29b-41d4-a716-446655440001",
						  p_department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
						}
					  ) {
						department_id
						user_id
						role
					  }
					}`,
				Role: "user",
				SessionVariables: map[string]string{
					"departments":        `{"2db9de0a-b9ba-416e-8619-783a399ae2b3","fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
					"department-manager": `{"2db9de0a-b9ba-416e-8619-783a399ae2b1"}`,
				},
			},
			expected: map[string]any{
				"errors": []any{
					map[string]any{
						"message": "failed to execute operations: failed to execute operation set_department_manager: failed to scan result row: ERROR: Permission denied: not a manager of department 2db9de0a-b9ba-416e-8619-783a399ae2b3 (SQLSTATE P0001)",
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

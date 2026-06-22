package integration_test

import (
	"testing"
)

func TestSelectByPK(t *testing.T) { //nolint:paralleltest
	ReinitializeTestData(t)

	cases := []TestCase{
		{
			name: "permissions: simple select",
			query: query{
				Query: `
					{
					  departments_by_pk(id: "2db9de0a-b9ba-416e-8619-783a399ae2b3") {
						name
					  }
					}`,
				Variables: nil,
				Role:      "user",
				SessionVariables: map[string]string{
					"user-id":     "550e8400-e29b-41d4-a716-446655440001",
					"departments": `{"2db9de0a-b9ba-416e-8619-783a399ae2b3","fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
				},
			},
		},

		{
			name: "permissions: simple select (no access)",
			query: query{
				Query: `
					{
					  departments_by_pk(id: "2db9de0a-b9ba-416e-8619-783a399ae2b3") {
						name
					  }
					}`,
				Variables: nil,
				Role:      "user",
				SessionVariables: map[string]string{
					"user-id":     "550e8400-e29b-41d4-a716-446655440001",
					"departments": `{"fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
				},
			},
		},

		{
			name: "permissions: nested",
			query: query{
				Query: `
					{
					  departments_by_pk(id: "2db9de0a-b9ba-416e-8619-783a399ae2b3") {
						name
						files {
						  file {
							name
						  }
						  department {
							name
						  }
						}
					  }
					}`,
				Variables: nil,
				Role:      "user",
				SessionVariables: map[string]string{
					"user-id":     "550e8400-e29b-41d4-a716-446655440001",
					"departments": `{"2db9de0a-b9ba-416e-8619-783a399ae2b3","fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
				},
			},
		},

		{
			name: "nested, filtering",
			query: query{
				Query: `
					{
					  departments_by_pk(id: "2db9de0a-b9ba-416e-8619-783a399ae2b3") {
						name
						files(where: {file:{bucketId: {_eq: "default"}}}) {
						  file {
							name
						  }
						  department {
							name
						  }
						}
					  }
					}`,
				Variables:        nil,
				Role:             "admin",
				SessionVariables: map[string]string{},
			},
		},

		{
			name: "permissions: nested, filtering",
			query: query{
				Query: `
					{
					  departments_by_pk(id: "2db9de0a-b9ba-416e-8619-783a399ae2b3") {
						name
						files(where: {file:{bucketId: {_eq: "default"}}}) {
						  file {
							name
						  }
						  department {
							name
						  }
						}
					  }
					}`,
				Variables: nil,
				Role:      "user",
				SessionVariables: map[string]string{
					"user-id":     "550e8400-e29b-41d4-a716-446655440001",
					"departments": `{"2db9de0a-b9ba-416e-8619-783a399ae2b3","fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
				},
			},
		},

		// Hasura-parity lock for the by_pk argumentPath surface. The by_pk root
		// field itself takes only the primary key, so the validation error is
		// raised on the nested array relationship (employees -> user_departments)
		// whose distinct_on column set does not match the leading order_by
		// column. The surrounding by_pk is valid so the build reaches the
		// relationship's buildSelectionSQL, where the argumentPath threaded by
		// root_query_by_pk.go is stamped onto the error:
		// "$.selectionSet.departments_by_pk.selectionSet.employees.args".
		// RunGraphQLTests diffs the full response against live Hasura, pinning
		// message, extensions.code, and extensions.path. Mirrors the unit
		// assertion in queries/dispatch_test.go's
		// TestBuildNestedRelationshipValidationErrorPath.
		{
			name: "nested-relationship distinct_on/order_by mismatch validation error",
			query: query{
				Query: `
					{
					  departments_by_pk(id: "2db9de0a-b9ba-416e-8619-783a399ae2b3") {
						name
						employees(distinct_on: role, order_by: { joined_at: desc }) {
						  user_id
						}
					  }
					}`,
				Variables:        nil,
				Role:             "admin",
				SessionVariables: map[string]string{},
			},
		},
	}

	RunGraphQLTests(t, cases, TestConfig{
		IsMutation: false,
	})
}

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
	}

	RunGraphQLTests(t, cases, TestConfig{
		IsMutation: false,
	})
}

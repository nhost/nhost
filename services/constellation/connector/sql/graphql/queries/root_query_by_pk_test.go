package queries_test

import (
	"testing"
)

func TestSelectByPKBuildQuery(t *testing.T) { //nolint:paralleltest
	cases := []buildQueryTestCase{
		{
			name: "simple select by pk",
			query: query{
				Query: `
					query {
						departments_by_pk(id: "123e4567-e89b-12d3-a456-426614174000") {
							id
							name
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "select by pk with variable",
			query: query{
				Query: `
					query($id: uuid!) {
						departments_by_pk(id: $id) {
							id
							name
							budget
						}
					}`,
				Role: "admin",
				Variables: map[string]any{
					"id": "123e4567-e89b-12d3-a456-426614174000",
				},
			},
		},

		{
			name: "select by pk with all columns",
			query: query{
				Query: `
					query($id: uuid!) {
						departments_by_pk(id: $id) {
							id
							name
							description
							budget
							created_at
							updated_at
						}
					}`,
				Role: "admin",
				Variables: map[string]any{
					"id": "123e4567-e89b-12d3-a456-426614174000",
				},
			},
		},

		{
			name: "select by pk with alias",
			query: query{
				Query: `
					query($id: uuid!) {
						dept: departments_by_pk(id: $id) {
							id
							name
						}
					}`,
				Role: "admin",
				Variables: map[string]any{
					"id": "123e4567-e89b-12d3-a456-426614174000",
				},
			},
		},

		{
			name: "select by pk with fragment",
			query: query{
				Query: `
					query($id: uuid!) {
						departments_by_pk(id: $id) {
							...DeptFields
						}
					}
					fragment DeptFields on departments {
						id
						name
						budget
					}`,
				Role: "admin",
				Variables: map[string]any{
					"id": "123e4567-e89b-12d3-a456-426614174000",
				},
			},
		},

		{
			name: "select by pk with nested relationship",
			query: query{
				Query: `
					query($id: uuid!) {
						departments_by_pk(id: $id) {
							id
							name
							employees {
								user_id
								role
							}
						}
					}`,
				Role: "admin",
				Variables: map[string]any{
					"id": "123e4567-e89b-12d3-a456-426614174000",
				},
			},
		},

		{
			name: "select by pk with nested relationship and WHERE",
			query: query{
				Query: `
					query($id: uuid!) {
						departments_by_pk(id: $id) {
							id
							name
							employees(where: {is_active: {_eq: true}}) {
								user_id
								role
							}
						}
					}`,
				Role: "admin",
				Variables: map[string]any{
					"id": "123e4567-e89b-12d3-a456-426614174000",
				},
			},
		},

		{
			name: "user: simple select by pk with permissions",
			query: query{
				Query: `
					{
					  departments_by_pk(id: "2db9de0a-b9ba-416e-8619-783a399ae2b3") {
						name
					  }
					}`,
				Role:      "user",
				Variables: nil,
				SessionVariables: map[string]any{
					"x-hasura-user-id":     "550e8400-e29b-41d4-a716-446655440001",
					"x-hasura-departments": "{2db9de0a-b9ba-416e-8619-783a399ae2b3,fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
				},
			},
		},

		{
			name: "user: select by pk with nested relationships and permissions",
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
				Role:      "user",
				Variables: nil,
				SessionVariables: map[string]any{
					"x-hasura-user-id":     "550e8400-e29b-41d4-a716-446655440001",
					"x-hasura-departments": "{2db9de0a-b9ba-416e-8619-783a399ae2b3,fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
				},
			},
		},

		{
			name: "user: nested where with relationship filter",
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
				Role:      "user",
				Variables: nil,
				SessionVariables: map[string]any{
					"x-hasura-user-id":     "550e8400-e29b-41d4-a716-446655440001",
					"x-hasura-departments": "{2db9de0a-b9ba-416e-8619-783a399ae2b3,fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
				},
			},
		},
	}

	testBuildQuery(t, cases, false)
}

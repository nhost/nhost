package queries_test

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/permissions"
)

func TestBuildSubscriptionCollectionSQL(t *testing.T) { //nolint:maintidx,paralleltest
	cases := []buildQueryTestCase{
		{
			name: "simple select",
			query: query{
				Query: `
					subscription {
						departments {
							id
							name
							budget
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "user: simple select",
			query: query{
				Query: `
					subscription {
						departments {
							id
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
			name: "user: simple select with no permissions for column",
			query: query{
				Query: `
					subscription {
						departments {
							id
							name
						}
					}`,
				Role:      "user",
				Variables: nil,
			},
			expectError: permissions.ErrSessionVariableNotFound,
		},

		{
			name: "relationships",
			query: query{
				Query: `
					subscription {
						departments {
							id
							name
							employees {
								user_id
								user {
								  defaultRoleByRole {
							   	    role
								  }
								}
							}
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "user: simple select with only permitted columns",
			query: query{
				Query: `
					subscription {
						departments {
							id
							name
							budget
						}
					}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-departments": "{123e4567-e89b-12d3-a456-426614174000}",
				},
				Variables: nil,
			},
		},

		{
			name: "named fragment",
			query: query{
				Query: `
					subscription {
						departments {
							...DeptFields
						}
					}
					fragment DeptFields on departments {
						id
						name
					}`,
				Variables: nil,
			},
		},

		{
			name: "multiple fragments",
			query: query{
				Query: `
					subscription {
						departments {
							...DeptID
							...DeptName
						}
					}
					fragment DeptID on departments {
						id
					}
					fragment DeptName on departments {
						name
					}`,
				Variables: nil,
			},
		},

		{
			name: "inline fragment",
			query: query{
				Query: `
					subscription {
						departments {
							... {
								id
								name
							}
						}
					}`,
				Variables: nil,
			},
		},

		{
			name: "mixed fields and fragments",
			query: query{
				Query: `
					subscription {
						departments {
							id
							...DeptName
						}
					}
					fragment DeptName on departments {
						name
					}`,
				Variables: nil,
			},
		},

		{
			name: "fragment with alias",
			query: query{
				Query: `
					subscription {
						departments {
							...DeptFields
							department_id: id
						}
					}
					fragment DeptFields on departments {
						name
					}`,
				Variables: nil,
			},
		},

		{
			name: "simple where clause with _eq",
			query: query{
				Query: `
					subscription {
						departments(where: {name: {_eq: "Sales"}}) {
							id
							name
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "where clause with _in",
			query: query{
				Query: `
					subscription {
						departments(where: {name: {_in: ["Sales", "Marketing", "Engineering"]}}) {
							id
							name
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "where clause with _and",
			query: query{
				Query: `
					subscription {
						departments(where: {_and: [{name: {_eq: "Sales"}}, {budget: {_eq: 100000}}]}) {
							id
							name
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "where clause with variables",
			query: query{
				Query: `
					subscription($dept_name: String!) {
						departments(where: {name: {_eq: $dept_name}}) {
							id
							name
						}
					}`,
				Role: "admin",
				Variables: map[string]any{
					"dept_name": "Sales",
				},
			},
		},

		{
			name: "relationship with where clause",
			query: query{
				Query: `
					subscription {
						departments {
							id
							name
							employees(where: {user_id: {_eq: "123e4567-e89b-12d3-a456-426614174000"}}) {
								user_id
							}
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "user: select with where clause and row-level permissions",
			query: query{
				Query: `
					subscription {
						departments(where: {name: {_eq: "Engineering"}}) {
							id
							name
							budget
						}
					}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-departments": "{123e4567-e89b-12d3-a456-426614174001,123e4567-e89b-12d3-a456-426614174002}",
				},
				Variables: nil,
			},
		},

		{
			name: "nested relationship filter with multiple levels",
			query: query{
				Query: `
					subscription {
						departments {
							name
							employees(where: {user: {displayName: {_eq: "Robert Taylor"}}}) {
								user_id
							}
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "order by single column ascending",
			query: query{
				Query: `
					subscription {
						departments(order_by: {name: asc}) {
							id
							name
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "order by multiple columns",
			query: query{
				Query: `
					subscription {
						departments(order_by: [{name: desc}, {created_at: asc}]) {
							id
							name
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "limit and offset",
			query: query{
				Query: `
					subscription {
						departments(limit: 10, offset: 5) {
							id
							name
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "distinct on with order by",
			query: query{
				Query: `
					subscription {
						user_departments(distinct_on: department_id, order_by: {department_id: asc}) {
							department_id
							user_id
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "combined where, order by, limit",
			query: query{
				Query: `
					subscription {
						departments(where: {budget: {_gt: 100000}}, order_by: {budget: desc}, limit: 5) {
							id
							name
							budget
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "list variable providing object instead of list",
			query: query{
				Query: `subscription($limit: Int!, $offset: Int!, $orderBy: [users_order_by!]) {
					users(limit: $limit, offset: $offset, order_by: $orderBy) {
						id
						displayName
					}
				}`,
				Role: "admin",
				Variables: map[string]any{
					"limit":   3,
					"offset":  1,
					"orderBy": map[string]any{"displayName": "asc"},
				},
			},
		},

		{
			name: "nested relationship with distinct_on, order_by, where, and limit",
			query: query{
				Query: `
					subscription {
						departments(limit: 2) {
							id
							name
							employees(
								distinct_on: user_id,
								where: {department_id: {_is_null: false}},
								order_by: {user_id: asc},
								limit: 3
							) {
								user_id
								department_id
							}
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "nested, filtering",
			query: query{
				Query: `
					subscription {
					  departments {
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
				SessionVariables: map[string]any{},
			},
		},

		{
			name: "permissions: nested, filtering",
			query: query{
				Query: `
					subscription {
					  departments {
					    files(where: {file: {bucketId: {_eq: "profile_pics"}}}) {
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
				SessionVariables: map[string]any{
					"x-hasura-user-id":     "550e8400-e29b-41d4-a716-446655440001",
					"x-hasura-departments": "{2db9de0a-b9ba-416e-8619-783a399ae2b3,fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
				},
			},
		},

		{
			name: "nested query with limit - three levels",
			query: query{
				Query: `subscription {
					users(limit: 2) {
						id
						displayName
						departments(limit: 3) {
							department {
								id
								name
								files(limit: 5) {
									id
									description
								}
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "complex: nested with relationship traversal in WHERE",
			query: query{
				Query: `subscription {
					files(
						where: {
							department_file: {
								department: {
									name: {_eq: "Engineering"}
								}
							}
						},
						limit: 5
					) {
						id
						name
						bucket {
							id
						}
						department_file {
							id
							department {
								id
								name
								files(limit: 3) {
									id
								}
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "departments with aliased employee sets",
			query: query{
				Query: `subscription {
					departments(limit: 3) {
						id
						name
						activeEmployees: employees(where: {is_active: {_eq: true}}, limit: 10) {
							role
							user {
								id
								displayName
							}
						}
						inactiveEmployees: employees(where: {is_active: {_eq: false}}, limit: 10) {
							role
							user {
								id
								displayName
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "duplicate relationship fields (merging)",
			query: query{
				Query: `subscription {
					departments(limit: 3) {
						id
						employees {
							user_id
						}
						employees {
							role
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "duplicate relationship with fragments (merging)",
			query: query{
				Query: `
					fragment EmployeeIds on user_departments {
						user_id
					}

					fragment EmployeeRoles on user_departments {
						role
					}

					subscription {
						departments(limit: 3) {
							id
							employees {
								...EmployeeIds
							}
							employees {
								...EmployeeRoles
							}
						}
					}`,
				Role: "admin",
			},
		},

		{
			name: "nested duplicate relationships",
			query: query{
				Query: `subscription {
					departments(limit: 2) {
						id
						employees {
							user {
								id
							}
						}
						employees {
							user {
								displayName
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		// JSONB query operators
		{
			name: "jsonb _contains - find users with specific profile",
			query: query{
				Query: `subscription {
					users(where: { metadata: { _contains: { profile: { title: "HR Manager" } } } }) {
						id
						displayName
						metadata
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _contains - find users with specific tag",
			query: query{
				Query: `subscription {
					users(where: { metadata: { _contains: { tags: ["manager"] } } }) {
						id
						displayName
						metadata
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _contained_in - find users with metadata contained in given value",
			query: query{
				Query: `subscription {
					users(where: { metadata: { _contained_in: { profile: { title: "HR Manager", level: 5 }, tags: ["manager", "hr", "leadership"], skills: ["recruitment", "compliance", "training"] } } }) {
						id
						displayName
						metadata
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _has_key - find users with profile key",
			query: query{
				Query: `subscription {
					users(where: { metadata: { _has_key: "profile" } }) {
						id
						displayName
						metadata
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _has_key - find users with tags key",
			query: query{
				Query: `subscription {
					users(where: { metadata: { _has_key: "tags" } }) {
						id
						displayName
						metadata
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _has_keys_all - find users with both profile and tags",
			query: query{
				Query: `subscription {
					users(where: { metadata: { _has_keys_all: ["profile", "tags"] } }) {
						id
						displayName
						metadata
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _has_keys_any - find users with profile or skills",
			query: query{
				Query: `subscription {
					users(where: { metadata: { _has_keys_any: ["profile", "skills"] } }) {
						id
						displayName
						metadata
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _has_keys_any with variables",
			query: query{
				Query: `subscription FindUsersByKeys($where: users_bool_exp!) {
					users(where: $where) {
						id
						displayName
						metadata
					}
				}`,
				Variables: map[string]any{
					"where": map[string]any{
						"metadata": map[string]any{
							"_has_keys_any": []any{"languages", "certifications"},
						},
					},
				},
				Role: "admin",
			},
		},

		{
			name: "jsonb combined with other filters",
			query: query{
				Query: `subscription {
					users(where: {
						_and: [
							{ metadata: { _has_key: "profile" } },
							{ locale: { _eq: "en" } }
						]
					}) {
						id
						displayName
						locale
						metadata
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _contains with nested object",
			query: query{
				Query: `subscription {
					users(where: { metadata: { _contains: { preferences: { theme: "dark" } } } }) {
						id
						displayName
						metadata
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _contains with variables",
			query: query{
				Query: `subscription FindUsersWithMetadata($where: users_bool_exp!) {
					users(where: $where) {
						id
						displayName
						metadata
					}
				}`,
				Variables: map[string]any{
					"where": map[string]any{
						"metadata": map[string]any{
							"_contains": map[string]any{
								"profile": map[string]any{
									"level": 5,
								},
							},
						},
					},
				},
				Role: "admin",
			},
		},
	}

	testBuildSubscription(t, cases, false)
}

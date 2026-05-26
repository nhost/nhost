package queries_test

import (
	"testing"
)

func TestInsertOneBuildQuery(t *testing.T) { //nolint:paralleltest,maintidx
	cases := []buildQueryTestCase{
		// Basic insert operations
		{
			name: "insert_one basic",
			query: query{
				Query: `mutation {
					insertUser(object: {
						id: "b4f5d5e2-3c4b-4f6a-9f7e-2d3c4b5a6e7f"
						displayName: "Test User"
						email: "testuser@example.com"
						disabled: false
						defaultRole: "user"
						locale: "en"
					}) {
						id
						displayName
						email
						disabled
						defaultRole
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "insert_one with variables",
			query: query{
				Query: `mutation InsertUser($displayName: String!, $email: citext!) {
					insertUser(object: {
						id: "b4f5d5e2-3c4b-4f6a-9f7e-2d3c4b5a6e7f"
						displayName: $displayName
						email: $email
						disabled: false
						defaultRole: "user"
						locale: "en"
					}) {
						id
						displayName
						email
					}
				}`,
				Variables: map[string]any{
					"displayName": "Variable User",
					"email":       "variable@example.com",
				},
				Role: "admin",
			},
		},

		{
			name: "insert_one with all fields",
			query: query{
				Query: `mutation {
					insertUser(object: {
						id: "b4f5d5e2-3c4b-4f6a-9f7e-2d3c4b5a6e7f"
						displayName: "Complete User"
						email: "complete@example.com"
						disabled: false
						locale: "fr"
						defaultRole: "user"
						emailVerified: true
						phoneNumberVerified: false
						isAnonymous: false
					}) {
						id
						displayName
						email
						disabled
						locale
						defaultRole
						emailVerified
						phoneNumberVerified
						isAnonymous
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "insert_one with minimal fields returned",
			query: query{
				Query: `mutation {
					insertUser(object: {
						id: "b4f5d5e2-3c4b-4f6a-9f7e-2d3c4b5a6e7f"
						displayName: "Minimal Return"
						email: "minimal@example.com"
						disabled: false
						defaultRole: "user"
						locale: "en"
					}) {
						id
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "insert_one with object variable",
			query: query{
				Query: `mutation InsertUser($object: users_insert_input!) {
					insertUser(object: $object) {
						id
						displayName
						email
						locale
					}
				}`,
				Variables: map[string]any{
					"object": map[string]any{
						"id":          "b4f5d5e2-3c4b-4f6a-9f7e-2d3c4b5a6e7f",
						"displayName": "Object Variable User",
						"email":       "objectvar@example.com",
						"disabled":    false,
						"locale":      "de",
						"defaultRole": "user",
					},
				},
				Role: "admin",
			},
		},

		{
			name: "insert_one with boolean fields",
			query: query{
				Query: `mutation {
					insertUser(object: {
						id: "b4f5d5e2-3c4b-4f6a-9f7e-2d3c4b5a6e7f"
						displayName: "Boolean User"
						email: "bool@example.com"
						disabled: true
						defaultRole: "user"
						emailVerified: false
						isAnonymous: true
						locale: "es"
					}) {
						id
						disabled
						emailVerified
						isAnonymous
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "insert_one with nullable fields",
			query: query{
				Query: `mutation {
					insertUser(object: {
						id: "b4f5d5e2-3c4b-4f6a-9f7e-2d3c4b5a6e7f"
						displayName: "Nullable Test"
						email: "nullable@example.com"
						disabled: false
						defaultRole: "user"
						phoneNumber: "+1234567890"
						locale: "it"
					}) {
						id
						phoneNumber
						avatarUrl
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "insert_one with nested relationship in RETURNING",
			query: query{
				Query: `mutation {
					insertUser(object: {
						id: "00000000-0000-0000-0000-000000000099"
						displayName: "Test User"
						email: "testuser-insert-one@example.com"
						disabled: false
						defaultRole: "user"
						locale: "en"
					}) {
						id
						displayName
						email
						disabled
						defaultRoleByRole {
							role
						}
					}
				}`,
				Role: "admin",
			},
		},

		// on_conflict / upsert operations
		{
			name: "insert_one with on_conflict do update",
			query: query{
				Query: `mutation {
					insertUser(
						object: {
							id: "b4f5d5e2-3c4b-4f6a-9f7e-2d3c4b5a6e7f"
							displayName: "Upsert User"
							email: "upsert@example.com"
							disabled: false
							defaultRole: "user"
							locale: "en"
						}
						on_conflict: {
							constraint: users_pkey
							update_columns: [displayName, email]
						}
					) {
						id
						displayName
						email
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "insert_one with on_conflict do nothing",
			query: query{
				Query: `mutation {
					insertUser(
						object: {
							id: "b4f5d5e2-3c4b-4f6a-9f7e-2d3c4b5a6e7f"
							displayName: "Ignored User"
							email: "ignored@example.com"
							disabled: false
							defaultRole: "user"
							locale: "fr"
						}
						on_conflict: {
							constraint: users_pkey
							update_columns: []
						}
					) {
						id
						displayName
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "insert_one with on_conflict using variables",
			query: query{
				Query: `mutation InsertUser($object: users_insert_input!, $onConflict: users_on_conflict) {
					insertUser(object: $object, on_conflict: $onConflict) {
						id
						displayName
						email
						locale
					}
				}`,
				Variables: map[string]any{
					"object": map[string]any{
						"id":          "b4f5d5e2-3c4b-4f6a-9f7e-2d3c4b5a6e7f",
						"displayName": "Variable Upsert",
						"email":       "variable-upsert@example.com",
						"disabled":    false,
						"defaultRole": "user",
						"locale":      "ja",
					},
					"onConflict": map[string]any{
						"constraint":     "users_pkey",
						"update_columns": []any{"displayName", "email", "locale"},
					},
				},
				Role: "admin",
			},
		},

		{
			name: "insert_one with on_conflict do update (actual conflict)",
			query: query{
				Query: `mutation {
					insert_departments_one(
						object: {
							id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
							name: "HR Updated"
						}
						on_conflict: {
							constraint: departments_pkey
							update_columns: [name]
						}
					) {
						id
						name
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "insert_one with on_conflict single update_column (not array)",
			query: query{
				Query: `mutation {
					insert_departments_one(
						object: {
							id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
							name: "HR Updated"
						}
						on_conflict: {
							constraint: departments_pkey
							update_columns: name
						}
					) {
						id
						name
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "insert_one with on_conflict do nothing (actual conflict)",
			query: query{
				Query: `mutation {
					insert_departments_one(
						object: {
							id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
							name: "HR Updated"
						}
						on_conflict: {
							constraint: departments_pkey
							update_columns: []
						}
					) {
						id
						name
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "insert_one with on_conflict using variables (actual conflict)",
			query: query{
				Query: `mutation InsertDepartment($object: departments_insert_input!, $onConflict: departments_on_conflict) {
					insert_departments_one(object: $object, on_conflict: $onConflict) {
						id
						name
					}
				}`,
				Variables: map[string]any{
					"object": map[string]any{
						"id":   "2db9de0a-b9ba-416e-8619-783a399ae2b3",
						"name": "HR Updated",
					},
					"onConflict": map[string]any{
						"constraint":     "departments_pkey",
						"update_columns": []any{"name"},
					},
				},
				Role: "admin",
			},
		},

		// Nested insert operations
		{
			name: "nested insert with object relationship",
			query: query{
				Query: `
					mutation {
					  insert_department_files_one(
						object: {
						  department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3",
						  file: {data: {id: "62abc701-2a54-4c3e-aa7e-2c800d3b1a19", bucketId: "profile_pics"}
						  }
						}) {
						file {
						  id
						  bucketId
						}
						department {
						  name
						}
					  }
					}`,
				Variables: map[string]any{},
				Role:      "admin",
			},
		},

		{
			name: "nested insert with multiple levels and specified IDs",
			query: query{
				Query: `mutation {
					  insert_user_departments_one(
						object: {
						  user_id: "550e8400-e29b-41d4-a716-446655440001",
						  role: "manager",
						  department: {
							data: {
							 id: "00000000-0000-0000-0000-000000000123",
							  name: "New Department",
							  description: "This is a new department",
							  budget: 200000
							  employees: {
								data: {
								  user_id: "550e8400-e29b-41d4-a716-446655440002",
								  role: "member"
								}
							  }
							}
						  }
						}
					  ) {
						user_id
						user {
						  displayName
						}
						department_id
						department {
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

		// Permission tests - simple
		{
			name: "permissions: simple insert",
			query: query{
				Query: `
					mutation {
					  insert_user_departments_one(
						object: {
						  user_id: "550e8400-e29b-41d4-a716-446655440051",
						  department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3",
						}
					  ) {
						department_id
						user_id
					  }
					}`,
				Variables: nil,
				Role:      "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id":            "550e8400-e29b-41d4-a716-446655440001",
					"x-hasura-department-manager": "{2db9de0a-b9ba-416e-8619-783a399ae2b3,fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
				},
			},
		},

		{
			name: "permissions: simple insert (denied)",
			query: query{
				Query: `
					mutation {
					  insert_user_departments_one(
						object: {
						  user_id: "550e8400-e29b-41d4-a716-446655440051",
						  department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3",
						}
					  ) {
						department_id
						user_id
					  }
					}`,
				Variables: nil,
				Role:      "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id":            "550e8400-e29b-41d4-a716-446655440001",
					"x-hasura-department-manager": "{fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
				},
			},
		},

		// Permission tests - nested insert
		{
			name: "permissions: nested insert",
			query: query{
				Query: `
					mutation {
					  insert_department_files_one(
						object: {
						  department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3",
						  file: {data: {id: "62abc701-2a54-4c3e-aa7e-2c800d3b1a19", bucketId: "profile_pics"}
						  }
						}) {
						file {
						  id
						  bucketId
						}
						department {
						  name
						}
					  }
					}`,
				Variables: map[string]any{},
				Role:      "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id":            "550e8400-e29b-41d4-a716-446655440001",
					"x-hasura-departments":        "{2db9de0a-b9ba-416e-8619-783a399ae2b3,fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
					"x-hasura-department-manager": "{fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
				},
			},
		},

		{
			name: "permissions: nested insert (denied)",
			query: query{
				Query: `
					mutation {
					  insert_department_files_one(
						object: {
						  department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3",
						  file: {data: {id: "62abc701-2a54-4c3e-aa7e-2c800d3b1a19", bucketId: "default"}
						  }
						}) {
						file {
						  id
						  bucketId
						}
						department {
						  name
						}
					  }
					}`,
				Variables: map[string]any{},
				Role:      "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id":            "550e8400-e29b-41d4-a716-446655440001",
					"x-hasura-departments":        "{2db9de0a-b9ba-416e-8619-783a399ae2b3,fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
					"x-hasura-department-manager": "{fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
				},
			},
		},

		// on_conflict with where clause
		{
			name: "insert_one with on_conflict where clause - simple condition",
			query: query{
				Query: `mutation {
					insertUser(
						object: {
							id: "b4f5d5e2-3c4b-4f6a-9f7e-2d3c4b5a6e7f"
							displayName: "Conditional Upsert User"
							email: "conditional@example.com"
							disabled: false
							defaultRole: "user"
							locale: "en"
						}
						on_conflict: {
							constraint: users_pkey
							update_columns: [displayName, email]
							where: { disabled: { _eq: false } }
						}
					) {
						id
						displayName
						email
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "insert_one with on_conflict where clause - complex condition",
			query: query{
				Query: `mutation {
					insertUser(
						object: {
							id: "b4f5d5e2-3c4b-4f6a-9f7e-2d3c4b5a6e7f"
							displayName: "Complex Upsert User"
							email: "complex@example.com"
							disabled: false
							defaultRole: "user"
							locale: "en"
						}
						on_conflict: {
							constraint: users_pkey
							update_columns: [displayName, email, locale]
							where: {
								_and: [
									{ disabled: { _eq: false } }
									{ defaultRole: { _eq: "user" } }
								]
							}
						}
					) {
						id
						displayName
						email
						locale
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "insert_one with on_conflict where clause using variables",
			query: query{
				Query: `mutation InsertUser($object: users_insert_input!, $onConflict: users_on_conflict) {
					insertUser(object: $object, on_conflict: $onConflict) {
						id
						displayName
						email
					}
				}`,
				Variables: map[string]any{
					"object": map[string]any{
						"id":          "b4f5d5e2-3c4b-4f6a-9f7e-2d3c4b5a6e7f",
						"displayName": "Variable Conditional Upsert",
						"email":       "variable-conditional@example.com",
						"disabled":    false,
						"defaultRole": "user",
						"locale":      "en",
					},
					"onConflict": map[string]any{
						"constraint":     "users_pkey",
						"update_columns": []any{"displayName", "email"},
						"where": map[string]any{
							"locale": map[string]any{"_neq": "ja"},
						},
					},
				},
				Role: "admin",
			},
		},

		// on_conflict where clause with actual conflicts
		{
			name: "on_conflict where clause - actual conflict, condition matches (update happens)",
			query: query{
				Query: `mutation {
					insert_departments_one(
						object: {
							id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
							name: "Human Resources Updated"
							description: "Updated HR Department"
						}
						on_conflict: {
							constraint: departments_pkey
							update_columns: [name, description]
							where: { name: { _like: "H%" } }
						}
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
			name: "on_conflict where clause - actual conflict, condition does not match (update skipped)",
			query: query{
				Query: `mutation {
					insert_departments_one(
						object: {
							id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
							name: "Should Not Update"
							description: "This should not appear"
						}
						on_conflict: {
							constraint: departments_pkey
							update_columns: [name, description]
							where: { name: { _like: "X%" } }
						}
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
			name: "on_conflict where clause - actual conflict with _and condition matching",
			query: query{
				Query: `mutation {
					insert_departments_one(
						object: {
							id: "fd1e6bba-c292-4b2f-872e-ae16146cdd82"
							name: "Engineering Renamed"
							budget: 999999
						}
						on_conflict: {
							constraint: departments_pkey
							update_columns: [name, budget]
							where: {
								_and: [
									{ name: { _like: "E%" } }
									{ budget: { _gte: 0 } }
								]
							}
						}
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
			name: "on_conflict where clause - actual conflict with _or condition",
			query: query{
				Query: `mutation {
					insert_departments_one(
						object: {
							id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
							name: "HR via OR"
							description: "Updated via OR condition"
						}
						on_conflict: {
							constraint: departments_pkey
							update_columns: [name, description]
							where: {
								_or: [
									{ name: { _eq: "NonExistent" } }
									{ name: { _like: "H%" } }
								]
							}
						}
					) {
						id
						name
						description
					}
				}`,
				Role: "admin",
			},
		},

		// presets
		{
			name: "insert_one with preset from session variable",
			query: query{
				Query: `mutation {
					insertFile(object: {
						id: "11111111-1111-1111-1111-111111111111"
						bucketId: "profile_pics"
						name: "test-file.txt"
						mimeType: "text/plain"
						size: 1024
						etag: "abc123"
						isUploaded: true
					}) {
						id
						bucketId
						name
						uploadedByUserId
					}
				}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},

		{
			name: "insert_one with variable and preset",
			query: query{
				Query: `mutation InsertFile($object: files_insert_input!) {
					insertFile(object: $object) {
						id
						bucketId
						name
						uploadedByUserId
					}
				}`,
				Variables: map[string]any{
					"object": map[string]any{
						"id":         "44444444-4444-4444-4444-444444444444",
						"bucketId":   "profile_pics",
						"name":       "variable-file.txt",
						"mimeType":   "text/plain",
						"size":       256,
						"etag":       "jkl012",
						"isUploaded": true,
					},
				},
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id": "550e8400-e29b-41d4-a716-446655440003",
				},
			},
		},
		// Permission tests - generated column in permission check
		{
			name: "permissions: insert with generated column check (pass)",
			query: query{
				Query: `mutation {
					insert_departments_one(object: {
						id: "00000000-0000-0000-0000-000000000201"
						name: "High Budget Dept"
						budget: 600000
					}) {
						id
						name
						budget
						has_high_budget
					}
				}`,
				Role: "generated_col_test",
			},
		},

		{
			name: "permissions: insert with generated column check (denied)",
			query: query{
				Query: `mutation {
					insert_departments_one(object: {
						id: "00000000-0000-0000-0000-000000000202"
						name: "Low Budget Dept"
						budget: 100000
					}) {
						id
						name
						budget
						has_high_budget
					}
				}`,
				Role: "generated_col_test",
			},
		},
	}

	testBuildQuery(t, cases, true)
}

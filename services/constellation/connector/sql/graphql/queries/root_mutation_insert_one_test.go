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
			name: "nested insert with array relationship (multiple rows)",
			query: query{
				Query: `mutation InsertDeptWithEmployees($obj: departments_insert_input!) {
					  insert_departments_one(object: $obj) {
						id
					  }
					}`,
				Variables: map[string]any{
					"obj": map[string]any{
						"id":          "00000000-0000-0000-0000-000000000789",
						"name":        "Array Insert Dept",
						"description": "department with many employees",
						"budget":      300000,
						"employees": map[string]any{
							"data": []any{
								map[string]any{
									"user_id": "550e8400-e29b-41d4-a716-446655440002",
									"role":    "member",
								},
								map[string]any{
									"user_id": "550e8400-e29b-41d4-a716-446655440001",
									"role":    "manager",
								},
							},
						},
					},
				},
				Role: "admin",
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

		// The nested department inserts a descendant `employees` CTE, while the
		// top-level returning selection aliases the normal `user` relationship to
		// `employees`. This must still build/read the lateral user relationship;
		// only direct nested relationships may be read from nested CTEs.
		{
			name: "nested descendant name does not shadow aliased top-level relationship",
			query: query{
				Query: `mutation {
					  insert_user_departments_one(
						object: {
						  user_id: "550e8400-e29b-41d4-a716-446655440001"
						  role: "manager"
						  department: {
							data: {
							  id: "00000000-0000-0000-0000-00000000020c"
							  name: "Alias Collision Department"
							  description: "nested descendant name collision"
							  budget: 123000
							  employees: {
								data: {
								  user_id: "550e8400-e29b-41d4-a716-446655440002"
								  role: "member"
								}
							  }
							}
						  }
						}
					  ) {
						user_id
						employees: user {
						  id
						  displayName
						}
						department {
						  id
						  name
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

		// Nested array-relationship insert where the child's insert permission
		// references the parent — either directly via the FK column
		// (`kb_entry_id: _in: ...`) or indirectly via a relationship to the
		// parent (`kb_entry: {uploader_id: _eq: ...}`).
		//
		// Two issues had to be fixed for this case:
		//   1. The pre-check data subquery emitted NULL for the FK column
		//      (because the parent INSERT hasn't produced its RETURNING yet),
		//      so any predicate on that column rejected every row. The check
		//      CTE now pulls the FK from the parent CTE.
		//   2. A relationship-based predicate compiles to EXISTS against the
		//      parent's underlying table — which doesn't see the in-flight
		//      parent INSERT (Postgres WITH snapshot rule). The relationship's
		//      EXISTS is now rewritten to query the parent CTE in nested
		//      contexts so it sees the freshly-inserted row.
		{
			name: "permissions: nested array insert references FK (single row)",
			query: query{
				Query: `
					mutation {
					  insert_kb_entries_one(
						object: {
						  title: "Single-row nested array test",
						  summary: "summary",
						  content: "content",
						  kb_entry_departments: {
							data: [
							  { department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3" }
							]
						  }
						}) {
						title
					  }
					}`,
				Variables: map[string]any{},
				Role:      "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id":     "550e8400-e29b-41d4-a716-446655440001",
					"x-hasura-departments": "{2db9de0a-b9ba-416e-8619-783a399ae2b3,fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
				},
			},
		},

		{
			name: "permissions: nested array insert references FK (multiple rows)",
			query: query{
				Query: `
					mutation {
					  insert_kb_entries_one(
						object: {
						  title: "Multi-row nested array test",
						  summary: "summary",
						  content: "content",
						  kb_entry_departments: {
							data: [
							  { department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3" },
							  { department_id: "fd1e6bba-c292-4b2f-872e-ae16146cdd82" }
							]
						  }
						}) {
						title
					  }
					}`,
				Variables: map[string]any{},
				Role:      "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id":     "550e8400-e29b-41d4-a716-446655440001",
					"x-hasura-departments": "{2db9de0a-b9ba-416e-8619-783a399ae2b3,fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
				},
			},
		},

		{
			name: "permissions: nested array insert references FK (denied)",
			query: query{
				Query: `
					mutation {
					  insert_kb_entries_one(
						object: {
						  title: "Multi-row nested array denied",
						  summary: "summary",
						  content: "content",
						  kb_entry_departments: {
							data: [
							  { department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3" },
							  { department_id: "fd1e6bba-c292-4b2f-872e-ae16146cdd82" }
							]
						  }
						}) {
						title
					  }
					}`,
				Variables: map[string]any{},
				Role:      "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id":     "550e8400-e29b-41d4-a716-446655440001",
					"x-hasura-departments": "{fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
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
			name: "on_conflict where clause - actual conflict with _and condition only matching incoming row",
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

		// Insert through a composite-FK object relationship whose join column
		// (parent_kind) is a DB-defaulted discriminator the client never supplies.
		// Locks the post-check SQL shape and end-to-end execution (parent_kind
		// defaults to 'strength' on insert, the check sees the real row).
		{
			name: "permissions: composite-FK relationship with defaulted discriminator",
			query: query{
				Query: `
					mutation {
					  insert_exercise_log_sets_one(
						object: {
						  parent_id: "0199aaaa-0000-7000-8000-000000000001"
						  reps: 10
						}
					  ) {
						parent_id
						reps
					  }
					}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},

		{
			name: "permissions: composite-FK relationship with defaulted discriminator (denied)",
			query: query{
				Query: `
					mutation {
					  insert_exercise_log_sets_one(
						object: {
						  parent_id: "0199aaaa-0000-7000-8000-000000000001"
						  reps: 10
						}
					  ) {
						parent_id
					  }
					}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id": "11111111-1111-1111-1111-111111111111",
				},
			},
		},

		// Insert where the check references the table's GENERATED BY DEFAULT
		// AS IDENTITY primary key. `id` carries neither IsGenerated nor
		// HasDefault — it surfaces via pg_attribute.attidentity — so without
		// the IsIdentity post-check trigger the pre-mutation check would
		// build its data CTE with NULL standing in for id and the
		// `id._is_null: false` predicate (from public_identity_check_logs.yaml)
		// would fail. Locks the post-check SQL shape so the predicate runs
		// against the engine-assigned value.
		{
			name: "permissions: identity column referenced by insert check",
			query: query{
				Query: `
					mutation {
					  insert_identity_check_logs_one(
						object: {
						  note: "hello"
						}
					  ) {
						owner_id
						note
					  }
					}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},

		// Nested array-relationship insert of a child (note_replies) from its
		// parent (notes) where the child's insert check references the parent
		// via the `note` object relationship and the child's `visibility`
		// column is a DB default that the payload omits. requiresPostInsertCheck
		// fires for the child (defaulted column referenced by check, absent
		// from payload, not in nestedFKIndex). extendSubsForArrayChild populates
		// tableSubs[notes.TableFromClause()] = mutation_result. Threading
		// tableSubs into buildSingleInsertCTEPostCheck must redirect the
		// relationship-EXISTS in the post-check predicate so it reads the
		// parent's just-inserted row in mutation_result instead of the
		// underlying (empty in this isolated DB) notes table. Locks the SQL
		// shape AND end-to-end execution (parent is empty otherwise, so a
		// non-substituted EXISTS would deny every row).
		{
			name: "permissions: nested array-rel insert with post-check substituted to parent CTE",
			query: query{
				Query: `
					mutation {
					  insert_notes_one(object: {
						id: "0199bbbb-0000-7000-8000-000000000010"
						author_id: "550e8400-e29b-41d4-a716-446655440001"
						title: "Top-level note"
						replies: {
						  data: [
							{ body: "first reply" }
						  ]
						}
					  }) {
						id
						replies { body }
					  }
					}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},

		// Same shape but with two nested rows: forces the multi-row nested
		// path (buildMultiNestedInsertCTEPostCheck) so the SQL shape for the
		// multi-row sibling of the above case is locked too.
		{
			name: "permissions: nested array-rel insert with post-check (multi-row child)",
			query: query{
				Query: `
					mutation {
					  insert_notes_one(object: {
						id: "0199bbbb-0000-7000-8000-000000000011"
						author_id: "550e8400-e29b-41d4-a716-446655440001"
						title: "Note with multiple replies"
						replies: {
						  data: [
							{ body: "reply 1" },
							{ body: "reply 2" }
						  ]
						}
					  }) {
						id
					  }
					}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},

		// Same shape as "(multi-row child)" but selects ONLY the parent
		// `title` scalar — no `id`, no `replies`. This is the exact
		// shape that historically left the gated `nested_replies` and
		// `nested_replies_post_check` CTEs unreferenced by the outer
		// SELECT, allowing Postgres to elide them and silently bypass
		// `constellation_throw_error`. Locks the WHERE-clause force
		// reference emitted by writeNestedCTEForceRef so the regression
		// can't sneak back in.
		{
			name: "permissions: nested array-rel insert with post-check (parent scalar only, force CTE reference)",
			query: query{
				Query: `
					mutation {
					  insert_notes_one(object: {
						id: "0199bbbb-0000-7000-8000-000000000014"
						author_id: "550e8400-e29b-41d4-a716-446655440001"
						title: "Parent scalar only"
						replies: {
						  data: [
							{ body: "reply" }
						  ]
						}
					  }) {
						title
					  }
					}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},

		// Denied at the PARENT pre-check: session user_id doesn't match the
		// parent's author_id. The nested child's post-check never runs at
		// execution time, but the SQL is still generated using the substituted
		// path — locking the shape of the post-check CTE under denial
		// conditions as well.
		{
			name: "permissions: nested array-rel insert with post-check (denied at parent)",
			query: query{
				Query: `
					mutation {
					  insert_notes_one(object: {
						id: "0199bbbb-0000-7000-8000-000000000012"
						author_id: "550e8400-e29b-41d4-a716-446655440001"
						title: "Denied note"
						replies: {
						  data: [{ body: "reply" }]
						}
					  }) {
						id
					  }
					}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id": "11111111-1111-1111-1111-111111111111",
				},
			},
		},

		// --- Non-admin upsert UPDATE-check enforcement, executed against
		// PostgreSQL (finding C1). The `user` role on public.notes carries BOTH
		// an UPDATE row-filter (author_id = X-Hasura-User-Id) and an UPDATE check
		// (title != '__forbidden__'), so a non-admin on_conflict DO UPDATE drives
		// the xmax action marker / _upsert_updates / _update_post_check CTE chain.
		// These cases EXECUTE the generated SQL (not just string-match it), so a
		// semantic defect that silently defeats the permission enforcement fails
		// the _data.json golden. The note 0199cccc-...0001 is seeded in
		// pg_seeds.sql, owned by Sarah Martinez (550e8400-...0001).

		// Detectable conflict (the conflict-target key `id` is supplied) whose
		// resulting row PASSES the UPDATE check: the seeded note is genuinely
		// updated and the new title is returned.
		{
			name: "upsert non-admin detectable conflict passes update check",
			query: query{
				Query: `mutation {
					insert_notes_one(
						object: {
							id: "0199cccc-0000-7000-8000-000000000001"
							author_id: "550e8400-e29b-41d4-a716-446655440001"
							title: "Renamed Note"
						}
						on_conflict: {
							constraint: notes_pkey
							update_columns: [title]
						}
					) {
						id
						author_id
						title
					}
				}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},

		// Detectable conflict whose resulting row FAILS the UPDATE check
		// (title == '__forbidden__'): the _update_post_check CTE raises ZZ901 and
		// the whole all-or-nothing mutation aborts, so the seeded row is NOT
		// updated. Captured as the PgError map in the _data.json golden.
		{
			name: "upsert non-admin detectable conflict fails update check",
			query: query{
				Query: `mutation {
					insert_notes_one(
						object: {
							id: "0199cccc-0000-7000-8000-000000000001"
							author_id: "550e8400-e29b-41d4-a716-446655440001"
							title: "__forbidden__"
						}
						on_conflict: {
							constraint: notes_pkey
							update_columns: [title]
						}
					) {
						id
						title
					}
				}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},

		// Undetectable conflict key (`id` is omitted) whose row PASSES the INSERT
		// check. PostgreSQL uses the internal xmax marker from RETURNING to tell
		// this was a fresh INSERT, so the UPDATE check is not applied.
		{
			name: "upsert non-admin undetectable conflict passes insert check",
			query: query{
				Query: `mutation {
					insert_notes_one(
						object: {
							author_id: "550e8400-e29b-41d4-a716-446655440001"
							title: "Fresh Note"
						}
						on_conflict: {
							constraint: notes_pkey
							update_columns: [title]
						}
					) {
						author_id
						title
					}
				}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},

		// Undetectable conflict key whose freshly INSERTed row would fail the UPDATE
		// check (title == '__forbidden__') but passes the INSERT check. PostgreSQL
		// classifies it as inserted from xmax, matching Hasura's per-row
		// insert/update check selection.
		{
			name: "upsert non-admin undetectable conflict ignores update check for insert",
			query: query{
				Query: `mutation {
					insert_notes_one(
						object: {
							author_id: "550e8400-e29b-41d4-a716-446655440001"
							title: "__forbidden__"
						}
						on_conflict: {
							constraint: notes_pkey
							update_columns: [title]
						}
					) {
						author_id
						title
					}
				}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},
	}

	testBuildQuery(t, cases, true)
}

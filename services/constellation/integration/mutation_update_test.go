package integration_test

import (
	"testing"
)

func TestUpdateMutations(t *testing.T) { //nolint:paralleltest,maintidx
	cases := []TestCase{
		// Basic update operations
		{
			name: "update with simple WHERE clause",
			query: query{
				Query: `
					mutation {
						update_departments(
							where: { name: { _eq: "Engineering" } }
							_set: { budget: 200000 }
						) {
							returning {
								id
								name
								budget
							}
							affected_rows
						}
					}`,
				Variables: nil,
			},
		},

		{
			name: "without affected_rows",
			query: query{
				Query: `mutation {
					updateUsers(
						where: { disabled: { _eq: false } }
						_set: { locale: "en" }
					) {
						returning {
							id
							displayName
							locale
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "without returning",
			query: query{
				Query: `mutation {
					updateUsers(
						where: { disabled: { _eq: false } }
						_set: { locale: "en" }
					) {
						affected_rows
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "updateUsers returning only affected_rows",
			query: query{
				Query: `mutation {
					updateUsers(
						where: { emailVerified: { _eq: false } }
						_set: { emailVerified: true }
					) {
						affected_rows
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "update with multiple SET fields and WHERE",
			query: query{
				Query: `
					mutation {
						update_departments(
							where: { budget: { _lt: 100000 } }
							_set: {
								budget: 100000
								description: "Updated"
							}
						) {
							returning {
								id
								budget
							}
							affected_rows
						}
					}`,
				Variables: nil,
			},
		},

		{
			name: "update multiple fields on users",
			query: query{
				Query: `mutation {
					updateUsers(
						where: { email: { _like: "%@example.com" } }
						_set: {
							locale: "fr"
							disabled: false
							emailVerified: true
						}
					) {
						affected_rows
						returning {
							id
							email
							locale
							disabled
							emailVerified
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "update with variables in WHERE and SET",
			query: query{
				Query: `
					mutation($where: departments_bool_exp!, $_set: departments_set_input!) {
						update_departments(where: $where, _set: $_set) {
							returning {
								id
								name
							}
							affected_rows
						}
					}`,
				Variables: map[string]any{
					"where": map[string]any{
						"name": map[string]any{
							"_eq": "Sales",
						},
					},
					"_set": map[string]any{
						"budget": 150000,
					},
				},
			},
		},

		{
			name: "update with variables on users",
			query: query{
				Query: `mutation UpdateUsers($where: users_bool_exp!, $set: users_set_input!) {
					updateUsers(
						where: $where
						_set: $set
					) {
						affected_rows
						returning {
							id
							displayName
							locale
						}
					}
				}`,
				Variables: map[string]any{
					"where": map[string]any{
						"disabled": map[string]any{"_eq": false},
					},
					"set": map[string]any{
						"locale": "es",
					},
				},
				Role: "admin",
			},
		},

		// Complex WHERE clauses
		{
			name: "update with complex WHERE clause (_and)",
			query: query{
				Query: `
					mutation {
						update_departments(
							where: {
								_and: [
									{ budget: { _gte: 50000 } }
									{ budget: { _lte: 150000 } }
								]
							}
							_set: { description: "Mid-sized department" }
						) {
							returning {
								id
								name
							}
							affected_rows
						}
					}`,
				Variables: nil,
			},
		},

		{
			name: "update with _or WHERE clause",
			query: query{
				Query: `
					mutation {
						update_departments(
							where: {
								_or: [
									{ name: { _eq: "Engineering" } }
									{ name: { _eq: "Sales" } }
								]
							}
							_set: { budget: 100000 }
						) {
							returning {
								id
							}
							affected_rows
						}
					}`,
				Variables: nil,
			},
		},

		{
			name: "update with _not condition",
			query: query{
				Query: `mutation {
					updateUsers(
						where: {
							_not: { disabled: { _eq: true } }
						}
						_set: { locale: "ja" }
					) {
						affected_rows
						returning {
							id
							disabled
							locale
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "update with _in operator",
			query: query{
				Query: `
					mutation($names: [String!]!) {
						update_departments(
							where: { name: { _in: $names } }
							_set: { budget: 75000 }
						) {
							returning {
								id
								name
							}
							affected_rows
						}
					}`,
				Variables: map[string]any{
					"names": []any{"IT", "HR", "Legal"},
				},
			},
		},

		{
			name: "update with _neq operator",
			query: query{
				Query: `
					mutation {
						update_departments(
							where: { name: { _neq: "Archived" } }
							_set: { budget: 50000 }
						) {
							returning {
								id
							}
							affected_rows
						}
					}`,
				Variables: nil,
			},
		},

		{
			name: "update with _is_null operator",
			query: query{
				Query: `
					mutation {
						update_departments(
							where: { description: { _is_null: true } }
							_set: { description: "No description" }
						) {
							returning {
								id
							}
							affected_rows
						}
					}`,
				Variables: nil,
			},
		},

		{
			name: "update with _like operator",
			query: query{
				Query: `mutation {
					update_departments(
						where: { name: { _like: "%Eng%" } }
						_set: { name: "Engineering Team" }
					) {
						affected_rows
						returning {
							id
							name
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Edge cases
		{
			name: "update without WHERE clause (error)",
			query: query{
				Query: `
					mutation {
						update_departments(
							_set: { description: "All departments" }
						) {
							returning {
								id
							}
							affected_rows
						}
					}`,
				Variables: nil,
			},
			expected: map[string]any{
				"errors": []any{
					map[string]any{
						"message": `Field "update_departments" argument "where" of type "departments_bool_exp!" is required, but it was not provided.`,
						"locations": []any{
							map[string]any{"line": float64(3), "column": float64(7)},
						},
					},
				},
			},
		},

		{
			name: "update with empty WHERE clause",
			query: query{
				Query: `
					mutation {
						update_departments(
							_set: { description: "All departments" }
							where: {},
						) {
							returning {
								id
							}
							affected_rows
						}
					}`,
				Variables: nil,
			},
		},

		{
			name: "update with null value in SET",
			query: query{
				Query: `
					mutation {
						update_departments(
							where: { name: { _eq: "Temp" } }
							_set: { description: null }
						) {
							returning {
								id
								description
							}
							affected_rows
						}
					}`,
				Variables: nil,
			},
		},

		{
			name: "update with no matching rows",
			query: query{
				Query: `mutation {
					updateUsers(
						where: { email: { _eq: "nonexistent@example.com" } }
						_set: { disabled: true }
					) {
						affected_rows
						returning {
							id
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "update boolean fields",
			query: query{
				Query: `mutation {
					updateUsers(
						where: { isAnonymous: { _eq: false } }
						_set: {
							emailVerified: true
							phoneNumberVerified: true
						}
					) {
						affected_rows
						returning {
							id
							emailVerified
							phoneNumberVerified
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Return field variations
		{
			name: "update returning all fields",
			query: query{
				Query: `
					mutation($_set: departments_set_input!) {
						update_departments(
							where: { budget: { _gt: 100000 } }
							_set: $_set
						) {
							returning {
								id
								name
								description
								budget
							}
							affected_rows
						}
					}`,
				Variables: map[string]any{
					"_set": map[string]any{
						"description": "High budget department",
					},
				},
			},
		},

		{
			name: "update with selective field return",
			query: query{
				Query: `mutation {
					updateUsers(
						where: { email: { _like: "%@example.com" } }
						_set: { disabled: false }
					) {
						affected_rows
						returning {
							email
							disabled
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Nested relationships
		{
			name: "with nested relationships in returning",
			query: query{
				Query: `mutation {
					updateUsers(
						where: { disabled: { _eq: false } }
						_set: { locale: "en" }
					) {
						affected_rows
						returning {
							id
							displayName
							locale
							departments {
								department {
									name
								}
							}
						}
					}
				}`,
				Variables: map[string]any{},
				Role:      "admin",
			},
		},

		// _inc operations
		{
			name: "update with _inc - increment department budget",
			query: query{
				Query: `mutation {
					update_departments(
						where: { name: { _eq: "Engineering" } }
						_inc: { budget: 10000 }
					) {
						affected_rows
						returning {
							id
							name
							budget
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "update with _inc - negative increment (decrement)",
			query: query{
				Query: `mutation {
					update_departments(
						where: { name: { _eq: "Sales" } }
						_inc: { budget: -5000 }
					) {
						affected_rows
						returning {
							id
							name
							budget
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "update with both _set and _inc",
			query: query{
				Query: `mutation {
					update_departments(
						where: { name: { _eq: "Marketing" } }
						_set: { description: "Updated marketing department" }
						_inc: { budget: 15000 }
					) {
						affected_rows
						returning {
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

		{
			name: "update with _inc using variables",
			query: query{
				Query: `mutation IncrementBudget($where: departments_bool_exp!, $_inc: departments_inc_input!) {
					update_departments(
						where: $where
						_inc: $_inc
					) {
						affected_rows
						returning {
							id
							name
							budget
						}
					}
				}`,
				Variables: map[string]any{
					"where": map[string]any{
						"budget": map[string]any{"_lt": 100000},
					},
					"_inc": map[string]any{
						"budget": 20000,
					},
				},
				Role: "admin",
			},
		},

		{
			name: "update with _inc only returning affected_rows",
			query: query{
				Query: `mutation {
					update_departments(
						where: { budget: { _gte: 50000 } }
						_inc: { budget: 5000 }
					) {
						affected_rows
					}
				}`,
				Role: "admin",
			},
		},

		// Permission tests - departments (user role with department-manager filter)
		{
			name: "permissions: update department (allowed)",
			query: query{
				Query: `mutation {
					update_departments(
						where: { id: { _eq: "2db9de0a-b9ba-416e-8619-783a399ae2b3" } }
						_set: { description: "Updated by manager" }
					) {
						affected_rows
						returning {
							id
							name
							description
						}
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
			name: "permissions: update department (denied - not manager)",
			query: query{
				Query: `mutation {
					update_departments(
						where: { id: { _eq: "2db9de0a-b9ba-416e-8619-783a399ae2b3" } }
						_set: { description: "Should not update" }
					) {
						affected_rows
						returning {
							id
							name
							description
						}
					}
				}`,
				Role: "user",
				SessionVariables: map[string]string{
					"user-id":            "550e8400-e29b-41d4-a716-446655440001",
					"department-manager": `{"fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
				},
			},
		},

		// Permission tests - user_departments (user role with department-manager filter)
		{
			name: "permissions: update user_departments (allowed)",
			query: query{
				Query: `mutation {
					update_user_departments(
						where: { department_id: { _eq: "2db9de0a-b9ba-416e-8619-783a399ae2b3" } }
						_set: { role: member }
					) {
						affected_rows
						returning {
							user_id
							department_id
							role
						}
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
			name: "permissions: update user_departments (denied - not manager)",
			query: query{
				Query: `mutation {
					update_user_departments(
						where: { department_id: { _eq: "2db9de0a-b9ba-416e-8619-783a399ae2b3" } }
						_set: { role: member }
					) {
						affected_rows
						returning {
							user_id
							department_id
							role
						}
					}
				}`,
				Role: "user",
				SessionVariables: map[string]string{
					"user-id":            "550e8400-e29b-41d4-a716-446655440001",
					"department-manager": `{"fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
				},
			},
			expected: nil,
		},

		{
			name: "update_many with single update",
			query: query{
				Query: `mutation {
					update_departments_many(
						updates: [
							{
								where: { name: { _eq: "Engineering" } }
								_set: { budget: 300000 }
							}
						]
					) {
						affected_rows
						returning {
							id
							name
							budget
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "update_many with nested relationships in returning",
			query: query{
				Query: `mutation {
					update_departments_many(
						updates: [
							{
								where: { id: { _eq: "2db9de0a-b9ba-416e-8619-783a399ae2b3" } }
								_set: { description: "Updated department" }
							}
						]
					) {
						affected_rows
						returning {
							id
							name
							employees {
								user_id
								role
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "update_many with alias",
			query: query{
				Query: `mutation {
					myUpdates: update_departments_many(
						updates: [
							{
								where: { name: { _eq: "Engineering" } }
								_set: { budget: 500000 }
							}
						]
					) {
						affected_rows
					}
				}`,
				Role: "admin",
			},
		},

		// Permission tests - users (user role with user-id filter and check)
		{
			name: "permissions: update own user profile (allowed)",
			query: query{
				Query: `mutation {
					updateUsers(
						where: { id: { _eq: "550e8400-e29b-41d4-a716-446655440001" } }
						_set: { displayName: "Updated Name", locale: "fr" }
					) {
						affected_rows
						returning {
							id
							displayName
							locale
						}
					}
				}`,
				Role: "user",
				SessionVariables: map[string]string{
					"user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},

		{
			name: "permissions: update other user profile (denied)",
			query: query{
				Query: `mutation {
					updateUsers(
						where: { id: { _eq: "550e8400-e29b-41d4-a716-446655440002" } }
						_set: { displayName: "Should not update" }
					) {
						affected_rows
						returning {
							id
							displayName
						}
					}
				}`,
				Role: "user",
				SessionVariables: map[string]string{
					"user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},

		// Permission tests with _inc
		{
			name: "permissions: update department with _inc (allowed)",
			query: query{
				Query: `mutation {
					update_departments(
						where: { id: { _eq: "2db9de0a-b9ba-416e-8619-783a399ae2b3" } }
						_inc: { budget: 5000 }
					) {
						affected_rows
						returning {
							id
							name
							budget
						}
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
			name: "permissions: update department with _inc (denied)",
			query: query{
				Query: `mutation {
					update_departments(
						where: { id: { _eq: "2db9de0a-b9ba-416e-8619-783a399ae2b3" } }
						_inc: { budget: 5000 }
					) {
						affected_rows
						returning {
							id
							name
							budget
						}
					}
				}`,
				Role: "user",
				SessionVariables: map[string]string{
					"user-id":            "550e8400-e29b-41d4-a716-446655440001",
					"department-manager": `{"fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
				},
			},
		},

		// JSONB _append operations
		{
			name: "jsonb _append - append to array",
			query: query{
				Query: `mutation {
					updateUsers(
						where: { id: { _eq: "550e8400-e29b-41d4-a716-446655440001" } }
						_append: { metadata: { tags: ["new-tag"] } }
					) {
						affected_rows
						returning {
							id
							metadata
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _append - append object to array",
			query: query{
				Query: `mutation {
					updateUsers(
						where: { id: { _eq: "550e8400-e29b-41d4-a716-446655440011" } }
						_append: { metadata: { projects: [{ id: 103, name: "New Project" }] } }
					) {
						affected_rows
						returning {
							id
							metadata
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _append with variables",
			query: query{
				Query: `mutation AppendMetadata($where: users_bool_exp!, $append: users_append_input!) {
					updateUsers(
						where: $where
						_append: $append
					) {
						affected_rows
						returning {
							id
							metadata
						}
					}
				}`,
				Variables: map[string]any{
					"where": map[string]any{
						"id": map[string]any{"_eq": "550e8400-e29b-41d4-a716-446655440001"},
					},
					"append": map[string]any{
						"metadata": []any{"new-skill"},
					},
				},
				Role: "admin",
			},
		},

		// JSONB _prepend operations
		{
			name: "jsonb _prepend - prepend to array",
			query: query{
				Query: `mutation {
					updateUsers(
						where: { id: { _eq: "550e8400-e29b-41d4-a716-446655440001" } }
						_prepend: { metadata: { tags: ["priority-tag"] } }
					) {
						affected_rows
						returning {
							id
							metadata
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _prepend with variables",
			query: query{
				Query: `mutation PrependMetadata($where: users_bool_exp!, $prepend: users_prepend_input!) {
					updateUsers(
						where: $where
						_prepend: $prepend
					) {
						affected_rows
						returning {
							id
							metadata
						}
					}
				}`,
				Variables: map[string]any{
					"where": map[string]any{
						"id": map[string]any{"_eq": "550e8400-e29b-41d4-a716-446655440011"},
					},
					"prepend": map[string]any{
						"metadata": []any{"rust"},
					},
				},
				Role: "admin",
			},
		},

		// JSONB _delete_key operations
		{
			name: "jsonb _delete_key - delete top-level key",
			query: query{
				Query: `mutation {
					updateUsers(
						where: { id: { _eq: "550e8400-e29b-41d4-a716-446655440001" } }
						_delete_key: { metadata: "tags" }
					) {
						affected_rows
						returning {
							id
							metadata
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _delete_key with variables",
			query: query{
				Query: `mutation DeleteKey($where: users_bool_exp!, $deleteKey: users_delete_key_input!) {
					updateUsers(
						where: $where
						_delete_key: $deleteKey
					) {
						affected_rows
						returning {
							id
							metadata
						}
					}
				}`,
				Variables: map[string]any{
					"where": map[string]any{
						"id": map[string]any{"_eq": "550e8400-e29b-41d4-a716-446655440001"},
					},
					"deleteKey": map[string]any{
						"metadata": "preferences",
					},
				},
				Role: "admin",
			},
		},

		// JSONB _delete_elem operations (requires JSONB array column - users 003, 004 have array metadata)
		{
			name: "jsonb _delete_elem - delete element at index 0",
			query: query{
				Query: `mutation {
					updateUsers(
						where: { id: { _eq: "550e8400-e29b-41d4-a716-446655440003" } }
						_delete_elem: { metadata: 0 }
					) {
						affected_rows
						returning {
							id
							metadata
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _delete_elem - delete element at index 2",
			query: query{
				Query: `mutation {
					updateUsers(
						where: { id: { _eq: "550e8400-e29b-41d4-a716-446655440004" } }
						_delete_elem: { metadata: 2 }
					) {
						affected_rows
						returning {
							id
							metadata
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _delete_elem - negative index deletes from end",
			query: query{
				Query: `mutation {
					updateUsers(
						where: { id: { _eq: "550e8400-e29b-41d4-a716-446655440004" } }
						_delete_elem: { metadata: -1 }
					) {
						affected_rows
						returning {
							id
							metadata
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _delete_elem with variables",
			query: query{
				Query: `mutation DeleteElem($where: users_bool_exp!, $deleteElem: users_delete_elem_input!) {
					updateUsers(
						where: $where
						_delete_elem: $deleteElem
					) {
						affected_rows
						returning {
							id
							metadata
						}
					}
				}`,
				Variables: map[string]any{
					"where": map[string]any{
						"id": map[string]any{"_eq": "550e8400-e29b-41d4-a716-446655440003"},
					},
					"deleteElem": map[string]any{
						"metadata": 1,
					},
				},
				Role: "admin",
			},
		},

		// JSONB _delete_at_path operations
		{
			name: "jsonb _delete_at_path - delete nested key",
			query: query{
				Query: `mutation {
					updateUsers(
						where: { id: { _eq: "550e8400-e29b-41d4-a716-446655440001" } }
						_delete_at_path: { metadata: ["profile", "title"] }
					) {
						affected_rows
						returning {
							id
							metadata
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _delete_at_path - delete deeply nested key",
			query: query{
				Query: `mutation {
					updateUsers(
						where: { id: { _eq: "550e8400-e29b-41d4-a716-446655440001" } }
						_delete_at_path: { metadata: ["preferences", "notifications", "email"] }
					) {
						affected_rows
						returning {
							id
							metadata
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _delete_at_path with variables",
			query: query{
				Query: `mutation DeleteAtPath($where: users_bool_exp!, $deleteAtPath: users_delete_at_path_input!) {
					updateUsers(
						where: $where
						_delete_at_path: $deleteAtPath
					) {
						affected_rows
						returning {
							id
							metadata
						}
					}
				}`,
				Variables: map[string]any{
					"where": map[string]any{
						"id": map[string]any{"_eq": "550e8400-e29b-41d4-a716-446655440011"},
					},
					"deleteAtPath": map[string]any{
						"metadata": []any{"profile", "yearsExperience"},
					},
				},
				Role: "admin",
			},
		},

		// Combined JSONB operations
		{
			name: "jsonb combined - _set and _append",
			query: query{
				Query: `mutation {
					updateUsers(
						where: { id: { _eq: "550e8400-e29b-41d4-a716-446655440001" } }
						_set: { locale: "fr" }
						_append: { metadata: { skills: ["french"] } }
					) {
						affected_rows
						returning {
							id
							locale
							metadata
						}
					}
				}`,
				Role: "admin",
			},
		},

		// JSONB with permissions
		{
			name: "jsonb _append with permissions (allowed)",
			query: query{
				Query: `mutation {
					updateUsers(
						where: { id: { _eq: "550e8400-e29b-41d4-a716-446655440001" } }
						_append: { metadata: { tags: ["self-update"] } }
					) {
						affected_rows
						returning {
							id
							metadata
						}
					}
				}`,
				Role: "user",
				SessionVariables: map[string]string{
					"user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},

		{
			name: "jsonb _delete_at_path with permissions (denied)",
			query: query{
				Query: `mutation {
					updateUsers(
						where: { id: { _eq: "550e8400-e29b-41d4-a716-446655440002" } }
						_delete_at_path: { metadata: ["profile", "title"] }
					) {
						affected_rows
						returning {
							id
							metadata
						}
					}
				}`,
				Role: "user",
				SessionVariables: map[string]string{
					"user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},

		// presets
		{
			name: "update with preset from session variable",
			query: query{
				Query: `mutation {
					updateFiles(
						where: { id: { _eq: "11111111-1111-1111-1111-111111111111" } }
						_set: { name: "renamed-file.txt" }
					) {
						affected_rows
						returning {
							id
							name
							uploadedByUserId
						}
					}
				}`,
				Role: "user",
				SessionVariables: map[string]string{
					"user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},
	}

	RunGraphQLTests(t, cases, TestConfig{
		IsMutation:           true,
		ReinitBetweenQueries: true,
	})
}

// TestUpdateOperatorValidationErrors checks the GraphQL error envelope for
// invalid update-operator input.
//
//   - Same column in two operators (_set + _inc on budget): both engines reject
//     at validation and the envelope matches Hasura byte-for-byte
//     (validation-failed, path $.selectionSet.update_departments.args), so it is
//     compared live against Hasura.
//   - No operator supplied (update / update_by_pk / update_many): Constellation
//     rejects all three with the same clean validation-failed envelope, whereas
//     Hasura diverges — it silently no-ops the collection update (affected_rows
//     0), returns {} for _by_pk, and emits a SET-less SQL syntax error for a
//     _many element. That is an intentional, documented deviation
//     (KNOWN_DIFFERENCES.md), so each no-operator case asserts Constellation's
//     envelope via a fixed expected response — guarding against a regression to
//     a sanitized "internal server error" in production — rather than diffing
//     against Hasura.
func TestUpdateOperatorValidationErrors(t *testing.T) { //nolint:paralleltest
	cases := []TestCase{
		{
			name: "update with same column in two operators (validation error)",
			query: query{
				Query: `mutation {
					update_departments(
						where: { name: { _eq: "Marketing" } }
						_set: { budget: 100 }
						_inc: { budget: 5 }
					) {
						affected_rows
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "update with no operators (validation error)",
			query: query{
				Query: `mutation {
					update_departments(where: { name: { _eq: "Marketing" } }) {
						affected_rows
					}
				}`,
				Role: "admin",
			},
			expected: map[string]any{
				"errors": []any{
					map[string]any{
						"message": "at least one update operator must be provided",
						"extensions": map[string]any{
							"code": "validation-failed",
							"path": "$.selectionSet.update_departments.args",
						},
					},
				},
			},
		},
		{
			// Hasura returns an empty object {} for a no-operator _by_pk update;
			// Constellation rejects with the validation-failed envelope.
			name: "update_by_pk with no operators (validation error)",
			query: query{
				Query: `mutation {
					update_departments_by_pk(
						pk_columns: { id: "dcd52518-58d0-4834-9683-ba6dee33833f" }
					) {
						id
					}
				}`,
				Role: "admin",
			},
			expected: map[string]any{
				"errors": []any{
					map[string]any{
						"message": "at least one update operator must be provided",
						"extensions": map[string]any{
							"code": "validation-failed",
							"path": "$.selectionSet.update_departments_by_pk.args",
						},
					},
				},
			},
		},
		{
			// Hasura returns [] for a single empty _many element (and a SET-less
			// SQL syntax error when an empty element is mixed with a non-empty
			// one); Constellation rejects the empty element with the
			// validation-failed envelope.
			name: "update_many with an empty update element (validation error)",
			query: query{
				Query: `mutation {
					update_departments_many(
						updates: [{ where: { name: { _eq: "Marketing" } } }]
					) {
						affected_rows
					}
				}`,
				Role: "admin",
			},
			expected: map[string]any{
				"errors": []any{
					map[string]any{
						"message": "at least one update operator must be provided",
						"extensions": map[string]any{
							"code": "validation-failed",
							"path": "$.selectionSet.update_departments_many.args",
						},
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

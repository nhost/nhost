package integration_test

import (
	"testing"
)

func TestInsertMutations(t *testing.T) { //nolint:paralleltest,maintidx
	cases := []TestCase{
		{
			name: "insert basic - 2 rows",
			query: query{
				Query: `mutation {
					insert_departments(objects: [
						{
							id: "00000000-0000-0000-0000-000000000001"
							name: "Engineering 2"
							description: "Engineering Department"
						},
						{
							id: "00000000-0000-0000-0000-000000000002"
							name: "Marketing 2"
							description: "Marketing Department"
						}
					]) {
						affected_rows
						returning {
							id
							name
							description
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "insert basic - 2 rows (no affected_rows)",
			query: query{
				Query: `mutation {
					insert_departments(objects: [
						{
							id: "00000000-0000-0000-0000-000000000001"
							name: "Engineering 2"
							description: "Engineering Department"
						},
						{
							id: "00000000-0000-0000-0000-000000000002"
							name: "Marketing 2"
							description: "Marketing Department"
						}
					]) {
						returning {
							id
							name
							description
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "insert with variables - 3 rows",
			query: query{
				Query: `mutation InsertDepts($objects: [departments_insert_input!]!) {
					insert_departments(objects: $objects) {
						affected_rows
						returning {
							id
							name
						}
					}
				}`,
				Variables: map[string]any{
					"objects": []any{
						map[string]any{
							"id":          "00000000-0000-0000-0000-000000000003",
							"name":        "Sales 2",
							"description": "Sales Department",
						},
						map[string]any{
							"id":          "00000000-0000-0000-0000-000000000004",
							"name":        "HR 2",
							"description": "Human Resources",
						},
						map[string]any{
							"id":          "00000000-0000-0000-0000-000000000005",
							"name":        "Finance 2",
							"description": "Finance Department",
						},
					},
				},
				Role: "admin",
			},
		},

		{
			name: "insert affected_rows only",
			query: query{
				Query: `mutation {
					insert_departments(objects: [
						{
							id: "00000000-0000-0000-0000-000000000006"
							name: "Operations 2"
						},
						{
							id: "00000000-0000-0000-0000-000000000007"
							name: "Support 2"
						}
					]) {
						affected_rows
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "insert with on_conflict do update",
			query: query{
				Query: `mutation {
					insert_departments(
						objects: [
							{
								id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
								name: "HR Updated"
								description: "Updated HR"
							},
							{
								id: "00000000-0000-0000-0000-000000000008"
								name: "New Dept"
								description: "New Department"
							}
						]
						on_conflict: {
							constraint: departments_pkey
							update_columns: [name, description]
						}
					) {
						affected_rows
						returning {
							id
							name
							description
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "insert with on_conflict do nothing",
			query: query{
				Query: `mutation {
					insert_departments(
						objects: [
							{
								id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
								name: "Will Be Ignored"
							},
							{
								id: "00000000-0000-0000-0000-000000000009"
								name: "Will Insert"
							}
						]
						on_conflict: {
							constraint: departments_pkey
							update_columns: []
						}
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

		{
			name: "insert with on_conflict using variables",
			query: query{
				Query: `mutation InsertDepts($objects: [departments_insert_input!]!, $onConflict: departments_on_conflict) {
					insert_departments(objects: $objects, on_conflict: $onConflict) {
						affected_rows
						returning {
							id
							name
						}
					}
				}`,
				Variables: map[string]any{
					"objects": []any{
						map[string]any{
							"id":   "2db9de0a-b9ba-416e-8619-783a399ae2b3",
							"name": "HR Variable Update",
						},
						map[string]any{
							"id":   "00000000-0000-0000-0000-000000000010",
							"name": "New Variable Dept",
						},
					},
					"onConflict": map[string]any{
						"constraint":     "departments_pkey",
						"update_columns": []any{"name"},
					},
				},
				Role: "admin",
			},
		},

		{
			name: "insert users - multiple data types",
			query: query{
				Query: `mutation {
					insertUsers(objects: [
						{
							id: "00000000-0000-0000-0000-000000000011"
							displayName: "Alice"
							email: "alice@example.com"
							disabled: false
							defaultRole: "user"
							locale: "en"
							emailVerified: true
							isAnonymous: false
						},
						{
							id: "00000000-0000-0000-0000-000000000012"
							displayName: "Bob"
							email: "bob@example.com"
							disabled: true
							defaultRole: "user"
							locale: "fr"
							emailVerified: false
							isAnonymous: false
						},
						{
							id: "00000000-0000-0000-0000-000000000013"
							displayName: "Charlie"
							email: "charlie@example.com"
							disabled: false
							defaultRole: "me"
							locale: "de"
							emailVerified: true
							isAnonymous: true
						}
					]) {
						affected_rows
						returning {
							id
							displayName
							email
							disabled
							defaultRole
							locale
							emailVerified
							isAnonymous
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "insert with nullable fields - mixed",
			query: query{
				Query: `mutation {
					insertUsers(objects: [
						{
							id: "00000000-0000-0000-0000-000000000014"
							displayName: "User With Phone"
							email: "phone@example.com"
							disabled: false
							defaultRole: "user"
							locale: "en"
							phoneNumber: "+1234567890"
						},
						{
							id: "00000000-0000-0000-0000-000000000015"
							displayName: "User Without Phone"
							email: "nophone@example.com"
							disabled: false
							defaultRole: "user"
							locale: "en"
						}
					]) {
						affected_rows
						returning {
							id
							displayName
							phoneNumber
							avatarUrl
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "insert with relationships in returning",
			query: query{
				Query: `mutation {
					insertUsers(objects: [
						{
							id: "00000000-0000-0000-0000-000000000016"
							displayName: "User With Role Lookup"
							email: "lookup@example.com"
							disabled: false
							defaultRole: "user"
							locale: "en"
						}
					]) {
						affected_rows
						returning {
							id
							displayName
							defaultRoleByRole {
								role
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "insert permissions - simple",
			query: query{
				Query: `mutation {
					insert_user_departments(objects: [
						{
							user_id: "550e8400-e29b-41d4-a716-446655440021"
							department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
							role: member
						},
						{
							user_id: "550e8400-e29b-41d4-a716-446655440032"
							department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
							role: member
						}
					]) {
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
					"department-manager": `{"2db9de0a-b9ba-416e-8619-783a399ae2b3","fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
				},
			},
		},

		{
			name: "insert permissions - partial denial",
			query: query{
				Query: `mutation {
					insert_user_departments(objects: [
						{
							user_id: "550e8400-e29b-41d4-a716-446655440021"
							department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
							role: member
						},
						{
							user_id: "550e8400-e29b-41d4-a716-446655440022"
							department_id: "fd1e6bba-c292-4b2f-872e-ae16146cdd82"
							role: member
						}
					]) {
						affected_rows
						returning {
							user_id
							department_id
						}
					}
				}`,
				Role: "user",
				SessionVariables: map[string]string{
					"user-id":            "550e8400-e29b-41d4-a716-446655440001",
					"department-manager": `{"fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
				},
			},
			expected: map[string]any{
				"errors": []any{
					map[string]any{
						"message": `failed to execute operations: failed to execute operation insert_user_departments: failed to scan result row: ERROR: check constraint of an insert/update permission has failed (SQLSTATE ZZ901)`,
					},
				},
			},
		},

		{
			name: "insert single row - edge case",
			query: query{
				Query: `mutation {
					insert_departments(objects: [
						{
							id: "00000000-0000-0000-0000-000000000017"
							name: "Single Row Insert"
							description: "Testing single row via insert"
						}
					]) {
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

		{
			name: "insert many rows - 5 rows",
			query: query{
				Query: `mutation {
					insert_departments(objects: [
						{ id: "00000000-0000-0000-0000-000000000018", name: "Dept 1" },
						{ id: "00000000-0000-0000-0000-000000000019", name: "Dept 2" },
						{ id: "00000000-0000-0000-0000-000000000020", name: "Dept 3" },
						{ id: "00000000-0000-0000-0000-000000000021", name: "Dept 4" },
						{ id: "00000000-0000-0000-0000-000000000022", name: "Dept 5" }
					]) {
						affected_rows
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "insert with mixed required and optional fields",
			query: query{
				Query: `mutation {
					insert_departments(objects: [
						{
							id: "00000000-0000-0000-0000-000000000023"
							name: "With Budget"
							description: "Has budget"
							budget: 500000
						},
						{
							id: "00000000-0000-0000-0000-000000000024"
							name: "Without Budget"
							description: "No budget"
						}
					]) {
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

		// on_conflict with where clause
		{
			name: "insert with on_conflict where clause",
			query: query{
				Query: `mutation {
					insert_departments(
						objects: [
							{
								id: "00000000-0000-0000-0000-000000000025"
								name: "Conditional Dept 1"
								description: "First conditional department"
								budget: 100000
							},
							{
								id: "00000000-0000-0000-0000-000000000026"
								name: "Conditional Dept 2"
								description: "Second conditional department"
								budget: 200000
							}
						]
						on_conflict: {
							constraint: departments_pkey
							update_columns: [name, description]
							where: { budget: { _gt: 50000 } }
						}
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

		// presets
		{
			name: "insert_collection with preset from session variable",
			query: query{
				Query: `mutation {
					insertFiles(objects: [
						{
							id: "22222222-2222-2222-2222-222222222222"
							bucketId: "profile_pics"
							name: "file1.txt"
							mimeType: "text/plain"
							size: 512
							etag: "def456"
							isUploaded: true
						},
						{
							id: "33333333-3333-3333-3333-333333333333"
							bucketId: "profile_pics"
							name: "file2.txt"
							mimeType: "text/plain"
							size: 768
							etag: "ghi789"
							isUploaded: true
						}
					]) {
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
					"user-id": "550e8400-e29b-41d4-a716-446655440002",
				},
			},
		},

		// Multi-row insert through a composite-FK object relationship with a
		// DB-defaulted discriminator join column (parent_kind, defaulted to
		// 'strength' and pinned by CHECK). All rows must be inserted with the
		// default applied before the check fires — locks Hasura parity for
		// the buildInsertMutationCTE post-check dispatch on batches.
		{
			name: "permissions: multi-row composite-FK with defaulted discriminator",
			query: query{
				Query: `
					mutation {
					  insert_exercise_log_sets(objects: [
						{ parent_id: "0199aaaa-0000-7000-8000-000000000001", reps: 5 }
						{ parent_id: "0199aaaa-0000-7000-8000-000000000001", reps: 8 }
					  ]) {
						affected_rows
						returning { parent_id reps }
					  }
					}`,
				Variables: map[string]any{},
				Role:      "user",
				SessionVariables: map[string]string{
					"user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},

		{
			name: "permissions: multi-row composite-FK with defaulted discriminator (denied)",
			query: query{
				Query: `
					mutation {
					  insert_exercise_log_sets(objects: [
						{ parent_id: "0199aaaa-0000-7000-8000-000000000001", reps: 5 }
					  ]) {
						affected_rows
					  }
					}`,
				Variables: map[string]any{},
				Role:      "user",
				SessionVariables: map[string]string{
					"user-id": "550e8400-e29b-41d4-a716-446655440099",
				},
			},
			expected: map[string]any{
				"errors": []any{
					map[string]any{
						"message": `failed to execute operations: failed to execute operation insert_exercise_log_sets: failed to scan result row: ERROR: check constraint of an insert/update permission has failed (SQLSTATE ZZ901)`,
					},
				},
			},
		},

		// Top-level multi-row parent insert with nested array-relationship
		// children whose post-check (`note.author_id = X-Hasura-User-Id AND
		// visibility = 'public'`) reaches the parent through note_id and
		// references the DB-defaulted `visibility` column absent from the
		// payload. Exercises buildMultiNestedInsertCTEPostCheck threading
		// tableSubs into permissions.Store.WriteInsertCheckSubstituted so the
		// EXISTS subquery reads from each parent's in-flight mutation_result
		// CTE instead of the empty public.notes table.
		{
			name: "permissions: multi-row parent insert with nested array replies through parent CTE",
			query: query{
				Query: `
					mutation {
					  insert_notes(objects: [
						{
						  id: "0199bbbb-0000-7000-8000-000000000020"
						  author_id: "550e8400-e29b-41d4-a716-446655440001"
						  title: "Parent one"
						  replies: {
							data: [
							  { body: "reply 1a" }
							  { body: "reply 1b" }
							]
						  }
						}
						{
						  id: "0199bbbb-0000-7000-8000-000000000021"
						  author_id: "550e8400-e29b-41d4-a716-446655440001"
						  title: "Parent two"
						  replies: {
							data: [
							  { body: "reply 2a" }
							]
						  }
						}
					  ]) {
						affected_rows
						returning { title }
					  }
					}`,
				Variables: map[string]any{},
				Role:      "user",
				SessionVariables: map[string]string{
					"user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},

		{
			name: "permissions: multi-row parent insert with nested replies denied (wrong author)",
			query: query{
				Query: `
					mutation {
					  insert_notes(objects: [
						{
						  id: "0199bbbb-0000-7000-8000-000000000022"
						  author_id: "550e8400-e29b-41d4-a716-446655440099"
						  title: "Wrong owner"
						  replies: {
							data: [
							  { body: "should not insert" }
							]
						  }
						}
					  ]) {
						affected_rows
					  }
					}`,
				Variables: map[string]any{},
				Role:      "user",
				SessionVariables: map[string]string{
					"user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
			expected: map[string]any{
				"errors": []any{
					map[string]any{
						"message": `failed to execute operations: failed to execute operation insert_notes: failed to scan result row: ERROR: check constraint of an insert/update permission has failed (SQLSTATE ZZ901)`,
					},
				},
			},
		},

		// Multi-row sibling of the single-row denial: parent pre-check passes
		// for every row, so each child runs through
		// buildMultiNestedInsertCTEPostCheck with tableSubs pointing the
		// note.author_id EXISTS at the parents' in-flight mutation_result CTE.
		// One child supplies `visibility: "private"` to trip the leaf
		// `visibility _eq "public"` half of the child's `_and`; the
		// substituted relationship half still passes, so the denial
		// demonstrably comes from the child post-check evaluated against
		// RETURNING *.
		{
			name: "permissions: multi-row parent insert denied at substituted child post-check (visibility private)",
			query: query{
				Query: `
					mutation {
					  insert_notes(objects: [
						{
						  id: "0199bbbb-0000-7000-8000-000000000023"
						  author_id: "550e8400-e29b-41d4-a716-446655440001"
						  title: "Parent passes A"
						  replies: {
							data: [
							  { body: "ok reply" }
							]
						  }
						}
						{
						  id: "0199bbbb-0000-7000-8000-000000000024"
						  author_id: "550e8400-e29b-41d4-a716-446655440001"
						  title: "Parent passes B"
						  replies: {
							data: [
							  { body: "private reply", visibility: "private" }
							]
						  }
						}
					  ]) {
						affected_rows
					  }
					}`,
				Variables: map[string]any{},
				Role:      "user",
				SessionVariables: map[string]string{
					"user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
			expected: map[string]any{
				"errors": []any{
					map[string]any{
						"message": `failed to execute operations: failed to execute operation insert_notes: failed to scan result row: ERROR: check constraint of an insert/update permission has failed (SQLSTATE ZZ901)`,
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

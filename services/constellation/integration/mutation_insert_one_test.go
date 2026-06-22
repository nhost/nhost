package integration_test

import (
	"testing"
)

func TestInsertOneMutations(t *testing.T) { //nolint:paralleltest,maintidx
	cases := []TestCase{
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
						  role: manager,
						  department: {
							data: {
							 id: "00000000-0000-0000-0000-000000000123",
							  name: "New Department",
							  description: "This is a new department",
							  budget: 200000
							  employees: {
								data: {
								  user_id: "550e8400-e29b-41d4-a716-446655440002",
								  role: member
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
				SessionVariables: map[string]string{
					"user-id":            "550e8400-e29b-41d4-a716-446655440001",
					"department-manager": `{"2db9de0a-b9ba-416e-8619-783a399ae2b3","fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
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
				SessionVariables: map[string]string{
					"user-id":            "550e8400-e29b-41d4-a716-446655440001",
					"department-manager": `{"fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
				},
			},
			expected: map[string]any{
				"errors": []any{
					map[string]any{
						"message": `failed to execute operations: failed to execute operation insert_user_departments_one: failed to scan result row: ERROR: check constraint of an insert/update permission has failed (SQLSTATE ZZ901)`,
					},
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
				SessionVariables: map[string]string{
					"user-id":            "550e8400-e29b-41d4-a716-446655440001",
					"departments":        `{"2db9de0a-b9ba-416e-8619-783a399ae2b3","fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
					"department-manager": `{"fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
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
				SessionVariables: map[string]string{
					"user-id":            "550e8400-e29b-41d4-a716-446655440001",
					"departments":        `{"2db9de0a-b9ba-416e-8619-783a399ae2b3","fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
					"department-manager": `{"fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
				},
			},
			expected: map[string]any{
				"errors": []any{
					map[string]any{
						"message": `failed to execute operations: failed to execute operation insert_department_files_one: failed to scan result row: ERROR: check constraint of an insert/update permission has failed (SQLSTATE ZZ901)`,
					},
				},
			},
		},

		{
			name: "permissions: nested array insert with parent-FK check (multi-row)",
			query: query{
				Query: `
					mutation {
					  insert_kb_entries_one(
						object: {
						  title: "Nested array, multi-row, FK-checked"
						  summary: "summary"
						  content: "content"
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
				SessionVariables: map[string]string{
					"user-id":     "550e8400-e29b-41d4-a716-446655440001",
					"departments": `{"2db9de0a-b9ba-416e-8619-783a399ae2b3","fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
				},
			},
		},

		{
			name: "permissions: nested array insert with parent-FK check (single row)",
			query: query{
				Query: `
					mutation {
					  insert_kb_entries_one(
						object: {
						  title: "Nested array, single-row, FK-checked"
						  summary: "summary"
						  content: "content"
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
				SessionVariables: map[string]string{
					"user-id":     "550e8400-e29b-41d4-a716-446655440001",
					"departments": `{"2db9de0a-b9ba-416e-8619-783a399ae2b3","fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
				},
			},
		},

		{
			name: "permissions: nested array insert with parent-FK check (denied)",
			query: query{
				Query: `
					mutation {
					  insert_kb_entries_one(
						object: {
						  title: "Nested array, denied"
						  summary: "summary"
						  content: "content"
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
				SessionVariables: map[string]string{
					"user-id":     "550e8400-e29b-41d4-a716-446655440001",
					"departments": `{"fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
				},
			},
			expected: map[string]any{
				"errors": []any{
					map[string]any{
						"message": `failed to execute operations: failed to execute operation insert_kb_entries_one: failed to scan result row: ERROR: check constraint of an insert/update permission has failed (SQLSTATE ZZ901)`,
					},
				},
			},
		},

		// Insert check reached through a composite-FK object relationship whose
		// join column (parent_kind) is a DB-defaulted discriminator the client
		// never supplies. The check must see the default ('strength'), so the
		// row must be inserted before the check runs — matching Hasura.
		{
			name: "permissions: insert through composite-FK relationship with defaulted discriminator",
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
				Variables: map[string]any{},
				Role:      "user",
				SessionVariables: map[string]string{
					"user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},

		{
			name: "permissions: insert through composite-FK relationship (denied, wrong owner)",
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
				Variables: map[string]any{},
				Role:      "user",
				SessionVariables: map[string]string{
					"user-id": "550e8400-e29b-41d4-a716-446655440099",
				},
			},
			expected: map[string]any{
				"errors": []any{
					map[string]any{
						"message": `failed to execute operations: failed to execute operation insert_exercise_log_sets_one: failed to scan result row: ERROR: check constraint of an insert/update permission has failed (SQLSTATE ZZ901)`,
					},
				},
			},
		},

		// Nested array-relationship insert through a composite FK
		// (exercise_log_sets.(parent_id, parent_kind) -> exercise_logs.(id, kind)),
		// the issue's verbatim repro. The child's parent_kind must be sourced from
		// the parent's `kind`, not its `id`; pre-fix Constellation emitted
		// parent_kind = mutation_result."id" and errored on the uuid-vs-text /
		// parent_kind CHECK where Hasura succeeds. Returns parent scalars only —
		// selecting the nested `sets` here would hit a separate bug that serializes
		// mutation-response array-rels as a single object instead of a list. The
		// child insertion itself is covered (via affected_rows) by the multi-row
		// sibling in mutation_insert_test.go.
		{
			name: "permissions: nested array insert through composite-FK relationship",
			query: query{
				Query: `
					mutation {
					  insert_exercise_logs_one(
						object: {
						  kind: "strength"
						  owner_id: "550e8400-e29b-41d4-a716-446655440001"
						  sets: { data: [{ reps: 6 }] }
						}
					  ) {
						kind
						owner_id
					  }
					}`,
				Variables: map[string]any{},
				Role:      "user",
				SessionVariables: map[string]string{
					"user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},

		// Insert where the check references a GENERATED BY DEFAULT AS IDENTITY
		// primary key. The id column surfaces via pg_attribute.attidentity, not
		// pg_attrdef, so it carries IsIdentity=true with IsGenerated=false and
		// HasDefault=false. requiresPostInsertCheck must treat IsIdentity the
		// same as IsGenerated and route the predicate through the post-mutation
		// path so the `id._is_null: false` clause (see public_identity_check_logs.yaml)
		// sees the engine-assigned value rather than the NULL placeholder a
		// pre-check data CTE would carry — under a pre-check the row would be
		// denied as if id were literally NULL.
		{
			name: "permissions: insert with identity column referenced by check",
			query: query{
				Query: `
					mutation {
					  insert_identity_check_logs_one(
						object: { note: "hello" }
					  ) {
						owner_id
						note
					  }
					}`,
				Variables: map[string]any{},
				Role:      "user",
				SessionVariables: map[string]string{
					"user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},

		// The denial branch for the identity column itself is unreachable in
		// production — IDENTITY columns are always engine-assigned and never
		// NULL after INSERT, so the `id._is_null: false` half can never fail
		// on a successful insert — so the integration locks only the positive
		// shape. The orthogonal "wrong session user" deny path is already
		// covered by the composite-FK case above; rewiring it here would
		// duplicate that coverage without exercising any new code path.

		// Nested array-relationship insert through a parent whose CTE is the
		// substitution target for the child's post-check EXISTS. The child
		// (note_replies) has insert_check `note.author_id = X-Hasura-User-Id
		// AND visibility = 'public'` -- visibility is DB-defaulted and absent
		// from the payload, so requiresPostInsertCheck routes the child
		// through buildSingleInsertCTEPostCheck. tableSubs must redirect the
		// note.author_id EXISTS to the parent's in-flight mutation_result CTE;
		// without that the EXISTS reads the empty public.notes and the insert
		// silently denies (or diverges from Hasura).
		{
			name: "permissions: nested array insert with single reply through parent CTE",
			query: query{
				Query: `
					mutation {
					  insert_notes_one(
						object: {
						  id: "0199bbbb-0000-7000-8000-000000000010"
						  author_id: "550e8400-e29b-41d4-a716-446655440001"
						  title: "Parent note with one reply"
						  replies: {
							data: [
							  { body: "first reply" }
							]
						  }
						}
					  ) {
						title
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
			name: "permissions: nested array insert with multiple replies through parent CTE",
			query: query{
				Query: `
					mutation {
					  insert_notes_one(
						object: {
						  id: "0199bbbb-0000-7000-8000-000000000011"
						  author_id: "550e8400-e29b-41d4-a716-446655440001"
						  title: "Parent note with several replies"
						  replies: {
							data: [
							  { body: "first reply" }
							  { body: "second reply" }
							  { body: "third reply" }
							]
						  }
						}
					  ) {
						title
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
			name: "permissions: nested array insert denied when parent author mismatches session user",
			query: query{
				Query: `
					mutation {
					  insert_notes_one(
						object: {
						  id: "0199bbbb-0000-7000-8000-000000000012"
						  author_id: "550e8400-e29b-41d4-a716-446655440099"
						  title: "Parent note owned by someone else"
						  replies: {
							data: [
							  { body: "should not insert" }
							]
						  }
						}
					  ) {
						title
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
						"message": `failed to execute operations: failed to execute operation insert_notes_one: failed to scan result row: ERROR: check constraint of an insert/update permission has failed (SQLSTATE ZZ901)`,
					},
				},
			},
		},

		// Direct denial through the SUBSTITUTED child post-check: the parent
		// pre-check passes (author_id == X-Hasura-User-Id), so the post-check
		// path runs end-to-end. The child supplies `visibility: "private"`,
		// which trips ONLY the `visibility _eq "public"` half of the child's
		// `_and`; the relationship-EXISTS half against the parent's in-flight
		// mutation_result CTE still passes via tableSubs substitution. Locks
		// the buildSingleInsertCTEPostCheck dispatch as the actual point of
		// failure (not the parent's pre-check).
		{
			name: "permissions: nested array insert denied at substituted child post-check (visibility private)",
			query: query{
				Query: `
					mutation {
					  insert_notes_one(
						object: {
						  id: "0199bbbb-0000-7000-8000-000000000013"
						  author_id: "550e8400-e29b-41d4-a716-446655440001"
						  title: "Parent passes, child denied"
						  replies: {
							data: [
							  { body: "private reply", visibility: "private" }
							]
						  }
						}
					  ) {
						title
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
						"message": `failed to execute operations: failed to execute operation insert_notes_one: failed to scan result row: ERROR: check constraint of an insert/update permission has failed (SQLSTATE ZZ901)`,
					},
				},
			},
		},

		// PostgreSQL/Hasura upsert classification: `id` is omitted, so the
		// conflict target is supplied by the database default. The inserted row's
		// title would fail the role's UPDATE check, but it is a pure INSERT and
		// must only be subject to the INSERT check.
		{
			name: "permissions: upsert insert_one with defaulted conflict key skips update check for insert",
			query: query{
				Query: `
					mutation {
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
				Variables: map[string]any{},
				Role:      "user",
				SessionVariables: map[string]string{
					"user-id": "550e8400-e29b-41d4-a716-446655440001",
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
							id: "023d4410-715e-4675-96a5-a58fd50ef33c"
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
				SessionVariables: map[string]string{
					"user-id": "550e8400-e29b-41d4-a716-446655440001",
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
				SessionVariables: map[string]string{
					"user-id": "550e8400-e29b-41d4-a716-446655440003",
				},
			},
		},
	}

	RunGraphQLTests(t, cases, TestConfig{
		IsMutation:           true,
		ReinitBetweenQueries: true,
	})
}

// TestUpsertOnConflictWhereTargetRow verifies that on_conflict.where is
// evaluated against the existing conflict-target row, not the incoming
// (EXCLUDED) row — matching Hasura. Each case is constructed so the existing
// row and the incoming row differ on the filtered column, so target-row and
// EXCLUDED semantics produce different results (the earlier suite at
// "on_conflict where clause - actual conflict ..." could not distinguish them
// because both rows satisfied or both failed the filter). See INCON_MEDIUM_9.
func TestUpsertOnConflictWhereTargetRow(t *testing.T) { //nolint:paralleltest
	cases := []TestCase{
		{
			// Existing row "Human Resources" matches H%; incoming
			// "Renamed Non-H Dept" does not. Target-row semantics => the
			// existing row matches => the update applies. EXCLUDED semantics
			// would have skipped it.
			name: "on_conflict where - existing row matches filter, incoming does not (update applies)",
			query: query{
				Query: `mutation {
					insert_departments_one(
						object: {
							id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
							name: "Renamed Non-H Dept"
							description: "changed"
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
			// Incoming row "Zeta Dept" matches Z%; existing "Human Resources"
			// does not. Target-row semantics => the existing row fails the
			// filter => the update is skipped (insert_one returns null).
			// EXCLUDED semantics would have applied the update.
			name: "on_conflict where - incoming row matches filter, existing does not (update skipped)",
			query: query{
				Query: `mutation {
					insert_departments_one(
						object: {
							id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
							name: "Zeta Dept"
							description: "zeta"
						}
						on_conflict: {
							constraint: departments_pkey
							update_columns: [name, description]
							where: { name: { _like: "Z%" } }
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
	}

	RunGraphQLTests(t, cases, TestConfig{
		IsMutation:           true,
		ReinitBetweenQueries: true,
	})
}

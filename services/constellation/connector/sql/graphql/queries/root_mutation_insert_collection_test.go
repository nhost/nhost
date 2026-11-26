package queries_test

import (
	"testing"
)

func TestInsertBuildQuery(t *testing.T) { //nolint:paralleltest,maintidx
	cases := []buildQueryTestCase{
		{
			name: "insert basic - 1 row array",
			query: query{
				Query: `mutation {
					insert_departments(objects: [
						{
							id: "00000000-0000-0000-0000-000000000001"
							name: "Engineering 2"
							description: "Engineering Department"
						},
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
			name: "insert basic - 1 row object",
			query: query{
				Query: `mutation {
					insert_departments(objects: {
						id: "00000000-0000-0000-0000-000000000001"
						name: "Engineering 2"
						description: "Engineering Department"
					}) {
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
			name: "upsert non-admin detectable conflict fails update check with typename only",
			query: query{
				Query: `mutation {
					insert_notes(
						objects: [
							{
								id: "0199cccc-0000-7000-8000-000000000001"
								author_id: "550e8400-e29b-41d4-a716-446655440001"
								title: "__forbidden__"
							}
						]
						on_conflict: {
							constraint: notes_pkey
							update_columns: [title]
						}
					) {
						__typename
					}
				}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
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
							role: "member"
						},
						{
							user_id: "550e8400-e29b-41d4-a716-446655440032"
							department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
							role: "member"
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
				SessionVariables: map[string]any{
					"x-hasura-user-id":            "550e8400-e29b-41d4-a716-446655440001",
					"x-hasura-department-manager": "{2db9de0a-b9ba-416e-8619-783a399ae2b3,fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
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
							role: "member"
						},
						{
							user_id: "550e8400-e29b-41d4-a716-446655440022"
							department_id: "fd1e6bba-c292-4b2f-872e-ae16146cdd82"
							role: "member"
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
				SessionVariables: map[string]any{
					"x-hasura-user-id":            "550e8400-e29b-41d4-a716-446655440001",
					"x-hasura-department-manager": "{fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
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
				SessionVariables: map[string]any{
					"x-hasura-user-id": "550e8400-e29b-41d4-a716-446655440002",
				},
			},
		},
		// Permission tests - generated column in permission check
		{
			name: "permissions: insert collection with generated column check (pass)",
			query: query{
				Query: `mutation {
					insert_departments(objects: [
						{
							id: "00000000-0000-0000-0000-000000000301"
							name: "High Budget A"
							budget: 600000
						},
						{
							id: "00000000-0000-0000-0000-000000000302"
							name: "High Budget B"
							budget: 700000
						}
					]) {
						affected_rows
						returning {
							id
							name
							budget
							has_high_budget
						}
					}
				}`,
				Role: "generated_col_test",
			},
		},

		{
			name: "permissions: insert collection with generated column check (denied)",
			query: query{
				Query: `mutation {
					insert_departments(objects: [
						{
							id: "00000000-0000-0000-0000-000000000303"
							name: "High Budget C"
							budget: 600000
						},
						{
							id: "00000000-0000-0000-0000-000000000304"
							name: "Low Budget D"
							budget: 100000
						}
					]) {
						affected_rows
						returning {
							id
							name
							budget
							has_high_budget
						}
					}
				}`,
				Role: "generated_col_test",
			},
		},

		// Multi-row insert through a composite-FK object relationship whose
		// join column (parent_kind) is a DB-defaulted discriminator the client
		// never supplies. Exercises the buildInsertMutationCTE dispatch into
		// the post-check path for batches.
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
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id": "550e8400-e29b-41d4-a716-446655440001",
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
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id": "11111111-1111-1111-1111-111111111111",
				},
			},
		},

		{
			name: "nested array insert maps composite FK columns from parent CTE",
			query: query{
				Query: `
					mutation {
					  insert_exercise_logs(objects: [
						{
						  id: "0199aaaa-0000-7000-8000-000000000101"
						  kind: "strength"
						  owner_id: "550e8400-e29b-41d4-a716-446655440001"
						  sets: { data: [{ reps: 6 }] }
						}
						{
						  id: "0199aaaa-0000-7000-8000-000000000102"
						  kind: "strength"
						  owner_id: "550e8400-e29b-41d4-a716-446655440001"
						  sets: { data: [{ reps: 8 }] }
						}
					  ]) {
						affected_rows
						returning {
						  id
						  sets { parent_id parent_kind reps }
						}
					  }
					}`,
				Role: "admin",
			},
		},

		// Multi-row insert where the check references a GENERATED BY DEFAULT
		// AS IDENTITY primary key (predicate: `id._is_null: false`, see
		// public_identity_check_logs.yaml in the integration metadata that
		// drives this fixture). Locks the multi-row sibling of the insert_one
		// identity-column case: the post-check path must fire for the batch
		// as a whole so the predicate runs against each engine-assigned row
		// in RETURNING rather than the NULL placeholders a pre-check data
		// CTE would carry (under which every row would be denied).
		{
			name: "permissions: multi-row identity column referenced by insert check",
			query: query{
				Query: `
					mutation {
					  insert_identity_check_logs(objects: [
						{ note: "first" }
						{ note: "second" }
					  ]) {
						affected_rows
						returning { owner_id note }
					  }
					}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},

		// With returning only, the nested child step must still execute its
		// post-insert permission check; the final selection does not own it.
		{
			name: "permissions: nested array-rel insert with returning-only selection (force CTE reference)",
			query: query{
				Query: `
					mutation {
					  insert_notes(objects: [
						{
						  id: "0199bbbb-0000-7000-8000-000000000025"
						  author_id: "550e8400-e29b-41d4-a716-446655440001"
						  title: "Returning only"
						  replies: {
							data: [
							  { body: "only reply" }
							]
						  }
						}
					  ]) {
						returning { id }
					  }
					}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},

		// Both parents have multi-row child batches. Each child's post-insert
		// check reads its previously inserted parent through a base-table EXISTS;
		// the defaulted visibility column is evaluated against the inserted row.
		{
			name: "permissions: multi-row nested array-rel insert with post-check substituted to parent CTE",
			query: query{
				Query: `
					mutation {
					  insert_notes(objects: [
						{
						  id: "0199bbbb-0000-7000-8000-000000000020"
						  author_id: "550e8400-e29b-41d4-a716-446655440001"
						  title: "Note A"
						  replies: {
							data: [
							  { body: "reply A1" }
							  { body: "reply A2" }
							]
						  }
						}
					  ]) {
						affected_rows
						returning { id }
					  }
					}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},

		// Collection insert with an object-relationship nested parent
		// (department_files.file → storage.files). Locks the affected_rows
		// summing shape for the object-rel case so we don't regress Hasura
		// parity: against Hasura admin role this same query reports
		// affected_rows = 2 (one parent file + one department_files row),
		// so the dependent count includes the inserted object row. Pairs with
		// the integration test of the same shape (TestInsertMutations /
		// "object-rel nested ..."), which asserts the count matches Hasura's 2.
		// Multi-parent nested array-rel insert. Two parents each with their
		// own children: parent[0] has 2 replies, parent[1] has 1 reply.
		// Locks the per-parent traversal: each parent row is inserted and
		// captured before its children, whose FKs bind to that parent's row.
		// This does not depend on RETURNING row order. Pre-bug, parent[1]'s
		// reply was dropped during arg parsing and parent[0]'s replies were
		// inserted twice (once per parent) via
		// the unbounded cross-join.
		{
			name: "permissions: multi-parent nested array-rel insert partitions children by parent",
			query: query{
				Query: `
					mutation {
					  insert_notes(objects: [
						{
						  id: "0199bbbb-0000-7000-8000-000000000030"
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
						  id: "0199bbbb-0000-7000-8000-000000000031"
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
						returning { id title }
					  }
					}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},

		// Multi-parent array-rel insert with array grandchildren. Each
		// authorization code must bind auth_request_id from its own captured
		// child row, not from another parent's or child's row.
		{
			name: "multi-parent nested array-rel insert with array grandchildren",
			query: query{
				Query: `
					mutation {
					  insertAuthOauth2Clients(objects: [
						{
						  clientId: "nested-grandchildren-client-a"
						  authRequests: {
							data: [
							  {
								redirectUri: "https://example.com/a/callback"
								responseType: "code"
								expiresAt: "2030-01-01T00:00:00Z"
								authorizationCodes: {
								  data: [
									{ codeHash: "hash-a-1", expiresAt: "2030-01-01T00:10:00Z" }
									{ codeHash: "hash-a-2", expiresAt: "2030-01-01T00:20:00Z" }
								  ]
								}
							  }
							  {
								redirectUri: "https://example.com/a/second-callback"
								responseType: "code"
								expiresAt: "2030-01-01T01:00:00Z"
								authorizationCodes: {
								  data: [
									{ codeHash: "hash-a-3", expiresAt: "2030-01-01T01:10:00Z" }
								  ]
								}
							  }
							]
						  }
						}
						{
						  clientId: "nested-grandchildren-client-b"
						  authRequests: {
							data: [
							  {
								redirectUri: "https://example.com/b/callback"
								responseType: "code"
								expiresAt: "2030-01-02T00:00:00Z"
								authorizationCodes: {
								  data: [
									{ codeHash: "hash-b-1", expiresAt: "2030-01-02T00:10:00Z" }
								  ]
								}
							  }
							]
						  }
						}
					  ]) {
						affected_rows
						returning { clientId }
					  }
					}`,
				Role: "admin",
			},
		},

		// Multi-parent nested array-rel insert where every child explicitly
		// supplies the permission-checked `visibility: "public"` column. This
		// keeps the child on the pre-check path and verifies the data CTE uses
		// the matched parent FK value instead of NULL when evaluating the
		// FK-backed `note.author_id` predicate.
		{
			name: "permissions: multi-parent nested array-rel insert with explicit public children passes pre-check",
			query: query{
				Query: `
					mutation {
					  insert_notes(objects: [
						{
						  id: "0199bbbb-0000-7000-8000-000000000036"
						  author_id: "550e8400-e29b-41d4-a716-446655440001"
						  title: "Parent public A"
						  replies: {
							data: [
							  { body: "public reply A", visibility: "public" }
							]
						  }
						}
						{
						  id: "0199bbbb-0000-7000-8000-000000000037"
						  author_id: "550e8400-e29b-41d4-a716-446655440001"
						  title: "Parent public B"
						  replies: {
							data: [
							  { body: "public reply B", visibility: "public" }
							]
						  }
						}
					  ]) {
						affected_rows
						returning { id title }
					  }
					}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},

		// Multi-parent nested array-rel insert where parent[1]'s child trips
		// the child's `visibility _eq "public"` insert check via
		// `visibility: "private"`. The per-parent traversal includes the
		// offending child with its matched parent FK; the check rejects the
		// mutation — matching Hasura. Pre-bug,
		// parent[1]'s row was silently dropped and the check passed: a
		// permission bypass.
		{
			name: "permissions: multi-parent nested array-rel insert with private child trips pre-check",
			query: query{
				Query: `
					mutation {
					  insert_notes(objects: [
						{
						  id: "0199bbbb-0000-7000-8000-000000000032"
						  author_id: "550e8400-e29b-41d4-a716-446655440001"
						  title: "Parent A"
						  replies: {
							data: [
							  { body: "ok reply", visibility: "public" }
							]
						  }
						}
						{
						  id: "0199bbbb-0000-7000-8000-000000000033"
						  author_id: "550e8400-e29b-41d4-a716-446655440001"
						  title: "Parent B"
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
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},

		// Multi-parent variant where only parent[1] has nested children, so
		// parent[0].NestedInserts is empty. Pre-bug, the code keyed off
		// `insertObjs[0].NestedInserts` and skipped the relationship
		// entirely; the per-parent traversal visits every parent.
		{
			name: "permissions: multi-parent nested array-rel insert with children only on second parent",
			query: query{
				Query: `
					mutation {
					  insert_notes(objects: [
						{
						  id: "0199bbbb-0000-7000-8000-000000000034"
						  author_id: "550e8400-e29b-41d4-a716-446655440001"
						  title: "No children"
						}
						{
						  id: "0199bbbb-0000-7000-8000-000000000035"
						  author_id: "550e8400-e29b-41d4-a716-446655440001"
						  title: "Has child"
						  replies: {
							data: [
							  { body: "only child" }
							]
						  }
						}
					  ]) {
						affected_rows
						returning { id title }
					  }
					}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},

		{
			name: "object-rel nested insert sums affected_rows over parent + nested CTE",
			query: query{
				Query: `mutation {
					insert_department_files(objects: [
						{
							id: "00000000-0000-0000-0000-0000000000fe"
							description: "object-rel-affected-rows"
							department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
							file: {
								data: {
									id: "00000000-0000-0000-0000-0000000000ff"
									bucketId: "default"
								}
							}
						}
					]) {
						affected_rows
						returning { id }
					}
				}`,
				Role: "admin",
			},
		},

		// Multi-parent object-rel nested insert (BUG_HIGH_1): each parent row
		// carries its OWN nested file. Previously the second file was silently
		// dropped and both department_files rows linked to the first file.
		// Now each file is inserted and captured before its matching parent row,
		// which binds file_id from that captured file.
		{
			name: "multi-parent object-rel nested insert partitions files per parent",
			query: query{
				Query: `mutation {
					insert_department_files(objects: [
						{
							id: "00000000-0000-0000-0000-00000000010a"
							description: "object-rel-parent-a"
							department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
							file: {
								data: {
									id: "00000000-0000-0000-0000-00000000010b"
									bucketId: "default"
								}
							}
						}
						{
							id: "00000000-0000-0000-0000-00000000010c"
							description: "object-rel-parent-b"
							department_id: "023d4410-715e-4675-96a5-a58fd50ef33c"
							file: {
								data: {
									id: "00000000-0000-0000-0000-00000000010d"
									bucketId: "default"
								}
							}
						}
					]) {
						affected_rows
						returning {
							id
							file_id
							description
							file { id bucketId }
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Mixed object-rel collection insert: one row points at a pre-existing
		// storage.files row, while a sibling row nested-inserts its file. Returning
		// uses captured root rows; the `file` relationship reads both files from
		// the final base table after the dependent statements.
		{
			name: "mixed object-rel returning combines nested CTEs with base-table rows",
			query: query{
				Query: `mutation {
					insert_department_files(objects: [
						{
							id: "00000000-0000-0000-0000-00000000030a"
							description: "object-rel-existing-file"
							department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
							file_id: "f1e9b8db-1111-439f-9d63-7f83de523fb1"
						}
						{
							id: "00000000-0000-0000-0000-00000000030b"
							description: "object-rel-nested-file"
							department_id: "023d4410-715e-4675-96a5-a58fd50ef33c"
							file: {
								data: {
									id: "00000000-0000-0000-0000-00000000030c"
									bucketId: "default"
								}
							}
						}
					]) {
						affected_rows
						returning {
							id
							file_id
							file { id bucketId }
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Each before-parent department owns its own nested employee array;
		// the step count and final related rows must include both branches.
		{
			name: "multi-parent object-rel nested insert counts nested descendants",
			query: query{
				Query: `mutation {
					insert_user_departments(objects: [
						{
							user_id: "550e8400-e29b-41d4-a716-446655440001"
							role: "manager"
							department: {
								data: {
									id: "00000000-0000-0000-0000-00000000020a"
									name: "Nested Department A"
									description: "object rel descendant A"
									budget: 100000
									employees: {
										data: [
											{ user_id: "550e8400-e29b-41d4-a716-446655440002", role: "member" }
										]
									}
								}
							}
						}
						{
							user_id: "550e8400-e29b-41d4-a716-446655440003"
							role: "manager"
							department: {
								data: {
									id: "00000000-0000-0000-0000-00000000020b"
									name: "Nested Department B"
									description: "object rel descendant B"
									budget: 110000
									employees: {
										data: [
											{ user_id: "550e8400-e29b-41d4-a716-446655440004", role: "member" }
										]
									}
								}
							}
						}
					]) {
						affected_rows
						returning {
							user_id
							department_id
							role
							department {
								id
								name
								employees { user_id role }
							}
						}
					}
				}`,
				Role: "admin",
			},
		},
	}

	testBuildQuery(t, cases, true)
}

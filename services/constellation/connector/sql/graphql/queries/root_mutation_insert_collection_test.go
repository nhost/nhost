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

		// Same shape but the client omits `affected_rows` from the selection.
		// Without the returning-side force reference emitted by
		// writeNestedCTEForceRef the gated `nested_replies` /
		// `nested_replies_post_check` CTEs would have no outer reference at
		// all (affected_rows' COUNT sum is gone too), Postgres would elide
		// them, and `constellation_throw_error` would never fire. Locks the
		// `WHERE (SELECT COUNT(*) FROM nested_replies) IS NOT NULL` no-op
		// appended to the returning subquery so the regression cannot return.
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

		// Multi-row top-level insert of notes (parents) each with multi-row
		// nested array-rel children (note_replies). The child's check has both
		// a relationship-EXISTS against the parent and a defaulted-and-absent
		// column (visibility), forcing the multi-row nested post-check path
		// (buildMultiNestedInsertCTEPostCheck) with tableSubs populated. Locks
		// the SQL shape of the multi-row sibling of the insert_one case.
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
		// so the emitted SQL must add a `+ (SELECT COUNT(*) FROM nested_file)`
		// term to the parent count. Pairs with the integration test of the
		// same shape (TestInsertMutations / "object-rel nested ..."), which
		// asserts the execution-time count matches Hasura's 2.
		// Multi-parent nested array-rel insert. Two parents each with their
		// own children: parent[0] has 2 replies, parent[1] has 1 reply.
		// Locks the partitioned shape — each parent insert has its own CTE,
		// and each child row sources its FK from the matching parent CTE so it
		// lands on its rightful parent without depending on RETURNING row
		// order. Pre-bug, parent[1]'s reply was dropped during arg parsing
		// and parent[0]'s replies were inserted twice (once per parent) via
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

		// Multi-parent array-rel insert with array grandchildren. The child
		// rows (auth requests) are inserted through the partitioned path and
		// each grandchild authorization code must source auth_request_id from
		// the exact child row CTE that owns it, not from the whole child CTE.
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
		// `visibility: "private"`. With partitioning the offending row
		// survives parse-time, reaches the pre-check with its matched parent
		// FK, and the mutation errors out — matching Hasura. Pre-bug,
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
		// entirely; partitioning iterates every parent.
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
	}

	testBuildQuery(t, cases, true)
}

package integration_test

import (
	"testing"
)

// TestUpdatePermissionCheckEnforced exercises the post-update permission
// "check" predicate across all three update paths (update, update_by_pk,
// update_many). The auth.users table grants the "user" role an update
// permission with a non-empty check ({id: {_eq: X-Hasura-User-Id}}); these
// cases assert Constellation enforces that check identically to Hasura.
//
// Regression guard for the privilege-escalation hole where the update check
// was parsed from metadata but never applied: an update whose post-update row
// would violate the check must abort all-or-nothing rather than silently
// succeed. Each case is a Hasura<->Constellation parity comparison, so it only
// passes once Constellation generates and applies the post-update check CTE.
func TestUpdatePermissionCheckEnforced(t *testing.T) { //nolint:paralleltest
	cases := []TestCase{
		// update (collection) — own row passes the check.
		{
			name: "check: update own user (allowed)",
			query: query{
				Query: `mutation {
					updateUsers(
						where: { id: { _eq: "550e8400-e29b-41d4-a716-446655440001" } }
						_set: { displayName: "Self Renamed", locale: "fr" }
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

		// update (collection) — attempt to mutate another user's row. The
		// row-level filter already excludes it; the post-update check is the
		// second line of defence. Both engines must report zero affected rows
		// and leave the row untouched (no escalation).
		{
			name: "check: update other user is blocked (no escalation)",
			query: query{
				Query: `mutation {
					updateUsers(
						where: { id: { _eq: "550e8400-e29b-41d4-a716-446655440002" } }
						_set: { displayName: "Hijacked" }
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

		// update_by_pk — own row passes the check.
		{
			name: "check: update_by_pk own user (allowed)",
			query: query{
				Query: `mutation {
					updateUser(
						pk_columns: { id: "550e8400-e29b-41d4-a716-446655440001" }
						_set: { displayName: "PK Self Renamed" }
					) {
						id
						displayName
					}
				}`,
				Role: "user",
				SessionVariables: map[string]string{
					"user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},

		// update_by_pk — another user's row is not returned and not mutated.
		{
			name: "check: update_by_pk other user is blocked",
			query: query{
				Query: `mutation {
					updateUser(
						pk_columns: { id: "550e8400-e29b-41d4-a716-446655440002" }
						_set: { displayName: "PK Hijacked" }
					) {
						id
						displayName
					}
				}`,
				Role: "user",
				SessionVariables: map[string]string{
					"user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},

		// update_many — own row passes; the per-update CTE carries the check.
		{
			name: "check: update_many own user (allowed)",
			query: query{
				Query: `mutation {
					update_users_many(
						updates: [
							{
								where: { id: { _eq: "550e8400-e29b-41d4-a716-446655440001" } }
								_set: { displayName: "Many Self Renamed" }
							}
						]
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

		// update_many — another user's row is left untouched.
		{
			name: "check: update_many other user is blocked",
			query: query{
				Query: `mutation {
					update_users_many(
						updates: [
							{
								where: { id: { _eq: "550e8400-e29b-41d4-a716-446655440002" } }
								_set: { displayName: "Many Hijacked" }
							}
						]
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
	}

	RunGraphQLTests(t, cases, TestConfig{
		IsMutation:           true,
		ReinitBetweenQueries: true,
	})
}

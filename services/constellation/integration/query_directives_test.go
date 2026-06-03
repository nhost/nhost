package integration_test

import "testing"

// TestQueryDirectiveParity exercises @skip/@include evaluation against
// Hasura-compatible behavior, including degenerate empty selections and remote
// relationships.
func TestQueryDirectiveParity(t *testing.T) { //nolint:paralleltest
	cases := []TestCase{
		{
			name: "nested skip literal true",
			query: query{
				Query:     `{ users { id displayName @skip(if: true) } }`,
				Variables: nil,
				Role:      "admin",
			},
		},
		{
			name: "nested include literal false",
			query: query{
				Query:     `{ users { id displayName @include(if: false) } }`,
				Variables: nil,
				Role:      "admin",
			},
		},
		{
			name: "nested skip variable true",
			query: query{
				Query: `query Q($s: Boolean!) {
					users { id displayName @skip(if: $s) }
				}`,
				Variables: map[string]any{"s": true},
				Role:      "admin",
			},
		},
		{
			name: "nested skip variable false",
			query: query{
				Query: `query Q($s: Boolean!) {
					users { id displayName @skip(if: $s) }
				}`,
				Variables: map[string]any{"s": false},
				Role:      "admin",
			},
		},
		{
			name: "skip whole root field",
			query: query{
				Query: `query Q($s: Boolean!) {
					users @skip(if: $s) { id }
				}`,
				Variables: map[string]any{"s": true},
				Role:      "admin",
			},
		},
		{
			name: "fragment with nested skip",
			query: query{
				Query: `query Q($s: Boolean!) {
					users { ...F }
				}
				fragment F on users {
					id
					displayName @skip(if: $s)
				}`,
				Variables: map[string]any{"s": true},
				Role:      "admin",
			},
		},
		{
			name: "collection selection emptied by skip",
			query: query{
				Query:     `{ users { id @skip(if: true) } }`,
				Variables: nil,
				Role:      "admin",
			},
		},
		{
			name: "object relationship selection emptied by skip",
			query: query{
				Query: `{
					users(where: {id: {_eq: "550e8400-e29b-41d4-a716-446655440001"}}, limit: 1) {
						id
						profile { id @skip(if: true) }
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},
		{
			name: "skip remote relationship literal true",
			query: query{
				Query: `query {
					userProfiles {
						id
						user @skip(if: true) { id displayName }
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},
		{
			name: "skip remote relationship variable true",
			query: query{
				Query: `query Q($s: Boolean!) {
					userProfiles {
						id
						user @skip(if: $s) { id displayName }
					}
				}`,
				Variables: map[string]any{"s": true},
				Role:      "admin",
			},
		},
		{
			name: "skip remote relationship variable false keeps it",
			query: query{
				Query: `query Q($s: Boolean!) {
					userProfiles {
						id
						user @skip(if: $s) { id displayName }
					}
				}`,
				Variables: map[string]any{"s": false},
				Role:      "admin",
			},
		},
		{
			name: "include remote relationship false",
			query: query{
				Query: `query {
					userProfiles {
						id
						user @include(if: false) { id displayName }
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},
	}

	RunGraphQLTests(t, cases, TestConfig{IsMutation: false, ReinitBetweenQueries: false})
}

package integration_test

import "testing"

// TestG08_RootOperationHandling exercises the controller root-operation /
// field-collection fixes (group G08) against the live Hasura engine. Every case
// uses expected==nil so the harness diffs Constellation's response against
// Hasura's, asserting parity for:
//
//   - INCON_MEDIUM_11: root-level fragment spreads and inline fragments
//   - INCON_MEDIUM_12: root-level __typename
//   - INCON_LOW_6:     mixed introspection meta-fields + data fields
//   - INCON_MEDIUM_1:  @skip / @include evaluation (literal and variable-driven)
//   - INCON_LOW_10:    operation-name selection diagnostics
func TestG08_RootOperationHandling(t *testing.T) { //nolint:paralleltest
	cases := []TestCase{
		// INCON_MEDIUM_11: root-level fragment spread.
		{
			name: "root fragment spread",
			query: query{
				Query: `query { ...Roots }
					fragment Roots on query_root {
						users { id }
					}`,
				Variables: nil,
				Role:      "admin",
			},
		},
		// INCON_MEDIUM_11: root-level inline fragment.
		{
			name: "root inline fragment",
			query: query{
				Query: `query {
					... on query_root {
						users { id }
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},
		// INCON_MEDIUM_12: bare root __typename.
		{
			name: "root typename",
			query: query{
				Query:     `{ __typename }`,
				Variables: nil,
				Role:      "admin",
			},
		},
		// INCON_MEDIUM_12: root __typename mixed with data (and aliased).
		{
			name: "root typename with data",
			query: query{
				Query:     `{ tn: __typename users { id } }`,
				Variables: nil,
				Role:      "admin",
			},
		},
		// INCON_MEDIUM_12 + INCON_MEDIUM_11: root inline fragment + __typename.
		{
			name: "root inline fragment with typename",
			query: query{
				Query: `query {
					... on query_root { users { id } }
					__typename
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},
		// INCON_LOW_6: mixed introspection meta-field + data.
		{
			name: "mixed introspection and data",
			query: query{
				Query: `{
					__schema { queryType { name } }
					users { id }
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},
		// INCON_MEDIUM_1: @skip(if:true) on a nested field via a literal.
		{
			name: "nested skip literal true",
			query: query{
				Query:     `{ users { id displayName @skip(if: true) } }`,
				Variables: nil,
				Role:      "admin",
			},
		},
		// INCON_MEDIUM_1: @include(if:false) on a nested field via a literal.
		{
			name: "nested include literal false",
			query: query{
				Query:     `{ users { id displayName @include(if: false) } }`,
				Variables: nil,
				Role:      "admin",
			},
		},
		// INCON_MEDIUM_1: variable-driven @skip true on a nested field.
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
		// INCON_MEDIUM_1: variable-driven @skip false keeps the field.
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
		// INCON_MEDIUM_1: @skip on a whole root field.
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
		// INCON_MEDIUM_1: @skip inside a fragment spread.
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
		// INCON_MEDIUM_1: every selected sub-field of a collection is skipped, so
		// the object selection set is empty. Both engines must return empty
		// objects ([{},{},...]) rather than erroring on degenerate SQL.
		{
			name: "collection selection emptied by skip",
			query: query{
				Query:     `{ users { id @skip(if: true) } }`,
				Variables: nil,
				Role:      "admin",
			},
		},
		// INCON_MEDIUM_1: an object (single-row) relationship whose only selected
		// field is skipped — the row_to_json/json_build_object object path with an
		// empty projection. Must yield "profile": {} on both engines.
		{
			name: "object relationship selection emptied by skip",
			query: query{
				Query:     `{ users(limit: 1) { id profile { id @skip(if: true) } } }`,
				Variables: nil,
				Role:      "admin",
			},
		},
		// INCON_MEDIUM_1: @skip(if:true) on a cross-database REMOTE relationship
		// (userProfiles.user, 'other' → 'default'). The directive must prevent the
		// relationship from being planned, phantom-injected, and resolved — the
		// response must match Hasura, which omits `user`.
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
		// INCON_MEDIUM_1: variable-driven @skip(if:true) on the remote relationship.
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
		// INCON_MEDIUM_1: @skip(if:false) keeps the remote relationship, proving it
		// is still planned and resolved when not excluded.
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
		// INCON_MEDIUM_1: @include(if:false) on the remote relationship.
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
		// INCON_LOW_10: operationName that matches nothing in a multi-op document.
		{
			name: "unmatched operation name",
			query: query{
				Query: `query A { users { id } }
					query B { users { displayName } }`,
				OperationName: "C",
				Variables:     nil,
				Role:          "admin",
			},
		},
		// INCON_LOW_10: omitted operationName with several operations present.
		{
			name: "no name multiple operations",
			query: query{
				Query: `query A { users { id } }
					query B { users { displayName } }`,
				Variables: nil,
				Role:      "admin",
			},
		},
	}

	RunGraphQLTests(t, cases, TestConfig{IsMutation: false, ReinitBetweenQueries: false})
}

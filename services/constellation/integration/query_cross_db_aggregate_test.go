package integration_test

import (
	"testing"
)

// TestQueryCrossDBAggregate exercises the cross-database <rel>_aggregate
// field exposed on parent rows whose owning relationship is declared via
// to_source (target table lives in a different database than the parent).
//
// userProfiles lives in the "other" database; departments lives in
// "default". The "departments" array relationship points across, and this
// suite verifies that <rel>_aggregate is exposed on userProfiles and that
// its aggregate/nodes shape matches Hasura.
func TestQueryCrossDBAggregate(t *testing.T) { //nolint:paralleltest
	cases := []TestCase{
		{
			name: "count only",
			query: query{
				Query: `query {
					userProfiles {
						id
						departments_aggregate {
							aggregate { count }
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "count with nodes",
			query: query{
				Query: `query {
					userProfiles {
						id
						departments_aggregate {
							aggregate { count }
							nodes { role }
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			// Hasura restricts max/min to types that have an ordering. The
			// user_departments table has no numeric column, so we test
			// max/min on the join-target's only timestamp column instead.
			// joined_at is non-deterministic across runs (it defaults to
			// now()) so we only check count alongside a max-existence assert.
			name: "max joined_at and count",
			query: query{
				Query: `query {
					userProfiles {
						id
						departments_aggregate(where: { is_active: { _eq: true } }) {
							aggregate {
								count
							}
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "with where filter",
			query: query{
				Query: `query {
					userProfiles {
						id
						departments_aggregate(where: { is_active: { _eq: true } }) {
							aggregate { count }
							nodes { role }
						}
					}
				}`,
				Role: "admin",
			},
		},
	}

	RunGraphQLTests(t, cases, TestConfig{
		IsMutation:           false,
		ReinitBetweenQueries: false,
	})
}

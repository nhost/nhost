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
			// joined_at defaults to now() so its absolute value is
			// non-deterministic across re-seeds, but the harness diffs
			// constellation against live Hasura over the SAME seeded rows, so
			// max/min return the identical stored timestamp from both engines
			// and the cmp.Diff is stable.
			name: "max and min joined_at with count",
			query: query{
				Query: `query {
					userProfiles {
						id
						departments_aggregate {
							aggregate {
								count
								max { joined_at }
								min { joined_at }
							}
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			// The where filter must actually trim each parent's target rows.
			// role splits the seed (only one user_departments row per user is a
			// manager) so a parent whose unfiltered count is >1 drops to a
			// smaller filtered count -- distinguishing this from the unfiltered
			// "count with nodes" case above and pinning that a cross-DB
			// aggregate where clause is applied per parent row.
			name: "with where filter",
			query: query{
				Query: `query {
					userProfiles {
						id
						departments_aggregate(where: { role: { _eq: manager } }) {
							aggregate { count }
							nodes { role }
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			// distinct_on dedupes each parent row's target rows by the requested
			// column before aggregating, so a parent with two rows that share a
			// role counts 1, not 2. Verifies constellation matches Hasura's
			// per-parent-row distinct_on on the cross-db aggregate relationship.
			name: "distinct_on role",
			query: query{
				Query: `query {
					userProfiles(order_by: { user_id: asc }) {
						user_id
						departments_aggregate(distinct_on: [role]) {
							aggregate { count }
							nodes { role }
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			// order_by reorders each parent's nodes without changing the count.
			// department_id is stable across runs (unlike joined_at).
			name: "order_by department_id desc",
			query: query{
				Query: `query {
					userProfiles(order_by: { user_id: asc }) {
						user_id
						departments_aggregate(order_by: { department_id: desc }) {
							aggregate { count }
							nodes { role department_id }
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			// distinct_on combined with an order_by that leads with the distinct
			// column: the trailing term resolves the DISTINCT ON tiebreak and
			// orders the nodes. Must match Hasura exactly.
			name: "distinct_on role with order_by role then department_id",
			query: query{
				Query: `query {
					userProfiles(order_by: { user_id: asc }) {
						user_id
						departments_aggregate(
							distinct_on: [role],
							order_by: [{ role: asc }, { department_id: desc }]
						) {
							aggregate { count }
							nodes { role department_id }
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			// Per-group limit: Hasura applies limit per parent row to BOTH the
			// aggregate count and the nodes. With limit 1 ordered by department_id
			// asc, each parent keeps only its smallest-department_id row (count 1,
			// one node); parents with no target rows stay count 0. department_id is
			// stable across runs and the order_by fully disambiguates which row
			// survives, so the live cmp.Diff against Hasura is deterministic.
			name: "limit one per group",
			query: query{
				Query: `query {
					userProfiles(order_by: { user_id: asc }) {
						user_id
						departments_aggregate(limit: 1, order_by: { department_id: asc }) {
							aggregate { count }
							nodes { role department_id }
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			// Per-group limit+offset: skip the first row then keep one. Ordered by
			// department_id asc, offset 1 + limit 1 keeps each parent's
			// second-smallest department_id row — a window distinct from the
			// limit-only case. Deterministic for the same reason (stable column +
			// disambiguating order_by).
			name: "limit one offset one per group",
			query: query{
				Query: `query {
					userProfiles(order_by: { user_id: asc }) {
						user_id
						departments_aggregate(limit: 1, offset: 1, order_by: { department_id: asc }) {
							aggregate { count }
							nodes { role department_id }
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			// distinct_on combined with a per-group limit: Hasura applies
			// DISTINCT -> ORDER BY -> LIMIT per group. Selecting only role keeps
			// the comparison unambiguous (role is the distinct key); ordering by
			// role asc and capping at 1 keeps each parent's alphabetically-first
			// distinct role.
			name: "distinct_on role with limit one",
			query: query{
				Query: `query {
					userProfiles(order_by: { user_id: asc }) {
						user_id
						departments_aggregate(distinct_on: [role], limit: 1, order_by: { role: asc }) {
							aggregate { count }
							nodes { role }
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			// limit: 0 empties every parent's window. Hasura still emits each
			// parent's aggregate with count 0 / nodes [] — a parent WITH matching
			// rows must not disappear just because its whole window is filtered out.
			// The live cmp.Diff against Hasura pins this per-group-empty-window
			// contract end to end.
			name: "limit zero per group",
			query: query{
				Query: `query {
					userProfiles(order_by: { user_id: asc }) {
						user_id
						departments_aggregate(limit: 0, order_by: { department_id: asc }) {
							aggregate { count }
							nodes { role department_id }
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			// An offset past every parent's group size also empties every window;
			// like limit: 0, Hasura keeps each parent group with count 0 / nodes [].
			name: "offset beyond group size",
			query: query{
				Query: `query {
					userProfiles(order_by: { user_id: asc }) {
						user_id
						departments_aggregate(offset: 5, order_by: { department_id: asc }) {
							aggregate { count }
							nodes { role department_id }
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

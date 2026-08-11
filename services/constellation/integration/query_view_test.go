package integration_test

import (
	"testing"
)

// TestQueryView exercises GraphQL queries against the `public.published_news`
// view. Views have no introspected primary key or foreign keys, so this
// covers: selecting from a constraint-less relation, manual-config object
// relationships resolving correctly, and aggregates on a relation that the
// schema generator must treat differently from a regular table (no
// `_on_conflict`, no `_by_pk`).
func TestQueryView(t *testing.T) { //nolint:paralleltest
	ReinitializeTestData(t)

	cases := []TestCase{
		{
			name: "select columns from view",
			query: query{
				Query: `query {
					publishedNews(order_by: {created_at: asc}) {
						id
						title
						content
						created_at
						updated_at
						department_id
						author_id
					}
				}`,
				Role: "user",
			},
		},
		{
			name: "filter view by where clause",
			query: query{
				Query: `query {
					publishedNews(where: {title: {_ilike: "%partnership%"}}) {
						title
					}
				}`,
				Role: "user",
			},
		},
		{
			name: "view with object relationships (manual_configuration)",
			query: query{
				Query: `query {
					publishedNews(order_by: {created_at: asc}) {
						id
						title
						author {
							id
							displayName
						}
						department {
							id
							name
						}
					}
				}`,
				Role: "user",
				SessionVariables: map[string]string{
					"departments": `{2db9de0a-b9ba-416e-8619-783a399ae2b3,ffd095c2-9745-43d9-b133-7e8d847e8371,24e9b8db-acf8-439f-9d63-7f83de523fb3,fd1e6bba-c292-4b2f-872e-ae16146cdd82}`,
				},
			},
		},
		{
			name: "aggregate count on view",
			query: query{
				Query: `query {
					publishedNewAggregate {
						aggregate {
							count
						}
					}
				}`,
				Role: "user",
			},
		},
		{
			name: "aggregate min/max on view",
			query: query{
				Query: `query {
					publishedNewAggregate {
						aggregate {
							min { created_at }
							max { created_at }
						}
					}
				}`,
				Role: "user",
			},
		},
		{
			name: "aggregate with nodes on view",
			query: query{
				Query: `query {
					publishedNewAggregate(order_by: {created_at: asc}) {
						aggregate {
							count
						}
						nodes {
							id
							title
						}
					}
				}`,
				Role: "user",
			},
		},
	}

	RunGraphQLTests(t, cases, TestConfig{
		IsMutation:           false,
		ReinitBetweenQueries: false,
	})
}

package queries_test

import (
	"testing"
)

func TestBuildQueryFunctionAggregateSQL(t *testing.T) { //nolint:paralleltest
	cases := []buildQueryTestCase{
		{
			name: "count only",
			query: query{
				Query: `
					query {
						search_news_aggregate(args: {search: "a"}) {
							aggregate {
								count
							}
						}
					}`,
				Role: "admin",
			},
		},

		{
			name: "count with nodes",
			query: query{
				Query: `
					query {
						search_news_aggregate(args: {search: "a"}, limit: 5) {
							aggregate {
								count
							}
							nodes {
								id
								content
							}
						}
					}`,
				Role: "admin",
			},
		},

		{
			name: "with where clause",
			query: query{
				Query: `
					query {
						search_news_aggregate(
							args: {search: "a"},
							where: {is_public: {_eq: true}}
						) {
							aggregate {
								count
							}
						}
					}`,
				Role: "admin",
			},
		},

		{
			name: "with order_by and limit",
			query: query{
				Query: `
					query {
						search_news_aggregate(
							args: {search: "a"},
							order_by: {created_at: desc},
							limit: 10
						) {
							aggregate {
								count
							}
							nodes {
								id
								content
							}
						}
					}`,
				Role: "admin",
			},
		},

		{
			name: "permissions: public",
			query: query{
				Query: `
					query {
						search_news_aggregate(args: {search: "a"}) {
							aggregate {
								count
							}
						}
					}`,
				Role: "public",
			},
		},

		{
			name: "permissions: user with session variables",
			query: query{
				Query: `
					query {
						search_news_aggregate(
							args: {search: "a"},
							where: {department: {budget: {_gt: 1}}}
						) {
							aggregate {
								count
							}
							nodes {
								content
								department {
									name
								}
							}
						}
					}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-departments": "{2db9de0a-b9ba-416e-8619-783a399ae2b3,fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
				},
			},
		},

		{
			name: "nested relationship filter",
			query: query{
				Query: `
					query {
						search_news_aggregate(
							args: {search: "a"},
							where: {author: {displayName: {_eq: "Sarah Martinez"}}}
						) {
							aggregate {
								count
							}
							nodes {
								id
								content
								author {
									displayName
								}
							}
						}
					}`,
				Role: "admin",
			},
		},
	}

	testBuildQuery(t, cases, false)
}

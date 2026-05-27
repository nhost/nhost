package integration_test

import (
	"testing"
)

func TestBuildQueryFunctionAggregateSQL(t *testing.T) { //nolint:paralleltest
	cases := []TestCase{
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
			name: "count only (custom name)",
			query: query{
				Query: `
					query {
						searchNews_aggregate(args: {search: "a"}) {
							aggregate {
								count
							}
						}
					}`,
				Role: "admin",
			},
		},

		{
			name: "count only (custom root field)",
			query: query{
				Query: `
					query {
						searchNewsAggregate(args: {search: "a"}) {
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
			expected: map[string]any{
				"errors": []any{
					map[string]any{
						"message": `Cannot query field "search_news_aggregate" on type "query_root".`,
						"locations": []any{
							map[string]any{"line": float64(3), "column": float64(7)},
						},
					},
				},
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
				SessionVariables: map[string]string{
					"departments": `{"2db9de0a-b9ba-416e-8619-783a399ae2b3","fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
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

	RunGraphQLTests(t, cases, TestConfig{
		IsMutation: false,
	})
}

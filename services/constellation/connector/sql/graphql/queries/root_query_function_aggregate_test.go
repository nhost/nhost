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

		// __typename across every aggregate scope. Exercises the same builder
		// (writeQueryAggregateSQL) that root_query_aggregate uses, but reached
		// via root_query_function_aggregate. The function-returning aggregate
		// must produce the same per-scope literal type names as the root path.
		// news has no numeric columns to SUM/AVG, so we use max/min over text.
		{
			name: "aggregate with __typename at every scope",
			query: query{
				Query: `
					query {
						search_news_aggregate(args: {search: "a"}) {
							__typename
							aggregate {
								__typename
								count
								max {
									__typename
									title
								}
								min {
									__typename
									title
								}
							}
							nodes {
								__typename
								id
							}
						}
					}`,
				Role: "admin",
			},
		},

		{
			// Defaulted argument omitted on the aggregate path: the function
			// call binds only "search" under named notation; no DEFAULT
			// keyword, no "max_len" binding.
			name: "defaulted arg omitted",
			query: query{
				Query: `
					query {
						search_news_default_aggregate(args: {search: "a"}) {
							aggregate {
								count
							}
						}
					}`,
				Role: "admin",
			},
		},

		{
			// Defaulted argument supplied on the aggregate path.
			name: "defaulted arg supplied",
			query: query{
				Query: `
					query {
						search_news_default_aggregate(args: {search: "a", max_len: 50}) {
							aggregate {
								count
							}
						}
					}`,
				Role: "admin",
			},
		},

		{
			// Positional-only defaulted argument omitted on the aggregate path:
			// bind only arg_1 positionally so PostgreSQL applies arg_2's default.
			name: "positional defaulted arg omitted",
			query: query{
				Query: `
					query {
						search_news_positional_aggregate(args: {arg_1: "a"}) {
							aggregate {
								count
							}
						}
					}`,
				Role: "admin",
			},
		},

		{
			// Positional-only defaulted argument supplied on the aggregate path:
			// unnamed PostgreSQL arguments must render as `$1, $2`.
			name: "positional defaulted arg supplied",
			query: query{
				Query: `
					query {
						search_news_positional_aggregate(args: {arg_1: "a", arg_2: 200}) {
							aggregate {
								count
							}
						}
					}`,
				Role: "admin",
			},
		},
	}

	testBuildQuery(t, cases, false)
}

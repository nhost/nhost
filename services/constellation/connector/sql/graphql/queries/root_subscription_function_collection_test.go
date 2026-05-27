//nolint:dupl
package queries_test

import (
	"testing"
)

func TestBuildSubscriptionFunctionCollectionSQL(t *testing.T) { //nolint:paralleltest
	cases := []buildQueryTestCase{
		{
			name: "simple select",
			query: query{
				Query: `
					subscription {
					  search_news(
						args: {search: "a"},
					  ) {
						content
						is_public
					  }
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "complex select",
			query: query{
				Query: `
					subscription {
					  search_news(
						args: {search: "a"},
						where: {is_public: {_eq: false}},
						limit: 1,
						order_by: {created_at: desc}
					  ) {
						content
						is_public
					  }
					}`,

				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "nested",
			query: query{
				Query: `
					subscription {
					  search_news(
						args: { search: "a" }
						where: { author: { displayName: {_eq: "Sarah Martinez"} } }
						order_by: { created_at: desc }
					  ) {
						id
						content
						author {
						  displayName
						}
					  }
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "permissions: simple",
			query: query{
				Query: `
					subscription {
					  search_news(
						args: {search: "a"},
					  ) {
						content
					  }
					}`,
				Role:      "public",
				Variables: nil,
			},
		},

		{
			name: "permissions: select (user)",
			query: query{
				Query: `subscription {
					  search_news(
						args: { search: "a" },
						where: {department: {budget: {_gt: 1}}}
					  ) {
						content
						department {
						  name
						}
					  }
					}`,
				Role:      "user",
				Variables: nil,
				SessionVariables: map[string]any{
					"x-hasura-departments": "{2db9de0a-b9ba-416e-8619-783a399ae2b3,fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
				},
			},
		},

		{
			name: "permissions: complex select",
			query: query{
				Query: `
					subscription {
					  search_news(
						args: {search: "a"},
						limit: 1,
						order_by: {created_at: desc}
					  ) {
						content
					  }
					}`,

				Role:      "public",
				Variables: nil,
			},
		},

		{
			name: "public: nested",
			query: query{
				Query: `
					subscription {
					  search_news(
						args: { search: "a" }
						where: { author: { displayName: {_eq: "Sarah Martinez"} } }
						order_by: { created_at: desc }
					  ) {
						id
						content
						author {
						  displayName
						}
					  }
					}`,
				Role:      "user",
				Variables: nil,
			},
		},
	}

	testBuildSubscription(t, cases, false)
}

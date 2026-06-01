package queries_test

import (
	"testing"
)

func TestBuildQueryFunctionCollectionSQL(t *testing.T) { //nolint:paralleltest
	cases := []buildQueryTestCase{
		{
			name: "simple select",
			query: query{
				Query: `
					{
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
					{
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
					{
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
					{
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
				Query: `{
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
					{
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
					{
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

		{
			// Defaulted argument omitted: the FROM clause must call the
			// function with only the required argument under named notation
			// (`"search" := $1`) and must not emit the invalid DEFAULT keyword
			// nor a "max_len" binding. PostgreSQL applies the declared default.
			name: "defaulted arg omitted",
			query: query{
				Query: `
					{
					  search_news_default(
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
			// Defaulted argument supplied: both arguments bind under named
			// notation (`"search" := $1, "max_len" := $2`).
			name: "defaulted arg supplied",
			query: query{
				Query: `
					{
					  search_news_default(
						args: {search: "a", max_len: 50},
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
			// Positional-only defaulted argument omitted: the function call must
			// bind only arg_1 positionally (`$1`) so PostgreSQL applies arg_2's
			// declared default.
			name: "positional defaulted arg omitted",
			query: query{
				Query: `
					{
					  search_news_positional(
						args: {arg_1: "a"},
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
			// Positional-only defaulted argument supplied: both arguments must bind
			// positionally (`$1, $2`) because unnamed PostgreSQL arguments cannot be
			// addressed with named-argument notation.
			name: "positional defaulted arg supplied",
			query: query{
				Query: `
					{
					  search_news_positional(
						args: {arg_1: "a", arg_2: 200},
					  ) {
						content
						is_public
					  }
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},
	}

	testBuildQuery(t, cases, false)
}

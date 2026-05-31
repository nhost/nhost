package integration_test

import (
	"testing"
)

func TestBuildQueryFunctionCollectionSQL(t *testing.T) { //nolint:paralleltest
	cases := []TestCase{
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
			name: "simple select (custom name)",
			query: query{
				Query: `
					{
					  searchNews(
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
			name: "simple select (custom root field)",
			query: query{
				Query: `
					{
					  searchNewsCollection(
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
				SessionVariables: map[string]string{
					"departments": `{"2db9de0a-b9ba-416e-8619-783a399ae2b3","fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
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
			// Defaulted argument omitted: this is the query that fails against
			// real PostgreSQL when the function call emits the invalid DEFAULT
			// keyword. It must succeed and apply the function's declared default
			// (max_len = 220), matching Hasura. The default is observable: the
			// seeded `news` rows matching "a" have content lengths in the
			// 194-228 band, so applying max_len = 220 returns a distinct,
			// NON-EMPTY result (the three rows of length <= 220). A regression
			// that bound NULL or 0 instead of the declared default would return
			// an empty set and diverge from Hasura, failing this case.
			name: "defaulted arg omitted",
			query: query{
				Query: `
					{
					  search_news_default(
						args: {search: "a"},
						order_by: {created_at: asc}
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
			// Defaulted argument supplied: both arguments bind and the supplied
			// value must actually filter the rows (not silently fall back to the
			// declared default of 220). The seeded `news` rows that match "a" all
			// have content lengths in the 194-228 band, so max_len=200 returns a
			// strict, non-empty SUBSET (the single 194-length row) while the
			// declared default of 220 returns three rows. A regression that
			// ignored the supplied argument — using the default or dropping the
			// arg — would return a different row set here and diverge from
			// Hasura, failing this case.
			name: "defaulted arg supplied",
			query: query{
				Query: `
					{
					  search_news_default(
						args: {search: "a", max_len: 200},
						order_by: {created_at: asc}
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
			// Positional-only (unnamed) PostgreSQL arguments. Hasura exposes them
			// under generated names arg_1/arg_2; Constellation must match so the
			// same query is valid against both. Trailing default (arg_2) omitted:
			// PostgreSQL applies the declared default (220) via positional notation
			// — named notation is impossible because the args have no SQL names. The
			// default is observable: rows matching "a" have content lengths in the
			// 194-228 band, so omitting arg_2 returns the three rows of length <=
			// 220. A regression that bound NULL or 0 instead of the declared default
			// would return an empty set and diverge from Hasura, failing this case.
			name: "positional-only function, trailing default omitted",
			query: query{
				Query: `
					{
					  search_news_positional(
						args: {arg_1: "a"},
						order_by: {created_at: asc}
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
			// Positional-only function with both args supplied: emits positional
			// ($1, $2). The supplied arg_2 must actually filter the rows. With the
			// seeded content lengths (194, 211, 218, 225, 228) for rows matching
			// "a", arg_2=200 returns a strict, non-empty SUBSET (the single
			// 194-length row) while the declared default of 220 returns three rows.
			// A regression that ignored the supplied positional value would return a
			// different row set and diverge from Hasura, failing this case.
			name: "positional-only function, both args supplied",
			query: query{
				Query: `
					{
					  search_news_positional(
						args: {arg_1: "a", arg_2: 200},
						order_by: {created_at: asc}
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

	RunGraphQLTests(t, cases, TestConfig{
		IsMutation: false,
	})
}

package integration_test

import "testing"

// TestQueryRootSelectionParity exercises root field collection and operation
// selection against Hasura-compatible behavior.
func TestQueryRootSelectionParity(t *testing.T) { //nolint:paralleltest
	cases := []TestCase{
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
		{
			name: "root typename",
			query: query{
				Query:     `{ __typename }`,
				Variables: nil,
				Role:      "admin",
			},
		},
		{
			name: "root typename with data",
			query: query{
				Query:     `{ tn: __typename users { id } }`,
				Variables: nil,
				Role:      "admin",
			},
		},
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

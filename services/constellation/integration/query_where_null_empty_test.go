package integration_test

import "testing"

// TestSelectWhereNullEmpty pins constellation's handling of null and empty
// where/bool_exp forms against live Hasura. Only the top-level where argument
// is nullable (no filter); empty logical forms follow boolean algebra: an empty
// bool_exp / `_and: []` is true, `_or: []` is false, and `_not: {}` is false.
//
// The null-rejection cases (`_not: null`, `relationship: null`, `_and: null`,
// `_or: null`, `column: null`) are covered by the where package unit tests
// instead: both engines reject them, but their error text differs, so they are
// not suited to the response-diffing harness here.
func TestSelectWhereNullEmpty(t *testing.T) { //nolint:paralleltest
	cases := []TestCase{
		{
			name: "where null literal is no filter",
			query: query{
				Query: `query {
					departments(where: null, order_by: {id: asc}) { id name }
				}`,
				Role: "admin",
			},
		},
		{
			name: "where null variable is no filter",
			query: query{
				Query: `query($where: departments_bool_exp) {
					departments(where: $where, order_by: {id: asc}) { id name }
				}`,
				Variables: map[string]any{"where": nil},
				Role:      "admin",
			},
		},
		{
			name: "where empty object matches all",
			query: query{
				Query: `query {
					departments(where: {}, order_by: {id: asc}) { id name }
				}`,
				Role: "admin",
			},
		},
		{
			name: "empty _and matches all",
			query: query{
				Query: `query {
					departments(where: {_and: []}, order_by: {id: asc}) { id name }
				}`,
				Role: "admin",
			},
		},
		{
			name: "empty _or matches none",
			query: query{
				Query: `query {
					departments(where: {_or: []}, order_by: {id: asc}) { id name }
				}`,
				Role: "admin",
			},
		},
		{
			name: "_or with empty element matches all",
			query: query{
				Query: `query {
					departments(where: {_or: [{}]}, order_by: {id: asc}) { id name }
				}`,
				Role: "admin",
			},
		},
		{
			name: "_or with empty element beside a real one matches all",
			query: query{
				Query: `query {
					departments(
						where: {_or: [{}, {name: {_eq: "Sales"}}]}, order_by: {id: asc}
					) { id name }
				}`,
				Role: "admin",
			},
		},
		{
			name: "_and with empty element matches all",
			query: query{
				Query: `query {
					departments(where: {_and: [{}]}, order_by: {id: asc}) { id name }
				}`,
				Role: "admin",
			},
		},
		{
			name: "double negation of empty matches all",
			query: query{
				Query: `query {
					departments(where: {_not: {_not: {}}}, order_by: {id: asc}) { id name }
				}`,
				Role: "admin",
			},
		},
		{
			name: "_not of empty object matches none",
			query: query{
				Query: `query {
					departments(where: {_not: {}}, order_by: {id: asc}) { id name }
				}`,
				Role: "admin",
			},
		},
		{
			name: "_not of empty _and matches none",
			query: query{
				Query: `query {
					departments(where: {_not: {_and: []}}, order_by: {id: asc}) { id name }
				}`,
				Role: "admin",
			},
		},
		{
			name: "_not of empty _or matches all",
			query: query{
				Query: `query {
					departments(where: {_not: {_or: []}}, order_by: {id: asc}) { id name }
				}`,
				Role: "admin",
			},
		},
		{
			name: "empty relationship filter is exists join",
			query: query{
				Query: `query {
					departments(where: {employees: {}}, order_by: {id: asc}) { id name }
				}`,
				Role: "admin",
			},
		},
	}

	RunGraphQLTests(t, cases, TestConfig{IsMutation: false, ReinitBetweenQueries: false})
}

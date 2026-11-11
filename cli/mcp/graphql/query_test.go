package graphql_test

import (
	"errors"
	"testing"

	"github.com/nhost/nhost/cli/mcp/graphql"
)

//nolint:maintidx // flat table of independent cases
func TestCheckAllowedGraphqlQuery(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name             string
		query            string
		allowedQueries   []string
		allowedMutations []string
		expectedError    error
	}{
		{
			name:             "nil, nil",
			query:            `query { user(id: 1) { name } }`,
			allowedQueries:   nil,
			allowedMutations: nil,
			expectedError:    graphql.ErrQueryNotAllowed,
		},
		{
			name:             "nil,",
			query:            `query { user(id: 1) { name } }`,
			allowedQueries:   nil,
			allowedMutations: []string{"user"},
			expectedError:    graphql.ErrQueryNotAllowed,
		},
		{
			name:             ",nil",
			query:            `mutation { user(id: 1) { name } }`,
			allowedQueries:   []string{"user"},
			allowedMutations: nil,
			expectedError:    graphql.ErrQueryNotAllowed,
		},
		{
			name:             "no query allowed",
			query:            `query { user(id: 1) { name } }`,
			allowedQueries:   []string{},
			allowedMutations: []string{},
			expectedError:    graphql.ErrQueryNotAllowed,
		},
		{
			name:             "no mutation allowed",
			query:            `mutation { user(id: 1) { name } }`,
			allowedQueries:   []string{},
			allowedMutations: []string{},
			expectedError:    graphql.ErrQueryNotAllowed,
		},
		{
			name:             "query allowed",
			query:            `query { user(id: 1) { name } }`,
			allowedQueries:   []string{"user"},
			allowedMutations: []string{},
			expectedError:    nil,
		},
		{
			name:             "query not allowed",
			query:            `query { projects(id: 1) { name } }`,
			allowedQueries:   []string{"user"},
			allowedMutations: []string{},
			expectedError:    graphql.ErrQueryNotAllowed,
		},
		{
			name:             "mutation allowed",
			query:            `mutation { user(id: 1) { name } }`,
			allowedQueries:   []string{},
			allowedMutations: []string{"user"},
			expectedError:    nil,
		},
		{
			name:             "mutation not allowed",
			query:            `mutation { projects(id: 1) { name } }`,
			allowedQueries:   []string{},
			allowedMutations: []string{"user"},
			expectedError:    graphql.ErrQueryNotAllowed,
		},
		{
			name:             "multiple query allowed",
			query:            `query { user(id: 1) { name } projects(id: 1) { name } }`,
			allowedQueries:   []string{"user", "projects"},
			allowedMutations: []string{},
			expectedError:    nil,
		},
		{
			name:             "multiple query not allowed",
			query:            `query { user(id: 1) { name } projects(id: 1) { name } }`,
			allowedQueries:   []string{"user"},
			allowedMutations: []string{},
			expectedError:    graphql.ErrQueryNotAllowed,
		},
		{
			name:             "multiple mutation allowed",
			query:            `mutation { user(id: 1) { name } projects(id: 1) { name } }`,
			allowedQueries:   []string{},
			allowedMutations: []string{"user", "projects"},
			expectedError:    nil,
		},
		{
			name:             "multiple mutation not allowed",
			query:            `mutation { user(id: 1) { name } projects(id: 1) { name } }`,
			allowedQueries:   []string{},
			allowedMutations: []string{"user"},
			expectedError:    graphql.ErrQueryNotAllowed,
		},
		{
			name:             "nested query allowed",
			query:            `query { user(id: 1) { name projects(id: 1) { name } } }`,
			allowedQueries:   []string{"user", "projects"},
			allowedMutations: []string{},
			expectedError:    nil,
		},
		{
			name:             "nested query not allowed",
			query:            `query { user(id: 1) { name projects(id: 1) { name } } }`,
			allowedQueries:   []string{"user"},
			allowedMutations: []string{},
			expectedError:    graphql.ErrQueryNotAllowed,
		},
		{
			name:             "nested mutation allowed",
			query:            `mutation { user(id: 1) { name projects(id: 1) { name } } }`,
			allowedQueries:   []string{},
			allowedMutations: []string{"user", "projects"},
			expectedError:    nil,
		},
		{
			name:             "nested mutation not allowed",
			query:            `mutation { user(id: 1) { name projects(id: 1) { name } } }`,
			allowedQueries:   []string{"user"},
			allowedMutations: []string{},
			expectedError:    graphql.ErrQueryNotAllowed,
		},
		{
			name:             "scalar root mutation not allowed",
			query:            `mutation { deleteApp(id: "x") }`,
			allowedQueries:   []string{"users"},
			allowedMutations: []string{},
			expectedError:    graphql.ErrQueryNotAllowed,
		},
		{
			name:             "scalar root mutation allowed",
			query:            `mutation { deleteApp(id: "x") }`,
			allowedQueries:   []string{},
			allowedMutations: []string{"deleteApp"},
			expectedError:    nil,
		},
		{
			name:             "scalar root query not allowed",
			query:            `query { appCount }`,
			allowedQueries:   []string{"users"},
			allowedMutations: []string{},
			expectedError:    graphql.ErrQueryNotAllowed,
		},
		{
			name:             "scalar root query next to allowed field not allowed",
			query:            `query { users { id } appCount }`,
			allowedQueries:   []string{"users"},
			allowedMutations: []string{},
			expectedError:    graphql.ErrQueryNotAllowed,
		},
		{
			name: "scalar root mutation next to allowed mutation not allowed",
			query: `mutation { insert_users(objects: []) { affected_rows } ` +
				`deleteApp(id: "x") }`,
			allowedQueries:   []string{},
			allowedMutations: []string{"insert_users"},
			expectedError:    graphql.ErrQueryNotAllowed,
		},
		{
			name:             "root typename allowed",
			query:            `query { __typename users { id } }`,
			allowedQueries:   []string{"users"},
			allowedMutations: []string{},
			expectedError:    nil,
		},
		{
			name:             "root typename mutation allowed",
			query:            `mutation { __typename }`,
			allowedQueries:   []string{},
			allowedMutations: []string{"user"},
			expectedError:    nil,
		},
		{
			name:             "aliased root field checked by name",
			query:            `mutation { users: deleteApp(id: "x") { id } }`,
			allowedQueries:   []string{},
			allowedMutations: []string{"users"},
			expectedError:    graphql.ErrQueryNotAllowed,
		},
		{
			name:             "aliased scalar root field checked by name",
			query:            `mutation { insert_users: deleteApp(id: "x") }`,
			allowedQueries:   []string{},
			allowedMutations: []string{"insert_users"},
			expectedError:    graphql.ErrQueryNotAllowed,
		},
		{
			name:             "root inline fragment mutation not allowed",
			query:            `mutation { ... on mutation_root { deleteApp(id: "x") { id } } }`,
			allowedQueries:   []string{"users"},
			allowedMutations: []string{},
			expectedError:    graphql.ErrQueryNotAllowed,
		},
		{
			name:             "root inline fragment without type condition not allowed",
			query:            `mutation { ... @include(if: true) { deleteApp(id: "x") } }`,
			allowedQueries:   []string{"users"},
			allowedMutations: []string{},
			expectedError:    graphql.ErrQueryNotAllowed,
		},
		{
			name:             "root inline fragment query not allowed",
			query:            `query { ... on query_root { secrets { value } } }`,
			allowedQueries:   []string{"users"},
			allowedMutations: []string{},
			expectedError:    graphql.ErrQueryNotAllowed,
		},
		{
			name:             "root inline fragment query allowed",
			query:            `query { ... on query_root { users { id } } }`,
			allowedQueries:   []string{"users"},
			allowedMutations: []string{},
			expectedError:    nil,
		},
		{
			name:             "nested inline fragment not allowed",
			query:            `query { users { ... on users { posts { id } } } }`,
			allowedQueries:   []string{"users"},
			allowedMutations: []string{},
			expectedError:    graphql.ErrQueryNotAllowed,
		},
		{
			name:             "nested inline fragment leaf allowed",
			query:            `query { users { ... on users { id name } } }`,
			allowedQueries:   []string{"users"},
			allowedMutations: []string{},
			expectedError:    nil,
		},
		{
			name:             "root fragment spread mutation not allowed",
			query:            `mutation { ...F } fragment F on mutation_root { deleteApp(id: "x") { id } }`,
			allowedQueries:   []string{"users"},
			allowedMutations: []string{},
			expectedError:    graphql.ErrQueryNotAllowed,
		},
		{
			name:             "root fragment spread scalar mutation not allowed",
			query:            `mutation { ...F } fragment F on mutation_root { deleteApp(id: "x") }`,
			allowedQueries:   []string{},
			allowedMutations: []string{"user"},
			expectedError:    graphql.ErrQueryNotAllowed,
		},
		{
			name:             "root fragment spread query allowed",
			query:            `query { ...F } fragment F on query_root { users { id } }`,
			allowedQueries:   []string{"users"},
			allowedMutations: []string{},
			expectedError:    nil,
		},
		{
			name:             "nested fragment spread not allowed",
			query:            `query { users { ...F } } fragment F on users { posts { id } }`,
			allowedQueries:   []string{"users"},
			allowedMutations: []string{},
			expectedError:    graphql.ErrQueryNotAllowed,
		},
		{
			name:             "nested fragment spread leaf allowed",
			query:            `query { users { ...F } } fragment F on users { id name }`,
			allowedQueries:   []string{"users"},
			allowedMutations: []string{},
			expectedError:    nil,
		},
		{
			name: "fragment reused nested and at root checked at root",
			query: `query { users { ...F } ...F } ` +
				`fragment F on query_root { appCount }`,
			allowedQueries:   []string{"users"},
			allowedMutations: []string{},
			expectedError:    graphql.ErrQueryNotAllowed,
		},
		{
			name: "chained fragment spreads not allowed",
			query: `mutation { ...A } ` +
				`fragment A on mutation_root { ...B } ` +
				`fragment B on mutation_root { deleteApp(id: "x") { id } }`,
			allowedQueries:   []string{},
			allowedMutations: []string{"user"},
			expectedError:    graphql.ErrQueryNotAllowed,
		},
		{
			name: "cyclic fragment spreads terminate",
			query: `query { users { ...A } } ` +
				`fragment A on users { id ...B } ` +
				`fragment B on users { name ...A }`,
			allowedQueries:   []string{"users"},
			allowedMutations: []string{},
			expectedError:    nil,
		},
		{
			name:             "unknown fragment not allowed",
			query:            `query { ...Missing }`,
			allowedQueries:   []string{"users"},
			allowedMutations: []string{},
			expectedError:    graphql.ErrQueryNotAllowed,
		},
		{
			name: "duplicate fragment names not allowed",
			query: `query { ...F } ` +
				`fragment F on query_root { users { id } } ` +
				`fragment F on query_root { secrets { value } }`,
			allowedQueries:   []string{"users"},
			allowedMutations: []string{},
			expectedError:    graphql.ErrQueryNotAllowed,
		},
		{
			name:             "mutation with query-only allowlist not allowed",
			query:            `mutation { ... on mutation_root { deleteApp(id: "x") } }`,
			allowedQueries:   []string{"*"},
			allowedMutations: nil,
			expectedError:    graphql.ErrQueryNotAllowed,
		},
		{
			name:             "wildcard allows fragments",
			query:            `mutation { ...F } fragment F on mutation_root { deleteApp(id: "x") }`,
			allowedQueries:   []string{},
			allowedMutations: []string{"*"},
			expectedError:    nil,
		},
		{
			name: "every operation checked",
			query: `query Q { users { id } } ` +
				`mutation M { ... on mutation_root { deleteApp(id: "x") } }`,
			allowedQueries:   []string{"users"},
			allowedMutations: []string{},
			expectedError:    graphql.ErrQueryNotAllowed,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			err := graphql.CheckAllowedGraphqlQuery(
				tc.allowedQueries,
				tc.allowedMutations,
				tc.query,
			)
			if !errors.Is(err, tc.expectedError) {
				t.Errorf("expected error %v, got %v", tc.expectedError, err)
			}
		})
	}
}

package graphql_test

import (
	"errors"
	"testing"

	"github.com/nhost/nhost/cli/mcp/graphql"
)

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
			expectedError:    nil,
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

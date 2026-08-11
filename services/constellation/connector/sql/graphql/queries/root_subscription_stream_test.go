package queries_test

import (
	"testing"
)

func TestBuildSubscriptionStreamSQL(t *testing.T) { //nolint:paralleltest
	cases := []buildQueryTestCase{
		{
			name: "simple stream with batch_size and cursor",
			query: query{
				Query: `
					subscription {
						news_stream(
							batch_size: 10
							cursor: [{initial_value: {id: "00000000-0000-0000-0000-000000000000"}}]
						) {
							id
							title
							content
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "stream with single cursor object (not array)",
			query: query{
				Query: `
					subscription {
						news_stream(
							batch_size: 2
							cursor: {initial_value: {created_at: "2025-11-01T10:00:00+00:00"}, ordering: ASC}
						) {
							id
							title
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "stream with cursor ordering ASC",
			query: query{
				Query: `
					subscription {
						news_stream(
							batch_size: 5
							cursor: [{initial_value: {id: "00000000-0000-0000-0000-000000000000"}, ordering: ASC}]
						) {
							id
							title
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "stream with cursor ordering DESC",
			query: query{
				Query: `
					subscription {
						news_stream(
							batch_size: 5
							cursor: [{initial_value: {id: "ffffffff-ffff-ffff-ffff-ffffffffffff"}, ordering: DESC}]
						) {
							id
							title
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "stream with where clause",
			query: query{
				Query: `
					subscription {
						news_stream(
							batch_size: 10
							cursor: [{initial_value: {id: "00000000-0000-0000-0000-000000000000"}}]
							where: {title: {_like: "%breaking%"}}
						) {
							id
							title
							content
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "stream with variables",
			query: query{
				Query: `
					subscription StreamNews($batch: Int!, $cursor_id: uuid!) {
						news_stream(
							batch_size: $batch
							cursor: [{initial_value: {id: $cursor_id}}]
						) {
							id
							title
						}
					}`,
				Role: "admin",
				Variables: map[string]any{
					"batch":     10,
					"cursor_id": "00000000-0000-0000-0000-000000000000",
				},
			},
		},

		{
			name: "stream with created_at cursor",
			query: query{
				Query: `
					subscription {
						news_stream(
							batch_size: 20
							cursor: [{initial_value: {created_at: "2024-01-01T00:00:00Z"}}]
						) {
							id
							title
							created_at
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "departments stream",
			query: query{
				Query: `
					subscription {
						departments_stream(
							batch_size: 5
							cursor: [{initial_value: {id: "00000000-0000-0000-0000-000000000000"}}]
						) {
							id
							name
							budget
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "stream with relationship",
			query: query{
				Query: `
					subscription {
						departments_stream(
							batch_size: 5
							cursor: [{initial_value: {id: "00000000-0000-0000-0000-000000000000"}}]
						) {
							id
							name
							employees {
								user_id
								role
							}
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "user: stream with permissions",
			query: query{
				Query: `
					subscription {
						departments_stream(
							batch_size: 5
							cursor: [{initial_value: {id: "00000000-0000-0000-0000-000000000000"}}]
						) {
							id
							name
						}
					}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id":     "550e8400-e29b-41d4-a716-446655440001",
					"x-hasura-departments": "{2db9de0a-b9ba-416e-8619-783a399ae2b3,fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
				},
				Variables: nil,
			},
		},

		{
			name: "stream with fragment",
			query: query{
				Query: `
					subscription {
						news_stream(
							batch_size: 10
							cursor: [{initial_value: {id: "00000000-0000-0000-0000-000000000000"}}]
						) {
							...NewsFields
						}
					}
					fragment NewsFields on news {
						id
						title
						content
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},
	}

	testBuildSubscription(t, cases, false)
}

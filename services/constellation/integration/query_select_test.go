package integration_test

import (
	"os"
	"testing"
)

//nolint:gochecknoglobals
var (
	hasuraURL = getEnvOrDefault(
		"HASURA_URL",
		"https://local.hasura.local.nhost.run/v1/graphql",
	)
	constellationURL = getEnvOrDefault("CONSTELLATION_URL", "http://localhost:8000/graphql")
	adminSecret      = getEnvOrDefault("ADMIN_SECRET", "nhost-admin-secret")
)

func getEnvOrDefault(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok {
		return v
	}

	return fallback
}

func TestSelect(t *testing.T) { //nolint:maintidx,paralleltest
	ReinitializeTestData(t)
	// t.Parallel()
	cases := []TestCase{
		// Basic field selection
		{
			name: "select all simple fields",
			query: query{
				Query: `query {
					users {
						id
						createdAt
						updatedAt
						displayName
						email
						avatarUrl
						locale
						disabled
						emailVerified
						phoneNumberVerified
						isAnonymous
						defaultRole
						lastSeen
						phoneNumber
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "select subset of fields",
			query: query{
				Query: `query {
					users {
						id
						displayName
						email
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "select only id",
			query: query{
				Query: `query {
					users {
						id
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		// Aliases
		{
			name: "alias single field",
			query: query{
				Query: `query {
					users {
						userId: id
					name: displayName
						userEmail: email
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "alias query",
			query: query{
				Query: `query {
					allUsers: users {
						id
						displayName
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "multiple aliased queries",
			query: query{
				Query: `query {
					firstSet: users {
						id
						displayName
					}
					secondSet: users {
						email
						locale
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		// Variables
		{
			name: "with limit variable",
			query: query{
				Query: `query($limit: Int!) {
					users(limit: $limit) {
						id
						displayName
					}
				}`,
				Variables: map[string]any{
					"limit": 5,
				},
				Role: "admin",
			},
		},

		{
			name: "with offset variable",
			query: query{
				Query: `query($offset: Int!) {
					users(offset: $offset) {
						id
						displayName
					}
				}`,
				Variables: map[string]any{
					"offset": 2,
				},
				Role: "admin",
			},
		},

		{
			name: "with where variable",
			query: query{
				Query: `query($where: users_bool_exp!) {
					users(where: $where) {
						id
						displayName
						disabled
					}
				}`,
				Variables: map[string]any{
					"where": map[string]any{
						"disabled": map[string]any{
							"_eq": false,
						},
					},
				},
				Role: "admin",
			},
		},

		{
			name: "with multiple variables",
			query: query{
				Query: `query($limit: Int!, $offset: Int!, $orderBy: [users_order_by!]) {
					users(limit: $limit, offset: $offset, order_by: $orderBy) {
						id
						displayName
					}
				}`,
				Variables: map[string]any{
					"limit":   3,
					"offset":  1,
					"orderBy": []map[string]any{{"displayName": "asc"}, {"createdAt": "desc"}},
				},
				Role: "admin",
			},
		},

		{
			name: "list variable providing object instead of list",
			query: query{
				Query: `query($limit: Int!, $offset: Int!, $orderBy: [users_order_by!]) {
					users(limit: $limit, offset: $offset, order_by: $orderBy) {
						id
						displayName
					}
				}`,
				Variables: map[string]any{
					"limit":   3,
					"offset":  1,
					"orderBy": map[string]any{"displayName": "asc"},
				},
				Role: "admin",
			},
		},

		// Filtering - Equality
		{
			name: "filter by disabled equals false",
			query: query{
				Query: `query {
					users(where: {disabled: {_eq: false}}) {
						id
						displayName
						disabled
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "filter by emailVerified equals true",
			query: query{
				Query: `query {
					users(where: {emailVerified: {_eq: true}}) {
						id
						email
						emailVerified
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "filter by isAnonymous equals false",
			query: query{
				Query: `query {
					users(where: {isAnonymous: {_eq: false}}) {
						id
						displayName
						isAnonymous
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		// Filtering - Not Equal
		{
			name: "filter by disabled not equals true",
			query: query{
				Query: `query {
					users(where: {disabled: {_neq: true}}) {
						id
						displayName
						disabled
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		// Filtering - IN
		{
			name: "filter by locale in list",
			query: query{
				Query: `query {
					users(where: {locale: {_in: ["en", "es", "fr"]}}) {
						id
						displayName
						locale
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "filter by defaultRole in list",
			query: query{
				Query: `query {
					users(where: {defaultRole: {_in: ["user", "admin"]}}) {
						id
						displayName
						defaultRole
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		// Filtering - NOT IN
		{
			name: "filter by locale not in list",
			query: query{
				Query: `query {
					users(where: {locale: {_nin: ["de", "it"]}}) {
						id
						displayName
						locale
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		// Filtering - IS NULL
		{
			name: "filter by email is null",
			query: query{
				Query: `query {
					users(where: {email: {_is_null: true}}) {
						id
						displayName
						email
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "filter by email is not null",
			query: query{
				Query: `query {
					users(where: {email: {_is_null: false}}) {
						id
						displayName
						email
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "filter by phoneNumber is null",
			query: query{
				Query: `query {
					users(where: {phoneNumber: {_is_null: true}}) {
						id
						displayName
						phoneNumber
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "filter by lastSeen is not null",
			query: query{
				Query: `query {
					users(where: {lastSeen: {_is_null: false}}) {
						id
						displayName
						lastSeen
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		// Filtering - LIKE
		{
			name: "filter by displayName like pattern",
			query: query{
				Query: `query {
					users(where: {displayName: {_like: "%test%"}}) {
						id
						displayName
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "filter by displayName like prefix",
			query: query{
				Query: `query {
					users(where: {displayName: {_like: "User%"}}) {
						id
						displayName
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "filter by email like pattern",
			query: query{
				Query: `query {
					users(where: {email: {_like: "%@example.com"}}) {
						id
						email
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		// Filtering - ILIKE (case insensitive)
		{
			name: "filter by displayName ilike pattern",
			query: query{
				Query: `query {
					users(where: {displayName: {_ilike: "%TEST%"}}) {
						id
						displayName
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "filter by email ilike pattern",
			query: query{
				Query: `query {
					users(where: {email: {_ilike: "%@EXAMPLE.COM"}}) {
						id
						email
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		// Filtering - Greater Than / Less Than
		{
			name: "filter by createdAt greater than",
			query: query{
				Query: `query {
					users(where: {createdAt: {_gt: "2020-01-01T00:00:00Z"}}) {
						id
						displayName
						createdAt
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "filter by createdAt greater than or equal",
			query: query{
				Query: `query {
					users(where: {createdAt: {_gte: "2020-01-01T00:00:00Z"}}) {
						id
						displayName
						createdAt
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "filter by createdAt less than",
			query: query{
				Query: `query {
					users(where: {createdAt: {_lt: "2030-01-01T00:00:00Z"}}) {
						id
						displayName
						createdAt
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "filter by createdAt less than or equal",
			query: query{
				Query: `query {
					users(where: {createdAt: {_lte: "2030-01-01T00:00:00Z"}}) {
						id
						displayName
						createdAt
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "filter by displayName greater than",
			query: query{
				Query: `query {
					users(where: {displayName: {_gt: "A"}}) {
						id
						displayName
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "filter by displayName less than",
			query: query{
				Query: `query {
					users(where: {displayName: {_lt: "Z"}}) {
						id
						displayName
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		// Filtering - AND
		{
			name: "filter with _and two conditions",
			query: query{
				Query: `query {
					users(where: {_and: [{disabled: {_eq: false}}, {emailVerified: {_eq: true}}]}) {
						id
						displayName
						disabled
						emailVerified
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "filter with _and three conditions",
			query: query{
				Query: `query {
					users(where: {_and: [{disabled: {_eq: false}}, {emailVerified: {_eq: true}}, {isAnonymous: {_eq: false}}]}) {
						id
						displayName
						disabled
						emailVerified
						isAnonymous
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "filter with implicit and",
			query: query{
				Query: `query {
					users(where: {disabled: {_eq: false}, emailVerified: {_eq: true}}) {
						id
						displayName
						disabled
						emailVerified
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		// Filtering - OR
		{
			name: "filter with _or two conditions",
			query: query{
				Query: `query {
					users(where: {_or: [{disabled: {_eq: true}}, {emailVerified: {_eq: false}}]}) {
						id
						displayName
						disabled
						emailVerified
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "filter with _or three conditions",
			query: query{
				Query: `query {
					users(where: {_or: [{disabled: {_eq: true}}, {emailVerified: {_eq: false}}, {isAnonymous: {_eq: true}}]}) {
						id
						displayName
						disabled
						emailVerified
						isAnonymous
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		// Filtering - NOT
		{
			name: "filter with _not",
			query: query{
				Query: `query {
					users(where: {_not: {disabled: {_eq: true}}}) {
						id
						displayName
						disabled
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "filter with _not complex",
			query: query{
				Query: `query {
					users(where: {_not: {_and: [{disabled: {_eq: true}}, {emailVerified: {_eq: false}}]}}) {
						id
						displayName
						disabled
						emailVerified
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		// Filtering - Complex combinations
		{
			name: "filter with _and and _or",
			query: query{
				Query: `query {
					users(where: {_and: [{disabled: {_eq: false}}, {_or: [{emailVerified: {_eq: true}}, {isAnonymous: {_eq: true}}]}]}) {
						id
						displayName
						disabled
						emailVerified
						isAnonymous
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "filter with _or and _not",
			query: query{
				Query: `query {
					users(where: {_or: [{disabled: {_eq: true}}, {_not: {emailVerified: {_eq: true}}}]}) {
						id
						displayName
						disabled
						emailVerified
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "filter with nested _and _or _not",
			query: query{
				Query: `query {
					users(where: {_and: [{disabled: {_eq: false}}, {_or: [{emailVerified: {_eq: true}}, {_not: {isAnonymous: {_eq: true}}}]}]}) {
						id
						displayName
						disabled
						emailVerified
						isAnonymous
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		// Limiting
		{
			name: "limit 1",
			query: query{
				Query: `query {
					users(limit: 1) {
						id
						displayName
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "limit 5",
			query: query{
				Query: `query {
					users(limit: 5) {
						id
						displayName
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "limit 10",
			query: query{
				Query: `query {
					users(limit: 10) {
						id
						displayName
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		// Offset
		{
			name: "offset 1",
			query: query{
				Query: `query {
					users(offset: 1) {
						id
						displayName
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "offset 5",
			query: query{
				Query: `query {
					users(offset: 5) {
						id
						displayName
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "limit and offset",
			query: query{
				Query: `query {
					users(limit: 3, offset: 2) {
						id
						displayName
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		// Ordering
		{
			name: "order by displayName asc",
			query: query{
				Query: `query {
					users(order_by: {displayName: asc}) {
						id
						displayName
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "order by displayName desc",
			query: query{
				Query: `query {
					users(order_by: {displayName: desc}) {
						id
						displayName
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "order by createdAt asc",
			query: query{
				Query: `query {
					users(order_by: {createdAt: asc}) {
						id
						displayName
						createdAt
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "order by createdAt desc",
			query: query{
				Query: `query {
					users(order_by: {createdAt: desc}) {
						id
						displayName
						createdAt
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "order by email asc",
			query: query{
				Query: `query {
					users(order_by: {email: asc}) {
						id
						email
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "order by multiple columns",
			query: query{
				Query: `query {
					users(order_by: [{disabled: asc}, {displayName: asc}]) {
						id
						displayName
						disabled
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "order by multiple columns mixed direction",
			query: query{
				Query: `query {
					users(order_by: [{disabled: desc}, {createdAt: asc}]) {
						id
						displayName
						disabled
						createdAt
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "order by three columns",
			query: query{
				Query: `query {
					users(order_by: [{disabled: asc}, {emailVerified: desc}, {displayName: asc}]) {
						id
						displayName
						disabled
						emailVerified
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		// Ordering with limit/offset
		{
			name: "order with limit",
			query: query{
				Query: `query {
					users(order_by: {displayName: asc}, limit: 5) {
						id
						displayName
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "order with limit and offset",
			query: query{
				Query: `query {
					users(order_by: {displayName: asc}, limit: 3, offset: 2) {
						id
						displayName
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		// Ordering with filtering
		{
			name: "order with where",
			query: query{
				Query: `query {
					users(where: {disabled: {_eq: false}}, order_by: {displayName: asc}) {
						id
						displayName
						disabled
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		// Combined: filter, order, limit, offset
		{
			name: "filter order limit offset combined",
			query: query{
				Query: `query {
					users(
						where: {disabled: {_eq: false}, emailVerified: {_eq: true}},
						order_by: {createdAt: desc},
						limit: 5,
						offset: 1
					) {
						id
						displayName
						email
						disabled
						emailVerified
						createdAt
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "complex filter with order and limit",
			query: query{
				Query: `query {
					users(
						where: {
							_and: [
								{disabled: {_eq: false}},
								{_or: [
									{emailVerified: {_eq: true}},
									{phoneNumberVerified: {_eq: true}}
								]}
							]
						},
						order_by: [{disabled: asc}, {displayName: asc}],
						limit: 10
					) {
						id
						displayName
						disabled
						emailVerified
						phoneNumberVerified
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		// Distinct
		{
			name: "distinct on locale",
			query: query{
				Query: `query {
					users(distinct_on: [locale]) {
						locale
						displayName
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "distinct on defaultRole",
			query: query{
				Query: `query {
					users(distinct_on: [defaultRole]) {
						defaultRole
						displayName
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "distinct on multiple columns",
			query: query{
				Query: `query {
					users(distinct_on: [disabled, emailVerified]) {
						disabled
						emailVerified
						displayName
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "distinct with order",
			query: query{
				Query: `query {
					users(distinct_on: [locale], order_by: {locale: asc}) {
						locale
						displayName
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "distinct with where",
			query: query{
				Query: `query {
					users(distinct_on: [defaultRole], where: {disabled: {_eq: false}}) {
						defaultRole
						displayName
						disabled
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		// Edge cases
		{
			name: "empty where clause",
			query: query{
				Query: `query {
					users(where: {}) {
						id
						displayName
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "limit 0",
			query: query{
				Query: `query {
					users(limit: 0) {
						id
						displayName
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "offset 0",
			query: query{
				Query: `query {
					users(offset: 0) {
						id
						displayName
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		// Multiple filters on same field
		{
			name: "multiple conditions on displayName",
			query: query{
				Query: `query {
					users(where: {displayName: {_gt: "A", _lt: "Z"}}) {
						id
						displayName
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "multiple conditions on createdAt",
			query: query{
				Query: `query {
					users(where: {createdAt: {_gte: "2020-01-01T00:00:00Z", _lte: "2030-01-01T00:00:00Z"}}) {
						id
						displayName
						createdAt
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		// Named queries
		{
			name: "named query",
			query: query{
				Query: `query GetUsers {
					users {
						id
						displayName
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "named query with variables",
			query: query{
				Query: `query GetUsersByStatus($disabled: Boolean!) {
					users(where: {disabled: {_eq: $disabled}}) {
						id
						displayName
						disabled
					}
				}`,
				Variables: map[string]any{
					"disabled": false,
				},
				Role: "admin",
			},
		},

		// Field with path parameter (jsonb)
		{
			name: "select metadata without path",
			query: query{
				Query: `query {
					users(limit: 5) {
						id
						displayName
						metadata
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		// Fragments
		{
			name: "simple fragment",
			query: query{
				Query: `query {
					users {
						...UserFields
					}
				}
				fragment UserFields on users {
					id
					displayName
					email
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "fragment with multiple fields",
			query: query{
				Query: `query {
					users {
						...UserInfo
					}
				}
				fragment UserInfo on users {
					id
					displayName
					email
					createdAt
					updatedAt
					disabled
					emailVerified
					locale
					defaultRole
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "multiple fragments",
			query: query{
				Query: `query {
					users {
						...BasicInfo
						...Timestamps
					}
				}
				fragment BasicInfo on users {
					id
					displayName
					email
				}
				fragment Timestamps on users {
					createdAt
					updatedAt
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "fragment with additional fields",
			query: query{
				Query: `query {
					users {
						...UserFields
						disabled
						locale
					}
				}
				fragment UserFields on users {
					id
					displayName
					email
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "nested fragments",
			query: query{
				Query: `query {
					users {
						...UserWithTimestamps
					}
				}
				fragment UserWithTimestamps on users {
					...BasicUser
					createdAt
					updatedAt
				}
				fragment BasicUser on users {
					id
					displayName
					email
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "fragment with where clause",
			query: query{
				Query: `query {
					users(where: {disabled: {_eq: false}}) {
						...UserFields
					}
				}
				fragment UserFields on users {
					id
					displayName
					email
					disabled
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "fragment with order and limit",
			query: query{
				Query: `query {
					users(order_by: {displayName: asc}, limit: 5) {
						...UserFields
					}
				}
				fragment UserFields on users {
					id
					displayName
					email
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "fragment in aliased query",
			query: query{
				Query: `query {
					allUsers: users {
						...UserFields
					}
				}
				fragment UserFields on users {
					id
					displayName
					email
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "fragment in multiple aliased queries",
			query: query{
				Query: `query {
					activeUsers: users(where: {disabled: {_eq: false}}) {
						...UserFields
					}
					disabledUsers: users(where: {disabled: {_eq: true}}) {
						...UserFields
					}
				}
				fragment UserFields on users {
					id
					displayName
					disabled
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "fragment with variables",
			query: query{
				Query: `query($limit: Int!) {
					users(limit: $limit) {
						...UserFields
					}
				}
				fragment UserFields on users {
					id
					displayName
					email
				}`,
				Variables: map[string]any{
					"limit": 5,
				},
				Role: "admin",
			},
		},

		{
			name: "inline fragment",
			query: query{
				Query: `query {
					users {
						id
						... on users {
							displayName
							email
						}
					}
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "fragment with aliased fields",
			query: query{
				Query: `query {
					users {
						...UserFieldsAliased
					}
				}
				fragment UserFieldsAliased on users {
					userId: id
				name: displayName
					userEmail: email
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "multiple fragments with overlapping fields",
			query: query{
				Query: `query {
					users {
						...Fragment1
						...Fragment2
					}
				}
				fragment Fragment1 on users {
					id
					displayName
					email
				}
				fragment Fragment2 on users {
					id
					disabled
					locale
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "fragment with complex filter",
			query: query{
				Query: `query {
					users(
						where: {
							_and: [
								{disabled: {_eq: false}},
								{emailVerified: {_eq: true}}
							]
						},
						order_by: {displayName: asc},
						limit: 10
					) {
						...UserDetails
					}
				}
				fragment UserDetails on users {
					id
					displayName
					email
					disabled
					emailVerified
					createdAt
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "deeply nested fragments",
			query: query{
				Query: `query {
					users {
						...Level1
					}
				}
				fragment Level1 on users {
					...Level2
					locale
				}
				fragment Level2 on users {
					...Level3
					defaultRole
				}
				fragment Level3 on users {
					id
					displayName
					email
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "fragment with distinct",
			query: query{
				Query: `query {
					users(distinct_on: [locale]) {
						...UserFields
					}
				}
				fragment UserFields on users {
					locale
					displayName
					email
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},
		{
			name: "permissions: simple select",
			query: query{
				Query: `
					query {
						files {
							id
							name
						}
					}`,
				Variables: nil,
				Role:      "user",
				SessionVariables: map[string]string{
					"user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},

		{
			name: "permissions: with where clause",
			query: query{
				Query: `
					query {
						files(where: {isUploaded: {_eq: true}}) {
							id
							name
						}
					}`,
				Variables: nil,
				Role:      "user",
				SessionVariables: map[string]string{
					"user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},

		{
			name: "permissions: traversal permissions and arrays",
			query: query{
				Query: `
					query {
					  department_files {
						file {
						  name
						}
						department {
						  name
						}
					  }
					}`,
				Variables: nil,
				Role:      "user",
				SessionVariables: map[string]string{
					"user-id":     "550e8400-e29b-41d4-a716-446655440001",
					"departments": `{"2db9de0a-b9ba-416e-8619-783a399ae2b3","fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
				},
			},
		},

		{
			name: "permissions: traversal permissions and arrays (nested where)",
			query: query{
				Query: `
					query {
					  department_files(where: {file: {bucketId: {_eq: "profile_pics"}}}) {
						file {
						  name
						}
						department {
						  name
						}
					  }
					}`,
				Variables: nil,
				Role:      "user",
				SessionVariables: map[string]string{
					"user-id":     "550e8400-e29b-41d4-a716-446655440001",
					"departments": `{"2db9de0a-b9ba-416e-8619-783a399ae2b3","fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
				},
			},
		},

		{
			name: "permissions: traversal permissions and arrays (inner where)",
			query: query{
				Query: `
					query {
					  departments {
					    files(where: {file: {bucketId: {_eq: "profile_pics"}}}) {
					  	  file {
					        name
					      }
					      department {
					        name
					      }
					    }
					  }
					}`,
				Variables: nil,
				Role:      "user",
				SessionVariables: map[string]string{
					"user-id":     "550e8400-e29b-41d4-a716-446655440001",
					"departments": `{"2db9de0a-b9ba-416e-8619-783a399ae2b3","fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
				},
			},
		},

		{
			name: "nested, filtering",
			query: query{
				Query: `
					{
					  departments {
						name
						files(where: {file:{bucketId: {_eq: "default"}}}) {
						  file {
							name
						  }
						  department {
							name
						  }
						}
					  }
					}`,
				Variables:        nil,
				Role:             "admin",
				SessionVariables: map[string]string{},
			},
		},

		{
			name: "permissions: nested, filtering",
			query: query{
				Query: `
					{
					  departments {
						name
						files(where: {file:{bucketId: {_eq: "default"}}}) {
						  file {
							name
						  }
						  department {
							name
						  }
						}
					  }
					}`,
				Variables: nil,
				Role:      "user",
				SessionVariables: map[string]string{
					"user-id":     "550e8400-e29b-41d4-a716-446655440001",
					"departments": `{"2db9de0a-b9ba-416e-8619-783a399ae2b3","fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
				},
			},
		},

		{
			name: "duplicate relationship fields (merging)",
			query: query{
				Query: `query {
					departments(limit: 3) {
						id
						employees {
							user_id
						}
						employees {
							role
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "duplicate relationship with fragments (merging)",
			query: query{
				Query: `
					fragment EmployeeIds on user_departments {
						user_id
					}

					fragment EmployeeRoles on user_departments {
						role
					}

					query {
						departments(limit: 3) {
							id
							employees {
								...EmployeeIds
							}
							employees {
								...EmployeeRoles
							}
						}
					}`,
				Role: "admin",
			},
		},

		{
			name: "nested duplicate relationships",
			query: query{
				Query: `query {
					departments(limit: 2) {
						id
						employees {
							user {
								id
							}
						}
						employees {
							user {
								displayName
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		// JSONB query operators
		{
			name: "jsonb _contains - find users with specific profile",
			query: query{
				Query: `query {
					users(where: { metadata: { _contains: { profile: { title: "HR Manager" } } } }) {
						id
						displayName
						metadata
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _contains - find users with specific tag",
			query: query{
				Query: `query {
					users(where: { metadata: { _contains: { tags: ["manager"] } } }) {
						id
						displayName
						metadata
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _contained_in - find users with metadata contained in given value",
			query: query{
				Query: `query {
					users(where: { metadata: { _contained_in: { profile: { title: "HR Manager", level: 5 }, tags: ["manager", "hr", "leadership"], skills: ["recruitment", "compliance", "training"] } } }) {
						id
						displayName
						metadata
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _has_key - find users with profile key",
			query: query{
				Query: `query {
					users(where: { metadata: { _has_key: "profile" } }) {
						id
						displayName
						metadata
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _has_key - find users with tags key",
			query: query{
				Query: `query {
					users(where: { metadata: { _has_key: "tags" } }) {
						id
						displayName
						metadata
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _has_keys_all - find users with both profile and tags",
			query: query{
				Query: `query {
					users(where: { metadata: { _has_keys_all: ["profile", "tags"] } }) {
						id
						displayName
						metadata
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _has_keys_any - find users with profile or skills",
			query: query{
				Query: `query {
					users(where: { metadata: { _has_keys_any: ["profile", "skills"] } }) {
						id
						displayName
						metadata
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _has_keys_any with variables",
			query: query{
				Query: `query FindUsersByKeys($where: users_bool_exp!) {
					users(where: $where) {
						id
						displayName
						metadata
					}
				}`,
				Variables: map[string]any{
					"where": map[string]any{
						"metadata": map[string]any{
							"_has_keys_any": []any{"languages", "certifications"},
						},
					},
				},
				Role: "admin",
			},
		},

		{
			name: "jsonb combined with other filters",
			query: query{
				Query: `query {
					users(where: {
						_and: [
							{ metadata: { _has_key: "profile" } },
							{ locale: { _eq: "en" } }
						]
					}) {
						id
						displayName
						locale
						metadata
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _contains with nested object",
			query: query{
				Query: `query {
					users(where: { metadata: { _contains: { preferences: { theme: "dark" } } } }) {
						id
						displayName
						metadata
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _contains with variables",
			query: query{
				Query: `query FindUsersWithMetadata($where: users_bool_exp!) {
					users(where: $where) {
						id
						displayName
						metadata
					}
				}`,
				Variables: map[string]any{
					"where": map[string]any{
						"metadata": map[string]any{
							"_contains": map[string]any{
								"profile": map[string]any{
									"level": 5,
								},
							},
						},
					},
				},
				Role: "admin",
			},
		},
	}

	RunGraphQLTests(t, cases, TestConfig{
		IsMutation: false,
	})
}

package integration_test

import (
	"testing"
)

func TestMiscMultiDatabase(t *testing.T) { //nolint:paralleltest
	cases := []TestCase{
		// Basic delete_by_pk operations
		{
			name: "queries",
			query: query{
				Query: `query {
					  users {
						id
					  }
					  userProfiles {
						id
					  }
					}`,
				Role: "admin",
			},
		},

		{
			name: "mutations",
			query: query{
				Query: `mutation {
					  insert_userProfiles(
						objects: [
						  {
							id: "440e8400-e29b-41d4-a716-446655440054"
							user_id: "550e8400-e29b-41d4-a716-446655440054"
							address: "asdasd"
						  }
						]
					  ) {
						returning {
						  id
						}
					  }
					  insertUsers(objects: [{
						  id: "550e8400-e29b-41d4-a716-446655440123",
						  locale: "en"
					  }]) {
						returning {
						  id
						}
					  }
					}`,
				Role: "admin",
			},
		},

		{
			name: "mutations with some errors",
			query: query{
				Query: `mutation {
					  insert_userProfiles(
						objects: [
						  {
							id: "440e8400-e29b-41d4-a716-446655440054"
							user_id: "550e8400-e29b-41d4-a716-446655440054"
							address: "asdasd"
						  }
						]
					  ) {
						returning {
						  id
						}
					  }
					  insertUsers(objects: [{
						  id: "550e8400-e29b-41d4-a716-44665544001",
						  locale: "en"
					  }]) {
						returning {
						  id
						}
					  }
					}`,
				Role: "admin",
			},
			expected: map[string]any{
				"data": map[string]any{
					"insert_userProfiles": map[string]any{
						"returning": []any{
							map[string]any{
								"id": string("440e8400-e29b-41d4-a716-446655440054"),
							},
						},
					},
				},
				"errors": []any{
					map[string]any{
						"message": string(
							`failed to execute operations: failed to execute operation insertUsers: failed to scan result row: ERROR: invalid input syntax for type uuid: "550e8400-e29b-41d4-a716-44665544001" (SQLSTATE 22P02)`,
						),
					},
				},
			},
		},

		// Test with fragments across multiple databases
		{
			name: "query with fragment across databases",
			query: query{
				Query: `
				fragment UserFields on users {
					id
				}
				fragment ProfileFields on userProfiles {
					id
					address
				}
				query {
					users {
						...UserFields
					}
					userProfiles {
						...ProfileFields
					}
				}`,
				Role: "admin",
			},
		},

		// Test with aliases across multiple databases
		{
			name: "query with aliases across databases",
			query: query{
				Query: `query {
					allUsers: users {
						userId: id
					}
					profiles: userProfiles {
						profileId: id
						profileAddress: address
					}
				}`,
				Role: "admin",
			},
		},

		// Test with multiple aliases on same table
		{
			name: "query with multiple aliases on same table",
			query: query{
				Query: `query {
					firstQuery: users {
						id
					}
					secondQuery: users {
						id
					}
				}`,
				Role: "admin",
			},
		},

		// Test with inline fragments
		{
			name: "query with inline fragments",
			query: query{
				Query: `query {
					users {
						... on users {
							id
						}
					}
					userProfiles {
						... on userProfiles {
							id
							address
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Test fragments with aliases combined
		{
			name: "query with fragment and aliases combined",
			query: query{
				Query: `
				fragment UserInfo on users {
					userId: id
				}
				query {
					activeUsers: users {
						...UserInfo
					}
				}`,
				Role: "admin",
			},
		},

		// Test mutation with aliases
		{
			name: "mutation with aliases",
			query: query{
				Query: `mutation {
					firstInsert: insert_userProfiles(
						objects: [{
							id: "550e8400-e29b-41d4-a716-446655440099"
							user_id: "550e8400-e29b-41d4-a716-446655440054"
							address: "First Address"
						}]
					) {
						affected: affected_rows
						data: returning {
							profileId: id
							profileAddress: address
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Test mutation with fragments in returning clause
		{
			name: "mutation with fragment in returning",
			query: query{
				Query: `
				fragment ProfileData on userProfiles {
					id
					address
				}
				mutation {
					insert_userProfiles(
						objects: [{
							id: "550e8400-e29b-41d4-a716-446655440098"
							user_id: "550e8400-e29b-41d4-a716-446655440054"
							address: "Fragment Address"
						}]
					) {
						returning {
							...ProfileData
						}
					}
				}`,
				Role: "admin",
			},
		},
	}

	RunGraphQLTests(t, cases, TestConfig{
		IsMutation:           true,
		ReinitBetweenQueries: true,
	})
}

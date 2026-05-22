package integration_test

import (
	"testing"
)

func TestQueryRemoteRelationships(t *testing.T) { //nolint:paralleltest,maintidx
	cases := []TestCase{
		// Basic remote relationship query - userProfiles from 'other' db
		// has a remote relationship to users in 'default' db
		{
			name: "basic remote object relationship",
			query: query{
				Query: `query {
					userProfiles {
						id
						user {
							id
							displayName
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Remote relationship with nested local relationship
		{
			name: "remote relationship with nested local relationship",
			query: query{
				Query: `query {
					userProfiles {
						id
						user {
							id
							departments {
								department {
									name
								}
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "remote relationships without fks",
			query: query{
				Query: `query {
					  userProfiles {
						id
						user {
						  displayName
						}
						departments {
						  department {
							name
						  }
						}
					  }
				}`,
				Role: "admin",
			},
		},

		{
			name: "remote relationships with fks",
			query: query{
				Query: `query {
					  userProfiles {
						id
						user {
						  id
						  displayName
						}
						departments {
						  user_id
						  department_id
						  department {
							name
						  }
						}
					  }
				}`,
				Role: "admin",
			},
		},

		// Query only from remote source without crossing databases
		{
			name: "query from other database only",
			query: query{
				Query: `query {
					userProfiles {
						id
						address
					}
				}`,
				Role: "admin",
			},
		},

		// Query from both databases without using remote relationships
		{
			name: "query from both databases without remote relationships",
			query: query{
				Query: `query {
					users {
						id
						displayName
					}
					userProfiles {
						id
						address
					}
				}`,
				Role: "admin",
			},
		},

		// database -> remote schema, object relationship
		{
			name: "admin query departments with team relationship",
			query: query{
				Query: `query {
					departments {
						name
						team {
							name
						}
					}
				}`,
				Role: "admin",
			},
		},

		// remote schema -> database, object relationship
		{
			name: "admin query teams with department relationship",
			query: query{
				Query: `query {
				  teams {
					name
					wins
					department {
					  name
					}
				  }
				}`,
				Role: "admin",
			},
		},

		{
			name: "remote schema nested to database relationship",
			query: query{
				Query: `query {
					games {
					homeTeam {
					  name
					  department {
						name
					  }
					}
					awayTeam {
					  name
					  department {
						name
					  }
					}
					homeScore
					awayScore
				  }
				}`,
				Role: "admin",
			},
		},

		{
			name: "subscriptions not supported",
			query: query{
				Query: `subscription {
					userProfiles {
					user {
					  displayName
					}
				  }
				}`,
				Role: "admin",
			},
			expected: map[string]any{
				"errors": []any{
					map[string]any{
						"message": "remote relationships are not supported in subscriptions",
					},
				},
			},
		},

		// Test with fragments on remote relationships
		{
			name: "remote relationship with fragment",
			query: query{
				Query: `
				fragment UserInfo on users {
					id
					displayName
				}
				query {
					userProfiles {
						id
						user {
							...UserInfo
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Test with nested fragments
		{
			name: "remote relationship with nested fragments",
			query: query{
				Query: `
				fragment DepartmentInfo on departments {
					name
				}
				fragment UserDepts on user_departments {
					department {
						...DepartmentInfo
					}
				}
				query {
					userProfiles {
						id
						user {
							id
							departments {
								...UserDepts
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Test with inline fragments on remote relationships
		{
			name: "remote relationship with inline fragment",
			query: query{
				Query: `query {
					userProfiles {
						id
						user {
							... on users {
								id
								displayName
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Test with aliases on remote relationships
		{
			name: "remote relationship with aliases",
			query: query{
				Query: `query {
					profiles: userProfiles {
						profileId: id
						profileAddress: address
						relatedUser: user {
							userId: id
							name: displayName
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Test with multiple aliases querying same remote relationship
		{
			name: "multiple queries with aliases on remote relationships",
			query: query{
				Query: `query {
					firstProfiles: userProfiles {
						id
						user {
							id
						}
					}
					secondProfiles: userProfiles {
						id
						address
						user {
							displayName
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Test db->rs relationship with aliases
		{
			name: "db to remote schema relationship with aliases",
			query: query{
				Query: `query {
					allDepartments: departments {
						deptName: name
						relatedTeam: team {
							teamName: name
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Test rs->db relationship with aliases
		{
			name: "remote schema to db relationship with aliases",
			query: query{
				Query: `query {
					allTeams: teams {
						teamName: name
						teamWins: wins
						relatedDept: department {
							deptName: name
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Test with fragment on rs->db relationship
		{
			name: "remote schema to db with fragment",
			query: query{
				Query: `
				fragment DeptFields on departments {
					name
				}
				query {
					teams {
						name
						department {
							...DeptFields
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Test nested rs->db with aliases
		{
			name: "nested remote schema to db with aliases",
			query: query{
				Query: `query {
					allGames: games {
						home: homeTeam {
							teamName: name
							dept: department {
								deptName: name
							}
						}
						away: awayTeam {
							teamName: name
							dept: department {
								deptName: name
							}
						}
						homePoints: homeScore
						awayPoints: awayScore
					}
				}`,
				Role: "admin",
			},
		},

		// Test combining fragments and aliases
		{
			name: "remote relationship with fragment and aliases combined",
			query: query{
				Query: `
				fragment TeamDept on Team {
					teamName: name
					dept: department {
						deptName: name
					}
				}
				query {
					allGames: games {
						home: homeTeam {
							...TeamDept
						}
						away: awayTeam {
							...TeamDept
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Test db->rs relationship with fragment on remote schema type
		{
			name: "db to rs relationship with fragment",
			query: query{
				Query: `
				fragment TeamInfo on Team {
					name
					wins
					losses
				}
				query {
					departments {
						name
						team {
							...TeamInfo
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Test fragment spread inside relationship result (fragment on target type)
		{
			name: "fragment inside relationship result",
			query: query{
				Query: `
				fragment DeptDetails on departments {
					name
					id
				}
				query {
					teams {
						name
						department {
							...DeptDetails
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Test multiple fragments at same level with relationships
		{
			name: "multiple fragments with relationships",
			query: query{
				Query: `
				fragment TeamBasic on Team {
					name
				}
				fragment TeamWithDept on Team {
					department {
						name
					}
				}
				query {
					teams {
						...TeamBasic
						...TeamWithDept
					}
				}`,
				Role: "admin",
			},
		},

		// Fragment on local DB type should not be forwarded to remote schema
		{
			name: "fragment on local type with remote schema relationship",
			query: query{
				Query: `
				fragment DeptInfo on departments {
					id
					name
					budget
				}
				query {
					departments {
						...DeptInfo
						team {
							name
						}
					}
				}`,
				Role: "admin",
			},
		},

		// db->rs relationship with user-provided argument forwarding
		{
			name: "db to rs relationship with no user arg (teamFiltered baseline)",
			query: query{
				Query: `query {
					departments {
						name
						teamFiltered {
							name
							wins
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "db to rs relationship with includeStats false",
			query: query{
				Query: `query {
					departments {
						name
						teamFiltered(includeStats: false) {
							name
							wins
							losses
							points
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "db to rs relationship with includeStats true",
			query: query{
				Query: `query {
					departments {
						name
						teamFiltered(includeStats: true) {
							name
							wins
							losses
							points
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "db to rs relationship with includeStats variable",
			query: query{
				Query: `query($stats: Boolean) {
					departments {
						name
						teamFiltered(includeStats: $stats) {
							name
							wins
							losses
							points
						}
					}
				}`,
				Variables: map[string]any{"stats": false},
				Role:      "admin",
			},
		},
	}

	RunGraphQLTests(t, cases, TestConfig{
		IsMutation:           false,
		ReinitBetweenQueries: false,
	})
}

func TestMutationRemoteRelationships(t *testing.T) { //nolint:paralleltest
	cases := []TestCase{
		{
			name: "mutation with remote relationship should work",
			query: query{
				Query: `mutation {
					insert_userProfiles(
						objects: [{
							id: "660e8400-e29b-41d4-a716-446655440054"
							user_id: "550e8400-e29b-41d4-a716-446655440054"
							address: "123 Test St"
						}]
					) {
						returning {
							id
							user {
								id
							}
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

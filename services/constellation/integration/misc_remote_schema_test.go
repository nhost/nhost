package integration_test

import (
	"net/http"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestRemoteSchemaQueries(t *testing.T) { //nolint:paralleltest,maintidx
	cases := []TestCase{
		// Admin can query all teams without any presets
		{
			name: "admin query teams",
			query: query{
				Query: `query {
					teams {
						id
						name
						departmentId
						departmentName
					}
				}`,
				Role: "admin",
			},
		},

		// Admin can query a specific team by id
		{
			name: "admin query team by id",
			query: query{
				Query: `query {
					team(id: "team-eng") {
						id
						name
						departmentName
					}
				}`,
				Role: "admin",
			},
		},

		// User can query all teams (same as admin for this query)
		{
			name: "user query teams",
			query: query{
				Query: `query {
					teams {
						id
						name
					}
				}`,
				Role: "user",
			},
		},

		// User query with @preset: myTeam uses x-hasura-team-id session variable
		// The teamId argument is preset from x-hasura-team-id, so user doesn't provide it
		{
			name: "user query myTeam with preset from session variable",
			query: query{
				Query: `query {
					myTeam {
						id
						name
						departmentName
					}
				}`,
				Role: "user",
				SessionVariables: map[string]string{
					"team-id": "team-eng",
				},
			},
		},

		// User query with @preset: myTeam with different team
		{
			name: "user query myTeam with different team",
			query: query{
				Query: `query {
					myTeam {
						id
						name
						departmentName
					}
				}`,
				Role: "user",
				SessionVariables: map[string]string{
					"team-id": "team-hr",
				},
			},
		},

		// User query teamGames with @preset: uses x-hasura-team-id session variable
		// When no games exist, returns empty array
		{
			name: "user query teamGames with preset - empty",
			query: query{
				Query: `query {
					teamGames {
						id
					}
				}`,
				Role: "user",
				SessionVariables: map[string]string{
					"team-id": "team-eng",
				},
			},
		},

		// User query leaderboard (no preset needed)
		{
			name: "user query leaderboard",
			query: query{
				Query: `query {
					leaderboard {
						id
						name
						points
						wins
						draws
						losses
					}
				}`,
				Role: "user",
			},
		},

		// User query all games
		{
			name: "user query games",
			query: query{
				Query: `query {
					games {
						id
						homeScore
						awayScore
					}
				}`,
				Role: "user",
			},
		},

		// User query single game by id
		{
			name: "user query game by id",
			query: query{
				Query: `query {
					game(id: "game-1") {
						id
						homeScore
						awayScore
					}
				}`,
				Role: "user",
			},
		},

		// User query team by id (no preset, explicit id)
		{
			name: "user query team by id",
			query: query{
				Query: `query {
					team(id: "team-eng") {
						id
						name
						departmentName
					}
				}`,
				Role: "user",
			},
		},

		// User query team by department
		{
			name: "user query team by department",
			query: query{
				Query: `query {
					teamByDepartment(departmentId: "dept-eng") {
						id
						name
						departmentId
					}
				}`,
				Role: "user",
			},
		},

		// Test with fragments
		{
			name: "query with fragment",
			query: query{
				Query: `
				fragment TeamFields on Team {
					id
					name
					departmentName
				}
				query {
					teams {
						...TeamFields
					}
				}`,
				Role: "admin",
			},
		},

		// Test with inline fragments
		{
			name: "query with inline fragment",
			query: query{
				Query: `query {
					teams {
						... on Team {
							id
							name
						}
					}
				}`,
				Role: "user",
			},
		},

		// Test with aliases
		{
			name: "query with aliases",
			query: query{
				Query: `query {
					engineering: team(id: "team-eng") {
						teamId: id
						teamName: name
						dept: departmentName
					}
					hr: team(id: "team-hr") {
						teamId: id
						teamName: name
						dept: departmentName
					}
				}`,
				Role: "admin",
			},
		},

		// Test with multiple aliases on same field
		{
			name: "query with multiple aliases on leaderboard",
			query: query{
				Query: `query {
					topTeams: leaderboard {
						id
						name
						points
					}
					standings: leaderboard {
						id
						wins
						losses
					}
				}`,
				Role: "user",
			},
		},

		// Test fragments with aliases combined
		{
			name: "query with fragment and aliases",
			query: query{
				Query: `
				fragment GameInfo on Game {
					gameId: id
					home: homeScore
					away: awayScore
				}
				query {
					allGames: games {
						...GameInfo
					}
				}`,
				Role: "admin",
			},
		},

		// Same query with different roles
		{
			name: "admin can query all team fields",
			query: query{
				Query: `query {
					teams {
						id
						name
						departmentId
						departmentName
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "user can query limited team fields",
			query: query{
				Query: `query {
					teams {
						id
						name
					}
				}`,
				Role: "user",
			},
		},

		// Admin vs user on specific team query
		{
			name: "admin query specific team",
			query: query{
				Query: `query {
					team(id: "team-eng") {
						id
						name
						departmentId
						departmentName
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "user query specific team",
			query: query{
				Query: `query {
					team(id: "team-eng") {
						id
						name
						departmentName
					}
				}`,
				Role: "user",
			},
		},

		// Leaderboard access by different roles
		{
			name: "admin query leaderboard",
			query: query{
				Query: `query {
					leaderboard {
						id
						name
						points
						wins
						draws
						losses
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "user query leaderboard",
			query: query{
				Query: `query {
					leaderboard {
						id
						name
						points
						wins
						draws
						losses
					}
				}`,
				Role: "user",
			},
		},

		// Games query by different roles
		{
			name: "admin query games",
			query: query{
				Query: `query {
					games {
						id
						homeScore
						awayScore
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "user query games",
			query: query{
				Query: `query {
					games {
						id
						homeScore
						awayScore
					}
				}`,
				Role: "user",
			},
		},

		{
			name: "custom type",
			query: query{
				Query: `query {
				  users {
					displayName
					profile {
					  address
					}
				  }
				}`,
				Role: "admin",
			},
		},

		// Namespaced remote schema (rs_namespaced): all root fields are wrapped
		// under `league` and types are prefixed `League*`. These exercise the
		// customization decorator's operation reversal and response re-wrapping.
		{
			name: "admin query namespaced league teams",
			query: query{
				Query: `query {
					league {
						teams {
							id
							name
							departmentName
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "user query namespaced league teams",
			query: query{
				Query: `query {
					league {
						teams {
							id
							name
						}
					}
				}`,
				Role: "user",
			},
		},
		{
			name: "admin query namespaced league with __typename",
			query: query{
				Query: `query {
					league {
						team(id: "team-eng") {
							id
							__typename
						}
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "admin query namespaced league with alias and fragment",
			query: query{
				Query: `
				fragment LeagueTeamFields on LeagueTeam {
					id
					name
				}
				query {
					eng: league {
						team(id: "team-eng") {
							...LeagueTeamFields
						}
					}
				}`,
				Role: "admin",
			},
		},
	}

	RunGraphQLTests(t, cases, TestConfig{
		IsMutation:           false,
		ReinitBetweenQueries: false,
	})
}

// TestRemoteSchemaNamespaceReference compares read-only wrapper fragments against
// the pinned live Hasura instance without changing shared metadata or remote data.
//
//nolint:paralleltest // Keep live comparisons serial on the shared integration stack.
func TestRemoteSchemaNamespaceReference(
	t *testing.T,
) {
	version, err := referenceVersion(t.Context(), hasuraURL)
	if err != nil {
		t.Fatalf("Hasura connectivity/version: %v", err)
	}

	if version != "v2.50.3-ce" {
		t.Fatalf("unexpected Hasura version %q (expected v2.50.3-ce)", version)
	}

	if _, err := referenceVersion(t.Context(), constellationURL); err != nil {
		t.Fatalf("Constellation connectivity/version: %v", err)
	}

	headers := http.Header{}
	headers.Set("x-hasura-admin-secret", adminSecret)

	cases := []struct {
		name, document string
	}{
		{
			name: "inline directive",
			document: `query Op($show: Boolean!) {
				eng: league {
					team(id: "team-eng") { id }
					... @include(if: $show) { hr: team(id: "team-hr") { id } }
				}
			}`,
		},
		{
			name: "typed inline directive",
			document: `query Op($show: Boolean!) {
				eng: league {
					team(id: "team-eng") { id }
					... on leagueQuery @include(if: $show) {
						hr: team(id: "team-hr") { id }
					}
				}
			}`,
		},
		{
			name: "named wrapper spread",
			document: `query Op($show: Boolean!) {
				eng: league {
					team(id: "team-eng") { id }
					...Extra @include(if: $show)
				}
			}
			fragment Extra on leagueQuery { hr: team(id: "team-hr") { id } }`,
		},
	}

	for _, tc := range cases {
		for _, show := range []bool{true, false} {
			name := tc.name + "/false"
			if show {
				name = tc.name + "/true"
			}

			//nolint:paralleltest // Keep both engines' reads paired in each subtest.
			t.Run(name, func(t *testing.T) {
				request := query{
					Query: tc.document, OperationName: "Op",
					Variables: map[string]any{"show": show}, Role: "admin",
				}

				wantLeague := map[string]any{"team": map[string]any{"id": "team-eng"}}
				if show {
					wantLeague["hr"] = map[string]any{"id": "team-hr"}
				}

				want := map[string]any{"data": map[string]any{"eng": wantLeague}}

				hasura, err := makeHTTPQuery(t.Context(), hasuraURL, request, headers)
				if err != nil {
					t.Fatalf("Hasura query: %v", err)
				}

				if diff := cmp.Diff(want, hasura); diff != "" {
					t.Fatalf("Hasura namespace fragment result changed (-want +got):\n%s", diff)
				}

				constellation, err := makeHTTPQuery(t.Context(), constellationURL, request, headers)
				if err != nil {
					t.Fatalf("Constellation query: %v", err)
				}

				if diff := cmp.Diff(hasura, constellation); diff != "" {
					t.Errorf(
						"namespace fragment responses differ (-hasura +constellation):\n%s",
						diff,
					)
				}
			})
		}
	}
}

func TestRemoteSchemaMutations(t *testing.T) { //nolint:paralleltest
	cases := []TestCase{
		// First, reset the league to ensure clean state
		{
			name: "admin reset league",
			query: query{
				Query: `mutation {
					resetLeague
				}`,
				Role: "admin",
			},
		},

		// Admin can record a game using recordGame (full access, no presets)
		{
			name: "admin record game",
			query: query{
				Query: `mutation {
					recordGame(input: {
						homeTeamId: "team-eng"
						awayTeamId: "team-hr"
						homeScore: 3
						awayScore: 1
					}) {
						homeTeam {
							id
							name
						}
						awayTeam {
							id
							name
						}
						homeScore
						awayScore
						source
					}
				}`,
				Role: "admin",
			},
		},

		// User mutation with @preset: recordMyTeamGame uses x-hasura-team-id for teamId
		// The teamId argument is NOT visible in the schema for user role (hidden by @preset)
		{
			name: "user record my team game with preset",
			query: query{
				Query: `mutation {
					recordMyTeamGame(
						opponentId: "team-sales"
						teamScore: 2
						opponentScore: 0
						isHome: true
					) {
						homeTeam {
							id
							name
						}
						awayTeam {
							id
							name
						}
						homeScore
						awayScore
						source
					}
				}`,
				Role: "user",
				SessionVariables: map[string]string{
					"team-id": "team-eng",
				},
			},
		},

		// User mutation with @preset: reportGame uses literal "user-reported" for source
		// The source and homeTeamId arguments are NOT visible in the schema for user role
		{
			name: "user report game with preset source",
			query: query{
				Query: `mutation {
					reportGame(
						awayTeamId: "team-fin"
						homeScore: 1
						awayScore: 1
					) {
						homeTeam {
							id
							name
						}
						awayTeam {
							id
							name
						}
						homeScore
						awayScore
						source
					}
				}`,
				Role: "user",
				SessionVariables: map[string]string{
					"team-id": "team-mkt",
				},
			},
		},
	}

	RunGraphQLTests(t, cases, TestConfig{
		IsMutation:           false,
		ReinitBetweenQueries: false,
	})
}

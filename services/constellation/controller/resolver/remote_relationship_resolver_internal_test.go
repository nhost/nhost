package resolver

import (
	"context"
	"log/slog"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/connector"
	connectormock "github.com/nhost/nhost/services/constellation/connector/mock"
	"github.com/nhost/nhost/services/constellation/internal/jsonpath"
	"github.com/vektah/gqlparser/v2/ast"
	"go.uber.org/mock/gomock"
)

// stubRemoteQueryResolver is an inline white-box stub for the
// remoteQueryResolver interface. White-box tests in package resolver cannot
// import a resolver/mock subpackage (import cycle), so each branch records
// the calls it needs to observe and returns canned values.
type stubRemoteQueryResolver struct {
	buildOperation       func(rq *remoteQuery) *ast.OperationDefinition
	extractResults       func(rq *remoteQuery, response any) []any
	buildResultLookup    func(rq *remoteQuery, results []any) map[string][]any
	getJoinKeyFromParent func(rq *remoteQuery, parentRow map[string]any) string
}

func (s *stubRemoteQueryResolver) BuildOperation(
	rq *remoteQuery,
) *ast.OperationDefinition {
	if s.buildOperation == nil {
		return nil
	}

	return s.buildOperation(rq)
}

func (s *stubRemoteQueryResolver) ExtractResults(rq *remoteQuery, response any) []any {
	if s.extractResults == nil {
		return nil
	}

	return s.extractResults(rq, response)
}

func (s *stubRemoteQueryResolver) BuildResultLookup(
	rq *remoteQuery,
	results []any,
) map[string][]any {
	if s.buildResultLookup == nil {
		return nil
	}

	return s.buildResultLookup(rq, results)
}

func (s *stubRemoteQueryResolver) GetJoinKeyFromParent(
	rq *remoteQuery,
	parentRow map[string]any,
) string {
	if s.getJoinKeyFromParent == nil {
		return ""
	}

	return s.getJoinKeyFromParent(rq, parentRow)
}

// remoteResolveCase describes a single Resolve() scenario. setup produces the
// parent results, the remote-query plan, and the connectors map; assert
// inspects the post-Resolve state. Returning the connectors map (rather than
// hard-coding it) lets cases choose between a registered mock and an empty
// map (missing-connector error path).
type remoteResolveCase struct {
	name    string
	setup   func(t *testing.T) (results map[string]any, rqs []*remoteQuery, conns map[string]connector.Connector)
	wantErr bool
	assert  func(t *testing.T, results map[string]any)
}

// Table-driven test for RemoteRelationshipResolver.Resolve. The per-case
// setup closures construct full parent results, remote-query plans, and
// connector maps; the gocognit threshold is exceeded by aggregate branch
// count, not by depth of any single case.
func TestRemoteRelationshipResolver_Resolve(t *testing.T) { //nolint:gocognit,cyclop,maintidx
	t.Parallel()

	deptStub := func(remoteResults []any) *stubRemoteQueryResolver {
		return &stubRemoteQueryResolver{
			buildOperation: func(*remoteQuery) *ast.OperationDefinition {
				return &ast.OperationDefinition{
					Operation:    ast.Query,
					SelectionSet: ast.SelectionSet{&ast.Field{Name: "departments"}},
				}
			},
			extractResults: func(*remoteQuery, any) []any { return remoteResults },
			buildResultLookup: func(*remoteQuery, []any) map[string][]any {
				return map[string][]any{
					"departmentId=dept1;": {remoteResults[0]},
					"departmentId=dept2;": {remoteResults[1]},
				}
			},
			getJoinKeyFromParent: func(_ *remoteQuery, parentRow map[string]any) string {
				return "departmentId=" + parentRow["departmentId"].(string) + ";" //nolint:forcetypeassert
			},
		}
	}

	tests := []remoteResolveCase{
		{
			name: "stitches remote results into parent data",
			setup: func(t *testing.T) (map[string]any, []*remoteQuery, map[string]connector.Connector) {
				t.Helper()

				results := map[string]any{
					"teams": []any{
						map[string]any{"name": "Team A", "departmentId": "dept1"},
						map[string]any{"name": "Team B", "departmentId": "dept2"},
					},
				}
				remoteResults := []any{
					map[string]any{"id": "dept1", "name": "Engineering"},
					map[string]any{"id": "dept2", "name": "Sales"},
				}

				mockConn := connectormock.NewMockConnector(gomock.NewController(t))
				mockConn.EXPECT().
					Execute(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).
					Return(map[string]any{"data": remoteResults}, nil)

				rq := &remoteQuery{
					targetConnector: "default",
					alias:           "department",
					parentPath:      jsonpath.Parse("teams"),
					isArray:         false,
					joinArguments: []*remoteJoinArgument{
						newRemoteJoinArgument(map[string]any{"departmentId": "dept1"}),
						newRemoteJoinArgument(map[string]any{"departmentId": "dept2"}),
					},
					sourceField:         nil,
					fragments:           nil,
					localPhantomFields:  []string{"departmentId"},
					remotePhantomFields: nil,
					resolver:            deptStub(remoteResults),
					aggregateInfo:       nil,
				}

				return results, []*remoteQuery{rq}, map[string]connector.Connector{
					"default": mockConn,
				}
			},
			assert: func(t *testing.T, results map[string]any) {
				t.Helper()

				teams, ok := results["teams"].([]any)
				if !ok {
					t.Fatal("teams is not []any")
				}

				for i, team := range teams {
					teamMap, ok := team.(map[string]any)
					if !ok {
						t.Fatalf("team[%d] is not map[string]any", i)
					}

					if _, exists := teamMap["departmentId"]; exists {
						t.Errorf("team[%d] still has departmentId (should be removed)", i)
					}

					if _, exists := teamMap["department"]; !exists {
						t.Errorf("team[%d] missing department field", i)
					}
				}
			},
		},
		{
			name: "handles nested arrays correctly",
			setup: func(t *testing.T) (map[string]any, []*remoteQuery, map[string]connector.Connector) {
				t.Helper()

				results := map[string]any{
					"games": []any{
						map[string]any{
							"id": "game1",
							"homeTeam": map[string]any{
								"name":         "Team A",
								"departmentId": "dept1",
							},
						},
						map[string]any{
							"id": "game2",
							"homeTeam": map[string]any{
								"name":         "Team B",
								"departmentId": "dept2",
							},
						},
					},
				}
				remoteResults := []any{
					map[string]any{"id": "dept1", "name": "Engineering"},
					map[string]any{"id": "dept2", "name": "Sales"},
				}

				mockConn := connectormock.NewMockConnector(gomock.NewController(t))
				mockConn.EXPECT().
					Execute(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).
					Return(map[string]any{"data": remoteResults}, nil)

				rq := &remoteQuery{
					targetConnector: "default",
					alias:           "department",
					parentPath:      jsonpath.Parse("games.homeTeam"),
					isArray:         false,
					joinArguments: []*remoteJoinArgument{
						newRemoteJoinArgument(map[string]any{"departmentId": "dept1"}),
						newRemoteJoinArgument(map[string]any{"departmentId": "dept2"}),
					},
					sourceField:         nil,
					fragments:           nil,
					localPhantomFields:  []string{"departmentId"},
					remotePhantomFields: nil,
					resolver:            deptStub(remoteResults),
					aggregateInfo:       nil,
				}

				return results, []*remoteQuery{rq}, map[string]connector.Connector{
					"default": mockConn,
				}
			},
			assert: func(t *testing.T, results map[string]any) {
				t.Helper()

				games, ok := results["games"].([]any)
				if !ok {
					t.Fatal("games is not []any")
				}

				for i, game := range games {
					gameMap, ok := game.(map[string]any)
					if !ok {
						t.Fatalf("games[%d] is not map[string]any", i)
					}

					homeTeam, ok := gameMap["homeTeam"].(map[string]any)
					if !ok {
						t.Fatalf("games[%d].homeTeam is not map[string]any", i)
					}

					if _, exists := homeTeam["departmentId"]; exists {
						t.Errorf("games[%d].homeTeam still has departmentId", i)
					}

					if _, exists := homeTeam["department"]; !exists {
						t.Errorf("games[%d].homeTeam missing department", i)
					}
				}
			},
		},
		{
			name: "skips queries with no join arguments",
			setup: func(t *testing.T) (map[string]any, []*remoteQuery, map[string]connector.Connector) {
				t.Helper()

				// Mock connector with no EXPECT() — any call would fail the test.
				mockConn := connectormock.NewMockConnector(gomock.NewController(t))

				results := map[string]any{
					"teams": []any{
						map[string]any{"name": "Team A"},
					},
				}

				rq := &remoteQuery{
					targetConnector:     "default",
					alias:               "",
					isArray:             false,
					joinArguments:       nil,
					sourceField:         nil,
					fragments:           nil,
					parentPath:          nil,
					localPhantomFields:  nil,
					remotePhantomFields: nil,
					resolver:            nil,
					aggregateInfo:       nil,
				}

				return results, []*remoteQuery{rq}, map[string]connector.Connector{
					"default": mockConn,
				}
			},
			assert: func(*testing.T, map[string]any) {},
		},
		{
			name: "returns error for missing connector",
			setup: func(t *testing.T) (map[string]any, []*remoteQuery, map[string]connector.Connector) {
				t.Helper()

				stub := &stubRemoteQueryResolver{
					buildOperation: func(*remoteQuery) *ast.OperationDefinition {
						return &ast.OperationDefinition{
							Operation:    ast.Query,
							SelectionSet: ast.SelectionSet{&ast.Field{Name: "test"}},
						}
					},
					extractResults:       nil,
					buildResultLookup:    nil,
					getJoinKeyFromParent: nil,
				}

				rq := &remoteQuery{
					targetConnector: "nonexistent",
					alias:           "",
					isArray:         false,
					joinArguments: []*remoteJoinArgument{
						newRemoteJoinArgument(map[string]any{"id": "1"}),
					},
					sourceField:         nil,
					fragments:           nil,
					parentPath:          nil,
					localPhantomFields:  nil,
					remotePhantomFields: nil,
					resolver:            stub,
					aggregateInfo:       nil,
				}

				return map[string]any{}, []*remoteQuery{rq}, map[string]connector.Connector{}
			},
			wantErr: true,
			assert:  func(*testing.T, map[string]any) {},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			results, rqs, conns := tt.setup(t)
			rr := New(conns)

			err := rr.Resolve(
				context.Background(),
				results,
				rqs,
				nil, nil, "admin", nil, slog.Default(),
			)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}

				return
			}

			if err != nil {
				t.Fatalf("Resolve() error = %v", err)
			}

			tt.assert(t, results)
		})
	}
}

func TestRemovePhantomFieldsFromPlan(t *testing.T) {
	t.Parallel()

	t.Run("removes phantom fields from multiple paths", func(t *testing.T) {
		t.Parallel()

		results := map[string]any{
			"games": []any{
				map[string]any{
					"homeTeam": map[string]any{
						"name":         "Team A",
						"departmentId": "dept1",
					},
					"awayTeam": map[string]any{
						"name":         "Team B",
						"departmentId": "dept2",
					},
				},
			},
		}

		rr := New(nil)

		remoteQueries := []*remoteQuery{
			{
				targetConnector:     "",
				alias:               "",
				isArray:             false,
				joinArguments:       nil,
				sourceField:         nil,
				fragments:           nil,
				parentPath:          jsonpath.Parse("games.homeTeam"),
				localPhantomFields:  []string{"departmentId"},
				remotePhantomFields: nil,
				resolver:            nil,
				aggregateInfo:       nil,
			},
			{
				targetConnector:     "",
				alias:               "",
				isArray:             false,
				joinArguments:       nil,
				sourceField:         nil,
				fragments:           nil,
				parentPath:          jsonpath.Parse("games.awayTeam"),
				localPhantomFields:  []string{"departmentId"},
				remotePhantomFields: nil,
				resolver:            nil,
				aggregateInfo:       nil,
			},
		}

		// Use Resolve with empty queries to trigger phantom field cleanup
		_ = rr.Resolve(
			context.Background(),
			results,
			remoteQueries,
			nil, nil, "admin", nil, slog.Default(),
		)

		games, ok := results["games"].([]any)
		if !ok {
			t.Fatal("games is not []any")
		}

		game, ok := games[0].(map[string]any)
		if !ok {
			t.Fatal("games[0] is not map[string]any")
		}

		homeTeam, ok := game["homeTeam"].(map[string]any)
		if !ok {
			t.Fatal("homeTeam is not map[string]any")
		}

		awayTeam, ok := game["awayTeam"].(map[string]any)
		if !ok {
			t.Fatal("awayTeam is not map[string]any")
		}

		if _, exists := homeTeam["departmentId"]; exists {
			t.Error("homeTeam still has departmentId")
		}

		if _, exists := awayTeam["departmentId"]; exists {
			t.Error("awayTeam still has departmentId")
		}

		// Names should still be there
		if homeTeam["name"] != "Team A" {
			t.Error("homeTeam name was incorrectly removed")
		}

		if awayTeam["name"] != "Team B" {
			t.Error("awayTeam name was incorrectly removed")
		}
	})

	t.Run("deduplicates paths", func(t *testing.T) {
		t.Parallel()

		results := map[string]any{
			"teams": []any{
				map[string]any{
					"name":         "Team A",
					"departmentId": "dept1",
					"extra":        "value",
				},
			},
		}

		// Two queries with the same parent path
		remoteQueries := []*remoteQuery{
			{
				targetConnector:     "",
				alias:               "",
				isArray:             false,
				joinArguments:       nil,
				sourceField:         nil,
				fragments:           nil,
				parentPath:          jsonpath.Parse("teams"),
				localPhantomFields:  []string{"departmentId"},
				remotePhantomFields: nil,
				resolver:            nil,
				aggregateInfo:       nil,
			},
			{
				targetConnector:     "",
				alias:               "",
				isArray:             false,
				joinArguments:       nil,
				sourceField:         nil,
				fragments:           nil,
				parentPath:          jsonpath.Parse("teams"),
				localPhantomFields:  []string{"departmentId"},
				remotePhantomFields: nil,
				resolver:            nil,
				aggregateInfo:       nil,
			},
		}

		rr := New(nil)
		_ = rr.Resolve(
			context.Background(),
			results,
			remoteQueries,
			nil, nil, "admin", nil, slog.Default(),
		)

		teams, ok := results["teams"].([]any)
		if !ok {
			t.Fatal("teams is not []any")
		}

		team, ok := teams[0].(map[string]any)
		if !ok {
			t.Fatal("teams[0] is not map[string]any")
		}

		// Should only have name and extra (departmentId removed once)
		expected := map[string]any{"name": "Team A", "extra": "value"}
		if diff := cmp.Diff(expected, team); diff != "" {
			t.Errorf("unexpected result (-want +got):\n%s", diff)
		}
	})
}

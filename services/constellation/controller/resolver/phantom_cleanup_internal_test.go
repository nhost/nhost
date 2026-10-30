package resolver

import (
	"context"
	"log/slog"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector"
	connectormock "github.com/nhost/nhost/services/constellation/connector/mock"
	"github.com/nhost/nhost/services/constellation/internal/jsonpath"
	"github.com/vektah/gqlparser/v2/ast"
	"go.uber.org/mock/gomock"
)

// TestTargetPhantomCleanupOwnsResultMaps pins the cleanup lifetime independently
// of the planner's duplicate-merge optimization. Even if two historical plans
// occupy the same response path, the first plan's phantom cannot delete a
// user-selected target join column in the later plan's final output.
func TestTargetPhantomCleanupOwnsResultMaps(t *testing.T) {
	t.Parallel()

	mockConn := connectormock.NewMockConnector(gomock.NewController(t))
	first := map[string]any{"label": "first", "id": float64(1)}
	mockConn.EXPECT().Execute(gomock.Any(), gomock.Any(), gomock.Any(),
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).
		Return(map[string]any{"row": first}, nil)
	mockConn.EXPECT().Execute(gomock.Any(), gomock.Any(), gomock.Any(),
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).
		Return(map[string]any{"row": map[string]any{"label": "first", "id": float64(1)}}, nil)

	result := map[string]any{"parents": []any{map[string]any{"key": "first"}}}

	queries := make([]*remoteQuery, 0, 2)
	for _, phantom := range []bool{true, false} {
		stub := &stubRemoteQueryResolver{
			buildOperation: func(rq *remoteQuery) *ast.OperationDefinition {
				if phantom {
					rq.remotePhantomFields = []string{"label"}
				}

				return &ast.OperationDefinition{
					Operation:    ast.Query,
					SelectionSet: ast.SelectionSet{&ast.Field{Name: "row"}},
				}
			},
			extractResults: func(_ *remoteQuery, response any) []any {
				data, ok := response.(map[string]any)
				if !ok {
					t.Fatalf("unexpected mock result: %T", response)
				}

				return []any{data["row"]}
			},
			buildResultLookup: func(_ *remoteQuery, rows []any) map[string][]any {
				return map[string][]any{"first": rows}
			},
			getJoinKeyFromParent: func(_ *remoteQuery, row map[string]any) string {
				return row["key"].(string) //nolint:forcetypeassert // Fixture key is a string.
			},
		}
		queries = append(queries, &remoteQuery{
			targetConnector: "target",
			alias:           "joined",
			isArray:         false,
			joinArguments: []*remoteJoinArgument{
				newRemoteJoinArgument(map[string]any{"key": "first"}),
			},
			sourceColumns: []string{"key"},
			sourceField:   &ast.Field{Name: "joined"},
			parentPath:    jsonpath.Parse("parents"),
			resolver:      stub,
		})
	}

	resolver := New(map[string]connector.Connector{"target": mockConn})
	if err := resolver.Resolve(
		context.Background(),
		result,
		queries,
		nil,
		nil,
		"admin",
		nil,
		slog.Default(),
	); err != nil {
		t.Fatal(err)
	}

	row := result["parents"].([]any)[0].(map[string]any) //nolint:forcetypeassert // Fixture shape.

	joined := row["joined"].(map[string]any) //nolint:forcetypeassert // Fixture shape.
	if joined["label"] != "first" || joined["id"] != float64(1) {
		t.Fatalf("user-selected join column lost: %#v", joined)
	}

	if _, leaked := first["label"]; leaked {
		t.Fatalf("first query's join-column phantom was not stripped: %#v", first)
	}
}

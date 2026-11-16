package resolver

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector"
	"github.com/nhost/nhost/services/constellation/connector/groupedaggregate"
	connectormock "github.com/nhost/nhost/services/constellation/connector/mock"
	"github.com/nhost/nhost/services/constellation/internal/jsonpath"
	"github.com/vektah/gqlparser/v2/ast"
	"go.uber.org/mock/gomock"
)

type stubCollectionTarget struct {
	connector.Connector

	fetch func(groupedaggregate.Request) (map[string]any, error)
}

func (s stubCollectionTarget) ExecuteGroupedCollection(
	_ context.Context, req groupedaggregate.Request, _ string,
	_ map[string]any, _ *slog.Logger,
) (map[string]any, error) {
	return s.fetch(req)
}

func TestExecuteAndStitchCollectionBranches(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name    string
		setup   func(t *testing.T) (connector.Connector, remoteQueryResolver)
		wantErr string
	}{
		{"missing target", func(t *testing.T) (connector.Connector, remoteQueryResolver) {
			t.Helper()
			return nil, newDatabaseResolver(map[string]string{"id": "id"}, "users")
		}, "target connector not found"},
		{"target lacks executor", func(t *testing.T) (connector.Connector, remoteQueryResolver) {
			t.Helper()

			return connectormock.NewMockConnector(gomock.NewController(t)),
				newDatabaseResolver(map[string]string{"id": "id"}, "users")
		}, errCollectionExecutorUnavailable.Error()},
		{"resolver is not database", func(t *testing.T) (connector.Connector, remoteQueryResolver) {
			t.Helper()

			return stubCollectionTarget{fetch: func(groupedaggregate.Request) (map[string]any, error) {
				t.Fatal("should not fetch")
				return nil, nil
			}}, &stubRemoteQueryResolver{}
		}, errCollectionExecutorUnavailable.Error()},
		{"invalid group", func(t *testing.T) (connector.Connector, remoteQueryResolver) {
			t.Helper()

			return stubCollectionTarget{fetch: func(groupedaggregate.Request) (map[string]any, error) {
				return map[string]any{"1": "not a group"}, nil
			}}, newDatabaseResolver(map[string]string{"id": "id"}, "users")
		}, "invalid grouped remote array result: group"},
		{"invalid nodes", func(t *testing.T) (connector.Connector, remoteQueryResolver) {
			t.Helper()

			return stubCollectionTarget{fetch: func(groupedaggregate.Request) (map[string]any, error) {
				return map[string]any{"1": map[string]any{"nodes": "not rows"}}, nil
			}}, newDatabaseResolver(map[string]string{"id": "id"}, "users")
		}, "invalid grouped remote array result: nodes"},
		{"executor error", func(t *testing.T) (connector.Connector, remoteQueryResolver) {
			t.Helper()

			return stubCollectionTarget{fetch: func(groupedaggregate.Request) (map[string]any, error) {
				return nil, errors.New("database failed") //nolint:err113 // branch-specific failure
			}}, newDatabaseResolver(map[string]string{"id": "id"}, "users")
		}, "executing grouped remote array: database failed"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			conn, strategy := tc.setup(t)
			rq := &remoteQuery{
				targetConnector: "target", alias: "kids", isArray: true,
				joinArguments: []*remoteJoinArgument{
					newRemoteJoinArgument(map[string]any{"id": 1}),
					newRemoteJoinArgument(map[string]any{"id": 2}),
				},
				sourceColumns: []string{"id"}, sourceField: &ast.Field{Name: "kids"},
				parentPath: jsonpath.Parse("users"), resolver: strategy,
				collectionInfo: &aggregateInfo{
					targetTableSchema: "public", targetTableName: "users",
					joinMapping: map[string]string{"id": "id"},
				},
			}
			r := New(map[string]connector.Connector{"target": conn})

			err := r.executeAndStitchCollection(t.Context(), map[string]any{
				"users": []any{map[string]any{"id": 1}, map[string]any{"id": 2}},
			}, rq, nil, nil, "admin", nil, slog.Default())
			if err == nil || !strings.Contains(err.Error(), tc.wantErr) {
				t.Fatalf("error=%v, want %q", err, tc.wantErr)
			}
		})
	}
}

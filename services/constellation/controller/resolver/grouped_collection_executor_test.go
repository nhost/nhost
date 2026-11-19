package resolver_test

import (
	"context"
	"log/slog"
	"reflect"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"go.uber.org/mock/gomock"

	"github.com/nhost/nhost/services/constellation/connector"
	"github.com/nhost/nhost/services/constellation/connector/groupedaggregate"
	connectormock "github.com/nhost/nhost/services/constellation/connector/mock"
	"github.com/nhost/nhost/services/constellation/controller/planner"
	"github.com/nhost/nhost/services/constellation/controller/resolver"
	collectionmock "github.com/nhost/nhost/services/constellation/controller/resolver/mock"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/internal/jsonpath"
)

type mockedCollectionConnector struct {
	connector.Connector
	*collectionmock.MockgroupedCollectionExecutor
}

// TestResolvePlannedGroupedCollection exercises the generated consumer mock
// through the exported plan/executor boundary; the SQL-backed tests separately
// verify the real connector's behavior.
func TestResolvePlannedGroupedCollection(t *testing.T) {
	t.Parallel()

	userWhere := &ast.Value{Kind: ast.ObjectValue, Children: ast.ChildValueList{{
		Name: "id", Value: &ast.Value{Kind: ast.ObjectValue, Children: ast.ChildValueList{{
			Name: "_gte", Value: &ast.Value{Kind: ast.IntValue, Raw: "1"},
		}}},
	}}}

	for _, tc := range []struct {
		name  string
		where *ast.Value
	}{
		{name: "no user where"},
		{name: "user where only", where: userWhere},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			m := gomock.NewController(t)
			base := connectormock.NewMockConnector(m)
			base.EXPECT().GetSchema().Return(map[string]*graph.Schema{}, nil)

			executor := collectionmock.NewMockgroupedCollectionExecutor(m)
			executor.EXPECT().
				ExecuteGroupedCollection(gomock.Any(), gomock.Any(), "admin", nil, gomock.Any()).
				DoAndReturn(func(_ context.Context, req groupedaggregate.Request, _ string,
					_ map[string]any, _ *slog.Logger,
				) (map[string]any, error) {
					where := req.Field.Arguments.ForName("where")
					if tc.where == nil && where != nil || tc.where != nil &&
						(where == nil || !reflect.DeepEqual(where.Value, tc.where)) {
						t.Errorf("grouped where = %#v, want user where %#v", where, tc.where)
					}

					if want := []string{
						"z_id",
						"a_kind",
					}; !reflect.DeepEqual(
						req.JoinColumns,
						want,
					) {
						t.Errorf("JoinColumns = %#v, want %#v", req.JoinColumns, want)
					}

					if want := [][]any{
						{1, "x"},
						{2, "y"},
					}; !reflect.DeepEqual(
						req.JoinTuples,
						want,
					) {
						t.Errorf("JoinTuples = %#v, want %#v", req.JoinTuples, want)
					}

					return map[string]any{
						groupedaggregate.TupleKey([]any{1, "x"}, []bool{false, false}): map[string]any{
							"nodes": []any{map[string]any{"id": float64(1)}},
						},
						groupedaggregate.TupleKey([]any{2, "y"}, []bool{false, false}): map[string]any{
							"nodes": []any{map[string]any{"id": float64(2)}},
						},
					}, nil
				})
			r := resolver.New(map[string]connector.Connector{
				"target": mockedCollectionConnector{
					Connector:                     base,
					MockgroupedCollectionExecutor: executor,
				},
			})
			results := map[string]any{"users": []any{
				map[string]any{"id": 1, "kind": "x"},
				map[string]any{"id": 2, "kind": "y"},
				map[string]any{"id": 1, "kind": "x"},
			}}

			arguments := ast.ArgumentList{{
				Name: "limit", Value: &ast.Value{Kind: ast.IntValue, Raw: "1"},
			}}
			if tc.where != nil {
				arguments = append(arguments, &ast.Argument{Name: "where", Value: tc.where})
			}

			plan := &planner.QueryPlan{RemoteQueries: []*planner.RemoteQueryPlan{{
				Name: "kids", SourceConnector: "source", SourcePath: jsonpath.Parse("users"),
				SourceNamePath: jsonpath.Parse("users"), TargetConnector: "target",
				TargetTable: "users", TargetTableSchema: "public",
				JoinMapping: map[string]string{"kind": "a_kind", "id": "z_id"}, IsArray: true,
				OutputField: "kids", ResolverType: planner.ResolverKindDatabase,
				Selection: &ast.Field{
					Name: "kids", Arguments: arguments,
					SelectionSet: ast.SelectionSet{&ast.Field{Name: "id"}},
				},
			}}}
			if err := r.ResolvePlanned(t.Context(), results, plan, nil,
				func(_, _ string) string { return "users" }, nil, "admin", nil, slog.Default(),
			); err != nil {
				t.Fatal(err)
			}

			want := map[string]any{"users": []any{
				map[string]any{
					"id":   1,
					"kind": "x",
					"kids": []any{map[string]any{"id": float64(1)}},
				},
				map[string]any{
					"id":   2,
					"kind": "y",
					"kids": []any{map[string]any{"id": float64(2)}},
				},
				map[string]any{
					"id":   1,
					"kind": "x",
					"kids": []any{map[string]any{"id": float64(1)}},
				},
			}}
			if !reflect.DeepEqual(results, want) {
				t.Fatalf("result=%#v, want %#v", results, want)
			}
		})
	}
}

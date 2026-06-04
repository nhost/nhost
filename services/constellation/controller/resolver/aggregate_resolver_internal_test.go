package resolver

import (
	"context"
	"errors"
	"log/slog"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/connector"
	"github.com/nhost/nhost/services/constellation/connector/groupedaggregate"
	groupedaggregatemock "github.com/nhost/nhost/services/constellation/connector/groupedaggregate/mock"
	"github.com/nhost/nhost/services/constellation/internal/jsonpath"
	"github.com/vektah/gqlparser/v2/ast"
	"go.uber.org/mock/gomock"
)

// newAggregateResolver builds a white-box RemoteRelationshipResolver whose
// aggregateExecutors map binds the supplied [groupedaggregate.Executor] to
// the "default" connector slot. The connectors map carries a same-keyed nil
// entry so the not-found guard in executeAndStitchAggregate passes, but the
// aggregate path itself never dereferences the connector value — that is the
// point of the split: the executor is the only boundary the aggregate path
// actually exercises, so the stub need not implement connector.Connector.
func newAggregateResolver(
	exec groupedaggregate.Executor,
) *RemoteRelationshipResolver {
	return &RemoteRelationshipResolver{
		connectors:         map[string]connector.Connector{"default": nil},
		aggregateExecutors: map[string]groupedaggregate.Executor{"default": exec},
	}
}

func newMockAggregateExecutor(t *testing.T) *groupedaggregatemock.MockExecutor {
	t.Helper()

	ctrl := gomock.NewController(t)

	return groupedaggregatemock.NewMockExecutor(ctrl)
}

// TestExecuteAndStitchAggregate_HappyPath covers the success branch of
// executeAndStitchAggregate: the resolver dispatches the request through
// groupedaggregate.Executor, then stitches per-key results onto parent rows
// and leaves missing keys with a zero-valued aggregate block.
func TestExecuteAndStitchAggregate_HappyPath(t *testing.T) {
	t.Parallel()

	// Aggregate result keyed by stringified deptId. Parent row "d1" has data;
	// "d2" parent will fall through to emptyAggregateForSelection.
	aggregateResult := map[string]any{
		"d1": map[string]any{
			"aggregate": map[string]any{"count": 5},
			"nodes":     []any{map[string]any{"id": "m1"}},
		},
	}

	mockExec := newMockAggregateExecutor(t)

	mockExec.EXPECT().
		ExecuteGroupedAggregate(gomock.Any(), gomock.Any(), "admin", gomock.Any(), gomock.Any()).
		DoAndReturn(func(
			_ context.Context,
			req groupedaggregate.Request,
			_ string,
			_ map[string]any,
			_ *slog.Logger,
		) (map[string]any, error) {
			if req.TableSchema != "public" {
				t.Errorf("TableSchema mismatch: got %q", req.TableSchema)
			}

			if req.TableName != "members" {
				t.Errorf("TableName mismatch: got %q", req.TableName)
			}

			if req.JoinColumnSQLName != "team_id" {
				t.Errorf("JoinColumnSQLName mismatch: got %q", req.JoinColumnSQLName)
			}

			wantValues := []any{"d1", "d2"}
			if diff := cmp.Diff(wantValues, req.JoinValues); diff != "" {
				t.Errorf("JoinValues mismatch (-want +got):\n%s", diff)
			}

			if req.ArgumentPath != "teams.selectionSet.members_aggregate" {
				t.Errorf("ArgumentPath mismatch: got %q", req.ArgumentPath)
			}

			return aggregateResult, nil
		})

	rr := newAggregateResolver(mockExec)

	results := map[string]any{
		"teams": []any{
			map[string]any{"name": "Engineering", "deptId": "d1"},
			map[string]any{"name": "Sales", "deptId": "d2"},
		},
	}

	rq := &remoteQuery{
		targetConnector: "default",
		alias:           "members_aggregate",
		isArray:         true,
		joinArguments: []*remoteJoinArgument{
			newRemoteJoinArgument(map[string]any{"deptId": "d1"}),
			newRemoteJoinArgument(map[string]any{"deptId": "d2"}),
		},
		sourceField: &ast.Field{
			Name: "members_aggregate",
			SelectionSet: ast.SelectionSet{
				&ast.Field{
					Name: "aggregate",
					SelectionSet: ast.SelectionSet{
						&ast.Field{Name: "count"},
					},
				},
				&ast.Field{Name: "nodes"},
			},
		},
		fragments:           nil,
		parentPath:          jsonpath.Parse("teams"),
		localPhantomFields:  nil,
		remotePhantomFields: nil,
		resolver:            nil,
		aggregateInfo: &aggregateInfo{
			targetTableSchema: "public",
			targetTableName:   "members",
			joinMapping:       map[string]string{"deptId": "team_id"},
		},
	}

	err := rr.executeAndStitchAggregate(
		context.Background(),
		results,
		rq,
		nil,
		nil,
		"admin",
		nil,
		slog.Default(),
	)
	if err != nil {
		t.Fatalf("executeAndStitchAggregate: %v", err)
	}

	teams, ok := results["teams"].([]any)
	if !ok {
		t.Fatal("teams missing or wrong type")
	}

	// d1 should receive the aggregate result.
	team0, ok := teams[0].(map[string]any)
	if !ok {
		t.Fatal("teams[0] wrong type")
	}

	if diff := cmp.Diff(aggregateResult["d1"], team0["members_aggregate"]); diff != "" {
		t.Errorf("team[0] aggregate mismatch (-want +got):\n%s", diff)
	}

	// d2 should fall through to an empty aggregate block matching the
	// SourceField selection.
	team1, ok := teams[1].(map[string]any)
	if !ok {
		t.Fatal("teams[1] wrong type")
	}

	wantEmpty := map[string]any{
		"aggregate": map[string]any{"count": 0},
		"nodes":     []any{},
	}
	if diff := cmp.Diff(wantEmpty, team1["members_aggregate"]); diff != "" {
		t.Errorf("team[1] empty-aggregate mismatch (-want +got):\n%s", diff)
	}
}

// TestExecuteAndStitchAggregate_NilSourceColumnEmits stitches a nil result for
// parent rows whose join column is itself nil. This guards the
// stitchAggregateResults early-return for v == nil.
func TestExecuteAndStitchAggregate_NilSourceColumnEmits(t *testing.T) {
	t.Parallel()

	mockExec := newMockAggregateExecutor(t)

	mockExec.EXPECT().
		ExecuteGroupedAggregate(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).
		Return(map[string]any{}, nil)

	rr := newAggregateResolver(mockExec)

	results := map[string]any{
		"teams": []any{
			map[string]any{"name": "NoDept", "deptId": nil},
		},
	}

	rq := &remoteQuery{
		targetConnector: "default",
		alias:           "members_aggregate",
		isArray:         true,
		joinArguments: []*remoteJoinArgument{
			newRemoteJoinArgument(map[string]any{"deptId": "d-something"}),
		},
		sourceField: &ast.Field{
			Name: "members_aggregate",
			SelectionSet: ast.SelectionSet{
				&ast.Field{Name: "aggregate"},
			},
		},
		fragments:           nil,
		parentPath:          jsonpath.Parse("teams"),
		localPhantomFields:  nil,
		remotePhantomFields: nil,
		resolver:            nil,
		aggregateInfo: &aggregateInfo{
			targetTableSchema: "public",
			targetTableName:   "members",
			joinMapping:       map[string]string{"deptId": "team_id"},
		},
	}

	err := rr.executeAndStitchAggregate(
		context.Background(),
		results,
		rq,
		nil,
		nil,
		"admin",
		nil,
		slog.Default(),
	)
	if err != nil {
		t.Fatalf("executeAndStitchAggregate: %v", err)
	}

	team0 := results["teams"].([]any)[0].(map[string]any) //nolint:forcetypeassert
	if got, ok := team0["members_aggregate"]; !ok || got != nil {
		t.Errorf("expected nil under members_aggregate, got %v (present=%v)", got, ok)
	}
}

// TestExecuteAndStitchAggregate_NoJoinValuesSkipsExecutor verifies that if all
// join arguments have nil values for the source column, no executor call is
// issued. gomock's controller asserts on the absence: zero EXPECT() calls
// means any call to ExecuteGroupedAggregate fails the test.
func TestExecuteAndStitchAggregate_NoJoinValuesSkipsExecutor(t *testing.T) {
	t.Parallel()

	mockExec := newMockAggregateExecutor(t)

	rr := newAggregateResolver(mockExec)

	rq := &remoteQuery{
		targetConnector: "default",
		alias:           "members_aggregate",
		isArray:         true,
		joinArguments: []*remoteJoinArgument{
			newRemoteJoinArgument(map[string]any{"deptId": nil}),
		},
		sourceField: &ast.Field{
			Name: "members_aggregate",
		},
		fragments:           nil,
		parentPath:          jsonpath.Parse("teams"),
		localPhantomFields:  nil,
		remotePhantomFields: nil,
		resolver:            nil,
		aggregateInfo: &aggregateInfo{
			targetTableSchema: "public",
			targetTableName:   "members",
			joinMapping:       map[string]string{"deptId": "team_id"},
		},
	}

	err := rr.executeAndStitchAggregate(
		context.Background(),
		map[string]any{},
		rq,
		nil,
		nil,
		"admin",
		nil,
		slog.Default(),
	)
	if err != nil {
		t.Fatalf("executeAndStitchAggregate: %v", err)
	}
}

// TestExecuteAndStitchAggregate_MultiColumnMappingUnsupported asserts the
// guard against multi-column GROUP BY mappings — the SQL builder only
// supports single-column join mappings for now. The executor must not be
// called; gomock enforces this via zero recorded expectations.
func TestExecuteAndStitchAggregate_MultiColumnMappingUnsupported(t *testing.T) {
	t.Parallel()

	mockExec := newMockAggregateExecutor(t)

	rr := newAggregateResolver(mockExec)

	rq := &remoteQuery{
		targetConnector: "default",
		alias:           "members_aggregate",
		isArray:         true,
		joinArguments: []*remoteJoinArgument{
			newRemoteJoinArgument(map[string]any{"deptId": "d1"}),
		},
		sourceField: &ast.Field{
			Name: "members_aggregate",
		},
		fragments:           nil,
		parentPath:          jsonpath.Parse("teams"),
		localPhantomFields:  nil,
		remotePhantomFields: nil,
		resolver:            nil,
		aggregateInfo: &aggregateInfo{
			targetTableSchema: "public",
			targetTableName:   "members",
			joinMapping: map[string]string{
				"deptId":   "team_id",
				"regionId": "region_id",
			},
		},
	}

	err := rr.executeAndStitchAggregate(
		context.Background(),
		map[string]any{},
		rq,
		nil,
		nil,
		"admin",
		nil,
		slog.Default(),
	)
	if !errors.Is(err, errAggregateMultiColumnJoinUnsupported) {
		t.Errorf("expected errAggregateMultiColumnJoinUnsupported, got %v", err)
	}
}

// TestExecuteAndStitchAggregate_ExecutorErrorWrapped covers error
// propagation from the executor.
func TestExecuteAndStitchAggregate_ExecutorErrorWrapped(t *testing.T) {
	t.Parallel()

	//nolint:err113 // test sentinel error used to verify error propagation
	sentinel := errors.New("boom")

	mockExec := newMockAggregateExecutor(t)

	mockExec.EXPECT().
		ExecuteGroupedAggregate(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).
		Return(nil, sentinel)

	rr := newAggregateResolver(mockExec)

	rq := &remoteQuery{
		targetConnector: "default",
		alias:           "members_aggregate",
		isArray:         true,
		joinArguments: []*remoteJoinArgument{
			newRemoteJoinArgument(map[string]any{"deptId": "d1"}),
		},
		sourceField: &ast.Field{
			Name: "members_aggregate",
		},
		fragments:           nil,
		parentPath:          jsonpath.Parse("teams"),
		localPhantomFields:  nil,
		remotePhantomFields: nil,
		resolver:            nil,
		aggregateInfo: &aggregateInfo{
			targetTableSchema: "public",
			targetTableName:   "members",
			joinMapping:       map[string]string{"deptId": "team_id"},
		},
	}

	err := rr.executeAndStitchAggregate(
		context.Background(),
		map[string]any{},
		rq,
		nil,
		nil,
		"admin",
		nil,
		slog.Default(),
	)
	if !errors.Is(err, sentinel) {
		t.Errorf("expected wrapped sentinel error, got %v", err)
	}
}

// TestUniqueJoinValues_DedupesAndSkipsNil covers the helper directly: it
// should preserve insertion order, dedupe repeats, and skip nil values.
func TestUniqueJoinValues_DedupesAndSkipsNil(t *testing.T) {
	t.Parallel()

	joinArgs := []*remoteJoinArgument{
		newRemoteJoinArgument(map[string]any{"deptId": "d1"}),
		newRemoteJoinArgument(map[string]any{"deptId": "d2"}),
		newRemoteJoinArgument(map[string]any{"deptId": "d1"}), // dup
		newRemoteJoinArgument(map[string]any{"deptId": nil}),  // skipped
		newRemoteJoinArgument(map[string]any{"deptId": "d3"}),
	}

	got := uniqueJoinValues(joinArgs, "deptId")

	want := []any{"d1", "d2", "d3"}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("uniqueJoinValues mismatch (-want +got):\n%s", diff)
	}
}

// TestUniqueJoinValues_EmptyInput returns an empty slice (not nil) for empty
// join arguments, satisfying the early-return contract in
// executeAndStitchAggregate.
func TestUniqueJoinValues_HandlesNonComparable(t *testing.T) {
	t.Parallel()

	sliceValue := []any{"a", "b"}
	mapValue := map[string]any{"k": "v"}
	joinArgs := []*remoteJoinArgument{
		newRemoteJoinArgument(map[string]any{"deptId": sliceValue}),
		newRemoteJoinArgument(map[string]any{"deptId": []any{"a", "b"}}),
		newRemoteJoinArgument(map[string]any{"deptId": mapValue}),
		newRemoteJoinArgument(map[string]any{"deptId": map[string]any{"k": "v"}}),
		newRemoteJoinArgument(map[string]any{"deptId": "d1"}),
	}

	got := uniqueJoinValues(joinArgs, "deptId")

	want := []any{sliceValue, mapValue, "d1"}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("uniqueJoinValues mismatch (-want +got):\n%s", diff)
	}
}

func TestUniqueJoinValues_EmptyInput(t *testing.T) {
	t.Parallel()

	got := uniqueJoinValues(nil, "deptId")
	if len(got) != 0 {
		t.Errorf("expected empty result, got %v", got)
	}
}

// TestEmptyAggregateForSelection_ShapesPayload covers the selection-driven
// shape of the empty aggregate block (count -> 0, columns -> nil).
func TestEmptyAggregateForSelection_ShapesPayload(t *testing.T) {
	t.Parallel()

	field := &ast.Field{
		Name: "members_aggregate",
		SelectionSet: ast.SelectionSet{
			&ast.Field{
				Name: "aggregate",
				SelectionSet: ast.SelectionSet{
					&ast.Field{Name: "count"},
					&ast.Field{
						Name: "sum",
						SelectionSet: ast.SelectionSet{
							&ast.Field{Name: "salary"},
						},
					},
				},
			},
			&ast.Field{Name: "nodes"},
		},
	}

	got := emptyAggregateForSelection(field)

	want := map[string]any{
		"aggregate": map[string]any{
			"count": 0,
			"sum":   map[string]any{"salary": nil},
		},
		"nodes": []any{},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("emptyAggregateForSelection mismatch (-want +got):\n%s", diff)
	}
}

func TestEmptyAggregateForSelection_UsesResponseNames(t *testing.T) {
	t.Parallel()

	field := &ast.Field{
		Name: "members_aggregate",
		SelectionSet: ast.SelectionSet{
			&ast.Field{
				Alias: "stats",
				Name:  "aggregate",
				SelectionSet: ast.SelectionSet{
					&ast.Field{Alias: "total", Name: "count"},
					&ast.Field{
						Alias: "total_salary",
						Name:  "sum",
						SelectionSet: ast.SelectionSet{
							&ast.Field{Alias: "amount", Name: "salary"},
						},
					},
				},
			},
			&ast.Field{Alias: "rows", Name: "nodes"},
		},
	}

	got := emptyAggregateForSelection(field)

	want := map[string]any{
		"stats": map[string]any{
			"total":        0,
			"total_salary": map[string]any{"amount": nil},
		},
		"rows": []any{},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("emptyAggregateForSelection aliases mismatch (-want +got):\n%s", diff)
	}
}

// TestEmptyAggregateForSelection_IgnoresUnknownSubfields verifies that
// selections outside aggregate/nodes are ignored.
func TestEmptyAggregateForSelection_IgnoresUnknownSubfields(t *testing.T) {
	t.Parallel()

	field := &ast.Field{
		Name: "members_aggregate",
		SelectionSet: ast.SelectionSet{
			&ast.Field{Name: "unknown"},
		},
	}

	got := emptyAggregateForSelection(field)
	if len(got) != 0 {
		t.Errorf("expected empty map, got %v", got)
	}
}

// TestEmptyAggregateBlock_ShapesPerColumn ensures the helper renders nil
// per-column entries and zero for count.
func TestEmptyAggregateBlock_ShapesPerColumn(t *testing.T) {
	t.Parallel()

	field := &ast.Field{
		Name: "aggregate",
		SelectionSet: ast.SelectionSet{
			&ast.Field{Name: "count"},
			&ast.Field{
				Name: "avg",
				SelectionSet: ast.SelectionSet{
					&ast.Field{Name: "a"},
					&ast.Field{Name: "b"},
				},
			},
		},
	}

	got := emptyAggregateBlock(field)

	want := map[string]any{
		"count": 0,
		"avg":   map[string]any{"a": nil, "b": nil},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("emptyAggregateBlock mismatch (-want +got):\n%s", diff)
	}
}

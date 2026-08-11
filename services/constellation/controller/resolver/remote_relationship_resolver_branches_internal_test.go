package resolver

import (
	"context"
	"errors"
	"log/slog"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/connector"
	connectormock "github.com/nhost/nhost/services/constellation/connector/mock"
	"github.com/nhost/nhost/services/constellation/internal/jsonpath"
	"github.com/vektah/gqlparser/v2/ast"
	"go.uber.org/mock/gomock"
)

// errExec is a sentinel for the connector-Execute-error branch test.
var errExec = errors.New("execute failed")

// TestRemoteRelationshipResolver_BuildOperationNilSkipsConnectorCall covers
// the BuildOperation-returns-nil branch in executeAndStitch: when the
// resolver returns nil, the controller must NOT call connector.Execute.
func TestRemoteRelationshipResolver_BuildOperationNilSkipsConnectorCall(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)

	// mockConn is the target connector — its Execute MUST NOT be called.
	// gomock fails the test if any unexpected call lands.
	mockConn := connectormock.NewMockConnector(ctrl)

	stub := &stubRemoteQueryResolver{
		buildOperation:       func(*remoteQuery) *ast.OperationDefinition { return nil },
		extractResults:       nil,
		buildResultLookup:    nil,
		getJoinKeyFromParent: nil,
	}

	rr := New(map[string]connector.Connector{"default": mockConn})

	results := map[string]any{
		"teams": []any{
			map[string]any{"name": "Team A", "departmentId": "dept1"},
		},
	}

	rq := &remoteQuery{
		targetConnector: "default",
		alias:           "department",
		isArray:         false,
		joinArguments: []*remoteJoinArgument{
			newRemoteJoinArgument(map[string]any{"departmentId": "dept1"}),
		},
		sourceField:         nil,
		fragments:           nil,
		parentPath:          jsonpath.Parse("teams"),
		localPhantomFields:  nil,
		remotePhantomFields: nil,
		resolver:            stub,
		aggregateInfo:       nil,
	}

	if err := rr.Resolve(
		context.Background(),
		results,
		[]*remoteQuery{rq},
		nil, nil, "admin", nil, slog.Default(),
	); err != nil {
		t.Fatalf("Resolve: %v", err)
	}
}

// TestRemoteRelationshipResolver_ExecuteErrorSurfaced covers the
// connector.Execute-returns-error branch.
func TestRemoteRelationshipResolver_ExecuteErrorSurfaced(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)

	mockConn := connectormock.NewMockConnector(ctrl)
	mockConn.EXPECT().
		Execute(gomock.Any(), gomock.Any(), gomock.Any(),
			gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).
		Return(nil, errExec)

	stub := &stubRemoteQueryResolver{
		buildOperation: func(*remoteQuery) *ast.OperationDefinition {
			return &ast.OperationDefinition{
				Operation:    ast.Query,
				SelectionSet: ast.SelectionSet{&ast.Field{Name: "departments"}},
			}
		},
		extractResults:       nil,
		buildResultLookup:    nil,
		getJoinKeyFromParent: nil,
	}

	rr := New(map[string]connector.Connector{"default": mockConn})

	results := map[string]any{
		"teams": []any{
			map[string]any{"name": "Team A", "departmentId": "dept1"},
		},
	}

	rq := &remoteQuery{
		targetConnector: "default",
		alias:           "department",
		isArray:         false,
		joinArguments: []*remoteJoinArgument{
			newRemoteJoinArgument(map[string]any{"departmentId": "dept1"}),
		},
		sourceField:         nil,
		fragments:           nil,
		parentPath:          jsonpath.Parse("teams"),
		localPhantomFields:  nil,
		remotePhantomFields: nil,
		resolver:            stub,
		aggregateInfo:       nil,
	}

	err := rr.Resolve(
		context.Background(),
		results,
		[]*remoteQuery{rq},
		nil, nil, "admin", nil, slog.Default(),
	)
	if err == nil {
		t.Fatal("expected error from Execute, got nil")
	}

	if !errors.Is(err, errExec) {
		t.Errorf("expected wrapped errExec, got %v", err)
	}
}

// TestRemoteRelationshipResolver_ArrayWithNoMatchesStitchesEmptySlice covers
// the isArray=true stitching branch when the lookup yields no matches: the
// parent row should receive an empty []any rather than nil.
func TestRemoteRelationshipResolver_ArrayWithNoMatchesStitchesEmptySlice(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)

	mockConn := connectormock.NewMockConnector(ctrl)
	mockConn.EXPECT().
		Execute(gomock.Any(), gomock.Any(), gomock.Any(),
			gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).
		Return(map[string]any{"data": []any{}}, nil)

	stub := &stubRemoteQueryResolver{
		buildOperation: func(*remoteQuery) *ast.OperationDefinition {
			return &ast.OperationDefinition{
				Operation:    ast.Query,
				SelectionSet: ast.SelectionSet{&ast.Field{Name: "departments"}},
			}
		},
		extractResults:       func(*remoteQuery, any) []any { return []any{} },
		buildResultLookup:    func(*remoteQuery, []any) map[string][]any { return map[string][]any{} },
		getJoinKeyFromParent: func(*remoteQuery, map[string]any) string { return "nomatch" },
	}

	rr := New(map[string]connector.Connector{"default": mockConn})

	results := map[string]any{
		"teams": []any{
			map[string]any{"name": "Team A", "deptId": "x"},
		},
	}

	rq := &remoteQuery{
		targetConnector: "default",
		alias:           "departments",
		isArray:         true,
		joinArguments: []*remoteJoinArgument{
			newRemoteJoinArgument(map[string]any{"deptId": "x"}),
		},
		sourceField:         nil,
		fragments:           nil,
		parentPath:          jsonpath.Parse("teams"),
		localPhantomFields:  nil,
		remotePhantomFields: nil,
		resolver:            stub,
		aggregateInfo:       nil,
	}

	if err := rr.Resolve(
		context.Background(),
		results,
		[]*remoteQuery{rq},
		nil, nil, "admin", nil, slog.Default(),
	); err != nil {
		t.Fatalf("Resolve: %v", err)
	}

	team := results["teams"].([]any)[0].(map[string]any) //nolint:forcetypeassert

	got, ok := team["departments"].([]any)
	if !ok {
		t.Fatalf(
			"expected []any under 'departments', got %T(%v)",
			team["departments"],
			team["departments"],
		)
	}

	if len(got) != 0 {
		t.Errorf("expected empty slice, got %v", got)
	}
}

// TestRemoteRelationshipResolver_ObjectWithNoMatchStitchesNil covers the
// isArray=false stitching branch with no matches: the parent row should
// receive an explicit nil for the relationship field.
func TestRemoteRelationshipResolver_ObjectWithNoMatchStitchesNil(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)

	mockConn := connectormock.NewMockConnector(ctrl)
	mockConn.EXPECT().
		Execute(gomock.Any(), gomock.Any(), gomock.Any(),
			gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).
		Return(map[string]any{"data": []any{}}, nil)

	stub := &stubRemoteQueryResolver{
		buildOperation: func(*remoteQuery) *ast.OperationDefinition {
			return &ast.OperationDefinition{
				Operation:    ast.Query,
				SelectionSet: ast.SelectionSet{&ast.Field{Name: "department"}},
			}
		},
		extractResults:       func(*remoteQuery, any) []any { return []any{} },
		buildResultLookup:    func(*remoteQuery, []any) map[string][]any { return map[string][]any{} },
		getJoinKeyFromParent: func(*remoteQuery, map[string]any) string { return "nomatch" },
	}

	rr := New(map[string]connector.Connector{"default": mockConn})

	results := map[string]any{
		"teams": []any{
			map[string]any{"name": "Team A", "deptId": "x"},
		},
	}

	rq := &remoteQuery{
		targetConnector: "default",
		alias:           "department",
		isArray:         false,
		joinArguments: []*remoteJoinArgument{
			newRemoteJoinArgument(map[string]any{"deptId": "x"}),
		},
		sourceField:         nil,
		fragments:           nil,
		parentPath:          jsonpath.Parse("teams"),
		localPhantomFields:  nil,
		remotePhantomFields: nil,
		resolver:            stub,
		aggregateInfo:       nil,
	}

	if err := rr.Resolve(
		context.Background(),
		results,
		[]*remoteQuery{rq},
		nil, nil, "admin", nil, slog.Default(),
	); err != nil {
		t.Fatalf("Resolve: %v", err)
	}

	team := results["teams"].([]any)[0].(map[string]any) //nolint:forcetypeassert

	got, present := team["department"]
	if !present {
		t.Fatal("expected 'department' key present with nil value, key was missing")
	}

	if got != nil {
		t.Errorf("expected nil for unmatched object relationship, got %v", got)
	}
}

// TestRemoteRelationshipResolver_RemotePhantomFieldsCleanedFromResults
// covers the RemovePhantomFieldsFromRemoteResults path: phantom fields
// injected into the remote selection set must not appear in the final
// stitched parent rows.
func TestRemoteRelationshipResolver_RemotePhantomFieldsCleanedFromResults(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)

	remoteResults := []any{
		map[string]any{"id": "d1", "name": "Engineering", "phantomCol": "x"},
	}

	mockConn := connectormock.NewMockConnector(ctrl)
	mockConn.EXPECT().
		Execute(gomock.Any(), gomock.Any(), gomock.Any(),
			gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).
		Return(map[string]any{"data": remoteResults}, nil)

	stub := &stubRemoteQueryResolver{
		buildOperation: func(*remoteQuery) *ast.OperationDefinition {
			return &ast.OperationDefinition{
				Operation:    ast.Query,
				SelectionSet: ast.SelectionSet{&ast.Field{Name: "department"}},
			}
		},
		extractResults: func(*remoteQuery, any) []any { return remoteResults },
		buildResultLookup: func(*remoteQuery, []any) map[string][]any {
			return map[string][]any{"d1": remoteResults}
		},
		getJoinKeyFromParent: func(*remoteQuery, map[string]any) string { return "d1" },
	}

	rr := New(map[string]connector.Connector{"default": mockConn})

	results := map[string]any{
		"teams": []any{
			map[string]any{"name": "Team A", "deptId": "d1"},
		},
	}

	rq := &remoteQuery{
		targetConnector:     "default",
		alias:               "department",
		isArray:             false,
		remotePhantomFields: []string{"phantomCol"},
		joinArguments: []*remoteJoinArgument{
			newRemoteJoinArgument(map[string]any{"deptId": "d1"}),
		},
		sourceField:        nil,
		fragments:          nil,
		parentPath:         jsonpath.Parse("teams"),
		localPhantomFields: nil,
		resolver:           stub,
		aggregateInfo:      nil,
	}

	if err := rr.Resolve(
		context.Background(),
		results,
		[]*remoteQuery{rq},
		nil, nil, "admin", nil, slog.Default(),
	); err != nil {
		t.Fatalf("Resolve: %v", err)
	}

	team := results["teams"].([]any)[0].(map[string]any) //nolint:forcetypeassert

	dept, ok := team["department"].(map[string]any)
	if !ok {
		t.Fatalf(
			"expected map under 'department', got %T(%v)",
			team["department"],
			team["department"],
		)
	}

	if _, has := dept["phantomCol"]; has {
		t.Errorf("expected phantomCol to be removed, got %v", dept)
	}

	if got, want := dept["name"], "Engineering"; got != want {
		t.Errorf("expected name=%q, got %v", want, got)
	}
}

// TestRemoteRelationshipResolver_AggregateInfoBypassesResolver covers the
// aggregateInfo != nil branch. When aggregateInfo is set, the controller
// should NOT consult resolver — instead it dispatches through the target
// connector's grouped-aggregate executor. The bypass is observable here by
// confirming that a missing-grouped-aggregate-executor connector produces a
// specific error from Resolve, rather than calling resolver.BuildOperation.
func TestRemoteRelationshipResolver_AggregateInfoBypassesResolver(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)

	// mockConn does not implement groupedaggregate.Executor — the resolver
	// must surface that mismatch as an error without consulting any
	// remoteQueryResolver.
	mockConn := connectormock.NewMockConnector(ctrl)

	rr := New(map[string]connector.Connector{"default": mockConn})

	results := map[string]any{
		"teams": []any{
			map[string]any{"name": "Team A", "deptId": "x"},
		},
	}

	rq := &remoteQuery{
		targetConnector: "default",
		alias:           "members_aggregate",
		isArray:         true,
		joinArguments: []*remoteJoinArgument{
			newRemoteJoinArgument(map[string]any{"deptId": "x"}),
		},
		sourceField:         nil,
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

	err := rr.Resolve(
		context.Background(),
		results,
		[]*remoteQuery{rq},
		nil, nil, "admin", nil, slog.Default(),
	)
	if err == nil {
		t.Fatal("expected error when connector does not support grouped-aggregate, got nil")
	}
}

// TestRemoteRelationshipResolver_MultipleQueriesAllResolved exercises the
// per-query loop with two independent remote relationships, verifying both
// are routed and stitched.
func TestRemoteRelationshipResolver_MultipleQueriesAllResolved(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)

	deptResults := []any{
		map[string]any{"id": "d1", "name": "Engineering"},
	}
	ownerResults := []any{
		map[string]any{"id": "u1", "name": "Alice"},
	}

	mockConn := connectormock.NewMockConnector(ctrl)
	mockConn.EXPECT().
		Execute(gomock.Any(), gomock.Any(), gomock.Any(),
			gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).
		Return(map[string]any{"data": deptResults}, nil)
	mockConn.EXPECT().
		Execute(gomock.Any(), gomock.Any(), gomock.Any(),
			gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).
		Return(map[string]any{"data": ownerResults}, nil)

	deptStub := &stubRemoteQueryResolver{
		buildOperation: func(*remoteQuery) *ast.OperationDefinition {
			return &ast.OperationDefinition{
				Operation:    ast.Query,
				SelectionSet: ast.SelectionSet{&ast.Field{Name: "department"}},
			}
		},
		extractResults: func(*remoteQuery, any) []any { return deptResults },
		buildResultLookup: func(*remoteQuery, []any) map[string][]any {
			return map[string][]any{"d1": deptResults}
		},
		getJoinKeyFromParent: func(*remoteQuery, map[string]any) string { return "d1" },
	}

	ownerStub := &stubRemoteQueryResolver{
		buildOperation: func(*remoteQuery) *ast.OperationDefinition {
			return &ast.OperationDefinition{
				Operation:    ast.Query,
				SelectionSet: ast.SelectionSet{&ast.Field{Name: "owner"}},
			}
		},
		extractResults: func(*remoteQuery, any) []any { return ownerResults },
		buildResultLookup: func(*remoteQuery, []any) map[string][]any {
			return map[string][]any{"u1": ownerResults}
		},
		getJoinKeyFromParent: func(*remoteQuery, map[string]any) string { return "u1" },
	}

	rr := New(map[string]connector.Connector{"default": mockConn})

	results := map[string]any{
		"teams": []any{
			map[string]any{"name": "Team A", "deptId": "d1", "ownerId": "u1"},
		},
	}

	rqs := []*remoteQuery{
		{
			targetConnector: "default",
			alias:           "department",
			isArray:         false,
			joinArguments: []*remoteJoinArgument{
				newRemoteJoinArgument(map[string]any{"deptId": "d1"}),
			},
			sourceField:         nil,
			fragments:           nil,
			parentPath:          jsonpath.Parse("teams"),
			localPhantomFields:  nil,
			remotePhantomFields: nil,
			resolver:            deptStub,
			aggregateInfo:       nil,
		},
		{
			targetConnector: "default",
			alias:           "owner",
			isArray:         false,
			joinArguments: []*remoteJoinArgument{
				newRemoteJoinArgument(map[string]any{"ownerId": "u1"}),
			},
			sourceField:         nil,
			fragments:           nil,
			parentPath:          jsonpath.Parse("teams"),
			localPhantomFields:  nil,
			remotePhantomFields: nil,
			resolver:            ownerStub,
			aggregateInfo:       nil,
		},
	}

	if err := rr.Resolve(
		context.Background(),
		results,
		rqs,
		nil, nil, "admin", nil, slog.Default(),
	); err != nil {
		t.Fatalf("Resolve: %v", err)
	}

	team := results["teams"].([]any)[0].(map[string]any) //nolint:forcetypeassert

	if diff := cmp.Diff(deptResults[0], team["department"]); diff != "" {
		t.Errorf("department mismatch (-want +got):\n%s", diff)
	}

	if diff := cmp.Diff(ownerResults[0], team["owner"]); diff != "" {
		t.Errorf("owner mismatch (-want +got):\n%s", diff)
	}
}

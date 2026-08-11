package resolver

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/controller/planner"
	"github.com/nhost/nhost/services/constellation/internal/jsonpath"
	"github.com/vektah/gqlparser/v2/ast"
)

// TestBuildRemoteQueriesFromPlan exercises the public builder across the
// branches that drive the resolver package's public Resolve entry point.
func TestBuildRemoteQueriesFromPlan(t *testing.T) { //nolint:maintidx,gocognit,gocyclo,cyclop
	t.Parallel()

	tests := []struct {
		name            string
		results         map[string]any
		plan            *planner.QueryPlan
		resolveTypeName typeNameResolver
		check           func(t *testing.T, got []*remoteQuery)
	}{
		{
			name:    "nil plan returns nil",
			results: map[string]any{},
			plan:    nil,
			check: func(t *testing.T, got []*remoteQuery) {
				t.Helper()

				if got != nil {
					t.Errorf("expected nil for nil plan, got %v", got)
				}
			},
		},
		{
			name:    "plan without remote queries returns nil",
			results: map[string]any{},
			plan:    &planner.QueryPlan{PrimaryQueries: nil, RemoteQueries: nil},
			check: func(t *testing.T, got []*remoteQuery) {
				t.Helper()

				if got != nil {
					t.Errorf("expected nil for plan with no remote queries, got %v", got)
				}
			},
		},
		{
			name: "all-nil join keys yields nil result",
			// All parent rows have nil deptId — the builder should skip the plan
			// entirely so the resolver doesn't issue a no-op remote call.
			results: map[string]any{
				"teams": []any{
					map[string]any{"name": "A", "deptId": nil},
					map[string]any{"name": "B", "deptId": nil},
				},
			},
			plan: &planner.QueryPlan{
				PrimaryQueries: nil,
				RemoteQueries: []*planner.RemoteQueryPlan{
					{
						Name:                "department",
						SourceConnector:     "db1",
						SourcePath:          jsonpath.Parse("teams"),
						TargetConnector:     "db2",
						TargetTable:         "departments",
						TargetTableSchema:   "public",
						JoinMapping:         map[string]string{"deptId": "id"},
						IsArray:             false,
						IsArrayAggregate:    false,
						OutputField:         "department",
						Selection:           &ast.Field{Name: "department"},
						SourcePhantomFields: nil,
						ResolverType:        planner.ResolverKindDatabase,
						LHSFields:           nil,
						RemoteFieldPath:     nil,
					},
				},
			},
			check: func(t *testing.T, got []*remoteQuery) {
				t.Helper()

				if got != nil {
					t.Errorf("expected nil result when all join keys are nil, got %v", got)
				}
			},
		},
		{
			name: "database resolver branch records phantom fields and join arguments",
			results: map[string]any{
				"teams": []any{
					map[string]any{"name": "A", "deptId": "d1"},
					map[string]any{"name": "B", "deptId": "d2"},
				},
			},
			plan: &planner.QueryPlan{
				PrimaryQueries: nil,
				RemoteQueries: []*planner.RemoteQueryPlan{
					{
						Name:              "department",
						SourceConnector:   "db1",
						SourcePath:        jsonpath.Parse("teams"),
						TargetConnector:   "db2",
						TargetTable:       "departments",
						TargetTableSchema: "public",
						JoinMapping:       map[string]string{"deptId": "id"},
						IsArray:           false,
						IsArrayAggregate:  false,
						OutputField:       "department",
						Selection: &ast.Field{
							Name: "department",
						},
						SourcePhantomFields: &planner.PhantomFieldSpec{
							Path:            jsonpath.Parse("teams"),
							Fields:          []string{"deptId"},
							ForRelationship: "department",
						},
						ResolverType:    planner.ResolverKindDatabase,
						LHSFields:       nil,
						RemoteFieldPath: nil,
					},
				},
			},
			resolveTypeName: func(connectorName, identifier string) string {
				// Simulate a custom type-name resolver: identifier is
				// "public.departments", return a custom alias.
				if connectorName == "db2" && identifier == "public.departments" {
					return "departments_aliased"
				}

				return ""
			},
			check: func(t *testing.T, got []*remoteQuery) {
				t.Helper()

				if len(got) != 1 {
					t.Fatalf("expected 1 remoteQuery, got %d", len(got))
				}

				rq := got[0]
				if rq.targetConnector != "db2" {
					t.Errorf("targetConnector mismatch: got %q", rq.targetConnector)
				}

				if rq.alias != "department" {
					t.Errorf("alias mismatch: got %q", rq.alias)
				}

				if rq.isArray {
					t.Error("expected isArray=false")
				}

				if rq.resolver == nil {
					t.Fatal("expected non-nil resolver")
				}

				if rq.aggregateInfo != nil {
					t.Errorf("expected nil aggregateInfo, got %+v", rq.aggregateInfo)
				}

				// Two distinct deptIds -> two join arguments, sorted-key dedupe applied.
				if len(rq.joinArguments) != 2 {
					t.Errorf("expected 2 join arguments, got %d", len(rq.joinArguments))
				}

				// Phantom fields on the source row are recorded for cleanup.
				wantPhantoms := []string{"deptId"}
				if diff := cmp.Diff(wantPhantoms, rq.localPhantomFields); diff != "" {
					t.Errorf("localPhantomFields mismatch (-want +got):\n%s", diff)
				}
			},
		},
		{
			name: "schema resolver branch produces schemaResolver",
			results: map[string]any{
				"users": []any{
					map[string]any{"id": "u1", "name": "Alice"},
					map[string]any{"id": "u2", "name": "Bob"},
				},
			},
			plan: &planner.QueryPlan{
				PrimaryQueries: nil,
				RemoteQueries: []*planner.RemoteQueryPlan{
					{
						Name:                "team",
						SourceConnector:     "db1",
						SourcePath:          jsonpath.Parse("users"),
						TargetConnector:     "remote",
						TargetTable:         "team",
						TargetTableSchema:   "",
						JoinMapping:         nil,
						IsArray:             false,
						IsArrayAggregate:    false,
						OutputField:         "team",
						Selection:           &ast.Field{Name: "team"},
						SourcePhantomFields: nil,
						ResolverType:        planner.ResolverKindSchema,
						LHSFields:           []string{"id"},
						RemoteFieldPath: []planner.RemoteFieldPathEntry{
							{
								FieldName: "teamByUser",
								Arguments: map[string]string{"userId": "$id"},
							},
						},
					},
				},
			},
			check: func(t *testing.T, got []*remoteQuery) {
				t.Helper()

				if len(got) != 1 {
					t.Fatalf("expected 1 remoteQuery, got %d", len(got))
				}

				rq := got[0]
				if rq.targetConnector != "remote" {
					t.Errorf("targetConnector mismatch: got %q", rq.targetConnector)
				}

				if rq.resolver == nil {
					t.Fatal("expected non-nil resolver")
				}

				if _, ok := rq.resolver.(*schemaResolver); !ok {
					t.Errorf("expected *schemaResolver, got %T", rq.resolver)
				}

				if rq.aggregateInfo != nil {
					t.Errorf("expected nil aggregateInfo, got %+v", rq.aggregateInfo)
				}

				if len(rq.joinArguments) != 2 {
					t.Errorf("expected 2 join arguments, got %d", len(rq.joinArguments))
				}
			},
		},
		{
			name: "aggregate plan sets aggregateInfo and skips per-strategy resolver",
			results: map[string]any{
				"teams": []any{
					map[string]any{"name": "A", "deptId": "d1"},
					map[string]any{"name": "B", "deptId": "d2"},
				},
			},
			plan: &planner.QueryPlan{
				PrimaryQueries: nil,
				RemoteQueries: []*planner.RemoteQueryPlan{
					{
						Name:                "members_aggregate",
						SourceConnector:     "db1",
						SourcePath:          jsonpath.Parse("teams"),
						TargetConnector:     "db2",
						TargetTable:         "members",
						TargetTableSchema:   "public",
						JoinMapping:         map[string]string{"deptId": "team_id"},
						IsArray:             true,
						IsArrayAggregate:    true,
						OutputField:         "members_aggregate",
						Selection:           &ast.Field{Name: "members_aggregate"},
						SourcePhantomFields: nil,
						ResolverType:        planner.ResolverKindDatabase,
						LHSFields:           nil,
						RemoteFieldPath:     nil,
					},
				},
			},
			check: func(t *testing.T, got []*remoteQuery) {
				t.Helper()

				if len(got) != 1 {
					t.Fatalf("expected 1 remoteQuery, got %d", len(got))
				}

				rq := got[0]
				if rq.aggregateInfo == nil {
					t.Fatal("expected non-nil aggregateInfo on aggregate plan")
				}

				if rq.aggregateInfo.targetTableSchema != "public" {
					t.Errorf(
						"targetTableSchema mismatch: got %q",
						rq.aggregateInfo.targetTableSchema,
					)
				}

				if rq.aggregateInfo.targetTableName != "members" {
					t.Errorf("targetTableName mismatch: got %q", rq.aggregateInfo.targetTableName)
				}

				if !rq.isArray {
					t.Error("expected isArray=true on aggregate plan")
				}

				// Aggregate plans bypass the per-strategy resolver entirely.
				if rq.resolver != nil {
					t.Errorf("expected nil resolver on aggregate plan, got %T", rq.resolver)
				}
			},
		},
		{
			name:    "empty parent path is skipped",
			results: map[string]any{"teams": []any{}},
			plan: &planner.QueryPlan{
				PrimaryQueries: nil,
				RemoteQueries: []*planner.RemoteQueryPlan{
					{
						Name:                "department",
						SourceConnector:     "db1",
						SourcePath:          jsonpath.Path{}, // empty
						TargetConnector:     "db2",
						TargetTable:         "departments",
						TargetTableSchema:   "public",
						JoinMapping:         map[string]string{"deptId": "id"},
						IsArray:             false,
						IsArrayAggregate:    false,
						OutputField:         "department",
						Selection:           &ast.Field{Name: "department"},
						SourcePhantomFields: nil,
						ResolverType:        planner.ResolverKindDatabase,
						LHSFields:           nil,
						RemoteFieldPath:     nil,
					},
				},
			},
			check: func(t *testing.T, got []*remoteQuery) {
				t.Helper()

				if got != nil {
					t.Errorf("expected nil for empty parent path, got %v", got)
				}
			},
		},
		{
			name: "fallback to raw table name when typeNameResolver is nil",
			results: map[string]any{
				"teams": []any{
					map[string]any{"deptId": "d1"},
				},
			},
			plan: &planner.QueryPlan{
				PrimaryQueries: nil,
				RemoteQueries: []*planner.RemoteQueryPlan{
					{
						Name:                "department",
						SourceConnector:     "db1",
						SourcePath:          jsonpath.Parse("teams"),
						TargetConnector:     "db2",
						TargetTable:         "departments",
						TargetTableSchema:   "public",
						JoinMapping:         map[string]string{"deptId": "id"},
						IsArray:             false,
						IsArrayAggregate:    false,
						OutputField:         "department",
						Selection:           &ast.Field{Name: "department"},
						SourcePhantomFields: nil,
						ResolverType:        planner.ResolverKindDatabase,
						LHSFields:           nil,
						RemoteFieldPath:     nil,
					},
				},
			},
			check: func(t *testing.T, got []*remoteQuery) {
				t.Helper()

				if len(got) != 1 {
					t.Fatalf("expected 1 remoteQuery, got %d", len(got))
				}

				dr, ok := got[0].resolver.(*databaseResolver)
				if !ok {
					t.Fatalf("expected *databaseResolver, got %T", got[0].resolver)
				}

				if dr.targetTableName != "departments" {
					t.Errorf(
						"expected fallback target table name 'departments', got %q",
						dr.targetTableName,
					)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := BuildRemoteQueriesFromPlan(tt.results, tt.plan, nil, tt.resolveTypeName)
			tt.check(t, got)
		})
	}
}

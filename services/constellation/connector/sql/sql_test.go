package sql_test

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"testing"
	"time"

	"github.com/vektah/gqlparser/v2/ast"
	"go.uber.org/mock/gomock"

	csql "github.com/nhost/nhost/services/constellation/connector/sql"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/connector/sql/mock"
	sqlsub "github.com/nhost/nhost/services/constellation/connector/sql/subscription"
	"github.com/nhost/nhost/services/constellation/metadata"
)

var errTest = errors.New("test error")

func emptyObjects() *introspection.Objects {
	return introspection.NewObjects()
}

func minimalMetadata() *metadata.DatabaseMetadata {
	return &metadata.DatabaseMetadata{
		Kind: "postgres",
	}
}

func newTestConnector(t *testing.T, driver *mock.MockDriver) *csql.Connector {
	t.Helper()

	driver.EXPECT().Dialect().Return(&dialect.PostgresDialect{}).AnyTimes()
	driver.EXPECT().Introspect(gomock.Any(), gomock.Any()).Return(emptyObjects(), nil)

	c, err := csql.NewConnector(context.Background(), driver, minimalMetadata(), nil, nil)
	if err != nil {
		t.Fatalf("NewConnector() unexpected error: %v", err)
	}

	return c
}

func TestNewConnector_Success(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	driver := mock.NewMockDriver(ctrl)

	c := newTestConnector(t, driver)

	schemas, err := c.GetSchema()
	if err != nil {
		t.Fatalf("GetSchema() unexpected error: %v", err)
	}

	if schemas == nil {
		t.Fatal("GetSchema() returned nil")
	}

	if _, ok := schemas["admin"]; !ok {
		t.Error("expected admin schema to exist")
	}
}

func TestNewConnector_IntrospectError(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	driver := mock.NewMockDriver(ctrl)

	driver.EXPECT().Dialect().Return(&dialect.PostgresDialect{}).AnyTimes()
	driver.EXPECT().Introspect(gomock.Any(), gomock.Any()).Return(nil, errTest)

	_, err := csql.NewConnector(context.Background(), driver, minimalMetadata(), nil, nil)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	if !errors.Is(err, errTest) {
		t.Errorf("expected wrapped errTest, got: %v", err)
	}
}

// objectsWithUntrackedFunctionTarget builds an introspection.Objects with a
// SETOF function whose return-type table is not tracked in metadata. This is
// the shape used to verify the inconsistency-tolerant drop path for
// functions whose base table is missing.
func objectsWithUntrackedFunctionTarget() *introspection.Objects {
	objs := introspection.NewObjects()
	objs.Schemas["public"] = &introspection.Schema{
		Tables: map[string]*introspection.Table{
			"users": {
				Schema:      "public",
				Name:        "users",
				Columns:     []introspection.Column{{Name: "id", Type: "uuid"}},
				PrimaryKeys: []string{"id"},
			},
		},
	}
	objs.Functions["public.search_orders"] = &introspection.Function{
		Arguments: nil,
		ReturnType: introspection.FunctionReturnType{
			Type:        "",
			IsSetOf:     true,
			TableSchema: "public",
			TableName:   "orders", // not tracked in metadata
		},
		Volatility: introspection.VolatilityStable,
	}

	return objs
}

// TestNewConnector_FunctionWithUntrackedBaseTableDropped is the
// inconsistency-tolerant counterpart to the old TestNewConnector_BuildRootsError:
// a function whose return-type table is not tracked in metadata used to abort
// NewConnector via errBaseTableForFunctionNotFound. The reconcile pass now
// drops the function and records a function inconsistency, so the connector
// must come up cleanly with the surviving table still serving.
func TestNewConnector_FunctionWithUntrackedBaseTableDropped(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	driver := mock.NewMockDriver(ctrl)

	driver.EXPECT().Dialect().Return(&dialect.PostgresDialect{}).AnyTimes()
	driver.EXPECT().
		Introspect(gomock.Any(), gomock.Any()).
		Return(objectsWithUntrackedFunctionTarget(), nil)
	driver.EXPECT().Close().AnyTimes()

	md := &metadata.DatabaseMetadata{
		Name: "default",
		Kind: "postgres",
		Tables: []metadata.TableMetadata{
			{Table: metadata.TableSource{Schema: "public", Name: "users"}},
		},
		Functions: []metadata.FunctionMetadata{
			{Function: metadata.FunctionSource{Schema: "public", Name: "search_orders"}},
		},
	}

	inc := metadata.NewInconsistencies()

	conn, err := csql.NewConnector(context.Background(), driver, md, inc, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	t.Cleanup(func() { conn.Close() })

	snap := inc.Snapshot()
	if len(snap) != 1 {
		t.Fatalf("expected one inconsistency, got %d: %+v", len(snap), snap)
	}

	if snap[0].Kind != metadata.InconsistencyKindFunction {
		t.Errorf(
			"expected kind=%q, got %q",
			metadata.InconsistencyKindFunction, snap[0].Kind,
		)
	}

	if snap[0].Name != "public.search_orders" {
		t.Errorf("expected name=public.search_orders, got %q", snap[0].Name)
	}

	if !strings.Contains(snap[0].Reason, "base table") {
		t.Errorf(
			"expected reason to mention base table, got %q",
			snap[0].Reason,
		)
	}
}

// TestNewConnector_ReloadSchemaError covers the "failed to load schema" wrap
// at sql.go:101 — the only error site exercised by neither
// TestNewConnector_IntrospectError nor TestNewConnector_BuildRootsError.
// reloadSchema calls schema.ParseDBKind(dbMeta.Kind); an unknown kind survives
// reconcileMetadata (which does not validate Kind) and BuildRoots (which only
// consults the dialect), then trips ParseDBKind and surfaces the wrap.
func TestNewConnector_ReloadSchemaError(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	driver := mock.NewMockDriver(ctrl)

	driver.EXPECT().Dialect().Return(&dialect.PostgresDialect{}).AnyTimes()
	driver.EXPECT().Introspect(gomock.Any(), gomock.Any()).Return(emptyObjects(), nil)

	// An unrecognised Kind is the simplest seam into reloadSchema's error
	// return: introspect and BuildRoots both succeed against an empty
	// metadata, but ParseDBKind rejects the string and propagates an
	// ErrUnknownDBKind up through reloadSchema.
	md := &metadata.DatabaseMetadata{
		Name: "default",
		Kind: "unknown",
	}

	_, err := csql.NewConnector(context.Background(), driver, md, nil, nil)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	if !strings.Contains(err.Error(), "failed to load schema") {
		t.Errorf("expected wrapping prefix %q, got: %v", "failed to load schema", err)
	}
}

// objectsWithEnumFKMissingValues builds an Objects where a tracked table has
// a foreign key into a tracked enum table — but the enum table has no entry
// in EnumValues. schema.GenerateForRole sees the FK, marks the target as a
// needed enum, then errors out of generateEnumTypes with
// "enum values not found".
func objectsWithEnumFKMissingValues() *introspection.Objects {
	objs := introspection.NewObjects()
	objs.Schemas["public"] = &introspection.Schema{
		Tables: map[string]*introspection.Table{
			"users": {
				Schema: "public",
				Name:   "users",
				Columns: []introspection.Column{
					{Name: "id", Type: "uuid"},
					{Name: "status", Type: "text"},
				},
				PrimaryKeys: []string{"id"},
				ForeignKeys: []introspection.ForeignKey{
					{
						ColumnName:        "status",
						ForeignSchema:     "public",
						ForeignTable:      "user_status",
						ForeignColumnName: "value",
					},
				},
			},
			"user_status": {
				Schema:      "public",
				Name:        "user_status",
				Columns:     []introspection.Column{{Name: "value", Type: "text"}},
				PrimaryKeys: []string{"value"},
			},
		},
	}
	// Deliberately leave objs.EnumValues empty.
	return objs
}

func TestNewConnector_EnumWithoutValuesIsDropped(t *testing.T) {
	t.Parallel()

	// An is_enum table whose driver did not surface any rows (missing,
	// invalid shape, empty) is no longer fatal: reconcileMetadata drops
	// the table entirely — matching Hasura — and records an enum_values
	// inconsistency.
	ctrl := gomock.NewController(t)
	driver := mock.NewMockDriver(ctrl)

	driver.EXPECT().Dialect().Return(&dialect.PostgresDialect{}).AnyTimes()
	driver.EXPECT().
		Introspect(gomock.Any(), gomock.Any()).
		Return(objectsWithEnumFKMissingValues(), nil)
	driver.EXPECT().Close().AnyTimes()

	md := &metadata.DatabaseMetadata{
		Name: "default",
		Kind: "postgres",
		Tables: []metadata.TableMetadata{
			{Table: metadata.TableSource{Schema: "public", Name: "users"}},
			{Table: metadata.TableSource{Schema: "public", Name: "user_status"}, IsEnum: true},
		},
	}

	inc := metadata.NewInconsistencies()

	conn, err := csql.NewConnector(context.Background(), driver, md, inc, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	t.Cleanup(func() { conn.Close() })

	snap := inc.Snapshot()
	if len(snap) != 1 {
		t.Fatalf("expected one inconsistency, got %d: %+v", len(snap), snap)
	}

	if snap[0].Kind != metadata.InconsistencyKindEnumValues {
		t.Errorf(
			"expected kind=%q, got %q",
			metadata.InconsistencyKindEnumValues, snap[0].Kind,
		)
	}

	if snap[0].Name != "public.user_status" {
		t.Errorf("expected name=public.user_status, got %q", snap[0].Name)
	}
}

// TestNewConnector_KitchenSinkInconsistencies feeds NewConnector a metadata
// document deliberately full of references that don't exist in the source —
// a missing table, a missing column on a surviving table, a missing
// function, an enum table with no values, and a local relationship pointing
// at a dropped target. The connector must come up cleanly, each problem
// must produce its specific inconsistency kind, and the surviving table
// must still serve a non-empty schema.
func TestNewConnector_KitchenSinkInconsistencies(t *testing.T) {
	t.Parallel()

	objs := introspection.NewObjects()
	objs.Schemas["public"] = &introspection.Schema{
		Tables: map[string]*introspection.Table{
			"users": {
				Schema:       "public",
				Name:         "users",
				IsInsertable: true,
				IsUpdatable:  true,
				Columns: []introspection.Column{
					{Name: "id", Type: "uuid"},
					{Name: "name", Type: "text"},
				},
				PrimaryKeys: []string{"id"},
			},
			"user_status": {
				Schema:       "public",
				Name:         "user_status",
				IsInsertable: true,
				IsUpdatable:  true,
				Columns:      []introspection.Column{{Name: "value", Type: "text"}},
				PrimaryKeys:  []string{"value"},
			},
		},
	}
	// user_status exists in the source but has no rows — drives enum_values.

	ctrl := gomock.NewController(t)
	driver := mock.NewMockDriver(ctrl)
	driver.EXPECT().Dialect().Return(&dialect.PostgresDialect{}).AnyTimes()
	driver.EXPECT().Introspect(gomock.Any(), gomock.Any()).Return(objs, nil)
	driver.EXPECT().Close().AnyTimes()

	md := &metadata.DatabaseMetadata{
		Name: "default",
		Kind: "postgres",
		Tables: []metadata.TableMetadata{
			{
				Table: metadata.TableSource{Schema: "public", Name: "users"},
				Configuration: metadata.TableConfiguration{
					ColumnConfig: map[string]metadata.ColumnConfig{
						"missing_col": {CustomName: "x"},
					},
				},
				ObjectRelationships: []metadata.ObjectRelationship{
					{
						Name: "ghost_rel",
						Using: metadata.RelationshipUsing{
							ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
								Columns: []string{"id"},
								Table: metadata.TableSource{
									Schema: "public", Name: "ghost_table",
								},
							},
						},
					},
				},
			},
			{
				Table:  metadata.TableSource{Schema: "public", Name: "user_status"},
				IsEnum: true,
			},
			{Table: metadata.TableSource{Schema: "public", Name: "ghost_table"}},
		},
		Functions: []metadata.FunctionMetadata{
			{Function: metadata.FunctionSource{Schema: "public", Name: "ghost_fn"}},
		},
	}

	inc := metadata.NewInconsistencies()

	conn, err := csql.NewConnector(t.Context(), driver, md, inc, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	t.Cleanup(func() { conn.Close() })

	// Pin the exact (kind, name) multiset: a regression that records the
	// same drop twice, mis-qualifies a name, or cascades an enum drop into
	// an unintended relationship inconsistency must trip this assertion.
	// Source is pinned (every kitchen-sink entry comes from the "default"
	// source); Reason and At are deliberately ignored — Reason contains
	// stable substrings already covered by reconcile_internal_test.go, and
	// At is wall-clock noise.
	type kindName struct {
		kind string
		name string
	}

	want := map[kindName]int{
		{metadata.InconsistencyKindColumn, "public.users.missing_col"}:     1,
		{metadata.InconsistencyKindRelationship, "public.users.ghost_rel"}: 1,
		{metadata.InconsistencyKindEnumValues, "public.user_status"}:       1,
		{metadata.InconsistencyKindTable, "public.ghost_table"}:            1,
		{metadata.InconsistencyKindFunction, "public.ghost_fn"}:            1,
	}

	snap := inc.Snapshot()
	if len(snap) != len(want) {
		t.Fatalf("expected %d inconsistencies, got %d: %+v", len(want), len(snap), snap)
	}

	got := make(map[kindName]int, len(snap))

	for _, it := range snap {
		if it.Source != "default" {
			t.Errorf("expected source=default, got %q for %+v", it.Source, it)
		}

		got[kindName{it.Kind, it.Name}]++
	}

	for k, n := range want {
		if got[k] != n {
			t.Errorf("expected %d inconsistencies for %+v, got %d (full snapshot: %+v)",
				n, k, got[k], snap)
		}
	}

	for k, n := range got {
		if _, expected := want[k]; !expected {
			t.Errorf("unexpected inconsistency %+v (count=%d, full snapshot: %+v)",
				k, n, snap)
		}
	}

	// The surviving users table must still produce a non-empty schema for
	// the admin role.
	schemas, err := conn.GetSchema()
	if err != nil {
		t.Fatalf("GetSchema: %v", err)
	}

	if schemas["admin"] == nil {
		t.Fatalf("expected admin schema, got roles %v", schemas)
	}
}

func TestConnector_Close(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	driver := mock.NewMockDriver(ctrl)

	c := newTestConnector(t, driver)

	driver.EXPECT().Close()
	c.Close()
}

func TestConnector_GetSchema(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	driver := mock.NewMockDriver(ctrl)

	c := newTestConnector(t, driver)

	schemas, err := c.GetSchema()
	if err != nil {
		t.Fatalf("GetSchema() unexpected error: %v", err)
	}

	if schemas == nil {
		t.Fatal("GetSchema() returned nil")
	}
}

func TestConnector_NewSubscriptionHandler(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	driver := mock.NewMockDriver(ctrl)

	c := newTestConnector(t, driver)

	handler := c.NewSubscriptionHandler(time.Second, slog.Default())
	if handler == nil {
		t.Fatal("NewSubscriptionHandler() returned nil")
	}
}

func TestConnector_Execute(t *testing.T) {
	t.Parallel()

	// With empty roots (no metadata tables), BuildQuery fails for any
	// non-empty selection because no operation matches.
	buildErrorOp := &ast.OperationDefinition{
		Operation: ast.Query,
		SelectionSet: ast.SelectionSet{
			&ast.Field{Name: "nonexistent"},
		},
	}

	// An empty selection set lets BuildQuery succeed with zero operations,
	// so we can drive the driver.ExecuteOperations branch.
	emptyOp := &ast.OperationDefinition{
		Operation:    ast.Query,
		SelectionSet: ast.SelectionSet{},
	}

	tests := []struct {
		name           string
		operation      *ast.OperationDefinition
		driverResult   map[string]any
		driverErr      error
		expectExecCall bool
		wantErr        error
	}{
		{
			name:           "build query error",
			operation:      buildErrorOp,
			expectExecCall: false,
		},
		{
			name:           "driver returns results",
			operation:      emptyOp,
			driverResult:   map[string]any{"ok": true},
			expectExecCall: true,
		},
		{
			name:           "driver returns error",
			operation:      emptyOp,
			driverErr:      errTest,
			expectExecCall: true,
			wantErr:        errTest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			driver := mock.NewMockDriver(ctrl)

			c := newTestConnector(t, driver)

			if tt.expectExecCall {
				driver.EXPECT().
					ExecuteOperations(gomock.Any(), gomock.Any(), gomock.Any()).
					Return(tt.driverResult, tt.driverErr)
			}

			got, err := c.Execute(
				context.Background(),
				tt.operation,
				nil,
				nil,
				"admin",
				nil,
				slog.Default(),
			)

			switch {
			case tt.name == "build query error":
				if err == nil {
					t.Fatal("expected error from Execute with unmatched operation, got nil")
				}
			case tt.wantErr != nil:
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("expected wrapped %v, got: %v", tt.wantErr, err)
				}
			default:
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}

				if got["ok"] != true {
					t.Errorf("expected results to contain ok=true, got %v", got)
				}
			}
		})
	}
}

func TestConnector_ExecuteMultiplexedQueries(t *testing.T) {
	t.Parallel()

	successResults := []sqlsub.MultiplexedResult{
		{SubscriptionID: "sub-1", Data: []byte(`{"users":[]}`)},
	}

	tests := []struct {
		name            string
		withCursor      bool
		subscriptionIDs []string
		cursorValues    map[string]any
		driverResults   []sqlsub.MultiplexedResult
		driverErr       error
		expectDriver    bool
		wantNilResults  bool
		wantErr         error
	}{
		{
			name:            "no-cursor: empty subscriptions short-circuits",
			subscriptionIDs: nil,
			wantNilResults:  true,
		},
		{
			name:            "no-cursor: driver error is wrapped",
			subscriptionIDs: []string{"sub-1"},
			driverErr:       errTest,
			expectDriver:    true,
			wantErr:         errTest,
		},
		{
			name:            "no-cursor: driver results pass through",
			subscriptionIDs: []string{"sub-1"},
			driverResults:   successResults,
			expectDriver:    true,
		},
		{
			name:            "with-cursor: empty subscriptions short-circuits",
			withCursor:      true,
			subscriptionIDs: nil,
			cursorValues:    map[string]any{"id": 42},
			wantNilResults:  true,
		},
		{
			name:            "with-cursor: driver error is wrapped",
			withCursor:      true,
			subscriptionIDs: []string{"sub-1"},
			cursorValues:    map[string]any{"id": 42},
			driverErr:       errTest,
			expectDriver:    true,
			wantErr:         errTest,
		},
		{
			name:            "with-cursor: driver results pass through",
			withCursor:      true,
			subscriptionIDs: []string{"sub-1"},
			cursorValues:    map[string]any{"id": 42},
			driverResults:   successResults,
			expectDriver:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			driver := mock.NewMockDriver(ctrl)

			c := newTestConnector(t, driver)

			if tt.expectDriver {
				driver.EXPECT().
					ExecuteMultiplexedOperation(
						gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
					).
					Return(tt.driverResults, tt.driverErr)
			}

			results, err := runMultiplexed(c, tt.withCursor, tt.subscriptionIDs, tt.cursorValues)

			checkMultiplexedResult(
				t, results, err, tt.wantErr, tt.wantNilResults, tt.driverResults,
			)
		})
	}
}

func runMultiplexed(
	c *csql.Connector,
	withCursor bool,
	subscriptionIDs []string,
	cursorValues map[string]any,
) ([]sqlsub.MultiplexedResult, error) {
	op := core.SQLOperation{SQL: "SELECT 1"}

	var (
		results []sqlsub.MultiplexedResult
		err     error
	)

	if withCursor {
		results, err = c.ExecuteMultiplexedQueryWithCursor(
			context.Background(),
			op,
			subscriptionIDs,
			nil,
			cursorValues,
			slog.Default(),
		)
	} else {
		results, err = c.ExecuteMultiplexedQuery(
			context.Background(),
			op,
			subscriptionIDs,
			nil,
			slog.Default(),
		)
	}

	if err != nil {
		return nil, fmt.Errorf("multiplexed query: %w", err)
	}

	return results, nil
}

func checkMultiplexedResult(
	t *testing.T,
	results []sqlsub.MultiplexedResult,
	err error,
	wantErr error,
	wantNilResults bool,
	wantResults []sqlsub.MultiplexedResult,
) {
	t.Helper()

	if wantErr != nil {
		if !errors.Is(err, wantErr) {
			t.Fatalf("expected wrapped %v, got: %v", wantErr, err)
		}

		return
	}

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if wantNilResults {
		if results != nil {
			t.Errorf("expected nil results, got %v", results)
		}

		return
	}

	if len(results) != len(wantResults) {
		t.Fatalf("expected %d results, got %d", len(wantResults), len(results))
	}

	for i := range results {
		if results[i].SubscriptionID != wantResults[i].SubscriptionID {
			t.Errorf(
				"result[%d] SubscriptionID = %q, want %q",
				i,
				results[i].SubscriptionID,
				wantResults[i].SubscriptionID,
			)
		}
	}
}

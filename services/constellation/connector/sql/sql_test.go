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

	c, err := csql.NewConnector(context.Background(), driver, minimalMetadata())
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

	_, err := csql.NewConnector(context.Background(), driver, minimalMetadata())
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	if !errors.Is(err, errTest) {
		t.Errorf("expected wrapped errTest, got: %v", err)
	}
}

// objectsWithUntrackedFunctionTarget builds an introspection.Objects with a
// SETOF function whose return-type table is not tracked in metadata. This is
// the same shape exercised by queries.BuildRoots'
// TestBuildRoots_FunctionReturningUnknownTableErrors path and forces
// queries.BuildRoots to fail with a missing-base-table error.
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

func TestNewConnector_BuildRootsError(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	driver := mock.NewMockDriver(ctrl)

	driver.EXPECT().Dialect().Return(&dialect.PostgresDialect{}).AnyTimes()
	driver.EXPECT().
		Introspect(gomock.Any(), gomock.Any()).
		Return(objectsWithUntrackedFunctionTarget(), nil)

	// Metadata tracks public.users (matching introspection) and
	// public.search_orders. BuildRoots will fail because the function's
	// return-type table (public.orders) is not tracked.
	md := &metadata.DatabaseMetadata{
		Kind: "postgres",
		Tables: []metadata.TableMetadata{
			{Table: metadata.TableSource{Schema: "public", Name: "users"}},
		},
		Functions: []metadata.FunctionMetadata{
			{Function: metadata.FunctionSource{Schema: "public", Name: "search_orders"}},
		},
	}

	_, err := csql.NewConnector(context.Background(), driver, md)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	if !strings.Contains(err.Error(), "failed to build GraphQL roots") {
		t.Errorf("expected wrapping prefix %q, got: %v", "failed to build GraphQL roots", err)
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

func TestNewConnector_ReloadSchemaError(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	driver := mock.NewMockDriver(ctrl)

	driver.EXPECT().Dialect().Return(&dialect.PostgresDialect{}).AnyTimes()
	driver.EXPECT().
		Introspect(gomock.Any(), gomock.Any()).
		Return(objectsWithEnumFKMissingValues(), nil)

	md := &metadata.DatabaseMetadata{
		Kind: "postgres",
		Tables: []metadata.TableMetadata{
			{Table: metadata.TableSource{Schema: "public", Name: "users"}},
			{Table: metadata.TableSource{Schema: "public", Name: "user_status"}, IsEnum: true},
		},
	}

	_, err := csql.NewConnector(context.Background(), driver, md)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	if !strings.Contains(err.Error(), "failed to load schema") {
		t.Errorf("expected wrapping prefix %q, got: %v", "failed to load schema", err)
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

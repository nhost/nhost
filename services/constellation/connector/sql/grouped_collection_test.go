package sql_test

import (
	"context"
	"encoding/json/jsontext"
	"errors"
	"log/slog"
	"reflect"
	"strings"
	"testing"

	"go.uber.org/mock/gomock"

	"github.com/nhost/nhost/services/constellation/connector/groupedaggregate"
	csql "github.com/nhost/nhost/services/constellation/connector/sql"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/connector/sql/mock"
	"github.com/nhost/nhost/services/constellation/metadata"
)

//nolint:gocognit // Driver, builder and result-parser failure branches share one fixture.
func TestConnector_ExecuteGroupedCollection(
	t *testing.T,
) {
	t.Parallel()

	for _, tc := range []struct {
		name, target string
		result       any
		driverErr    error
		wantErr      string
		want         map[string]any
	}{
		{"build error", "absent", nil, nil, "table not registered", nil},
		{"driver error", "users", nil, errTest, "executing grouped collection", nil},
		{"missing result", "users", nil, nil, "grouped aggregate result missing", nil},
		{"invalid type", "users", "not JSON", nil, "unexpected grouped aggregate result type", nil},
		{"invalid JSON", "users", jsontext.Value(`[broken`), nil, "failed to unmarshal", nil},
		{
			"missing join key", "users", jsontext.Value(`[{"nodes":[]}]`), nil,
			"grouped aggregate row missing _join_key", nil,
		},
		{"success", "users", jsontext.Value(`[{"_join_key":"a","nodes":[{"id":"a"}]},` +
			`{"_join_key":"b","nodes":[]}]`), nil, "", map[string]any{
			"a": map[string]any{"nodes": []any{map[string]any{"id": "a"}}},
			"b": map[string]any{"nodes": []any{}},
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			driver := mock.NewMockDriver(gomock.NewController(t))
			conn := newUsersConnector(t, driver)

			field, fragments := parseAggregateFieldSource(t, `query { users(limit:1) { id } }`)
			if tc.target == "users" {
				call := driver.EXPECT().ExecuteOperations(gomock.Any(), gomock.Any(), gomock.Any())
				call.DoAndReturn(
					func(_ context.Context, ops []core.SQLOperation, _ *slog.Logger) (map[string]any, error) {
						if len(ops) != 1 || !strings.Contains(ops[0].SQL, "LIMIT 1") {
							t.Fatalf("expected one bounded SQL statement: %#v", ops)
						}

						if tc.driverErr != nil {
							return nil, tc.driverErr
						}

						if tc.result == nil {
							return map[string]any{}, nil
						}

						return map[string]any{ops[0].Name: tc.result}, nil
					},
				)
			}

			got, err := conn.ExecuteGroupedCollection(t.Context(), groupedaggregate.Request{
				TableSchema: "public", TableName: tc.target, JoinColumnSQLName: "id",
				JoinValues: []any{"a", "b"}, Field: field, Fragments: fragments,
			}, "admin", nil, slog.Default())
			if tc.wantErr != "" {
				if err == nil || !strings.Contains(err.Error(), tc.wantErr) {
					t.Fatalf("error=%v; want %q", err, tc.wantErr)
				}

				if tc.driverErr != nil && !errors.Is(err, tc.driverErr) {
					t.Fatalf("driver error not wrapped: %v", err)
				}
			} else if err != nil || !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("result=%#v error=%v; want %#v", got, err, tc.want)
			}
		})
	}
}

// TestConnector_ExecuteGroupedCollection_SQLiteChunks verifies that more
// parent keys than SQLite's bounded derived-table chunk result in a small
// number of statements, never one network query per key.
func TestConnector_ExecuteGroupedCollection_SQLiteChunks(t *testing.T) {
	t.Parallel()
	driver := mock.NewMockDriver(gomock.NewController(t))
	driver.EXPECT().Dialect().Return(dialect.NewSQLiteDialect()).AnyTimes()

	objects := introspection.NewObjects()
	objects.Schemas[""] = &introspection.Schema{Tables: map[string]*introspection.Table{
		"users": {Name: "users", Columns: []introspection.Column{
			{Name: "id", Type: "integer"},
		}, PrimaryKeys: []string{"id"}},
	}}
	driver.EXPECT().Introspect(gomock.Any(), gomock.Any()).Return(objects, nil)

	conn, err := csql.NewConnector(t.Context(), driver, &metadata.DatabaseMetadata{
		Kind:   "sqlite",
		Tables: []metadata.TableMetadata{{Table: metadata.TableSource{Name: "users"}}},
	}, nil, nil)
	if err != nil {
		t.Fatal(err)
	}

	field, fragments := parseAggregateFieldSource(t, `query { users(limit:1) { id } }`)

	values := make([]any, 201)
	for i := range values {
		values[i] = i + 1
	}

	var calls int
	driver.EXPECT().ExecuteOperations(gomock.Any(), gomock.Any(), gomock.Any()).Times(2).
		DoAndReturn(func(_ context.Context, ops []core.SQLOperation, _ *slog.Logger) (map[string]any, error) {
			calls++

			if len(ops) != 1 || !strings.Contains(ops[0].SQL, "LIMIT 1") ||
				len(ops[0].Parameters) > 201 {
				t.Fatalf("unbounded batch: %#v", ops)
			}

			return map[string]any{ops[0].Name: jsontext.Value(`[]`)}, nil
		})

	_, err = conn.ExecuteGroupedCollection(t.Context(), groupedaggregate.Request{
		TableName: "users", JoinColumnSQLName: "id", JoinValues: values,
		Field: field, Fragments: fragments,
	}, "admin", nil, slog.Default())
	if err != nil || calls != 2 {
		t.Fatalf("calls=%d err=%v", calls, err)
	}
}

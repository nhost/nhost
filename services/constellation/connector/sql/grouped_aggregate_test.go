package sql_test

import (
	"context"
	"encoding/json/jsontext"
	"errors"
	"log/slog"
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
	"go.uber.org/mock/gomock"

	"github.com/nhost/nhost/services/constellation/connector/groupedaggregate"
	csql "github.com/nhost/nhost/services/constellation/connector/sql"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/connector/sql/mock"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// usersObjects builds an introspection.Objects with a single public.users
// table — enough for queries.BuildRoots to register a grouped-aggregate
// operation for "users".
func usersObjects() *introspection.Objects {
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

	return objs
}

func usersMetadata() *metadata.DatabaseMetadata {
	return &metadata.DatabaseMetadata{
		Kind: "postgres",
		Tables: []metadata.TableMetadata{
			{Table: metadata.TableSource{Schema: "public", Name: "users"}},
		},
	}
}

func newUsersConnector(t *testing.T, driver *mock.MockDriver) *csql.Connector {
	t.Helper()

	driver.EXPECT().Dialect().Return(&dialect.PostgresDialect{}).AnyTimes()
	driver.EXPECT().Introspect(gomock.Any(), gomock.Any()).Return(usersObjects(), nil)

	c, err := csql.NewConnector(context.Background(), driver, usersMetadata(), nil, nil)
	if err != nil {
		t.Fatalf("NewConnector() unexpected error: %v", err)
	}

	return c
}

// parseAggregateField parses the canonical aggregate query used by the
// grouped-aggregate tests and returns the root *ast.Field plus fragment
// definitions, ready to feed into groupedaggregate.Request.
func parseAggregateField(t *testing.T) (*ast.Field, ast.FragmentDefinitionList) {
	t.Helper()

	const src = `query { _root { aggregate { count } } }`

	doc, gqlErr := parser.ParseQuery(&ast.Source{Input: src})
	if gqlErr != nil {
		t.Fatalf("parse: %v", gqlErr)
	}

	field, ok := doc.Operations[0].SelectionSet[0].(*ast.Field)
	if !ok {
		t.Fatal("expected root selection to be a Field")
	}

	return field, doc.Fragments
}

func TestConnector_ExecuteGroupedAggregate_BuildError(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	driver := mock.NewMockDriver(ctrl)

	c := newUsersConnector(t, driver)

	field, fragments := parseAggregateField(t)

	// Targeting an unregistered table forces BuildGroupedAggregateSQL to fail.
	_, err := c.ExecuteGroupedAggregate(
		context.Background(),
		groupedaggregate.Request{
			TableSchema:       "public",
			TableName:         "orders",
			JoinColumnSQLName: "id",
			JoinValues:        []any{"x"},
			Field:             field,
			Fragments:         fragments,
		},
		"admin",
		nil,
		slog.Default(),
	)
	if err == nil {
		t.Fatal("expected build error, got nil")
	}

	if !strings.Contains(err.Error(), "failed to build grouped aggregate SQL") {
		t.Errorf("expected build-error wrapping, got: %v", err)
	}
}

func TestConnector_ExecuteGroupedAggregate_DriverError(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	driver := mock.NewMockDriver(ctrl)

	c := newUsersConnector(t, driver)

	field, fragments := parseAggregateField(t)

	driver.EXPECT().
		ExecuteOperations(gomock.Any(), gomock.Any(), gomock.Any()).
		Return(nil, errTest)

	_, err := c.ExecuteGroupedAggregate(
		context.Background(),
		groupedaggregate.Request{
			TableSchema:       "public",
			TableName:         "users",
			JoinColumnSQLName: "id",
			JoinValues:        []any{"11111111-1111-1111-1111-111111111111"},
			Field:             field,
			Fragments:         fragments,
		},
		"admin",
		nil,
		slog.Default(),
	)
	if !errors.Is(err, errTest) {
		t.Fatalf("expected wrapped errTest, got: %v", err)
	}
}

func TestConnector_ExecuteGroupedAggregate_MissingResultKey(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	driver := mock.NewMockDriver(ctrl)

	c := newUsersConnector(t, driver)

	field, fragments := parseAggregateField(t)

	// Return a result map that does not contain the operation's Name key.
	driver.EXPECT().
		ExecuteOperations(gomock.Any(), gomock.Any(), gomock.Any()).
		DoAndReturn(func(
			_ context.Context, ops []core.SQLOperation, _ *slog.Logger,
		) (map[string]any, error) {
			if len(ops) != 1 {
				t.Fatalf("expected 1 op, got %d", len(ops))
			}

			return map[string]any{"unrelated": "value"}, nil
		})

	_, err := c.ExecuteGroupedAggregate(
		context.Background(),
		groupedaggregate.Request{
			TableSchema:       "public",
			TableName:         "users",
			JoinColumnSQLName: "id",
			JoinValues:        []any{"11111111-1111-1111-1111-111111111111"},
			Field:             field,
			Fragments:         fragments,
		},
		"admin",
		nil,
		slog.Default(),
	)
	if err == nil {
		t.Fatal("expected missing-result error, got nil")
	}

	if !strings.Contains(err.Error(), "grouped aggregate result missing") {
		t.Errorf("expected missing-result wrapping, got: %v", err)
	}
}

func TestConnector_ExecuteGroupedAggregate_ParseErrors(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		driverResult any
		wantErrSub   string
	}{
		{
			name:         "driver returns wrong type for op result",
			driverResult: "not a jsontext value",
			wantErrSub:   "unexpected grouped aggregate result type",
		},
		{
			name:         "driver returns rows missing _join_key",
			driverResult: jsontext.Value(`[{"aggregate":{"count":1},"nodes":[]}]`),
			wantErrSub:   "grouped aggregate row missing _join_key",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			driver := mock.NewMockDriver(ctrl)

			c := newUsersConnector(t, driver)

			field, fragments := parseAggregateField(t)

			driver.EXPECT().
				ExecuteOperations(gomock.Any(), gomock.Any(), gomock.Any()).
				DoAndReturn(func(
					_ context.Context, ops []core.SQLOperation, _ *slog.Logger,
				) (map[string]any, error) {
					if len(ops) != 1 {
						t.Fatalf("expected 1 op, got %d", len(ops))
					}

					return map[string]any{ops[0].Name: tt.driverResult}, nil
				})

			_, err := c.ExecuteGroupedAggregate(
				context.Background(),
				groupedaggregate.Request{
					TableSchema:       "public",
					TableName:         "users",
					JoinColumnSQLName: "id",
					JoinValues:        []any{"k1"},
					Field:             field,
					Fragments:         fragments,
				},
				"admin",
				nil,
				slog.Default(),
			)
			if err == nil {
				t.Fatal("expected parse error, got nil")
			}

			if !strings.Contains(err.Error(), tt.wantErrSub) {
				t.Errorf("error %q missing substring %q", err.Error(), tt.wantErrSub)
			}
		})
	}
}

func TestConnector_ExecuteGroupedAggregate_Success(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	driver := mock.NewMockDriver(ctrl)

	c := newUsersConnector(t, driver)

	field, fragments := parseAggregateField(t)

	payload := jsontext.Value(
		`[{"_join_key":"k1","aggregate":{"count":2},"nodes":[]},` +
			`{"_join_key":"k2","aggregate":{"count":0},"nodes":[]}]`,
	)

	driver.EXPECT().
		ExecuteOperations(gomock.Any(), gomock.Any(), gomock.Any()).
		DoAndReturn(func(
			_ context.Context, ops []core.SQLOperation, _ *slog.Logger,
		) (map[string]any, error) {
			if len(ops) != 1 {
				t.Fatalf("expected 1 op, got %d", len(ops))
			}

			return map[string]any{ops[0].Name: payload}, nil
		})

	out, err := c.ExecuteGroupedAggregate(
		context.Background(),
		groupedaggregate.Request{
			TableSchema:       "public",
			TableName:         "users",
			JoinColumnSQLName: "id",
			JoinValues:        []any{"k1", "k2"},
			Field:             field,
			Fragments:         fragments,
		},
		"admin",
		nil,
		slog.Default(),
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(out) != 2 {
		t.Fatalf("expected 2 entries, got %d: %v", len(out), out)
	}

	for _, k := range []string{"k1", "k2"} {
		if _, ok := out[k]; !ok {
			t.Errorf("missing key %q", k)
		}
	}
}

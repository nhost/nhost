package arguments_test

import (
	"errors"
	"fmt"
	"reflect"
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"go.uber.org/mock/gomock"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments/mock"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
)

type testComputedTableOrderCall struct{}

func (testComputedTableOrderCall) SQLType() string         { return "integer" }
func (testComputedTableOrderCall) SourceColumns() []string { return nil }
func (testComputedTableOrderCall) TargetSchema() string    { return "cf_select" }
func (testComputedTableOrderCall) TargetName() string      { return "tags" }
func (testComputedTableOrderCall) WriteExpression(
	b *strings.Builder, source string, session map[string]any, params []any, index int,
) ([]any, int, error) {
	fmt.Fprintf(b, `"cf_select"."item_tags"(%s, $%d)`, source, index)

	return append(params, session["x-hasura-user-id"]), index + 1, nil
}

// sqliteDialect returns a real SQLite dialect; the variance gate only reads
// SupportsStableVarianceOrderBy, so the concrete value is preferable to a mock.
func sqliteDialect() dialect.Dialect { return &dialect.SQLiteDialect{} }

// TestParseOrderBy_ComputedAggregateInObjectRelationship pins correlation,
// both permission layers, and the order in which their parameters are bound.
func TestParseOrderBy_ComputedAggregateInObjectRelationship(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name, aggregate, wantExpr, direction string
	}{
		{"count", "count", "COUNT(*)", "desc"},
		{"max", "max", `MAX("_cs_ob1"."id")`, "asc"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			parent := mock.NewMockTable(ctrl)
			rel := mock.NewMockRelationship(ctrl)
			item := mock.NewMockTable(ctrl)
			tags := mock.NewMockTable(ctrl)

			parent.EXPECT().ColumnFromGraphqlName("item").Return(nil)
			parent.EXPECT().ComputedScalarFromGraphqlName("item", "reader").Return(nil)
			parent.EXPECT().Relationship("item").Return(rel)
			rel.EXPECT().TargetTable().Return(item)
			rel.EXPECT().Name().Return("item")
			rel.EXPECT().IsArray().Return(false)
			rel.EXPECT().WriteJoinConditionAliased(gomock.Any(), `"outer"`, `"_cs_ob0"`).
				Do(func(b *strings.Builder, _, _ string) {
					b.WriteString(`"outer"."item_id" = "_cs_ob0"."id"`)
				})

			item.EXPECT().ColumnFromGraphqlName("item_tags_aggregate").Return(nil)
			item.EXPECT().ComputedScalarFromGraphqlName("item_tags_aggregate", "reader").Return(nil)
			item.EXPECT().ComputedTableFromGraphqlName("item_tags", "reader").
				Return(testComputedTableOrderCall{})
			item.EXPECT().OrderTableBySchemaName("cf_select", "tags").Return(tags)
			item.EXPECT().TableFromClause().Return(`"cf_select"."items"`)
			item.EXPECT().HasRowLevelPermissions("reader").Return(true)
			item.EXPECT().
				WriteRowLevelPermissions(gomock.Any(), gomock.Any(), 4, "reader", gomock.Any(), `"_cs_ob0"`).
				DoAndReturn(func(b *strings.Builder, params []any, index int, _ string, _ map[string]any, _ string) ([]any, int, error) {
					b.WriteString(`"_cs_ob0"."owner_id" = $4`)
					return append(params, "owner"), index + 1, nil
				})

			if tt.aggregate == "max" {
				tags.EXPECT().ColumnFromGraphqlName("id").Return(newColumn("id", "id", "integer"))
				tags.EXPECT().Dialect().Return(pgDialect())
			}

			tags.EXPECT().HasRowLevelPermissions("reader").Return(true)
			tags.EXPECT().
				WriteRowLevelPermissions(gomock.Any(), gomock.Any(), 3, "reader", gomock.Any(), `"_cs_ob1"`).
				DoAndReturn(func(b *strings.Builder, params []any, index int, _ string, _ map[string]any, _ string) ([]any, int, error) {
					b.WriteString(`"_cs_ob1"."label" = $3`)
					return append(params, "visible"), index + 1, nil
				})

			value := objectValue(child("item", objectValue(child(
				"item_tags_aggregate", objectValue(child(tt.aggregate,
					func() *ast.Value {
						if tt.aggregate == "count" {
							return enumValue(tt.direction)
						}

						return objectValue(child("id", enumValue(tt.direction)))
					}(),
				)),
			))))
			session := map[string]any{"x-hasura-user-id": "caller"}

			items, err := arguments.ParseOrderBy(parent, value, nil, "reader", session, `"outer"`)
			if err != nil {
				t.Fatal(err)
			}

			if len(items) != 1 {
				t.Fatalf("items = %d, want 1", len(items))
			}

			var b strings.Builder

			params, next, err := (&arguments.OrderBy{Items: items}).WriteSQL(
				&b,
				[]any{"earlier"},
				2,
			)
			if err != nil {
				t.Fatal(err)
			}

			want := `ORDER BY (SELECT (SELECT ` + tt.wantExpr +
				` FROM "cf_select"."item_tags"("_cs_ob0", $2) AS "_cs_ob1"` +
				` WHERE "_cs_ob1"."label" = $3) FROM "cf_select"."items" "_cs_ob0"` +
				` WHERE "outer"."item_id" = "_cs_ob0"."id" AND "_cs_ob0"."owner_id" = $4 LIMIT 1) ` +
				strings.ToUpper(tt.direction)
			if b.String() != want {
				t.Errorf("SQL = %q, want %q", b.String(), want)
			}

			if next != 5 ||
				!reflect.DeepEqual(params, []any{"earlier", "caller", "visible", "owner"}) {
				t.Errorf("params = %v, next = %d", params, next)
			}
		})
	}
}

// aggregateOrderByTable wires the mocks for an array-relationship aggregate
// order_by of the shape {employees_aggregate: {<fn>: {joined_at: asc}}} against
// a target table using the given dialect, and returns the parent table to pass
// to ParseOrderBy. When renderTarget is true it also wires the calls the
// per-column rendering path makes, which is reached only when the variance gate
// allows the function through.
func aggregateOrderByTable(
	t *testing.T, d dialect.Dialect, renderTarget bool,
) arguments.Table {
	t.Helper()

	ctrl := gomock.NewController(t)
	tbl := mock.NewMockTable(ctrl)
	rel := mock.NewMockRelationship(ctrl)
	target := mock.NewMockTable(ctrl)

	// employees_aggregate is not a scalar column; it dispatches to the
	// array-relationship aggregate ordering path.
	tbl.EXPECT().ColumnFromGraphqlName("employees_aggregate").Return(nil)
	tbl.EXPECT().ComputedScalarFromGraphqlName("employees_aggregate", "admin").Return(nil)
	tbl.EXPECT().ComputedTableFromGraphqlName("employees", "admin").Return(nil)
	tbl.EXPECT().Relationship("employees_aggregate").Return(rel)

	rel.EXPECT().Name().Return("employees").AnyTimes()
	rel.EXPECT().AggregateName().Return("employees_aggregate").AnyTimes()
	rel.EXPECT().IsArray().Return(true).AnyTimes()
	rel.EXPECT().TargetTable().Return(target).AnyTimes()

	// The dialect is consulted by the variance gate (and, on the success path,
	// again to render the aggregate expression).
	target.EXPECT().Dialect().Return(d).AnyTimes()

	if renderTarget {
		// Reached only when the gate allows the function through: the per-column
		// loop resolves the column and renders the correlated subquery.
		target.EXPECT().
			ColumnFromGraphqlName("joined_at").
			Return(newColumn("joined_at", "joined_at", "timestamptz"))
		target.EXPECT().TableFromClause().Return(`"public"."user_departments"`).AnyTimes()
		target.EXPECT().HasRowLevelPermissions("admin").Return(false).AnyTimes()
		rel.EXPECT().
			WriteJoinConditionAliased(gomock.Any(), gomock.Any(), gomock.Any()).
			Do(func(b *strings.Builder, parentAlias, targetAlias string) {
				b.WriteString(parentAlias)
				b.WriteString(`."id" = `)
				b.WriteString(targetAlias)
				b.WriteString(`."department_id"`)
			}).
			AnyTimes()
	}

	return tbl
}

// aggregateOrderByValue builds the GraphQL order_by value
// {employees_aggregate: {<fn>: {joined_at: asc}}}.
func aggregateOrderByValue(fn string) *ast.Value {
	return objectValue(child(
		"employees_aggregate",
		objectValue(child(fn, objectValue(child("joined_at", enumValue("asc"))))),
	))
}

// TestParseOrderBy_AggregateVarianceGate locks the runtime backstop in
// buildAggregateColumnOrderItems: an array-relationship aggregate order_by over
// a stddev/variance function is rejected on a backend whose dialect reports
// SupportsStableVarianceOrderBy() == false (SQLite), but renders the expected
// correlated aggregate subquery on a backend that supports it (PostgreSQL).
//
// Schema gating normally hides these fields on SQLite, so this is the only
// coverage of the defensive ErrUnsupportedAggregateOrderBy path. It also pins
// the gated set to the variance family: a non-variance aggregate (avg) is not
// rejected on SQLite.
func TestParseOrderBy_AggregateVarianceGate(t *testing.T) {
	t.Parallel()

	t.Run("stddev rejected on SQLite", func(t *testing.T) {
		t.Parallel()

		tbl := aggregateOrderByTable(t, sqliteDialect(), false)

		_, err := arguments.ParseOrderBy(
			tbl, aggregateOrderByValue("stddev"), nil, "admin", nil, `"public"."departments"`,
		)
		if !errors.Is(err, arguments.ErrUnsupportedAggregateOrderBy) {
			t.Fatalf("expected ErrUnsupportedAggregateOrderBy, got %v", err)
		}
	})

	t.Run("variance rejected on SQLite", func(t *testing.T) {
		t.Parallel()

		tbl := aggregateOrderByTable(t, sqliteDialect(), false)

		_, err := arguments.ParseOrderBy(
			tbl, aggregateOrderByValue("variance"), nil, "admin", nil, `"public"."departments"`,
		)
		if !errors.Is(err, arguments.ErrUnsupportedAggregateOrderBy) {
			t.Fatalf("expected ErrUnsupportedAggregateOrderBy, got %v", err)
		}
	})

	t.Run("non-variance aggregate allowed on SQLite", func(t *testing.T) {
		t.Parallel()

		// avg is not in varianceOrderByFuncs, so the gate must not fire even on
		// SQLite. This pins the gated set to exactly the variance family.
		tbl := aggregateOrderByTable(t, sqliteDialect(), true)

		items, err := arguments.ParseOrderBy(
			tbl, aggregateOrderByValue("avg"), nil, "admin", nil, `"public"."departments"`,
		)
		if err != nil {
			t.Fatalf("avg ordering must be allowed on SQLite, got %v", err)
		}

		if len(items) != 1 {
			t.Fatalf("expected 1 order_by item, got %d", len(items))
		}
	})

	t.Run("stddev renders aggregate subquery on PostgreSQL", func(t *testing.T) {
		t.Parallel()

		tbl := aggregateOrderByTable(t, pgDialect(), true)

		items, err := arguments.ParseOrderBy(
			tbl, aggregateOrderByValue("stddev"), nil, "admin", nil, `"public"."departments"`,
		)
		if err != nil {
			t.Fatalf("stddev ordering must be allowed on PostgreSQL, got %v", err)
		}

		ob := &arguments.OrderBy{Items: items}

		var b strings.Builder
		if _, _, werr := ob.WriteSQL(&b, nil, 1); werr != nil {
			t.Fatalf("WriteSQL: %v", werr)
		}

		const want = `ORDER BY (SELECT STDDEV("_cs_ob0"."joined_at") ` +
			`FROM "public"."user_departments" "_cs_ob0" ` +
			`WHERE "public"."departments"."id" = "_cs_ob0"."department_id") ASC`
		if got := b.String(); got != want {
			t.Errorf("rendered SQL\n got = %q\nwant = %q", got, want)
		}
	})
}

package arguments_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"go.uber.org/mock/gomock"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments/mock"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
)

// sqliteDialect returns a real SQLite dialect; the variance gate only reads
// SupportsStableVarianceOrderBy, so the concrete value is preferable to a mock.
func sqliteDialect() dialect.Dialect { return &dialect.SQLiteDialect{} }

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

package queries_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	groupedaggdispatch "github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/groupedaggregate"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// parseSingleField parses a GraphQL document and returns its first operation
// plus the first selection-set field. Both grouped-aggregate and BuildQuery
// smoke tests need the same parse-and-extract dance.
func parseSingleField(
	t *testing.T,
	src string,
) (*ast.OperationDefinition, *ast.Field, ast.FragmentDefinitionList) {
	t.Helper()

	doc, gqlErr := parser.ParseQuery(&ast.Source{Input: src})
	if gqlErr != nil {
		t.Fatalf("parse: %v", gqlErr)
	}

	if len(doc.Operations) == 0 || len(doc.Operations[0].SelectionSet) == 0 {
		t.Fatal("query must contain at least one operation with a root field")
	}

	field, ok := doc.Operations[0].SelectionSet[0].(*ast.Field)
	if !ok {
		t.Fatal("expected root selection to be a Field")
	}

	return doc.Operations[0], field, doc.Fragments
}

func TestBuildQueryDispatch_Query(t *testing.T) {
	t.Parallel()

	objects := buildObjectsWithUsersTable()
	md := &metadata.DatabaseMetadata{Tables: []metadata.TableMetadata{tableMetaFor("users")}}

	roots, _, err := queries.BuildRoots(objects, md, &dialect.PostgresDialect{})
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	op, _, _ := parseSingleField(t, `query { users { id } }`)

	ops, err := roots.BuildQuery(op, nil, nil, "admin", nil)
	if err != nil {
		t.Fatalf("BuildQuery: %v", err)
	}

	if len(ops) != 1 {
		t.Fatalf("expected 1 operation, got %d", len(ops))
	}

	got := ops[0].SQL
	// Collection queries emit a json_agg wrapping the rows selected from the table.
	if !strings.Contains(got, `FROM "public"."users"`) {
		t.Errorf("query SQL missing table FROM clause; got: %s", got)
	}

	if !strings.Contains(got, "json_agg") {
		t.Errorf("query SQL missing json_agg; got: %s", got)
	}
}

func TestBuildQueryDispatch_QueryByPk(t *testing.T) {
	t.Parallel()

	objects := buildObjectsWithUsersTable()
	md := &metadata.DatabaseMetadata{Tables: []metadata.TableMetadata{tableMetaFor("users")}}

	roots, _, err := queries.BuildRoots(objects, md, &dialect.PostgresDialect{})
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	op, _, _ := parseSingleField(
		t,
		`query { users_by_pk(id: "11111111-1111-1111-1111-111111111111") { id } }`,
	)

	ops, err := roots.BuildQuery(op, nil, nil, "admin", nil)
	if err != nil {
		t.Fatalf("BuildQuery: %v", err)
	}

	if len(ops) != 1 {
		t.Fatalf("expected 1 operation, got %d", len(ops))
	}

	got := ops[0].SQL
	if !strings.Contains(got, `"public"."users"."id" = `) {
		t.Errorf("by_pk SQL missing pk filter; got: %s", got)
	}
}

func TestBuildQueryDispatch_Mutation(t *testing.T) {
	t.Parallel()

	objects := buildObjectsWithUsersTable()
	md := &metadata.DatabaseMetadata{Tables: []metadata.TableMetadata{tableMetaFor("users")}}

	roots, _, err := queries.BuildRoots(objects, md, &dialect.PostgresDialect{})
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	op, _, _ := parseSingleField(
		t,
		`mutation { insert_users_one(object: { id: "11111111-1111-1111-1111-111111111111" }) { id } }`,
	)

	ops, err := roots.BuildQuery(op, nil, nil, "admin", nil)
	if err != nil {
		t.Fatalf("BuildQuery: %v", err)
	}

	if len(ops) != 1 {
		t.Fatalf("expected 1 operation, got %d", len(ops))
	}

	got := ops[0].SQL
	if !strings.Contains(got, `INSERT INTO "public"."users"`) {
		t.Errorf("mutation SQL missing INSERT; got: %s", got)
	}
}

func TestBuildQueryDispatch_Subscription(t *testing.T) {
	t.Parallel()

	objects := buildObjectsWithUsersTable()
	md := &metadata.DatabaseMetadata{Tables: []metadata.TableMetadata{tableMetaFor("users")}}

	roots, _, err := queries.BuildRoots(objects, md, &dialect.PostgresDialect{})
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	op, _, _ := parseSingleField(t, `subscription { users { id } }`)

	ops, err := roots.BuildQuery(op, nil, nil, "admin", nil)
	if err != nil {
		t.Fatalf("BuildQuery: %v", err)
	}

	if len(ops) != 1 {
		t.Fatalf("expected 1 operation, got %d", len(ops))
	}

	got := ops[0].SQL
	if !strings.Contains(got, `FROM "public"."users"`) {
		t.Errorf("subscription SQL missing table FROM clause; got: %s", got)
	}
}

func TestBuildQueryDispatch_UnknownFieldErrors(t *testing.T) {
	t.Parallel()

	objects := buildObjectsWithUsersTable()
	md := &metadata.DatabaseMetadata{Tables: []metadata.TableMetadata{tableMetaFor("users")}}

	roots, _, err := queries.BuildRoots(objects, md, &dialect.PostgresDialect{})
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	op, _, _ := parseSingleField(t, `query { not_a_root { id } }`)

	_, err = roots.BuildQuery(op, nil, nil, "admin", nil)
	if err == nil {
		t.Fatal("expected error for unknown root field, got nil")
	}

	if !strings.Contains(err.Error(), "not_a_root") {
		t.Errorf("error should mention unknown field; got: %v", err)
	}
}

func TestBuildQueryNestedRelationshipValidationErrorPath(t *testing.T) {
	t.Parallel()

	objects := buildObjectsWithUsersAndOrders()
	md := &metadata.DatabaseMetadata{
		Tables: []metadata.TableMetadata{
			{
				Table: metadata.TableSource{Schema: "public", Name: "users"},
				ArrayRelationships: []metadata.ArrayRelationship{
					{
						Name: "orders",
						Using: metadata.RelationshipUsing{
							ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
								Columns: []string{"user_id"},
								Table: metadata.TableSource{
									Schema: "public",
									Name:   "orders",
								},
							},
						},
					},
				},
			},
			tableMetaFor("orders"),
		},
	}

	roots, _, err := queries.BuildRoots(objects, md, &dialect.PostgresDialect{})
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	op, _, _ := parseSingleField(t, `query {
		people: users {
			id
			orderList: orders(distinct_on: id, order_by: { user_id: asc }) { id }
		}
	}`)

	_, err = roots.BuildQuery(op, nil, nil, "admin", nil)
	if !errors.Is(err, arguments.ErrDistinctOnOrderByMismatch) {
		t.Fatalf("expected ErrDistinctOnOrderByMismatch, got %v", err)
	}

	assertValidationPath(
		t,
		err,
		"$.selectionSet.people.selectionSet.orderList.args",
	)
}

func assertValidationPath(t *testing.T, err error, want string) {
	t.Helper()

	var vErr *arguments.QueryValidationError
	if !errors.As(err, &vErr) {
		t.Fatalf("err = %T, want *QueryValidationError", err)
	}

	ext, ok := vErr.AsMap()["extensions"].(map[string]any)
	if !ok {
		t.Fatalf("extensions = %T, want map[string]any", vErr.AsMap()["extensions"])
	}

	if got := ext["path"]; got != want {
		t.Fatalf("extensions.path = %v, want %s", got, want)
	}
}

// buildObjectsWithUsersAndOrders builds an introspection.Objects with two
// tables and a FK from orders.user_id to users.id. Used to test grouped
// aggregate paths that need a registered relationship.
func buildObjectsWithUsersAndOrders() *introspection.Objects {
	objs := introspection.NewObjects()
	objs.Schemas["public"] = &introspection.Schema{
		Tables: map[string]*introspection.Table{
			"users": {
				Schema:      "public",
				Name:        "users",
				Columns:     []introspection.Column{{Name: "id", Type: "uuid"}},
				PrimaryKeys: []string{"id"},
			},
			"orders": {
				Schema: "public",
				Name:   "orders",
				Columns: []introspection.Column{
					{Name: "id", Type: "uuid"},
					{Name: "user_id", Type: "uuid"},
				},
				PrimaryKeys: []string{"id"},
				ForeignKeys: []introspection.ForeignKey{
					{
						ColumnName:        "user_id",
						ForeignSchema:     "public",
						ForeignTable:      "users",
						ForeignColumnName: "id",
					},
				},
			},
		},
	}

	return objs
}

// TestBuildGroupedAggregate_LimitApplied asserts that a per-group limit emits a
// windowed CTE that numbers rows per parent join key and keeps only the first N,
// with the limit bound as a parameter (never concatenated). The windowed rows
// are LEFT JOINed back onto the distinct join-key set (window predicate in the
// ON clause) so every requested group survives even when its window is empty,
// while the same row set still feeds both the aggregate and the nodes.
func TestBuildGroupedAggregate_LimitApplied(t *testing.T) {
	t.Parallel()

	objects := buildObjectsWithUsersTable()
	md := &metadata.DatabaseMetadata{Tables: []metadata.TableMetadata{tableMetaFor("users")}}

	_, groupedAgg, err := queries.BuildRoots(objects, md, &dialect.PostgresDialect{})
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	_, field, fragments := parseSingleField(t, `query {
		_root(limit: 5, order_by: { id: asc }) {
			aggregate { count }
			nodes { id }
		}
	}`)

	op, err := groupedAgg.BuildGroupedAggregateSQL(groupedaggdispatch.BuildInput{
		TableSchema:       "public",
		TableName:         "users",
		Field:             field,
		Fragments:         fragments,
		Variables:         nil,
		Role:              "admin",
		SessionVariables:  nil,
		JoinColumnSQLName: "id",
		JoinValues:        []any{"11111111-1111-1111-1111-111111111111"},
	})
	if err != nil {
		t.Fatalf("BuildGroupedAggregateSQL: %v", err)
	}

	// The window CTE partitions by the join key and orders by the user order_by.
	wantWindow := `"_root.windowed" AS MATERIALIZED (SELECT "_root.base".` +
		`*, row_number() OVER ` +
		`(PARTITION BY "__cs_join_key" ORDER BY "_root.base"."id" ASC)`
	if !strings.Contains(op.SQL, wantWindow) {
		t.Errorf("SQL missing windowed CTE %q:\n%s", wantWindow, op.SQL)
	}

	// The distinct join-key set is derived from the windowed CTE (which never
	// drops rows) and the windowed rows are LEFT JOINed back onto it, so a group
	// whose window is empty is still emitted.
	wantFrom := `FROM (SELECT DISTINCT "__cs_join_key" FROM "_root.windowed") AS "_root.keys" ` +
		`LEFT JOIN "_root.windowed" ON "_root.keys"."__cs_join_key" = "_root.windowed"."__cs_join_key"`
	if !strings.Contains(op.SQL, wantFrom) {
		t.Errorf("SQL missing key-set LEFT JOIN %q:\n%s", wantFrom, op.SQL)
	}

	// limit-only => offset 0, upper bound offset+limit; both parameterised. The
	// window predicate lives in the JOIN's ON clause (alongside the join-col
	// not-null guard) rather than a row-removing WHERE, so out-of-window rows
	// simply fail to join instead of dropping the group.
	wantPredicate := `AND "_root.windowed"."id" IS NOT NULL AND "__cs_rn" > $2 AND "__cs_rn" <= $3`
	if !strings.Contains(op.SQL, wantPredicate) {
		t.Errorf("SQL missing window ON predicate %q:\n%s", wantPredicate, op.SQL)
	}

	// The group is keyed off the preserved key set, not the windowed rows.
	if !strings.Contains(op.SQL, `GROUP BY "_root.keys"."__cs_join_key"`) {
		t.Errorf("group must be keyed off the preserved key set:\n%s", op.SQL)
	}

	// The window predicate must never become a row-removing outer WHERE, which
	// would drop groups whose window is empty (the bug this guards against).
	if strings.Contains(op.SQL, `FROM "_root.windowed" WHERE`) {
		t.Errorf("window must not be applied as a row-removing WHERE:\n%s", op.SQL)
	}

	wantParams := []any{
		[]any{"11111111-1111-1111-1111-111111111111"},
		0, // offset
		5, // offset + limit
	}
	if diff := cmp.Diff(wantParams, op.Parameters); diff != "" {
		t.Errorf("limit/offset params mismatch (-want +got):\n%s", diff)
	}
}

// TestBuildGroupedAggregate_OffsetApplied asserts that an offset-only request
// emits the window predicate with no upper bound (skip first N, keep the rest)
// and binds the offset as a parameter.
func TestBuildGroupedAggregate_OffsetApplied(t *testing.T) {
	t.Parallel()

	objects := buildObjectsWithUsersTable()
	md := &metadata.DatabaseMetadata{Tables: []metadata.TableMetadata{tableMetaFor("users")}}

	_, groupedAgg, err := queries.BuildRoots(objects, md, &dialect.PostgresDialect{})
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	_, field, fragments := parseSingleField(t, `query {
		_root(offset: 10, order_by: { id: asc }) {
			aggregate { count }
		}
	}`)

	op, err := groupedAgg.BuildGroupedAggregateSQL(groupedaggdispatch.BuildInput{
		TableSchema:       "public",
		TableName:         "users",
		Field:             field,
		Fragments:         fragments,
		Variables:         nil,
		Role:              "admin",
		SessionVariables:  nil,
		JoinColumnSQLName: "id",
		JoinValues:        []any{"11111111-1111-1111-1111-111111111111"},
	})
	if err != nil {
		t.Fatalf("BuildGroupedAggregateSQL: %v", err)
	}

	// offset-only => lower bound only, no upper bound. The predicate lives in the
	// LEFT JOIN's ON clause so groups past the offset are still emitted (count 0,
	// nodes []) rather than dropped.
	wantPredicate := `AND "_root.windowed"."id" IS NOT NULL AND "__cs_rn" > $2`
	if !strings.Contains(op.SQL, wantPredicate) {
		t.Errorf("SQL missing offset-only window predicate %q:\n%s", wantPredicate, op.SQL)
	}

	if strings.Contains(op.SQL, `"__cs_rn" <=`) {
		t.Errorf("offset-only must not emit an upper bound:\n%s", op.SQL)
	}

	// The group must be keyed off the preserved key set, never a row-removing
	// WHERE over the windowed rows.
	if !strings.Contains(op.SQL, `GROUP BY "_root.keys"."__cs_join_key"`) {
		t.Errorf("group must be keyed off the preserved key set:\n%s", op.SQL)
	}

	if strings.Contains(op.SQL, `FROM "_root.windowed" WHERE`) {
		t.Errorf("window must not be applied as a row-removing WHERE:\n%s", op.SQL)
	}

	wantParams := []any{
		[]any{"11111111-1111-1111-1111-111111111111"},
		10, // offset
	}
	if diff := cmp.Diff(wantParams, op.Parameters); diff != "" {
		t.Errorf("offset params mismatch (-want +got):\n%s", diff)
	}
}

// TestBuildGroupedAggregate_NoWindowWithoutLimitOffset asserts the common path
// emits no windowed CTE and reads from the base CTE, so existing queries are
// unaffected.
func TestBuildGroupedAggregate_NoWindowWithoutLimitOffset(t *testing.T) {
	t.Parallel()

	objects := buildObjectsWithUsersTable()
	md := &metadata.DatabaseMetadata{Tables: []metadata.TableMetadata{tableMetaFor("users")}}

	_, groupedAgg, err := queries.BuildRoots(objects, md, &dialect.PostgresDialect{})
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	_, field, fragments := parseSingleField(t, `query {
		_root {
			aggregate { count }
		}
	}`)

	op, err := groupedAgg.BuildGroupedAggregateSQL(groupedaggdispatch.BuildInput{
		TableSchema:       "public",
		TableName:         "users",
		Field:             field,
		Fragments:         fragments,
		Variables:         nil,
		Role:              "admin",
		SessionVariables:  nil,
		JoinColumnSQLName: "id",
		JoinValues:        []any{"11111111-1111-1111-1111-111111111111"},
	})
	if err != nil {
		t.Fatalf("BuildGroupedAggregateSQL: %v", err)
	}

	if strings.Contains(op.SQL, "_root.windowed") {
		t.Errorf("no limit/offset must not emit a windowed CTE:\n%s", op.SQL)
	}

	if !strings.Contains(op.SQL, `FROM "_root.base" GROUP BY "__cs_join_key"`) {
		t.Errorf("outer query must read from base CTE:\n%s", op.SQL)
	}
}

func TestBuildGroupedAggregate_ReservedJoinKeyResponseNameRejected(t *testing.T) {
	t.Parallel()

	objects := buildObjectsWithUsersTable()
	md := &metadata.DatabaseMetadata{Tables: []metadata.TableMetadata{tableMetaFor("users")}}

	_, groupedAgg, err := queries.BuildRoots(objects, md, &dialect.PostgresDialect{})
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	tests := []struct {
		name  string
		query string
	}{
		{
			name: "aggregate alias",
			query: `query {
				_root {
					_join_key: aggregate { count }
				}
			}`,
		},
		{
			name: "nodes alias",
			query: `query {
				_root {
					_join_key: nodes { id }
				}
			}`,
		},
		{
			name: "typename alias",
			query: `query {
				_root {
					_join_key: __typename
				}
			}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			_, field, fragments := parseSingleField(t, tt.query)

			_, err := groupedAgg.BuildGroupedAggregateSQL(groupedaggdispatch.BuildInput{
				TableSchema:       "public",
				TableName:         "users",
				Field:             field,
				Fragments:         fragments,
				Variables:         nil,
				Role:              "admin",
				SessionVariables:  nil,
				JoinColumnSQLName: "id",
				JoinValues:        []any{"11111111-1111-1111-1111-111111111111"},
			})
			if err == nil {
				t.Fatal("expected reserved response-name error, got nil")
			}

			if !strings.Contains(err.Error(), "grouped aggregate response name is reserved") {
				t.Errorf("error should mention reserved response name; got: %v", err)
			}

			if !strings.Contains(err.Error(), groupedaggdispatch.ResultJoinKeyField) {
				t.Errorf("error should name reserved field; got: %v", err)
			}
		})
	}
}

// TestBuildGroupedAggregate_DistinctOnApplied asserts that distinct_on partitions
// the DISTINCT ON by the parent join key so each group is deduplicated
// independently, matching Hasura's per-parent-row distinct_on on a cross-database
// aggregate relationship.
func TestBuildGroupedAggregate_DistinctOnApplied(t *testing.T) {
	t.Parallel()

	objects := buildObjectsWithUsersTable()
	md := &metadata.DatabaseMetadata{Tables: []metadata.TableMetadata{tableMetaFor("users")}}

	_, groupedAgg, err := queries.BuildRoots(objects, md, &dialect.PostgresDialect{})
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	_, field, fragments := parseSingleField(t, `query {
		_root(distinct_on: [id]) {
			aggregate { count }
			nodes { id }
		}
	}`)

	op, err := groupedAgg.BuildGroupedAggregateSQL(groupedaggdispatch.BuildInput{
		TableSchema:       "public",
		TableName:         "users",
		Field:             field,
		Fragments:         fragments,
		Variables:         nil,
		Role:              "admin",
		SessionVariables:  nil,
		JoinColumnSQLName: "id",
		JoinValues:        []any{"11111111-1111-1111-1111-111111111111"},
	})
	if err != nil {
		t.Fatalf("BuildGroupedAggregateSQL: %v", err)
	}

	// DISTINCT ON must lead with the join key so the distinct is per group, and
	// the CTE ORDER BY must lead with the join key to resolve the tiebreak.
	wantDistinct := `DISTINCT ON ("__cs_join_key", "id")`
	if !strings.Contains(op.SQL, wantDistinct) {
		t.Errorf("SQL missing %q:\n%s", wantDistinct, op.SQL)
	}

	wantOrder := `ORDER BY "__cs_join_key"`
	if !strings.Contains(op.SQL, wantOrder) {
		t.Errorf("SQL missing CTE %q:\n%s", wantOrder, op.SQL)
	}
}

// TestBuildGroupedAggregate_OrderByApplied asserts that order_by orders the
// per-group nodes inside the json_agg (the GROUP BY discards the CTE row order)
// without reshaping the aggregated row set, matching Hasura.
func TestBuildGroupedAggregate_OrderByApplied(t *testing.T) {
	t.Parallel()

	objects := buildObjectsWithUsersTable()
	md := &metadata.DatabaseMetadata{Tables: []metadata.TableMetadata{tableMetaFor("users")}}

	_, groupedAgg, err := queries.BuildRoots(objects, md, &dialect.PostgresDialect{})
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	_, field, fragments := parseSingleField(t, `query {
		_root(order_by: { id: desc }) {
			aggregate { count }
			nodes { id }
		}
	}`)

	op, err := groupedAgg.BuildGroupedAggregateSQL(groupedaggdispatch.BuildInput{
		TableSchema:       "public",
		TableName:         "users",
		Field:             field,
		Fragments:         fragments,
		Variables:         nil,
		Role:              "admin",
		SessionVariables:  nil,
		JoinColumnSQLName: "id",
		JoinValues:        []any{"11111111-1111-1111-1111-111111111111"},
	})
	if err != nil {
		t.Fatalf("BuildGroupedAggregateSQL: %v", err)
	}

	// order_by-only does not touch the CTE: no DISTINCT ON, and the ordering is
	// applied inside the nodes json_agg against the base CTE alias.
	if strings.Contains(op.SQL, "DISTINCT ON") {
		t.Errorf("order_by-only must not emit DISTINCT ON:\n%s", op.SQL)
	}

	wantNodesOrder := `ORDER BY "_root.base"."id" DESC`
	if !strings.Contains(op.SQL, wantNodesOrder) {
		t.Errorf("SQL missing nodes %q:\n%s", wantNodesOrder, op.SQL)
	}
}

// TestBuildGroupedAggregate_RelationshipOrderByRejected asserts that ordering a
// cross-database aggregate by a nested relationship is rejected: such terms
// render correlated subqueries that cannot be threaded into the grouped build.
func TestBuildGroupedAggregate_RelationshipOrderByRejected(t *testing.T) {
	t.Parallel()

	objects := buildObjectsWithUsersAndOrders()
	md := &metadata.DatabaseMetadata{
		Tables: []metadata.TableMetadata{
			tableMetaFor("users"),
			{
				Table: metadata.TableSource{Schema: "public", Name: "orders"},
				ObjectRelationships: []metadata.ObjectRelationship{
					{
						Name: "user",
						Using: metadata.RelationshipUsing{
							ForeignKeyColumns: []string{"user_id"},
						},
					},
				},
			},
		},
	}

	_, groupedAgg, err := queries.BuildRoots(objects, md, &dialect.PostgresDialect{})
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	_, field, fragments := parseSingleField(t, `query {
		_root(order_by: { user: { id: asc } }) {
			aggregate { count }
		}
	}`)

	_, err = groupedAgg.BuildGroupedAggregateSQL(groupedaggdispatch.BuildInput{
		TableSchema:       "public",
		TableName:         "orders",
		Field:             field,
		Fragments:         fragments,
		Variables:         nil,
		Role:              "admin",
		SessionVariables:  nil,
		JoinColumnSQLName: "user_id",
		JoinValues:        []any{"11111111-1111-1111-1111-111111111111"},
	})
	if !errors.Is(err, queries.ErrGroupedAggregateRelationshipOrderBy) {
		t.Fatalf("expected ErrGroupedAggregateRelationshipOrderBy, got %v", err)
	}
}

// TestBuildGroupedAggregate_DistinctOnUnsupportedDialect asserts that distinct_on
// is rejected on a dialect without DISTINCT ON (SQLite). The schema does not
// advertise distinct_on there, so this is a defensive guard.
func TestBuildGroupedAggregate_DistinctOnUnsupportedDialect(t *testing.T) {
	t.Parallel()

	objects := buildObjectsWithUsersTable()
	md := &metadata.DatabaseMetadata{Tables: []metadata.TableMetadata{tableMetaFor("users")}}

	_, groupedAgg, err := queries.BuildRoots(objects, md, &dialect.SQLiteDialect{})
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	_, field, fragments := parseSingleField(t, `query {
		_root(distinct_on: [id]) {
			aggregate { count }
		}
	}`)

	_, err = groupedAgg.BuildGroupedAggregateSQL(groupedaggdispatch.BuildInput{
		TableSchema:       "public",
		TableName:         "users",
		Field:             field,
		Fragments:         fragments,
		Variables:         nil,
		Role:              "admin",
		SessionVariables:  nil,
		JoinColumnSQLName: "id",
		JoinValues:        []any{"11111111-1111-1111-1111-111111111111"},
	})
	if !errors.Is(err, queries.ErrGroupedAggregateDistinctOnUnsupported) {
		t.Fatalf("expected ErrGroupedAggregateDistinctOnUnsupported, got %v", err)
	}
}

func TestBuildGroupedAggregateValidationErrorPath(t *testing.T) {
	t.Parallel()

	objects := buildObjectsWithUsersAndOrders()
	md := &metadata.DatabaseMetadata{Tables: []metadata.TableMetadata{tableMetaFor("orders")}}

	_, groupedAgg, err := queries.BuildRoots(objects, md, &dialect.PostgresDialect{})
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	_, field, fragments := parseSingleField(t, `query {
		_root(distinct_on: id, order_by: { user_id: asc }) {
			aggregate { count }
		}
	}`)

	_, err = groupedAgg.BuildGroupedAggregateSQL(groupedaggdispatch.BuildInput{
		TableSchema:       "public",
		TableName:         "orders",
		Field:             field,
		ArgumentPath:      "users.selectionSet.ordersAgg",
		Fragments:         fragments,
		Variables:         nil,
		Role:              "admin",
		SessionVariables:  nil,
		JoinColumnSQLName: "user_id",
		JoinValues:        []any{"11111111-1111-1111-1111-111111111111"},
	})
	if !errors.Is(err, arguments.ErrDistinctOnOrderByMismatch) {
		t.Fatalf("expected ErrDistinctOnOrderByMismatch, got %v", err)
	}

	assertValidationPath(
		t,
		err,
		"$.selectionSet.users.selectionSet.ordersAgg.args",
	)
}

func TestBuildGroupedAggregate_NestedRelationshipsRejected(t *testing.T) {
	t.Parallel()

	objects := buildObjectsWithUsersAndOrders()
	md := &metadata.DatabaseMetadata{
		Tables: []metadata.TableMetadata{
			tableMetaFor("users"),
			{
				Table: metadata.TableSource{Schema: "public", Name: "orders"},
				ObjectRelationships: []metadata.ObjectRelationship{
					{
						Name: "user",
						Using: metadata.RelationshipUsing{
							ForeignKeyColumns: []string{"user_id"},
						},
					},
				},
			},
		},
	}

	_, groupedAgg, err := queries.BuildRoots(objects, md, &dialect.PostgresDialect{})
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	_, field, fragments := parseSingleField(t, `query {
		_root {
			nodes { id user { id } }
		}
	}`)

	_, err = groupedAgg.BuildGroupedAggregateSQL(groupedaggdispatch.BuildInput{
		TableSchema:       "public",
		TableName:         "orders",
		Field:             field,
		Fragments:         fragments,
		Variables:         nil,
		Role:              "admin",
		SessionVariables:  nil,
		JoinColumnSQLName: "user_id",
		JoinValues:        []any{"11111111-1111-1111-1111-111111111111"},
	})
	if err == nil {
		t.Fatal("expected nested-relationships error, got nil")
	}

	if !strings.Contains(err.Error(), "nested relationships") {
		t.Errorf("error should mention nested relationships; got: %v", err)
	}
}

func TestBuildGroupedAggregate_TableNotRegistered(t *testing.T) {
	t.Parallel()

	objects := buildObjectsWithUsersTable()
	md := &metadata.DatabaseMetadata{Tables: []metadata.TableMetadata{tableMetaFor("users")}}

	_, groupedAgg, err := queries.BuildRoots(objects, md, &dialect.PostgresDialect{})
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	_, field, fragments := parseSingleField(t, `query {
		_root { aggregate { count } }
	}`)

	_, err = groupedAgg.BuildGroupedAggregateSQL(groupedaggdispatch.BuildInput{
		TableSchema:       "public",
		TableName:         "orders", // not registered
		Field:             field,
		Fragments:         fragments,
		Variables:         nil,
		Role:              "admin",
		SessionVariables:  nil,
		JoinColumnSQLName: "id",
		JoinValues:        []any{"11111111-1111-1111-1111-111111111111"},
	})
	if err == nil {
		t.Fatal("expected table-not-registered error, got nil")
	}

	if !strings.Contains(err.Error(), "public.orders") {
		t.Errorf("error should name the missing table; got: %v", err)
	}
}

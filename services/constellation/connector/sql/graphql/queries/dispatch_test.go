package queries_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
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

	op, _, _ := parseSingleField(t,
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

func TestBuildGroupedAggregate_LimitRejected(t *testing.T) {
	t.Parallel()

	objects := buildObjectsWithUsersTable()
	md := &metadata.DatabaseMetadata{Tables: []metadata.TableMetadata{tableMetaFor("users")}}

	_, groupedAgg, err := queries.BuildRoots(objects, md, &dialect.PostgresDialect{})
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	_, field, fragments := parseSingleField(t, `query {
		_root(limit: 5) {
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
	if !errors.Is(err, queries.ErrGroupedAggregateLimitOffsetUnsupported) {
		t.Fatalf("expected ErrGroupedAggregateLimitOffsetUnsupported, got %v", err)
	}
}

func TestBuildGroupedAggregate_OffsetRejected(t *testing.T) {
	t.Parallel()

	objects := buildObjectsWithUsersTable()
	md := &metadata.DatabaseMetadata{Tables: []metadata.TableMetadata{tableMetaFor("users")}}

	_, groupedAgg, err := queries.BuildRoots(objects, md, &dialect.PostgresDialect{})
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	_, field, fragments := parseSingleField(t, `query {
		_root(offset: 10) {
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
	if !errors.Is(err, queries.ErrGroupedAggregateLimitOffsetUnsupported) {
		t.Fatalf("expected ErrGroupedAggregateLimitOffsetUnsupported, got %v", err)
	}
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

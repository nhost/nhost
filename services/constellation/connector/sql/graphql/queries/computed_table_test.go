package queries_test

import (
	"encoding/json"
	"errors"
	"reflect"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	groupedagg "github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/groupedaggregate"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/multiplexed"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func extendComputedTableFixture(ddl []byte, md *metadata.DatabaseMetadata) []byte {
	ddl = append(ddl, []byte(`
CREATE FUNCTION cf_select.tag_session(tag cf_select.tags, session jsonb) RETURNS text LANGUAGE sql STABLE
AS $$ SELECT tag.label || ':' || (session->>'x-hasura-user-id') $$;
CREATE FUNCTION cf_select.tag_parent(tag cf_select.tags) RETURNS SETOF cf_select.items LANGUAGE sql STABLE
AS $$ SELECT i.id, i.owner_id, i.label, i.amount, i.payload FROM cf_select.items i WHERE i.id = tag.item_id $$;
CREATE FUNCTION cf_select.item_tags_with_args(item cf_select.items, needle text DEFAULT '', session jsonb DEFAULT '{}')
RETURNS SETOF cf_select.tags LANGUAGE sql STABLE AS $$
    SELECT t.id, t.item_id, t.label FROM cf_select.tags t WHERE t.item_id = item.id
    AND t.label LIKE needle || '%' AND session->>'x-hasura-user-id' = 'reader'
    ORDER BY t.id
$$;
CREATE FUNCTION cf_select.item_tags_for_session(item cf_select.items, session jsonb)
RETURNS SETOF cf_select.tags LANGUAGE sql STABLE AS $$
    SELECT t.id, t.item_id, t.label FROM cf_select.tags t
    WHERE t.item_id = item.id AND t.label = session->>'x-hasura-tag-label'
$$;
CREATE FUNCTION cf_select.item_tags_error(item cf_select.items) RETURNS SETOF cf_select.tags
LANGUAGE sql STABLE AS $$ SELECT t.id, t.item_id, t.label FROM cf_select.tags t WHERE t.item_id = 1 AND 1 / (item.id - 1) > 0 $$;
CREATE FUNCTION cf_select.item_tags_null(item cf_select.items) RETURNS SETOF cf_select.tags
LANGUAGE sql STABLE AS $$ SELECT NULL::cf_select.tags WHERE item.id = 1 $$;
`)...)
	md.Tables[0].ComputedFields = append(
		md.Tables[0].ComputedFields,
		metadata.ComputedField{
			Name: "item_tags_with_args",
			Definition: metadata.ComputedFieldDefinition{
				Function: metadata.FunctionSource{
					Schema: "cf_select",
					Name:   "item_tags_with_args",
				},
				SessionArgument: "session",
			},
		},
		metadata.ComputedField{
			Name: "item_tags_for_session",
			Definition: metadata.ComputedFieldDefinition{
				Function: metadata.FunctionSource{
					Schema: "cf_select",
					Name:   "item_tags_for_session",
				},
				SessionArgument: "session",
			},
		},
		metadata.ComputedField{
			Name: "item_tags_error",
			Definition: metadata.ComputedFieldDefinition{
				Function: metadata.FunctionSource{Schema: "cf_select", Name: "item_tags_error"},
			},
		},
		metadata.ComputedField{Name: "item_tags_null", Definition: metadata.ComputedFieldDefinition{
			Function: metadata.FunctionSource{Schema: "cf_select", Name: "item_tags_null"},
		}},
	)
	md.Tables[1].ComputedFields = append(md.Tables[1].ComputedFields,
		metadata.ComputedField{Name: "tag_session", Definition: metadata.ComputedFieldDefinition{
			Function: metadata.FunctionSource{
				Schema: "cf_select",
				Name:   "tag_session",
			},
			SessionArgument: "session",
		}},
		metadata.ComputedField{Name: "tag_parent", Definition: metadata.ComputedFieldDefinition{
			Function: metadata.FunctionSource{Schema: "cf_select", Name: "tag_parent"},
		}},
	)
	md.Tables[1].SelectPermissions[0].Permission.ComputedFields = append(
		md.Tables[1].SelectPermissions[0].Permission.ComputedFields, "tag_session",
	)

	return ddl
}

func computedTableRoots(
	t *testing.T,
	objects *introspection.Objects,
	md *metadata.DatabaseMetadata,
) queries.Roots {
	t.Helper()

	caps := schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect())
	caps.SupportsComputedTableSelection = true

	roots, _, err := queries.BuildRoots(objects, md, dialect.NewPostgresDialect(), caps)
	if err != nil {
		t.Fatal(err)
	}

	return roots
}

func computedTableOperation(
	t *testing.T,
	roots queries.Roots,
	query, role string,
	session map[string]any,
) core.SQLOperation {
	t.Helper()

	doc, err := parser.ParseQuery(&ast.Source{Input: query})
	if err != nil {
		t.Fatal(err)
	}

	ops, err := roots.BuildQuery(doc.Operations[0], doc.Fragments, nil, role, session)
	if err != nil {
		t.Fatal(err)
	}

	if len(ops) != 1 {
		t.Fatalf("operations: %d", len(ops))
	}

	return ops[0]
}

//nolint:paralleltest,tparallel,cyclop // Subtests share a fixture whose target permission changes after query cases.
func TestComputedTableSelectionAndPermissions(t *testing.T) {
	t.Parallel()
	_, pool, objects, md, _ := computedTestFixture(t)
	roots := computedTableRoots(t, objects, md)

	for _, role := range []struct {
		name, field string
	}{
		{"admin", "[cf_select_tags!]"},
		{"cf_reader", "[cf_select_tags!]"},
		{"cf_no_grant", ""},
	} {
		t.Run(role.name, func(t *testing.T) {
			caps := schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect())
			caps.SupportsComputedTableSelection = true

			s, err := schema.GenerateForRole(objects, role.name, md, caps)
			if err != nil {
				t.Fatal(err)
			}

			typeField := s.ToAST().Definitions.ForName(
				"cf_select_items",
			).Fields.ForName(
				"item_tags",
			)
			if role.field == "" {
				if typeField != nil {
					t.Fatal("ungranted target exposed table field")
				}

				return
			}

			if typeField == nil || typeField.Type.String() != role.field ||
				typeField.Arguments.ForName("where") == nil ||
				typeField.Arguments.ForName("distinct_on") == nil {
				t.Fatalf("table field = %#v", typeField)
			}

			if s.ToAST().Definitions.ForName(
				"cf_select_items",
			).Fields.ForName(
				"item_tags_aggregate",
			) != nil {
				t.Fatal("Hasura has no computed table aggregate sibling")
			}
		})
	}

	cases := []struct {
		name, query string
		want        any
	}{
		{
			"collection",
			`query { cf_select_items(order_by:{id:asc}) { id item_tags(order_by:{id:desc},limit:1) { label } } }`,
			[]any{
				map[string]any{
					"id":        float64(1),
					"item_tags": []any{map[string]any{"label": "two"}},
				},
				map[string]any{
					"id":        float64(2),
					"item_tags": []any{map[string]any{"label": "three"}},
				},
			},
		},
		{
			"target filter",
			`query { cf_select_items_by_pk(id:1) { item_tags(where:{label:{_eq:"one"}},distinct_on:[item_id],order_by:[{item_id:asc},{id:asc}],offset:0) { id label } } }`,
			map[string]any{"item_tags": []any{map[string]any{"id": float64(1), "label": "one"}}},
		},
		{
			"empty",
			`query { cf_select_items_by_pk(id:2) { item_tags(where:{label:{_eq:"missing"}}) { id } } }`,
			map[string]any{"item_tags": []any{}},
		},
		{
			"relationship",
			`query { cf_select_tags(where:{id:{_eq:1}}) { item { item_tags { id } } } }`,
			[]any{
				map[string]any{
					"item": map[string]any{
						"item_tags": []any{
							map[string]any{"id": float64(1)},
							map[string]any{"id": float64(2)},
						},
					},
				},
			},
		},
		{
			"function rows",
			`query { items_from_function(where:{id:{_eq:1}}) { item_tags { id } } }`,
			[]any{
				map[string]any{
					"item_tags": []any{
						map[string]any{"id": float64(1)},
						map[string]any{"id": float64(2)},
					},
				},
			},
		},
		{
			"aggregate nodes",
			`query { cf_select_items_aggregate(where:{id:{_eq:1}}) { nodes { item_tags { id } } } }`,
			map[string]any{
				"nodes": []any{
					map[string]any{
						"item_tags": []any{
							map[string]any{"id": float64(1)},
							map[string]any{"id": float64(2)},
						},
					},
				},
			},
		},
		{
			"two aliases",
			`query { cf_select_items_by_pk(id:1) { first: item_tags(where:{id:{_eq:1}}) { id } second: item_tags(where:{id:{_eq:2}}) { id } } }`,
			map[string]any{
				"first":  []any{map[string]any{"id": float64(1)}},
				"second": []any{map[string]any{"id": float64(2)}},
			},
		},
		{
			"merged selections",
			`query { cf_select_items_by_pk(id:1) { item_tags(order_by:{id:asc}) { id } item_tags(order_by:{id:asc}) { label } } }`,
			map[string]any{"item_tags": []any{
				map[string]any{"id": float64(1), "label": "one"},
				map[string]any{"id": float64(2), "label": "two"},
			}},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			op := computedTableOperation(t, roots, tc.query, "cf_reader", nil)
			if !strings.Contains(op.SQL, `"cf_select"."item_tags"`) {
				t.Fatalf("not correlated to computed function: %s", op.SQL)
			}

			if got := computedResult(t, pool, op); !reflect.DeepEqual(got, tc.want) {
				t.Errorf("result: %#v\nwant: %#v\nSQL: %s", got, tc.want, op.SQL)
			}
		})
	}

	doc, err := parser.ParseQuery(
		&ast.Source{Input: `query { cf_select_items { item_tags { id } } }`},
	)
	if err != nil {
		t.Fatal(err)
	}

	if _, err := roots.BuildQuery(
		doc.Operations[0],
		doc.Fragments,
		nil,
		"cf_no_grant",
		nil,
	); err == nil {
		t.Fatal("ungranted target computed selection executed for denied role")
	}

	// Target select permissions must filter function-returned rows, not only
	// restrict which GraphQL fields can be selected.
	md.Tables[1].SelectPermissions[0].Permission.Filter = map[string]any{
		"label": map[string]any{"_eq": "one"},
	}
	filtered := computedTableRoots(t, objects, md)
	op := computedTableOperation(
		t,
		filtered,
		`query { cf_select_items(where:{id:{_eq:1}}) { item_tags { id } } }`,
		"cf_reader",
		nil,
	)

	want := []any{map[string]any{"item_tags": []any{map[string]any{"id": float64(1)}}}}
	if got := computedResult(t, pool, op); !reflect.DeepEqual(got, want) {
		t.Errorf("target permission: %#v, want %#v\n%s", got, want, op.SQL)
	}
}

// Target scalar predicates, nested table rows, and session/user argument
// placeholders all execute against the same correlated function result.
//
//nolint:paralleltest,tparallel // Target column permissions change after the query cases on the shared fixture.
func TestComputedTableNestedModifiersAndArguments(t *testing.T) {
	t.Parallel()
	_, pool, objects, md, _ := computedTestFixture(t, true, true)
	roots := computedTableRoots(t, objects, md)
	caps := schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect())
	caps.SupportsComputedTableSelection = true

	s, err := schema.GenerateForRole(objects, "cf_reader", md, caps)
	if err != nil {
		t.Fatal(err)
	}

	item := s.ToAST().Definitions.ForName("cf_select_items")

	args := item.Fields.ForName("item_tags_with_args").Arguments.ForName("args")
	if args == nil || args.Type.String() != "item_tags_with_args_cf_select_items_args" ||
		s.ToAST().Definitions.ForName("cf_select_tags").Fields.ForName("tag_parent") == nil {
		t.Fatalf("table args/nesting missing: %#v", args)
	}

	for _, tc := range []struct {
		name, query string
		want        any
	}{
		{
			"nested scalar session filter", `query { cf_select_items(where:{id:{_eq:1}}) { item_tags_with_args(args:{needle:"t"},where:{tag_session:{_eq:"two:reader"}},order_by:{tag_session:desc},limit:1) { id tag_parent { id item_tags(where:{label:{_eq:"one"}}) { id } } } } }`,
			[]any{map[string]any{"item_tags_with_args": []any{map[string]any{"id": float64(2), "tag_parent": []any{map[string]any{"id": float64(1), "item_tags": []any{map[string]any{"id": float64(1)}}}}}}}},
		},
		{
			"empty from function", `query { cf_select_items(where:{id:{_eq:1}}) { item_tags_with_args(args:{needle:"missing"}) { id } } }`,
			[]any{map[string]any{"item_tags_with_args": []any{}}},
		},
		{
			"null composite from function", `query { cf_select_items_by_pk(id:1) { item_tags_null { id } } }`,
			map[string]any{"item_tags_null": []any{map[string]any{"id": nil}}},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			op := computedTableOperation(
				t,
				roots,
				tc.query,
				"cf_reader",
				map[string]any{"x-hasura-user-id": "reader"},
			)
			if strings.Contains(op.SQL, "two:reader") || strings.Contains(op.SQL, "missing") {
				t.Fatalf("client input interpolated: %s", op.SQL)
			}

			if got := computedResult(t, pool, op); !reflect.DeepEqual(got, tc.want) {
				t.Errorf(
					"result: %#v, want %#v\nSQL: %s\nparameters: %#v",
					got,
					tc.want,
					op.SQL,
					op.Parameters,
				)
			}
		})
	}

	// The target's select filter can itself call a scalar computed function
	// with a session argument against the returned (not the base) row.
	md.Tables[1].SelectPermissions[0].Permission.Filter = map[string]any{
		"tag_session": map[string]any{"_eq": "one:reader"},
	}
	filtered := computedTableRoots(t, objects, md)
	op := computedTableOperation(t, filtered,
		`query { cf_select_items_by_pk(id:1) { item_tags { id } } }`,
		"cf_reader", map[string]any{"x-hasura-user-id": "reader"})

	want := map[string]any{"item_tags": []any{map[string]any{"id": float64(1)}}}
	if got := computedResult(t, pool, op); !reflect.DeepEqual(got, want) {
		t.Fatalf("target computed permission: %#v, want %#v\nSQL: %s", got, want, op.SQL)
	}

	// Restricting the target's columns changes the returned object schema even
	// though the parent function continues to return the physical complete row.
	md.Tables[1].SelectPermissions[0].Permission.Columns = []string{"id"}

	s, err = schema.GenerateForRole(objects, "cf_reader", md, caps)
	if err != nil {
		t.Fatal(err)
	}

	if s.ToAST().Definitions.ForName("cf_select_tags").Fields.ForName("label") != nil {
		t.Fatal("target column permission bypass")
	}
}

func TestComputedTableGroupedAggregateNodes(t *testing.T) {
	t.Parallel()
	_, pool, objects, md, _ := computedTestFixture(t)
	caps := schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect())
	caps.SupportsComputedTableSelection = true

	_, grouped, err := queries.BuildRoots(objects, md, dialect.NewPostgresDialect(), caps)
	if err != nil {
		t.Fatal(err)
	}

	doc, err := parser.ParseQuery(
		&ast.Source{Input: `query { _root { nodes { item_tags(order_by:{id:asc}) { id } } } }`},
	)
	if err != nil {
		t.Fatal(err)
	}

	field, ok := doc.Operations[0].SelectionSet[0].(*ast.Field)
	if !ok {
		t.Fatalf("aggregate selection is %T, want field", doc.Operations[0].SelectionSet[0])
	}

	op, err := grouped.BuildGroupedAggregateSQL(groupedagg.BuildInput{
		TableSchema: "cf_select", TableName: "items", Field: field,
		Fragments: doc.Fragments, Variables: nil, Role: "cf_reader", SessionVariables: nil,
		JoinColumnSQLName: "id", JoinValues: []any{1, 2, 99},
	})
	if err != nil {
		t.Fatal(err)
	}

	got := computedResult(t, pool, op)
	if !strings.Contains(op.SQL, `"cf_select"."item_tags"`) {
		t.Fatalf("grouped node lost table function: %s", op.SQL)
	}

	want := map[any]any{
		float64(1): []any{
			map[string]any{
				"item_tags": []any{
					map[string]any{"id": float64(1)},
					map[string]any{"id": float64(2)},
				},
			},
		},
		float64(2):  []any{map[string]any{"item_tags": []any{map[string]any{"id": float64(3)}}}},
		float64(99): []any{},
	}

	groups, ok := got.([]any)
	if !ok || len(groups) != len(want) {
		t.Fatalf("groups = %#v", got)
	}

	for _, group := range groups {
		row, ok := group.(map[string]any)
		if !ok {
			t.Fatalf("group is %T, want object", group)
		}

		if !reflect.DeepEqual(row["nodes"], want[row["_join_key"]]) {
			t.Errorf(
				"group %v nodes = %#v, want %#v",
				row["_join_key"],
				row["nodes"],
				want[row["_join_key"]],
			)
		}
	}
}

//nolint:paralleltest // Keep the added testdb pool serial under default package parallelism.
func TestComputedTableGroupedAggregateInputs(t *testing.T) {
	_, pool, objects, md, _ := computedTestFixture(t)
	caps := schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect())

	_, grouped, err := queries.BuildRoots(objects, md, dialect.NewPostgresDialect(), caps)
	if err != nil {
		t.Fatal(err)
	}

	doc, err := parser.ParseQuery(&ast.Source{Input: `query {
		_root(where:{item_tags:{id:{_eq:3}}},order_by:{item_tags_aggregate:{count:desc}}) {
			nodes { id }
		}
	}`})
	if err != nil {
		t.Fatal(err)
	}

	field, ok := doc.Operations[0].SelectionSet[0].(*ast.Field)
	if !ok {
		t.Fatalf("aggregate field: %T", doc.Operations[0].SelectionSet[0])
	}

	op, err := grouped.BuildGroupedAggregateSQL(groupedagg.BuildInput{
		TableSchema: "cf_select", TableName: "items", Field: field,
		Fragments: doc.Fragments, Role: "cf_reader", JoinColumnSQLName: "id",
		JoinValues: []any{1, 2},
	})
	if err != nil {
		t.Fatal(err)
	}

	got := computedResult(t, pool, op)

	want := []any{
		map[string]any{"_join_key": float64(1), "nodes": []any{}},
		map[string]any{"_join_key": float64(2), "nodes": []any{map[string]any{"id": float64(2)}}},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("grouped computed input: got %#v want %#v; SQL %s", got, want, op.SQL)
	}

	// Place both items in one grouped CTE so aggregate ordering actually
	// compares their target-filtered counts rather than single-row groups.
	if _, err := pool.Exec(
		t.Context(),
		`UPDATE cf_select.items SET owner_id=1 WHERE id=2`,
	); err != nil {
		t.Fatal(err)
	}

	md.Tables[1].SelectPermissions[0].Permission.Filter = map[string]any{
		"label": map[string]any{"_eq": "three"},
	}

	_, grouped, err = queries.BuildRoots(objects, md, dialect.NewPostgresDialect(), caps)
	if err != nil {
		t.Fatal(err)
	}

	doc, err = parser.ParseQuery(&ast.Source{Input: `query {
		_root(order_by:[{item_tags_aggregate:{count:desc}},{id:asc}]) { nodes { id } }
	}`})
	if err != nil {
		t.Fatal(err)
	}

	field, ok = doc.Operations[0].SelectionSet[0].(*ast.Field)
	if !ok {
		t.Fatalf("aggregate field: %T", doc.Operations[0].SelectionSet[0])
	}

	for _, tc := range []struct {
		role string
		ids  []any
	}{
		{"cf_reader", []any{map[string]any{"id": float64(2)}, map[string]any{"id": float64(1)}}},
		{"admin", []any{map[string]any{"id": float64(1)}, map[string]any{"id": float64(2)}}},
	} {
		op, err := grouped.BuildGroupedAggregateSQL(groupedagg.BuildInput{
			TableSchema: "cf_select", TableName: "items", Field: field,
			Fragments: doc.Fragments, Role: tc.role, JoinColumnSQLName: "owner_id",
			JoinValues: []any{1},
		})
		if err != nil {
			t.Fatal(err)
		}

		want := []any{map[string]any{"_join_key": float64(1), "nodes": tc.ids}}
		if got := computedResult(t, pool, op); !reflect.DeepEqual(got, want) {
			t.Fatalf(
				"%s grouped target-filtered order: got %#v want %#v; SQL %s",
				tc.role,
				got,
				want,
				op.SQL,
			)
		}
	}
}

//nolint:paralleltest,tparallel // Mutations update the same isolated fixture and must run in input order.
func TestComputedTableReturningAndErrors(t *testing.T) {
	t.Parallel()
	_, pool, objects, md, _ := computedTestFixture(t, true, true)

	roots := computedTableRoots(t, objects, md)
	for _, tc := range []struct {
		name, query string
		want        any
	}{
		{
			"update by pk", `mutation { update_cf_select_items_by_pk(pk_columns:{id:1},_set:{label:"updated"}) { item_tags(order_by:{id:asc}) { label } } }`,
			map[string]any{"item_tags": []any{map[string]any{"label": "one"}, map[string]any{"label": "two"}}},
		},
		{
			"update returning", `mutation { update_cf_select_items(where:{id:{_eq:1}},_set:{label:"updated"}) { returning { item_tags(limit:1,order_by:{id:desc}) { id } } } }`,
			map[string]any{"returning": []any{map[string]any{"item_tags": []any{map[string]any{"id": float64(2)}}}}},
		},
		{
			"insert returning", `mutation { insert_cf_select_items_one(object:{id:10,owner_id:1,label:"new",amount:1,payload:{},tags:{data:[{id:10,label:"linked"}]}}) { item_tags { id } } }`,
			map[string]any{"item_tags": []any{map[string]any{"id": float64(10)}}},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			op := computedTableOperation(t, roots, tc.query, "admin", nil)
			if got := computedResult(t, pool, op); !reflect.DeepEqual(got, tc.want) {
				t.Errorf("returning: %#v, want %#v\nSQL: %s", got, tc.want, op.SQL)
			}
		})
	}

	op := computedTableOperation(
		t,
		roots,
		`query { cf_select_items_by_pk(id:1) { item_tags_error { id } } }`,
		"cf_reader",
		nil,
	)

	var raw []byte

	err := pool.QueryRow(t.Context(), op.SQL, op.Parameters...).Scan(&raw)

	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "22012" {
		t.Fatalf("computed table function error = %v, want division by zero", err)
	}
}

//nolint:gocognit // Live and stream cohorts share one typed-session fixture and assert isolated nested results.
func TestComputedTableSubscriptionCohorts(t *testing.T) {
	t.Parallel()
	_, pool, objects, md, _ := computedTestFixture(t, true, true)

	roots := computedTableRoots(t, objects, md)
	for _, tc := range []struct {
		name, query string
		cursor      map[string]any
	}{
		{"live", `subscription { cf_select_items(where:{id:{_eq:1}}) { item_tags_with_args(where:{tag_session:{_eq:"one:reader"}}) { id tag_session } } }`, nil},
		{"stream", `subscription { cf_select_items_stream(batch_size:1,cursor:[{initial_value:{id:0}}],where:{id:{_eq:1}}) { item_tags_with_args(where:{tag_session:{_eq:"one:reader"}}) { id tag_session } } }`, map[string]any{"id": 0}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			op := computedTableOperation(t, roots, tc.query, "cf_reader", map[string]any{
				"x-hasura-role": "cf_reader", "x-hasura-user-id": "template",
			})
			params := multiplexed.PrepareParams([]string{"sub-a", "sub-b"}, map[string][]any{
				"x-hasura-role": {
					"cf_reader",
					"cf_reader",
				},
				"x-hasura-user-id": {"reader", "other"},
			}, tc.cursor)
			params = append(params, op.Parameters...)

			rows, err := pool.Query(t.Context(), op.SQL, params...)
			if err != nil {
				t.Fatalf("multiplex: %v\n%s", err, op.SQL)
			}
			defer rows.Close()

			got := map[string][]any{}
			for rows.Next() {
				var (
					id  string
					raw []byte
				)
				if err := rows.Scan(&id, &raw); err != nil {
					t.Fatal(err)
				}

				var payload map[string][]map[string]any
				if err := json.Unmarshal(raw, &payload); err != nil {
					t.Fatal(err)
				}

				name := "cf_select_items"
				if tc.name == "stream" {
					name += "_stream"
				}

				if len(payload[name]) != 1 {
					t.Fatalf("%s: %s", id, raw)
				}

				tags, ok := payload[name][0]["item_tags_with_args"].([]any)
				if !ok {
					t.Fatalf("%s: computed tags are not an array: %s", id, raw)
				}

				got[id] = tags
			}

			if err := rows.Err(); err != nil {
				t.Fatal(err)
			}

			if !reflect.DeepEqual(
				got["sub-a"],
				[]any{map[string]any{"id": float64(1), "tag_session": "one:reader"}},
			) ||
				len(got["sub-b"]) != 0 {
				t.Fatalf("cohorts = %#v\nSQL: %s", got, op.SQL)
			}
		})
	}
}

func TestComputedTableTargetPermissionSQL(t *testing.T) {
	t.Parallel()
	_, pool, objects, md, _ := computedTestFixture(t)
	md.Tables[1].SelectPermissions[0].Permission.Filter = map[string]any{
		"label": map[string]any{"_eq": "x-hasura-tag-label"},
	}
	roots := computedTableRoots(t, objects, md)
	op := computedTableOperation(
		t,
		roots,
		`query { cf_select_items(where:{id:{_eq:1}}) { item_tags(order_by:{id:asc},where:{id:{_gt:0}}) { id } } }`,
		"cf_reader",
		map[string]any{"x-hasura-tag-label": "two"},
	)

	path := "testdata/" + t.Name() + ".json"
	if *updateGolden {
		updateGoldenFile(t, []core.SQLOperation{op}, path)
	}

	var expected []core.SQLOperation
	getData(t, path, &expected)

	got := []core.SQLOperation{op}

	normalize(expected)
	normalize(got)

	if diff := cmp.Diff(expected, got, cmpopts.EquateEmpty()); diff != "" {
		t.Errorf("target permission SQL (-want +got):\n%s", diff)
	}

	want := []any{map[string]any{"item_tags": []any{map[string]any{"id": float64(2)}}}}
	if result := computedResult(t, pool, op); !reflect.DeepEqual(result, want) {
		t.Errorf("filtered table result: %#v, want %#v", result, want)
	}
}

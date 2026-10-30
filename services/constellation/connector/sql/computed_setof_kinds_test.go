package sql_test

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/nhost/nhost/services/constellation/connector/groupedaggregate"
	csql "github.com/nhost/nhost/services/constellation/connector/sql"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/metadata"
)

type computedSetofKind struct {
	name, sqlType, expression, gqlType, one, comparison, aggregate string
}

//nolint:cyclop // The isolated fixture installs additional operands only for the int4 aggregate matrix.
func computedSetofKindConnector(
	t *testing.T,
	kind computedSetofKind,
) (*csql.Connector, func(int) int) {
	t.Helper()

	fixture := computedTestDB(t)
	if kind.name == "citext" {
		var installed bool
		if err := fixture.QueryRow(
			t.Context(), `SELECT EXISTS(SELECT 1 FROM pg_available_extensions WHERE name='citext')`,
		).Scan(&installed); err != nil {
			t.Fatal(err)
		}

		if !installed {
			t.Skip("citext extension is not available on this PostgreSQL installation")
		}

		if _, err := fixture.Exec(
			t.Context(),
			`CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public`,
		); err != nil {
			t.Fatalf("install available citext extension: %v", err)
		}
	}

	ddl := fmt.Sprintf(
		`CREATE FUNCTION cf_select.p14_setof_kind(item cf_select.items) RETURNS SETOF %s
	LANGUAGE sql STABLE AS $$ SELECT %s FROM generate_series(1,
	CASE WHEN item.id=101 THEN 0 WHEN item.id IN (102,104) THEN 1 ELSE 3 END) n $$`,
		kind.sqlType,
		kind.expression,
	)
	if _, err := fixture.Exec(t.Context(), ddl); err != nil {
		t.Fatalf("install %s SETOF function: %v", kind.name, err)
	}

	if kind.name == "int4" {
		if _, err := fixture.Exec(
			t.Context(),
			`CREATE FUNCTION cf_select.p14_setof_second(item cf_select.items, factor int4 DEFAULT 10) RETURNS SETOF int4
			LANGUAGE sql STABLE AS $$ SELECT n*factor FROM generate_series(1,
			CASE WHEN item.id=101 THEN 0 WHEN item.id IN (102,104) THEN 1 ELSE 2 END) n $$;
			CREATE FUNCTION cf_select.p14_const_set(item cf_select.items) RETURNS SETOF int4
			LANGUAGE sql STABLE AS $$ SELECT 5 $$;
			CREATE FUNCTION cf_select.p14_const_scalar(item cf_select.items) RETURNS int4
			LANGUAGE sql STABLE AS $$ SELECT 5 $$`,
		); err != nil {
			t.Fatalf("install additional computed functions: %v", err)
		}
	}

	for _, id := range []int{101, 102, 103} {
		if _, err := fixture.Exec(t.Context(), `INSERT INTO cf_select.items
			(id,owner_id,label,amount,payload) VALUES ($1,1,'isolated',1,'{}')`, id); err != nil {
			t.Fatalf("seed SETOF row: %v", err)
		}
	}

	md, err := metadata.FromHasuraJSON(computedFixture(t, "metadata.json"))
	if err != nil {
		t.Fatal(err)
	}

	parent := &md.Databases[0].Tables[0]
	parent.ComputedFields = append(parent.ComputedFields, metadata.ComputedField{
		Name: "p14_setof_kind",
		Definition: metadata.ComputedFieldDefinition{
			Function: metadata.FunctionSource{Schema: "cf_select", Name: "p14_setof_kind"},
		},
	})

	parent.SelectPermissions[1].Permission.ComputedFields = append(
		parent.SelectPermissions[1].Permission.ComputedFields, "p14_setof_kind")
	if kind.name == "int4" {
		parent.ArrayRelationships = append(parent.ArrayRelationships, metadata.ArrayRelationship{
			Name: "same_owner", Using: metadata.RelationshipUsing{
				ManualConfiguration: &metadata.ManualConfiguration{
					RemoteTable:   metadata.TableSource{Schema: "cf_select", Name: "items"},
					ColumnMapping: map[string]string{"owner_id": "owner_id"},
				},
			},
		})
		for _, name := range []string{"p14_setof_second", "p14_const_set", "p14_const_scalar"} {
			parent.ComputedFields = append(parent.ComputedFields, metadata.ComputedField{
				Name: name,
				Definition: metadata.ComputedFieldDefinition{
					Function: metadata.FunctionSource{Schema: "cf_select", Name: name},
				},
			})
			parent.SelectPermissions[1].Permission.ComputedFields = append(
				parent.SelectPermissions[1].Permission.ComputedFields, name)
		}
	}

	pool, err := postgres.Open(t.Context(), fixture.Config().ConnString())
	if err != nil {
		t.Fatal(err)
	}

	inc := metadata.NewInconsistencies()

	conn, err := csql.NewConnector(
		t.Context(),
		postgres.NewClient(pool),
		&md.Databases[0],
		inc,
		slog.Default(),
	)
	if err != nil {
		pool.Close()
		t.Fatal(err)
	}

	t.Cleanup(conn.Close)

	if got := inc.Snapshot(); len(got) != 0 {
		t.Fatalf("%s return inconsistency: %+v", kind.name, got)
	}

	count := func(id int) int {
		t.Helper()

		var n int
		if err := fixture.QueryRow(t.Context(), `SELECT count(*) FROM cf_select.items WHERE id=$1`, id).
			Scan(&n); err != nil {
			t.Fatal(err)
		}

		return n
	}

	return conn, count
}

func assertSetofKindResult(t *testing.T, conn *csql.Connector, role, query, want string) {
	t.Helper()

	got, err := customArgumentQuery(t, conn, role, query, nil)
	if err != nil {
		t.Fatal(err)
	}

	b, err := json.Marshal(got)
	if err != nil || string(b) != want {
		t.Fatalf("result %s; want %s (err %v)", b, want, err)
	}
}

func assertSetofKindError(t *testing.T, conn *csql.Connector, role, query, state string) {
	t.Helper()
	_, err := customArgumentQuery(t, conn, role, query, nil)

	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != state {
		t.Fatalf("SQLSTATE %v; want %s", err, state)
	}
}

//nolint:paralleltest // Each kind owns one isolated testdb and runs mutation cases in sequence.
func TestComputedScalarSetofKinds(t *testing.T) {
	kinds := []computedSetofKind{
		{"int4", "int4", "n::int4", "Int", `1`, "1", "max"},
		{"float8", "float8", "n::float8", "float8", `1`, "1", "max"},
		{"bool", "bool", "(n % 2 = 1)", "Boolean", `true`, "true", ""},
		{"date", "date", "('2020-01-01'::date + n)", "date", `"2020-01-02"`, `"2020-01-02"`, "max"},
		{
			"uuid",
			"uuid",
			"('00000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid",
			"uuid",
			`"00000000-0000-0000-0000-000000000001"`,
			`"00000000-0000-0000-0000-000000000001"`,
			"max",
		},
		{"jsonb", "jsonb", "jsonb_build_object('n',n)", "jsonb", `{"n":1}`, `{n:1}`, ""},
		{
			"citext",
			"public.citext",
			"('value' || n)::public.citext",
			"citext",
			`"value1"`,
			`"value1"`,
			"max",
		},
	}
	for _, kind := range kinds {
		t.Run(kind.name, func(t *testing.T) { testComputedScalarSetofKind(t, kind) })
	}
}

//nolint:paralleltest // Grouping shares the isolated function fixture with its mutation matrix.
func TestComputedSetofGroupedAggregateWeights(t *testing.T) {
	conn, _ := computedSetofKindConnector(t, computedSetofKind{
		name: "int4", sqlType: "int4", expression: "n::int4", gqlType: "Int",
		one: `1`, comparison: "1", aggregate: "max",
	})
	for _, tc := range []struct{ name, query, want string }{
		{"all rows", `query{_root(where:{id:{_gte:101}}){aggregate{avg{p14_setof_kind}}}}`, `1.75`},
		{"per-key window", `query{_root(where:{id:{_gte:101}},order_by:{id:asc},limit:2){aggregate{avg{p14_setof_kind}}}}`, `1`},
		{"per-key offset", `query{_root(where:{id:{_gte:101}},order_by:{id:asc},offset:2){aggregate{avg{p14_setof_kind}}}}`, `2`},
		{"per-key empty window", `query{_root(where:{id:{_gte:101}},limit:0){aggregate{avg{p14_setof_kind}}}}`, `null`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			field, fragments := parseAggregateFieldSource(t, tc.query)

			result, err := conn.ExecuteGroupedAggregate(t.Context(), groupedaggregate.Request{
				TableSchema: "cf_select", TableName: "items", JoinColumnSQLName: "owner_id",
				JoinValues: []any{1, 2}, Field: field, Fragments: fragments,
			}, "cf_reader", nil, slog.Default())
			if err != nil {
				t.Fatal(err)
			}

			b, err := json.Marshal(result[groupedaggregate.JoinKey(1, false)])

			want := `{"aggregate":{"avg":{"p14_setof_kind":` + tc.want + `}}}`
			if err != nil || string(b) != want {
				t.Fatalf(
					"flattened grouped average = %s, want %s (%v); whole result %+v",
					b,
					want,
					err,
					result,
				)
			}
		})
	}
}

//nolint:paralleltest // One isolated testdb owns the shared function and grouped queries.
func TestComputedSetofCombinedAggregates(t *testing.T) {
	conn, _ := computedSetofKindConnector(t, computedSetofKind{
		name: "int4", sqlType: "int4", expression: "n::int4", gqlType: "Int",
		one: `1`, comparison: "1", aggregate: "max",
	})

	if conn.HasComputedJoinKey("cf_select", "items", "p14_setof_kind") ||
		conn.HasComputedJoinKey("cf_select", "items", "p14_setof_second") ||
		!conn.HasComputedJoinKey("cf_select", "items", "p14_const_scalar") {
		t.Fatal("SETOF remote keys must be rejected without rejecting ordinary scalar keys")
	}

	for _, tc := range []struct{ name, query, want string }{
		{"count, column, operand and nodes", `{cf_select_items_aggregate(where:{id:{_gte:101}},order_by:{id:asc}){aggregate{count sum{amount} avg{p14_setof_kind}} nodes{id}}}`, `{"cf_select_items_aggregate":{"aggregate":{"avg":{"p14_setof_kind":1.75},"count":4,"sum":{"amount":4}},"nodes":[{"id":102},{"id":103},{"id":103},{"id":103}]}}`},
		{"aggregate aliases", `{cf_select_items_aggregate(where:{id:{_gte:101}}){a:aggregate{count} b:aggregate{max{p14_setof_kind}}}}`, `{"cf_select_items_aggregate":{"a":{"count":4},"b":{"max":{"p14_setof_kind":3}}}}`},
		{"lockstep operands", `{cf_select_items_aggregate(where:{id:{_gte:101}}){aggregate{count sum{amount p14_setof_kind p14_setof_second} max{p14_setof_second}} nodes{id}}}`, `{"cf_select_items_aggregate":{"aggregate":{"count":4,"max":{"p14_setof_second":20},"sum":{"amount":4,"p14_setof_kind":7,"p14_setof_second":40}},"nodes":[{"id":102},{"id":103},{"id":103},{"id":103}]}}`},
		{"nested relationship", `{cf_select_items(where:{id:{_eq:102}}){same_owner_aggregate(where:{id:{_gte:101}},order_by:{id:asc}){aggregate{count sum{amount} avg{p14_setof_kind}} nodes{id}}}}`, `{"cf_select_items":[{"same_owner_aggregate":{"aggregate":{"avg":{"p14_setof_kind":1.75},"count":4,"sum":{"amount":4}},"nodes":[{"id":102},{"id":103},{"id":103},{"id":103}]}}]}`},
		{"bound operand", `{cf_select_items_aggregate(where:{id:{_gte:101}}){aggregate{count sum{amount scaled:p14_setof_second(args:{factor:2})}} nodes{id}}}`, `{"cf_select_items_aggregate":{"aggregate":{"count":3,"sum":{"amount":3,"scaled":8}},"nodes":[{"id":102},{"id":103},{"id":103}]}}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			assertSetofKindResult(t, conn, "admin", tc.query, tc.want)
		})
	}

	field, fragments := parseAggregateFieldSource(
		t,
		`query{_root(where:{id:{_gte:101}},order_by:{id:asc}){aggregate{count sum{amount} avg{p14_setof_kind}} nodes{id}}}`,
	)

	result, err := conn.ExecuteGroupedAggregate(t.Context(), groupedaggregate.Request{
		TableSchema: "cf_select", TableName: "items", JoinColumnSQLName: "owner_id",
		JoinValues: []any{1, 998, 999}, Field: field, Fragments: fragments,
	}, "admin", nil, slog.Default())
	if err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct {
		key  int
		want string
	}{
		{1, `{"aggregate":{"avg":{"p14_setof_kind":1.75},"count":4,"sum":{"amount":4}},"nodes":[{"id":102},{"id":103},{"id":103},{"id":103}]}`},
		{998, `{"aggregate":{"avg":{"p14_setof_kind":null},"count":0,"sum":{"amount":null}},"nodes":[]}`},
		{999, `{"aggregate":{"avg":{"p14_setof_kind":null},"count":0,"sum":{"amount":null}},"nodes":[]}`},
	} {
		b, marshalErr := json.Marshal(result[groupedaggregate.JoinKey(tc.key, false)])
		if marshalErr != nil || string(b) != tc.want {
			t.Fatalf("group %d: %s want %s (%v)", tc.key, b, tc.want, marshalErr)
		}
	}

	for _, tc := range []struct{ name, query, want string }{
		{"two operands", `query{_root(where:{id:{_gte:101}},order_by:{id:asc}){a:aggregate{count sum{amount p14_setof_kind p14_setof_second}} b:aggregate{max{p14_setof_second}} nodes{id}}}`, `{"a":{"count":4,"sum":{"amount":4,"p14_setof_kind":7,"p14_setof_second":40}},"b":{"max":{"p14_setof_second":20}},"nodes":[{"id":102},{"id":103},{"id":103},{"id":103}]}`},
		{"offset and limit", `query{_root(where:{id:{_gte:101}},order_by:{id:asc},limit:1,offset:1){aggregate{count sum{amount p14_setof_kind scaled:p14_setof_second(args:{factor:2})}} nodes{id}}}`, `{"aggregate":{"count":1,"sum":{"amount":1,"p14_setof_kind":1,"scaled":2}},"nodes":[{"id":102}]}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			field, fragments := parseAggregateFieldSource(t, tc.query)

			got, execErr := conn.ExecuteGroupedAggregate(t.Context(), groupedaggregate.Request{
				TableSchema: "cf_select", TableName: "items", JoinColumnSQLName: "owner_id",
				JoinValues: []any{1, 998, 999}, Field: field, Fragments: fragments,
			}, "admin", nil, slog.Default())
			if execErr != nil {
				t.Fatal(execErr)
			}

			b, marshalErr := json.Marshal(got[groupedaggregate.JoinKey(1, false)])
			if marshalErr != nil || string(b) != tc.want {
				t.Fatalf("grouped %s: %s want %s (%v)", tc.name, b, tc.want, marshalErr)
			}
		})
	}
}

//nolint:paralleltest // One fixture verifies multiple empty groups simultaneously.
func TestComputedGroupedEmptyKeysDoNotCallFunctions(t *testing.T) {
	conn, _ := computedSetofKindConnector(t, computedSetofKind{
		name: "int4", sqlType: "int4", expression: "n::int4", gqlType: "Int",
		one: `1`, comparison: "1", aggregate: "max",
	})

	for _, tc := range []struct{ name, args, operands, emptySum, fullSum, windowSum string }{
		{"unbounded", `where:{id:{_gte:101}}`, `p14_const_set p14_const_scalar`, `"p14_const_scalar":null,"p14_const_set":null`, `"p14_const_scalar":15,"p14_const_set":15`, `"p14_const_scalar":5,"p14_const_set":5`},
		{"windowed", `where:{id:{_gte:101}},order_by:{id:asc},limit:1,offset:1`, `p14_const_set p14_const_scalar`, `"p14_const_scalar":null,"p14_const_set":null`, `"p14_const_scalar":15,"p14_const_set":15`, `"p14_const_scalar":5,"p14_const_set":5`},
		{"scalar only", `where:{id:{_gte:101}}`, `p14_const_scalar`, `"p14_const_scalar":null`, `"p14_const_scalar":15`, `"p14_const_scalar":5`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			field, fragments := parseAggregateFieldSource(
				t,
				`query{_root(`+tc.args+`){aggregate{count sum{`+tc.operands+`}} nodes{id}}}`,
			)

			result, err := conn.ExecuteGroupedAggregate(t.Context(), groupedaggregate.Request{
				TableSchema: "cf_select", TableName: "items", JoinColumnSQLName: "owner_id",
				JoinValues: []any{1, 998, 999}, Field: field, Fragments: fragments,
			}, "admin", nil, slog.Default())
			if err != nil {
				t.Fatal(err)
			}

			for _, key := range []int{998, 999} {
				b, marshalErr := json.Marshal(result[groupedaggregate.JoinKey(key, false)])

				want := `{"aggregate":{"count":0,"sum":{` + tc.emptySum + `}},"nodes":[]}`
				if marshalErr != nil || string(b) != want {
					t.Fatalf("empty key %d: %s want %s (%v)", key, b, want, marshalErr)
				}
			}

			b, marshalErr := json.Marshal(result[groupedaggregate.JoinKey(1, false)])

			want := `{"aggregate":{"count":3,"sum":{` + tc.fullSum + `}},"nodes":[{"id":101},{"id":102},{"id":103}]}`
			if tc.name == "windowed" {
				want = `{"aggregate":{"count":1,"sum":{` + tc.windowSum + `}},"nodes":[{"id":102}]}`
			}

			if marshalErr != nil || string(b) != want {
				t.Fatalf("nonempty key: %s want %s (%v)", b, want, marshalErr)
			}
		})
	}
}

//nolint:paralleltest // Mutation assertions share one isolated testdb transaction sequence.
func TestComputedSetofCollectionReturningRollback(t *testing.T) {
	conn, count := computedSetofKindConnector(t, computedSetofKind{
		name: "int4", sqlType: "int4", expression: "n::int4", gqlType: "Int",
		one: `1`, comparison: "1", aggregate: "max",
	})

	for _, tc := range []struct{ name, query, want string }{
		{"upsert zero", `mutation{insert_cf_select_items(objects:[{id:101,owner_id:1,label:"zero",amount:1,payload:{}}],on_conflict:{constraint:items_pkey,update_columns:[label]}){affected_rows returning{id p14_setof_kind}}}`, `{"insert_cf_select_items":{"affected_rows":1,"returning":[null]}}`},
		{"insert one", `mutation{insert_cf_select_items(objects:[{id:104,owner_id:1,label:"one",amount:1,payload:{}}]){affected_rows returning{id p14_setof_kind}}}`, `{"insert_cf_select_items":{"affected_rows":1,"returning":[{"id":104,"p14_setof_kind":1}]}}`},
		{"update zero and one", `mutation{update_cf_select_items(where:{id:{_in:[101,102]}},_set:{label:"changed"}){affected_rows returning{id p14_setof_kind}}}`, `{"update_cf_select_items":{"affected_rows":2,"returning":[null,{"id":102,"p14_setof_kind":1}]}}`},
		{"update many one", `mutation{update_cf_select_items_many(updates:[{where:{id:{_eq:102}},_set:{label:"many"}}]){affected_rows returning{id p14_setof_kind}}}`, `{"update_cf_select_items_many":[{"affected_rows":1,"returning":[{"id":102,"p14_setof_kind":1}]}]}`},
		{"related row on returning", `mutation{update_cf_select_items(where:{id:{_eq:102}},_set:{label:"many"}){affected_rows returning{id p14_setof_kind same_owner(where:{id:{_eq:102}}){id}}}}`, `{"update_cf_select_items":{"affected_rows":1,"returning":[{"id":102,"p14_setof_kind":1,"same_owner":[{"id":102}]}]}}`},
		{"delete zero", `mutation{delete_cf_select_items(where:{id:{_eq:101}}){affected_rows returning{id p14_setof_kind}}}`, `{"delete_cf_select_items":{"affected_rows":1,"returning":[null]}}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			assertSetofKindResult(t, conn, "admin", tc.query, tc.want)
		})
	}

	for _, tc := range []struct {
		name, query   string
		id            int
		expectedLabel string
	}{
		{"insert many", `mutation{insert_cf_select_items(objects:[{id:105,owner_id:1,label:"many",amount:1,payload:{}}]){affected_rows returning{id p14_setof_kind}}}`, 105, ""},
		{"update many", `mutation{update_cf_select_items(where:{id:{_eq:103}},_set:{label:"wrong"}){affected_rows returning{id p14_setof_kind}}}`, 103, "isolated"},
		{"update_many many", `mutation{update_cf_select_items_many(updates:[{where:{id:{_eq:103}},_set:{label:"wrong"}}]){affected_rows returning{id p14_setof_kind}}}`, 103, "isolated"},
		{"delete many", `mutation{delete_cf_select_items(where:{id:{_eq:103}}){affected_rows returning{id p14_setof_kind}}}`, 103, "isolated"},
		{"mixed upsert rolls back", `mutation{insert_cf_select_items(objects:[{id:104,owner_id:1,label:"wrong",amount:1,payload:{}},{id:105,owner_id:1,label:"wrong",amount:1,payload:{}}],on_conflict:{constraint:items_pkey,update_columns:[label]}){affected_rows returning{id p14_setof_kind}}}`, 105, ""},
		{"mixed update many rolls back", `mutation{update_cf_select_items_many(updates:[{where:{id:{_eq:102}},_set:{label:"wrong"}},{where:{id:{_eq:103}},_set:{label:"wrong"}}]){affected_rows returning{id p14_setof_kind}}}`, 103, "isolated"},
		{"mixed delete rolls back", `mutation{delete_cf_select_items(where:{id:{_in:[102,103]}}){affected_rows returning{id p14_setof_kind}}}`, 103, "isolated"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			assertSetofKindError(t, conn, "admin", tc.query, "21000")

			if got := count(tc.id); (tc.id == 105 && got != 0) || (tc.id == 103 && got != 1) {
				t.Fatalf("failed mutation persisted row count %d", got)
			}

			if tc.id == 103 {
				assertSetofKindResult(
					t,
					conn,
					"admin",
					`{cf_select_items_by_pk(id:103){label}}`,
					`{"cf_select_items_by_pk":{"label":"`+tc.expectedLabel+`"}}`,
				)
			}

			if count(102) != 1 || count(104) != 1 {
				t.Fatal("multi-row failure removed an unrelated successful row")
			}

			assertSetofKindResult(
				t,
				conn,
				"admin",
				`{cf_select_items_by_pk(id:102){label}}`,
				`{"cf_select_items_by_pk":{"label":"many"}}`,
			)
			assertSetofKindResult(
				t,
				conn,
				"admin",
				`{cf_select_items_by_pk(id:104){label}}`,
				`{"cf_select_items_by_pk":{"label":"one"}}`,
			)
		})
	}
}

//nolint:cyclop,gocognit,gocyclo,maintidx // Per-kind SDL, cardinality, inputs and mutations form one contract.
func testComputedScalarSetofKind(t *testing.T, kind computedSetofKind) {
	t.Helper()
	conn, count := computedSetofKindConnector(t, kind)

	schemas, err := conn.GetSchema()
	if err != nil {
		t.Fatal(err)
	}

	for _, role := range []string{"admin", "cf_reader"} {
		defs := schemas[role].ToAST().Definitions
		field := defs.ForName("cf_select_items").Fields.ForName("p14_setof_kind")
		boolField := defs.ForName("cf_select_items_bool_exp").Fields.ForName("p14_setof_kind")

		orderField := defs.ForName("cf_select_items_order_by").Fields.ForName("p14_setof_kind")
		if field == nil || field.Type.Name() != kind.gqlType || field.Type.Elem != nil ||
			field.Type.NonNull ||
			boolField == nil ||
			boolField.Type.Name() != kind.gqlType+"_comparison_exp" ||
			orderField == nil ||
			orderField.Type.Name() != "order_by" {
			t.Fatalf("%s %s nullable scalar / inputs missing", kind.name, role)
		}

		for _, op := range []string{"max", "min", "sum", "avg"} {
			typeDef := defs.ForName("cf_select_items_" + op + "_fields")
			present := typeDef != nil && typeDef.Fields.ForName("p14_setof_kind") != nil

			want := (op == "max" || op == "min") && kind.aggregate != "" ||
				(op == "sum" || op == "avg") && (kind.name == "int4" || kind.name == "float8")
			if present != want {
				t.Fatalf(
					"%s %s aggregate %s present=%t want=%t",
					kind.name,
					role,
					op,
					present,
					want,
				)
			}
		}
	}

	denied := schemas["cf_no_grant"].ToAST().Definitions
	if denied.ForName("cf_select_items").Fields.ForName("p14_setof_kind") != nil ||
		denied.ForName("cf_select_items_bool_exp").Fields.ForName("p14_setof_kind") != nil {
		t.Fatal("ungranted role sees SETOF return or input")
	}

	field := "p14_setof_kind"
	assertSetofKindResult(
		t,
		conn,
		"admin",
		`{cf_select_items_by_pk(id:101){id `+field+`}}`,
		`{"cf_select_items_by_pk":null}`,
	)
	assertSetofKindResult(t, conn, "cf_reader", `{cf_select_items_by_pk(id:102){id `+field+`}}`,
		`{"cf_select_items_by_pk":{"id":102,"`+field+`":`+kind.one+`}}`)
	assertSetofKindError(t, conn, "admin", `{cf_select_items_by_pk(id:103){`+field+`}}`, "21000")

	for _, id := range []int{101, 102, 103} {
		query := fmt.Sprintf(
			`{cf_select_items(where:{id:{_eq:%d},%s:{_eq:%s}}){id}}`,
			id,
			field,
			kind.comparison,
		)
		assertSetofKindError(t, conn, "cf_reader", query, "0A000")
	}

	got, err := customArgumentQuery(
		t,
		conn,
		"cf_reader",
		`{cf_select_items(where:{id:{_gte:101}},order_by:{`+field+`:asc}){id}}`,
		nil,
	)
	if err != nil {
		t.Fatal(err)
	}

	rows, ok := got["cf_select_items"].([]any)
	if !ok || len(rows) != 4 {
		t.Fatalf("%s order cardinality: %+v", kind.name, got)
	}

	frequency := map[float64]int{}
	for _, row := range rows {
		item, ok := row.(map[string]any)
		if !ok {
			t.Fatalf("%s order row is not an object: %T", kind.name, row)
		}

		id, ok := item["id"].(float64)
		if !ok {
			t.Fatalf("%s order row lacks numeric id: %+v", kind.name, item)
		}

		frequency[id]++
	}

	if frequency[102] != 1 || frequency[103] != 3 || len(frequency) != 2 {
		t.Fatalf("%s order dropped/duplicated wrong rows: %+v", kind.name, frequency)
	}

	if kind.aggregate != "" {
		query := `{cf_select_items_aggregate(where:{id:{_gte:101}}){aggregate{` +
			kind.aggregate + `{` + field + `}}}}`
		if kind.name == "uuid" {
			assertSetofKindError(t, conn, "admin", query, "42883")
			assertSetofKindError(
				t,
				conn,
				"cf_reader",
				strings.Replace(query, "max{", "min{", 1),
				"42883",
			)
		} else {
			maxResult := map[string]string{
				"int4": `3`, "float8": `3`, "date": `"2020-01-04"`, "citext": `"value3"`,
			}[kind.name]
			assertSetofKindResult(t, conn, "cf_reader", query,
				`{"cf_select_items_aggregate":{"aggregate":{"max":{"`+field+`":`+maxResult+`}}}}`)

			minResult := map[string]string{
				"int4": `1`, "float8": `1`, "date": `"2020-01-02"`, "citext": `"value1"`,
			}[kind.name]
			assertSetofKindResult(t, conn, "cf_reader", strings.Replace(query, "max{", "min{", 1),
				`{"cf_select_items_aggregate":{"aggregate":{"min":{"`+field+`":`+minResult+`}}}}`)

			if kind.name == "int4" || kind.name == "float8" {
				for _, op := range []struct{ name, want string }{
					{"sum", `7`}, {"avg", `1.75`}, {"var_pop", `0.6875`},
				} {
					assertSetofKindResult(
						t,
						conn,
						"cf_reader",
						strings.Replace(query, "max{", op.name+"{", 1),
						`{"cf_select_items_aggregate":{"aggregate":{"`+op.name+`":{"`+field+`":`+op.want+`}}}}`,
					)
				}
			}
		}
	}

	if kind.name == "jsonb" {
		assertSetofKindResult(
			t,
			conn,
			"cf_reader",
			`{cf_select_items_by_pk(id:102){p14_setof_kind(path:"$.n")}}`,
			`{"cf_select_items_by_pk":{"p14_setof_kind":1}}`,
		)
	}

	assertSetofKindResult(
		t,
		conn,
		"admin",
		`mutation{insert_cf_select_items_one(object:{id:104,owner_id:1,`+
			`label:"new",amount:1,payload:{}}){id `+field+`}}`,
		`{"insert_cf_select_items_one":{"id":104,"`+field+`":`+kind.one+`}}`,
	)
	assertSetofKindResult(
		t,
		conn,
		"admin",
		`mutation{update_cf_select_items_by_pk(pk_columns:{id:102},_set:{label:"changed"}){id `+field+`}}`,
		`{"update_cf_select_items_by_pk":{"id":102,"`+field+`":`+kind.one+`}}`,
	)
	assertSetofKindError(
		t,
		conn,
		"admin",
		`mutation{insert_cf_select_items_one(object:{id:105,owner_id:1,`+
			`label:"new",amount:1,payload:{}}){`+field+`}}`,
		"21000",
	)

	if count(104) != 1 || count(105) != 0 {
		t.Fatal("mutation success missing or failed multi-returning insert persisted")
	}
}

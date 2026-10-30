package sql_test

import (
	"encoding/json"
	"errors"
	"log/slog"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	csql "github.com/nhost/nhost/services/constellation/connector/sql"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/metadata"
)

const computedNumericReturnDDL = `
CREATE FUNCTION cf_select.p14_numeric(item cf_select.items) RETURNS SETOF numeric
 LANGUAGE sql STABLE AS $$ SELECT (n*2)::numeric FROM generate_series(1,
 CASE WHEN item.id IN (101,106,109,114) THEN 0 WHEN item.id IN (102,104,113) THEN 1 ELSE 2 END) n $$;
CREATE FUNCTION cf_select.p14_rows(item cf_select.items) RETURNS SETOF cf_select.tags
 LANGUAGE sql STABLE AS $$ SELECT t FROM cf_select.tags t WHERE t.id <=
 CASE WHEN item.id IN (101,106,109,114) THEN 0 WHEN item.id IN (102,104,113) THEN 1 ELSE 2 END ORDER BY t.id $$;
CREATE FUNCTION cf_select.p14_row(item cf_select.items) RETURNS cf_select.tags
 LANGUAGE sql STABLE AS $$ SELECT t FROM cf_select.tags t WHERE t.id =
 CASE WHEN item.id IN (101,106,109,114) THEN 999 WHEN item.id IN (102,104,113) THEN 1 ELSE 2 END $$;
`

func computedNumericReturnConnector(
	t *testing.T,
) (*csql.Connector, func(int) int, func(int) string) {
	t.Helper()

	fixture := computedTestDB(t)
	if _, err := fixture.Exec(t.Context(), computedNumericReturnDDL); err != nil {
		t.Fatalf("install return functions: %v", err)
	}

	for _, id := range []int{101, 102, 103} {
		if _, err := fixture.Exec(t.Context(), `INSERT INTO cf_select.items
		 (id,owner_id,label,amount,payload) VALUES ($1,1,'isolated',1,'{}')`, id); err != nil {
			t.Fatalf("seed return row: %v", err)
		}
	}

	md, err := metadata.FromHasuraJSON(computedFixture(t, "metadata.json"))
	if err != nil {
		t.Fatal(err)
	}

	parent := &md.Databases[0].Tables[0]
	for _, name := range []string{"numeric", "rows", "row"} {
		parent.ComputedFields = append(parent.ComputedFields, metadata.ComputedField{
			Name: "p14_" + name,
			Definition: metadata.ComputedFieldDefinition{
				Function: metadata.FunctionSource{Schema: "cf_select", Name: "p14_" + name},
			},
		})
	}

	parent.SelectPermissions[1].Permission.ComputedFields = append(
		parent.SelectPermissions[1].Permission.ComputedFields, "p14_numeric")

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

	if len(inc.Snapshot()) != 0 {
		t.Fatalf("numeric return inconsistency: %+v", inc.Snapshot())
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

	label := func(id int) string {
		t.Helper()

		var value string
		if err := fixture.QueryRow(t.Context(), `SELECT label FROM cf_select.items WHERE id=$1`, id).
			Scan(&value); err != nil {
			t.Fatal(err)
		}

		return value
	}

	return conn, count, label
}

//nolint:paralleltest,gocognit,gocyclo,cyclop // One testdb/connector owns the ordered cardinality and mutation rollback matrix.
func TestComputedNumericSetofAndTableReturning(t *testing.T) {
	conn, count, label := computedNumericReturnConnector(t)

	schemas, err := conn.GetSchema()
	if err != nil {
		t.Fatal(err)
	}

	for _, role := range []string{"admin", "cf_reader"} {
		defs := schemas[role].ToAST().Definitions

		item := defs.ForName("cf_select_items")
		if item == nil || item.Fields.ForName("p14_numeric") == nil ||
			item.Fields.ForName("p14_numeric").Type.Name() != "numeric" ||
			item.Fields.ForName("p14_numeric").Type.NonNull ||
			defs.ForName("cf_select_items_bool_exp").Fields.ForName("p14_numeric") == nil ||
			defs.ForName(
				"cf_select_items_bool_exp",
			).Fields.ForName(
				"p14_numeric",
			).Type.Name() != "numeric_comparison_exp" ||
			defs.ForName("cf_select_items_order_by").Fields.ForName("p14_numeric") == nil ||
			defs.ForName(
				"cf_select_items_order_by",
			).Fields.ForName(
				"p14_numeric",
			).Type.Name() != "order_by" ||
			defs.ForName("cf_select_items_max_fields").Fields.ForName("p14_numeric") == nil ||
			defs.ForName(
				"cf_select_items_max_fields",
			).Fields.ForName(
				"p14_numeric",
			).Type.Name() != "numeric" {
			t.Fatalf("numeric setof SDL missing for %s", role)
		}

		if defs.ForName("cf_select_items_order_by").Fields.ForName("p14_rows_aggregate") == nil ||
			item.Fields.ForName("p14_rows") == nil || item.Fields.ForName("p14_row") == nil {
			t.Fatalf("table return SDL missing for %s", role)
		}
	}

	denied := schemas["cf_no_grant"].ToAST().Definitions.ForName("cf_select_items")
	if denied == nil || denied.Fields.ForName("p14_numeric") != nil ||
		denied.Fields.ForName("p14_rows") != nil || denied.Fields.ForName("p14_row") != nil ||
		schemas["cf_no_grant"].ToAST().Definitions.ForName(
			"cf_select_items_bool_exp",
		).Fields.ForName(
			"p14_numeric",
		) != nil {
		t.Fatal("ungranted scalar or target-table return exposed")
	}

	for _, tc := range []struct{ name, role, query, want string }{
		{"zero by_pk", "admin", `{cf_select_items_by_pk(id:101){id p14_numeric}}`, `{"cf_select_items_by_pk":null}`},
		{"one by_pk", "cf_reader", `{cf_select_items_by_pk(id:102){id p14_numeric}}`, `{"cf_select_items_by_pk":{"id":102,"p14_numeric":2}}`},
		{"numeric order", "admin", `{cf_select_items(where:{id:{_gte:101}},order_by:{p14_numeric:asc}){id}}`, `{"cf_select_items":[{"id":102},{"id":103},{"id":103}]}`},
		{"numeric max", "cf_reader", `{cf_select_items_aggregate(where:{id:{_gte:101}}){aggregate{max{p14_numeric}}}}`, `{"cf_select_items_aggregate":{"aggregate":{"max":{"p14_numeric":4}}}}`},
		{"table zero", "admin", `{cf_select_items_by_pk(id:101){p14_rows{id} p14_row{id}}}`, `{"cf_select_items_by_pk":{"p14_row":[{"id":null}],"p14_rows":[]}}`},
		{"table one", "admin", `{cf_select_items_by_pk(id:102){p14_rows{id} p14_row{id}}}`, `{"cf_select_items_by_pk":{"p14_row":[{"id":1}],"p14_rows":[{"id":1}]}}`},
		{"table many", "admin", `{cf_select_items_by_pk(id:103){p14_rows{id} p14_row{id}}}`, `{"cf_select_items_by_pk":{"p14_row":[{"id":2}],"p14_rows":[{"id":1},{"id":2}]}}`},
		{"insert one", "admin", `mutation{insert_cf_select_items_one(object:{id:104,owner_id:1,label:"new",amount:1,payload:{}}){id p14_numeric p14_rows{id} p14_row{id}}}`, `{"insert_cf_select_items_one":{"id":104,"p14_numeric":2,"p14_row":[{"id":1}],"p14_rows":[{"id":1}]}}`},
		{"insert zero", "admin", `mutation{insert_cf_select_items_one(object:{id:106,owner_id:1,label:"new",amount:1,payload:{}}){id p14_numeric}}`, `{"insert_cf_select_items_one":null}`},
		{"insert table zero", "admin", `mutation{insert_cf_select_items_one(object:{id:109,owner_id:1,label:"new",amount:1,payload:{}}){id p14_rows{id}}}`, `{"insert_cf_select_items_one":{"id":109,"p14_rows":[]}}`},
		{"insert table many", "admin", `mutation{insert_cf_select_items_one(object:{id:108,owner_id:1,label:"new",amount:1,payload:{}}){id p14_rows{id}}}`, `{"insert_cf_select_items_one":{"id":108,"p14_rows":[{"id":1},{"id":2}]}}`},
		{"insert single positive", "admin", `mutation{insert_cf_select_items_one(object:{id:113,owner_id:1,label:"new",amount:1,payload:{}}){id p14_row{id}}}`, `{"insert_cf_select_items_one":{"id":113,"p14_row":[{"id":1}]}}`},
		{"insert single missing", "admin", `mutation{insert_cf_select_items_one(object:{id:114,owner_id:1,label:"new",amount:1,payload:{}}){id p14_row{id}}}`, `{"insert_cf_select_items_one":{"id":114,"p14_row":[{"id":null}]}}`},
		{"update table returning", "admin", `mutation{update_cf_select_items_by_pk(pk_columns:{id:102},_set:{label:"changed"}){id p14_row{id}}}`, `{"update_cf_select_items_by_pk":{"id":102,"p14_row":[{"id":1}]}}`},
		{"update zero", "admin", `mutation{update_cf_select_items_by_pk(pk_columns:{id:101},_set:{label:"zero"}){id p14_numeric}}`, `{"update_cf_select_items_by_pk":null}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := customArgumentQuery(t, conn, tc.role, tc.query, nil)
			if err != nil {
				t.Fatal(err)
			}

			b, err := json.Marshal(got)
			if err != nil || string(b) != tc.want {
				t.Fatalf("got %s want %s: %v", b, tc.want, err)
			}
		})
	}

	for _, tc := range []struct {
		name, role, query, state string
		id                       int
	}{
		{"numeric direct many", "admin", `{cf_select_items_by_pk(id:103){p14_numeric}}`, "21000", 0},
		{"numeric where zero", "admin", `{cf_select_items(where:{id:{_eq:101},p14_numeric:{_eq:2}}){id}}`, "0A000", 0},
		{"numeric where one", "cf_reader", `{cf_select_items(where:{id:{_eq:102},p14_numeric:{_eq:2}}){id}}`, "0A000", 0},
		{"insert many rolls back", "admin", `mutation{insert_cf_select_items_one(object:{id:107,owner_id:1,label:"new",amount:1,payload:{}}){p14_numeric}}`, "21000", 107},
		{"update many rolls back", "admin", `mutation{update_cf_select_items_by_pk(pk_columns:{id:103},_set:{label:"changed"}){p14_numeric}}`, "21000", 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := customArgumentQuery(t, conn, tc.role, tc.query, nil)

			var pgErr *pgconn.PgError
			if !errors.As(err, &pgErr) || pgErr.Code != tc.state {
				t.Fatalf("SQLSTATE %v, want %s", err, tc.state)
			}

			if tc.id != 0 && count(tc.id) != 0 {
				t.Fatal("failed mutation persisted a row")
			}
		})
	}

	if count(104) != 1 || count(106) != 1 || count(108) != 1 ||
		count(109) != 1 || count(113) != 1 || count(114) != 1 {
		t.Fatal("successful inserts did not persist")
	}

	if label(103) != "isolated" || label(101) != "zero" {
		t.Fatal("failed update persisted or successful zero-cardinality update rolled back")
	}
}

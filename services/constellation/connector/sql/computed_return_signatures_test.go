package sql_test

import (
	"encoding/json"
	"errors"
	"log/slog"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	csql "github.com/nhost/nhost/services/constellation/connector/sql"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2/ast"
)

const computedReturnDDL = `
CREATE FUNCTION cf_select.p14_one(item cf_select.items) RETURNS cf_select.tags
 LANGUAGE sql STABLE AS $$ SELECT t FROM cf_select.tags t WHERE t.item_id = item.id AND t.id = 1 $$;
CREATE FUNCTION cf_select.p14_null(item cf_select.items) RETURNS cf_select.tags
 LANGUAGE sql STABLE AS $$ SELECT NULL::cf_select.tags $$;
CREATE FUNCTION cf_select.p14_missing(item cf_select.items) RETURNS cf_select.tags
 LANGUAGE sql STABLE AS $$ SELECT t FROM cf_select.tags t WHERE t.id = 9999 $$;
CREATE FUNCTION cf_select.p14_synthetic(item cf_select.items) RETURNS cf_select.tags
 LANGUAGE sql STABLE AS $$ SELECT (9999,item.id,'ghost')::cf_select.tags $$;
CREATE FUNCTION cf_select.p14_zero(item cf_select.items) RETURNS SETOF text
 LANGUAGE sql STABLE AS $$ SELECT NULL::text WHERE false $$;
CREATE FUNCTION cf_select.p14_single(item cf_select.items) RETURNS SETOF text
 LANGUAGE sql STABLE AS $$ SELECT 'single' || item.id $$;
CREATE FUNCTION cf_select.p14_many(item cf_select.items) RETURNS SETOF text
 LANGUAGE sql STABLE AS $$ SELECT 'v' || n FROM generate_series(1, CASE WHEN item.id = 1 THEN 0 ELSE 2 END) n $$;
CREATE FUNCTION cf_select.p14_text_array(item cf_select.items) RETURNS text[]
 LANGUAGE sql STABLE AS $$ SELECT ARRAY['a','b']::text[] $$;
`

func computedReturnConnector(
	t *testing.T,
	invalidGrant string,
) (*csql.Connector, *metadata.Inconsistencies) {
	t.Helper()

	fixture := computedTestDB(t)
	if _, err := fixture.Exec(t.Context(), computedReturnDDL); err != nil {
		t.Fatalf("install return functions: %v", err)
	}

	md, err := metadata.FromHasuraJSON(computedFixture(t, "metadata.json"))
	if err != nil {
		t.Fatalf("parse return fixture: %v", err)
	}

	parent := &md.Databases[0].Tables[0]
	for _, name := range []string{"one", "null", "missing", "synthetic", "zero", "single", "many", "text_array"} {
		parent.ComputedFields = append(parent.ComputedFields, metadata.ComputedField{
			Name: "p14_" + name,
			Definition: metadata.ComputedFieldDefinition{
				Function: metadata.FunctionSource{Schema: "cf_select", Name: "p14_" + name},
			},
		})
		if name == "zero" || name == "single" || name == "many" ||
			name == invalidGrant {
			parent.SelectPermissions[1].Permission.ComputedFields = append(
				parent.SelectPermissions[1].Permission.ComputedFields, "p14_"+name,
			)
		}
	}

	pool, err := postgres.Open(t.Context(), fixture.Config().ConnString())
	if err != nil {
		t.Fatalf("open return pool: %v", err)
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
		t.Fatalf("build return connector: %v", err)
	}

	t.Cleanup(conn.Close)

	return conn, inc
}

func assertComputedReturnTableSDL(t *testing.T, defs ast.DefinitionList, role string) {
	t.Helper()

	item := defs.ForName("cf_select_items")
	if item == nil {
		t.Fatal("items root removed")
	}

	for _, name := range []string{"one", "null", "missing", "synthetic"} {
		field := item.Fields.ForName("p14_" + name)
		if role == "cf_no_grant" {
			if field != nil {
				t.Fatalf("no target access exposed %s", name)
			}

			continue
		}

		if !validComputedReturnTableField(field) {
			t.Fatalf("table return type/arguments %s: %+v", name, field)
		}

		if defs.ForName("cf_select_items_bool_exp").Fields.ForName("p14_"+name) == nil ||
			defs.ForName(
				"cf_select_items_order_by",
			).Fields.ForName(
				"p14_"+name+"_aggregate",
			) == nil {
			t.Fatalf("missing table input for %s", name)
		}
	}
}

func validComputedReturnTableField(field *ast.FieldDefinition) bool {
	if field == nil || field.Type.Elem == nil || !field.Type.Elem.NonNull ||
		field.Type.Elem.Name() != "cf_select_tags" || field.Type.NonNull {
		return false
	}

	for _, name := range []string{"where", "order_by", "distinct_on", "limit", "offset"} {
		if field.Arguments.ForName(name) == nil {
			return false
		}
	}

	return true
}

func assertComputedReturnTableRows(
	t *testing.T, conn *csql.Connector, role, name, want string,
) {
	t.Helper()

	query := `query { cf_select_items(order_by:{id:asc}) { p14_` + name + ` { id } } }`

	got, err := customArgumentQuery(t, conn, role, query, nil)
	if err != nil {
		t.Fatal(err)
	}

	encoded, err := json.Marshal(got["cf_select_items"])
	if err != nil {
		t.Fatalf("encode result: %v", err)
	}

	var rows []map[string]json.RawMessage
	if err := json.Unmarshal(encoded, &rows); err != nil || len(rows) != 2 {
		t.Fatalf("decode rows %s: %v", encoded, err)
	}

	values := make([]json.RawMessage, 0, len(rows))
	for _, row := range rows {
		values = append(values, row["p14_"+name])
	}

	actual, err := json.Marshal(values)
	if err != nil || string(actual) != want {
		t.Fatalf("result %s, want %s (err %v)", actual, want, err)
	}
}

func assertComputedSetofScalarSDL(t *testing.T, defs ast.DefinitionList, role string) {
	t.Helper()

	for _, name := range []string{"zero", "single", "many"} {
		field := defs.ForName("cf_select_items").Fields.ForName("p14_" + name)
		if field == nil || field.Type.Name() != "String" || field.Type.NonNull ||
			defs.ForName("cf_select_items_bool_exp").Fields.ForName("p14_"+name) == nil ||
			defs.ForName("cf_select_items_order_by").Fields.ForName("p14_"+name) == nil ||
			defs.ForName("cf_select_items_max_fields").Fields.ForName("p14_"+name) == nil {
			t.Fatalf("%s SETOF scalar %s SDL: %+v", role, name, field)
		}
	}
}

//nolint:paralleltest // Every subcase uses the same isolated connector and its testdb pool.
func TestComputedReturnTableRoleSDLAndData(t *testing.T) {
	conn, inc := computedReturnConnector(t, "")

	schemas, err := conn.GetSchema()
	if err != nil {
		t.Fatal(err)
	}

	for _, role := range []string{"admin", "cf_reader", "cf_filtered_one", "cf_filtered_three", "cf_no_grant"} {
		t.Run(role+" schema", func(t *testing.T) {
			assertComputedReturnTableSDL(t, schemas[role].ToAST().Definitions, role)
		})
	}

	if got := inc.Snapshot(); len(got) != 1 ||
		got[0].Kind != metadata.InconsistencyKindComputedField {
		t.Fatalf("invalid array return must be isolated: %+v", got)
	}

	_, err = customArgumentQuery(
		t,
		conn,
		"cf_no_grant",
		`query { cf_select_items { id p14_one { id } } }`,
		nil,
	)
	if err == nil || !strings.Contains(err.Error(), "p14_one") {
		t.Fatalf("role without target permission used table field: %v", err)
	}

	root, err := customArgumentQuery(
		t,
		conn,
		"cf_no_grant",
		`query { cf_select_items(order_by:{id:asc}) { id } }`,
		nil,
	)
	if err != nil || root == nil {
		t.Fatalf("unrelated items root missing: %v, %v", root, err)
	}

	for _, tc := range []struct {
		role, name, want string
	}{
		{"admin", "one", `[[{"id":1}],[{"id":null}]]`},
		{"cf_reader", "one", `[[{"id":1}],[{"id":null}]]`},
		{"cf_filtered_one", "one", `[[{"id":1}],[]]`},
		{"cf_filtered_three", "one", `[[],[]]`},
		{"admin", "null", `[[{"id":null}],[{"id":null}]]`},
		{"cf_reader", "null", `[[{"id":null}],[{"id":null}]]`},
		{"cf_filtered_one", "null", `[[],[]]`},
		{"admin", "missing", `[[{"id":null}],[{"id":null}]]`},
		{"cf_filtered_three", "missing", `[[],[]]`},
		{"admin", "synthetic", `[[{"id":9999}],[{"id":9999}]]`},
		{"cf_reader", "synthetic", `[[{"id":9999}],[{"id":9999}]]`},
		{"cf_filtered_one", "synthetic", `[[],[]]`},
	} {
		t.Run(tc.role+" "+tc.name, func(t *testing.T) {
			assertComputedReturnTableRows(t, conn, tc.role, tc.name, tc.want)
		})
	}

	for _, tc := range []struct {
		name, role, query, want string
	}{
		{"modifier", "admin", `query { cf_select_items(order_by:{id:asc}) { p14_one(where:{id:{_eq:1}}) { id } } }`, `{"cf_select_items":[{"p14_one":[{"id":1}]},{"p14_one":[]}]}`},
		{"boolean", "cf_reader", `query { cf_select_items(where:{p14_one:{id:{_eq:1}}}) { id } }`, `{"cf_select_items":[{"id":1}]}`},
		{"filtered boolean", "cf_filtered_three", `query { cf_select_items(where:{p14_one:{id:{_eq:1}}}) { id } }`, `{"cf_select_items":[]}`},
		{"aggregate order", "cf_reader", `query { cf_select_items(order_by:{p14_one_aggregate:{max:{id:asc}}}) { id } }`, `{"cf_select_items":[{"id":1},{"id":2}]}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := customArgumentQuery(t, conn, tc.role, tc.query, nil)
			if err != nil {
				t.Fatal(err)
			}

			encoded, err := json.Marshal(got)
			if err != nil || string(encoded) != tc.want {
				t.Fatalf("result %s, want %s (err %v)", encoded, tc.want, err)
			}
		})
	}
}

//nolint:paralleltest // Cases share one connector; each negative query is isolated.
func TestComputedSetofScalarResultsAndInputs(t *testing.T) {
	conn, _ := computedReturnConnector(t, "")

	schemas, err := conn.GetSchema()
	if err != nil {
		t.Fatal(err)
	}

	for _, role := range []string{"admin", "cf_reader"} {
		assertComputedSetofScalarSDL(t, schemas[role].ToAST().Definitions, role)
	}

	for _, tc := range []struct {
		name, query, want string
	}{
		{"zero direct", `query { cf_select_items { id p14_zero } }`, `{"cf_select_items":[null,null]}`},
		{"single direct", `query { cf_select_items(order_by:{id:asc}) { id p14_single } }`, `{"cf_select_items":[{"id":1,"p14_single":"single1"},{"id":2,"p14_single":"single2"}]}`},
		{"zero order", `query { cf_select_items(order_by:{p14_zero:asc}) { id } }`, `{"cf_select_items":[]}`},
		{"single order", `query { cf_select_items(order_by:{p14_single:asc}) { id } }`, `{"cf_select_items":[{"id":1},{"id":2}]}`},
		{"many order", `query { cf_select_items(order_by:{p14_many:asc}) { id } }`, `{"cf_select_items":[{"id":2},{"id":2}]}`},
		{"zero max", `query { cf_select_items_aggregate { aggregate { max { p14_zero } } } }`, `{"cf_select_items_aggregate":{"aggregate":{"max":{"p14_zero":null}}}}`},
		{"single max", `query { cf_select_items_aggregate { aggregate { max { p14_single } } } }`, `{"cf_select_items_aggregate":{"aggregate":{"max":{"p14_single":"single2"}}}}`},
		{"many max", `query { cf_select_items_aggregate { aggregate { max { p14_many } } } }`, `{"cf_select_items_aggregate":{"aggregate":{"max":{"p14_many":"v2"}}}}`},
	} {
		for _, role := range []string{"admin", "cf_reader"} {
			t.Run(role+" "+tc.name, func(t *testing.T) {
				got, err := customArgumentQuery(t, conn, role, tc.query, nil)
				if err != nil {
					t.Fatal(err)
				}

				encoded, err := json.Marshal(got)
				if err != nil || string(encoded) != tc.want {
					t.Fatalf("result %s, want %s (err %v)", encoded, tc.want, err)
				}
			})
		}
	}

	for _, role := range []string{"admin", "cf_reader"} {
		for _, name := range []string{"zero", "single", "many"} {
			t.Run(role+" "+name+" predicate", func(t *testing.T) {
				_, err := customArgumentQuery(
					t,
					conn,
					role,
					`query { cf_select_items(where:{p14_`+name+`:{_eq:"v1"}}) { id } }`,
					nil,
				)

				var pgErr *pgconn.PgError
				if !errors.As(err, &pgErr) || pgErr.Code != "0A000" {
					t.Fatalf("predicate SQLSTATE = %v, want 0A000", err)
				}
			})
		}

		t.Run(role+" multi-row direct", func(t *testing.T) {
			_, err := customArgumentQuery(
				t,
				conn,
				role,
				`query { cf_select_items { p14_many } }`,
				nil,
			)

			var pgErr *pgconn.PgError
			if !errors.As(err, &pgErr) || pgErr.Code != "21000" {
				t.Fatalf("multi-row SQLSTATE = %v, want 21000", err)
			}
		})
	}
}

//nolint:paralleltest // Own isolated testdb and connector; explicit table grants are invalid.
func TestComputedSingleTableExplicitGrantRevokesRole(t *testing.T) {
	conn, inc := computedReturnConnector(t, "one")

	found := false
	for _, item := range inc.Snapshot() {
		if item.Kind == metadata.InconsistencyKindSelectPermission &&
			item.Name == "cf_select.items.cf_reader" {
			found = true
		}
	}

	if !found {
		t.Fatalf("missing invalid explicit table grant: %+v", inc.Snapshot())
	}

	schemas, err := conn.GetSchema()
	if err != nil {
		t.Fatal(err)
	}

	if schemas["cf_reader"].ToAST().Definitions.ForName("cf_select_items") != nil ||
		schemas["cf_no_grant"].ToAST().Definitions.ForName("cf_select_items") == nil {
		t.Fatal("explicit table grant did not revoke only the granting role")
	}
}

//nolint:paralleltest // Own isolated testdb and connector, independent of the valid-return matrix.
func TestComputedArrayReturnRevokesOnlyGrantingRole(t *testing.T) {
	conn, inc := computedReturnConnector(t, "text_array")

	foundField, foundGrant := false, false
	for _, item := range inc.Snapshot() {
		if item.Kind == metadata.InconsistencyKindComputedField &&
			item.Name == "cf_select.items.p14_text_array" {
			foundField = true
		}

		if item.Kind == metadata.InconsistencyKindSelectPermission &&
			item.Name == "cf_select.items.cf_reader" {
			foundGrant = true
		}
	}

	if !foundField || !foundGrant {
		t.Fatalf("invalid definition/grant inconsistencies: %+v", inc.Snapshot())
	}

	schemas, err := conn.GetSchema()
	if err != nil {
		t.Fatal(err)
	}

	if schemas["cf_reader"].ToAST().Definitions.ForName("cf_select_items") != nil ||
		schemas["cf_no_grant"].ToAST().Definitions.ForName("cf_select_items") == nil ||
		schemas["admin"].ToAST().Definitions.ForName(
			"cf_select_items",
		).Fields.ForName(
			"p14_text_array",
		) != nil {
		t.Fatal("array return exposed or unrelated role permission lost")
	}
}

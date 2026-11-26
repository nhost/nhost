package sql_test

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	csql "github.com/nhost/nhost/services/constellation/connector/sql"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// These definitions live in an isolated testdb, never in the shared Hasura
// source. Both public and non-public types are cast by the same SQL writer.
const customArgumentDDL = `
CREATE DOMAIN public.p14_public_posint AS integer CHECK (VALUE > 0);
CREATE DOMAIN cf_select.p14_posint AS integer CHECK (VALUE > 0);
CREATE DOMAIN cf_select.p14_label AS text CHECK (VALUE <> '');
CREATE TYPE cf_select.p14_mood AS ENUM ('sad', 'ok', 'happy');
CREATE TYPE cf_select.p14_pair AS (a integer, b text);
CREATE FUNCTION cf_select.p14_public(item cf_select.items, n public.p14_public_posint)
RETURNS numeric LANGUAGE sql STABLE AS $$ SELECT item.amount + n $$;
CREATE FUNCTION cf_select.p14_int(item cf_select.items, n cf_select.p14_posint)
RETURNS numeric LANGUAGE sql STABLE AS $$ SELECT item.amount + n $$;
CREATE FUNCTION cf_select.p14_text(item cf_select.items, l cf_select.p14_label)
RETURNS text LANGUAGE sql STABLE AS $$ SELECT item.label || l $$;
CREATE FUNCTION cf_select.p14_enum(item cf_select.items, m cf_select.p14_mood DEFAULT 'ok')
RETURNS text LANGUAGE sql STABLE AS $$ SELECT m::text $$;
CREATE FUNCTION cf_select.p14_pair(item cf_select.items, p cf_select.p14_pair)
RETURNS text LANGUAGE sql STABLE AS $$ SELECT (p).a::text || ':' || (p).b $$;
CREATE FUNCTION cf_select.p14_range(item cf_select.items, r int4range)
RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT r @> item.id $$;
CREATE FUNCTION cf_select.p14_multirange(item cf_select.items, r int4multirange)
RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT r @> item.id $$;
CREATE FUNCTION cf_select.p14_array(item cf_select.items, ids integer[])
RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT item.id = ANY(ids) $$;
CREATE FUNCTION cf_select.p14_enum_array(item cf_select.items, m cf_select.p14_mood[])
RETURNS text LANGUAGE sql STABLE AS $$ SELECT array_to_string(m, ',') $$;
CREATE FUNCTION cf_select.p14_tags(item cf_select.items, n cf_select.p14_posint)
RETURNS SETOF cf_select.tags LANGUAGE sql STABLE AS $$
 SELECT t.id, t.item_id, t.label FROM cf_select.tags t WHERE t.item_id = item.id AND t.id = n
$$;
CREATE FUNCTION cf_select.p14_immutable(item cf_select.items)
RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'immutable'::text $$;
`

func customArgumentConnector(t *testing.T) *csql.Connector {
	t.Helper()

	fixture := computedTestDB(t)
	if _, err := fixture.Exec(t.Context(), customArgumentDDL); err != nil {
		t.Fatalf("install custom argument functions: %v", err)
	}

	md, err := metadata.FromHasuraJSON(computedFixture(t, "metadata.json"))
	if err != nil {
		t.Fatalf("parse fixture metadata: %v", err)
	}

	parent := &md.Databases[0].Tables[0]
	for _, name := range []string{"public", "int", "text", "enum", "pair", "range", "multirange", "array", "enum_array", "tags"} {
		parent.ComputedFields = append(parent.ComputedFields, metadata.ComputedField{
			Name: "p14_" + name,
			Definition: metadata.ComputedFieldDefinition{
				Function: metadata.FunctionSource{Schema: "cf_select", Name: "p14_" + name},
			},
		})
		if name != "tags" {
			parent.SelectPermissions[1].Permission.ComputedFields = append(
				parent.SelectPermissions[1].Permission.ComputedFields, "p14_"+name)
		}
	}

	parent.ComputedFields = append(parent.ComputedFields, metadata.ComputedField{
		Name: "p14_immutable",
		Definition: metadata.ComputedFieldDefinition{
			Function: metadata.FunctionSource{Schema: "cf_select", Name: "p14_immutable"},
		},
	})
	parent.SelectPermissions[1].Permission.ComputedFields = append(
		parent.SelectPermissions[1].Permission.ComputedFields, "p14_immutable",
	)

	pool, err := postgres.Open(t.Context(), fixture.Config().ConnString())
	if err != nil {
		t.Fatalf("open custom argument pool: %v", err)
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
		t.Fatalf("build custom argument connector: %v", err)
	}

	t.Cleanup(conn.Close)

	if found := inc.Snapshot(); len(found) != 0 {
		t.Fatalf("custom argument inconsistency: %+v", found)
	}

	return conn
}

func customArgumentQuery(
	t *testing.T,
	conn *csql.Connector,
	role, query string,
	variables map[string]any,
) (map[string]any, error) {
	t.Helper()

	doc, err := parser.ParseQuery(&ast.Source{Input: query})
	if err != nil {
		t.Fatalf("parse custom argument query: %v", err)
	}

	result, err := conn.Execute(
		t.Context(),
		doc.Operations[0],
		doc.Fragments,
		variables,
		role,
		nil,
		slog.Default(),
	)
	if err != nil {
		return nil, fmt.Errorf("executing custom argument query: %w", err)
	}

	encoded, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("encode custom argument result: %v", err)
	}

	var decoded map[string]any
	if err := json.Unmarshal(encoded, &decoded); err != nil {
		t.Fatalf("decode custom argument result: %v", err)
	}

	return decoded, nil
}

//nolint:cyclop,gocognit,gocyclo,paralleltest,tparallel // Shared connector includes an ordered insert; subtests cannot race it.
func TestComputedCustomArgumentRolesAndExecution(t *testing.T) {
	t.Parallel()
	conn := customArgumentConnector(t)

	schemas, err := conn.GetSchema()
	if err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct {
		role, field, argType string
		present              bool
	}{
		{"admin", "p14_public", "p14_public_posint", true},
		{"admin", "p14_int", "p14_posint", true},
		{"admin", "p14_text", "p14_label", true},
		{"admin", "p14_enum", "p14_mood", true},
		{"admin", "p14_pair", "p14_pair_scalar", true},
		{"admin", "p14_range", "int4range", true},
		{"admin", "p14_multirange", "int4multirange", true},
		{"admin", "p14_array", "_int4", true},
		{"admin", "p14_enum_array", "_p14_mood", true},
		{"admin", "p14_tags", "p14_posint", true},
		{"cf_reader", "p14_int", "p14_posint", true},
		{"cf_reader", "p14_pair", "p14_pair_scalar", true},
		{"cf_reader", "p14_tags", "p14_posint", true},
		{"cf_no_grant", "p14_int", "p14_posint", false},
		{"cf_no_grant", "p14_tags", "p14_posint", false},
	} {
		t.Run(tc.role+"/"+tc.field, func(t *testing.T) {
			definitions := schemas[tc.role].ToAST().Definitions

			field := definitions.ForName("cf_select_items").Fields.ForName(tc.field)
			if (field != nil) != tc.present {
				t.Fatalf("field present=%t, want %t", field != nil, tc.present)
			}

			if !tc.present {
				if definitions.ForName(tc.field+"_cf_select_items_args") != nil ||
					definitions.ForName(tc.argType) != nil {
					t.Fatalf("ungranted role received private computed argument types")
				}

				return
			}

			args := definitions.ForName(tc.field + "_cf_select_items_args")
			argument := field.Arguments.ForName("args")

			expectRequired := tc.field != "p14_enum"
			if args == nil || len(args.Fields) != 1 || args.Fields[0].Type.Name() != tc.argType ||
				args.Fields[0].Type.NonNull || argument == nil ||
				argument.Type.NonNull != expectRequired ||
				argument.Type.Name() != tc.field+"_cf_select_items_args" ||
				definitions.ForName(tc.argType) == nil ||
				definitions.ForName(tc.argType).Kind != ast.Scalar {
				t.Fatalf("incorrect scalar/args for %s: %+v", tc.field, args)
			}
		})
	}

	for _, role := range []string{"admin", "cf_reader", "cf_no_grant"} {
		definitions := schemas[role].ToAST().Definitions

		immutable := definitions.ForName("cf_select_items").Fields.ForName("p14_immutable")
		if (immutable != nil) != (role != "cf_no_grant") ||
			immutable != nil && len(immutable.Arguments) != 0 {
			t.Fatalf("%s immutable field visibility/arguments: %+v", role, immutable)
		}

		maxFields := definitions.ForName("cf_select_items_max_fields")
		if role == "cf_no_grant" {
			if maxFields != nil {
				t.Fatalf("%s unexpectedly has aggregate output: %+v", role, maxFields)
			}

			continue
		}

		if maxFields == nil || maxFields.Fields.ForName("p14_int") == nil {
			t.Fatalf("%s aggregate output does not follow scalar grant: %+v", role, maxFields)
		}
	}

	for _, tc := range []struct {
		name, query, want string
	}{
		{"public domain", `query { cf_select_items(where:{id:{_eq:1}}) { p14_public(args:{n:"2"}) } }`, `{"cf_select_items":[{"p14_public":14.5}]}`},
		{"nonpublic domain", `query { cf_select_items(where:{id:{_eq:1}}) { p14_int(args:{n:"2"}) } }`, `{"cf_select_items":[{"p14_int":14.5}]}`},
		{"null", `query { cf_select_items(where:{id:{_eq:1}}) { p14_int(args:{n:null}) } }`, `{"cf_select_items":[{"p14_int":null}]}`},
		{"public null", `query { cf_select_items(where:{id:{_eq:1}}) { p14_public(args:{n:null}) } }`, `{"cf_select_items":[{"p14_public":null}]}`},
		{"enum null", `query { cf_select_items(where:{id:{_eq:1}}) { p14_enum(args:{m:null}) } }`, `{"cf_select_items":[{"p14_enum":null}]}`},
		{"text domain", `query { cf_select_items(where:{id:{_eq:1}}) { p14_text(args:{l:"!"}) } }`, `{"cf_select_items":[{"p14_text":"first!"}]}`},
		{"enum default", `query { cf_select_items(where:{id:{_eq:1}}) { p14_enum } }`, `{"cf_select_items":[{"p14_enum":"ok"}]}`},
		{"immutable", `query { cf_select_items(where:{id:{_eq:1}}) { p14_immutable } }`, `{"cf_select_items":[{"p14_immutable":"immutable"}]}`},
		{"enum explicit", `query { cf_select_items(where:{id:{_eq:1}}) { p14_enum(args:{m:"happy"}) } }`, `{"cf_select_items":[{"p14_enum":"happy"}]}`},
		{"enum token", `query { cf_select_items(where:{id:{_eq:1}}) { p14_enum(args:{m:happy}) } }`, `{"cf_select_items":[{"p14_enum":"happy"}]}`},
		{"enum array", `query { cf_select_items(where:{id:{_eq:1}}) { p14_enum_array(args:{m:"{ok,happy}"}) } }`, `{"cf_select_items":[{"p14_enum_array":"ok,happy"}]}`},
		{"enum array quoted identifier", `query { cf_select_items(where:{id:{_eq:1}}) { p14_enum_array(args:{m:"{sad}"}) } }`, `{"cf_select_items":[{"p14_enum_array":"sad"}]}`},
		{"composite", `query { cf_select_items(where:{id:{_eq:1}}) { p14_pair(args:{p:"(1,x)"}) } }`, `{"cf_select_items":[{"p14_pair":"1:x"}]}`},
		{"range", `query { cf_select_items(where:{id:{_eq:1}}) { p14_range(args:{r:"[1,2)"}) } }`, `{"cf_select_items":[{"p14_range":true}]}`},
		{"multirange", `query { cf_select_items(where:{id:{_eq:1}}) { p14_multirange(args:{r:"{[1,2)}"}) } }`, `{"cf_select_items":[{"p14_multirange":true}]}`},
		{"array", `query { cf_select_items(where:{id:{_eq:1}}) { p14_array(args:{ids:"{1}"}) } }`, `{"cf_select_items":[{"p14_array":true}]}`},
		{"setof domain", `query { cf_select_items(where:{id:{_eq:1}}) { p14_tags(args:{n:"1"}) { id } } }`, `{"cf_select_items":[{"p14_tags":[{"id":1}]}]}`},
		{"setof domain null", `query { cf_select_items(where:{id:{_eq:1}}) { p14_tags(args:{n:null}) { id } } }`, `{"cf_select_items":[{"p14_tags":[]}]}`},
		{"aggregate", `query { cf_select_items_aggregate { aggregate { max { p14_int(args:{n:"2"}) } } } }`, `{"cf_select_items_aggregate":{"aggregate":{"max":{"p14_int":14.5}}}}`},
		{"mutation returning", `mutation { insert_cf_select_items_one(object:{id:4,owner_id:1,label:"new",amount:1,payload:{}}) { p14_int(args:{n:"2"}) } }`, `{"insert_cf_select_items_one":{"p14_int":3}}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := customArgumentQuery(t, conn, "admin", tc.query, nil)
			if err != nil {
				t.Fatalf("execute %s: %v", tc.name, err)
			}

			encoded, err := json.Marshal(got)
			if err != nil || string(encoded) != tc.want {
				t.Fatalf("result %s, want %s (err %v)", encoded, tc.want, err)
			}
		})
	}

	got, err := customArgumentQuery(
		t,
		conn,
		"cf_reader",
		`query { cf_select_items(where:{id:{_eq:1}}) { p14_int(args:{n:"2"}) p14_tags(args:{n:"1"}) { id } } }`,
		nil,
	)
	if err != nil {
		t.Fatalf("granted reader execution: %v", err)
	}

	encoded, err := json.Marshal(got)
	if err != nil ||
		string(encoded) != `{"cf_select_items":[{"p14_int":14.5,"p14_tags":[{"id":1}]}]}` {
		t.Fatalf("granted reader result: %s (err %v)", encoded, err)
	}
}

//nolint:cyclop,gocognit,paralleltest,tparallel // Error paths share a connector and isolated test database.
func TestComputedCustomArgumentErrors(t *testing.T) {
	t.Parallel()
	conn := customArgumentConnector(t)

	for _, tc := range []struct {
		name, field, argument, input, typeName string
	}{
		{"public number", "public", "n", "2", "p14_public_posint"},
		{"domain number", "int", "n", "2", "p14_posint"},
		{"enum number", "enum", "m", "1", "p14_mood"},
		{"enum array list", "enum_array", "m", "[ok,happy]", "_p14_mood"},
		{"enum array number", "enum_array", "m", "1", "_p14_mood"},
		{"composite object", "pair", "p", `{a:1,b:"x"}`, "p14_pair"},
		{"array list", "array", "ids", "[1]", "_int4"},
		{"range number", "range", "r", "1", "int4range"},
		{"multirange number", "multirange", "r", "1", "int4multirange"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			query := `query { cf_select_items { p14_` + tc.field + `(args:{` + tc.argument + `:` + tc.input + `}) } }`
			for _, role := range []string{"admin", "cf_reader"} {
				_, err := customArgumentQuery(t, conn, role, query, nil)

				var invalid *arguments.QueryValidationError
				if !errors.As(err, &invalid) {
					t.Fatalf("%s: expected parse failure, got %v", role, err)
				}

				ext, ok := invalid.AsMap()["extensions"].(map[string]any)
				if !ok {
					t.Fatalf("%s: missing parse extensions: %+v", role, invalid.AsMap())
				}

				path := "$.selectionSet.cf_select_items.selectionSet.p14_" + tc.field + ".args.args." + tc.argument
				if invalid.Error() != "A string is expected for type: "+tc.typeName ||
					ext["code"] != "parse-failed" || ext["path"] != path {
					t.Fatalf("%s: parse failure = %+v, want path %s", role, invalid.AsMap(), path)
				}
			}
		})
	}

	for _, tc := range []struct {
		name, field, argument, input, sqlState string
	}{
		{"public check", "public", "n", `"0"`, "23514"},
		{"nonpublic check", "int", "n", `"0"`, "23514"},
		{"invalid integer", "int", "n", `"x"`, "22P02"},
		{"public invalid integer", "public", "n", `"x"`, "22P02"},
		{"empty text", "text", "l", `""`, "23514"},
		{"invalid enum", "enum", "m", `"angry"`, "22P02"},
		{"invalid enum array", "enum_array", "m", `"{angry}"`, "22P02"},
		{"invalid range", "range", "r", `"nope"`, "22P02"},
		{"invalid multirange", "multirange", "r", `"nope"`, "22P02"},
		{"invalid array", "array", "ids", `"nope"`, "22P02"},
		{"invalid composite", "pair", "p", `"(nope,x)"`, "22P02"},
		{"table domain check", "tags", "n", `"0"`, "23514"},
		{"table invalid integer", "tags", "n", `"x"`, "22P02"},
		{"parameterized injection", "int", "n", `"2);DROP TABLE cf_select.items;--"`, "22P02"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			selection := ""
			if tc.field == "tags" {
				selection = " { id }"
			}

			query := `query { cf_select_items { p14_` + tc.field + `(args:{` + tc.argument + `:` + tc.input + `})` + selection + ` } }`
			_, err := customArgumentQuery(t, conn, "admin", query, nil)

			var pgErr *pgconn.PgError
			if !errors.As(err, &pgErr) || pgErr.Code != tc.sqlState {
				t.Fatalf("SQLSTATE = %v, want %s", err, tc.sqlState)
			}
		})
	}

	_, err := customArgumentQuery(
		t,
		conn,
		"admin",
		`query { cf_select_items { p14_tags(args:{n:2}) { id } } }`,
		nil,
	)

	var tableArg *arguments.QueryValidationError
	if !errors.As(err, &tableArg) {
		t.Fatalf("SETOF domain must reject non-string: %v", err)
	}

	tableExt, ok := tableArg.AsMap()["extensions"].(map[string]any)
	if !ok || tableExt["code"] != "parse-failed" ||
		tableExt["path"] != "$.selectionSet.cf_select_items.selectionSet.p14_tags.args.args.n" {
		t.Fatalf("SETOF domain parse envelope: %+v", tableArg.AsMap())
	}

	variableQuery := `query ($n:p14_posint) { cf_select_items(where:{id:{_eq:1}}) { p14_int(args:{n:$n}) } }`

	got, err := customArgumentQuery(t, conn, "admin", variableQuery, map[string]any{"n": "2"})
	if err != nil || got == nil {
		t.Fatalf("custom scalar variable: %v, %v", got, err)
	}

	_, err = customArgumentQuery(t, conn, "admin", variableQuery, map[string]any{"n": 2})

	var invalid *arguments.QueryValidationError
	if !errors.As(err, &invalid) ||
		invalid.AsMap()["message"] != "A string is expected for type: p14_posint" {
		t.Fatalf("non-string custom scalar variable: %v", err)
	}

	_, err = customArgumentQuery(
		t,
		conn,
		"cf_no_grant",
		`query { cf_select_items { p14_int(args:{n:"2"}) } }`,
		nil,
	)
	if err == nil || !strings.Contains(err.Error(), "p14_int") {
		t.Fatalf("ungranted selection should fail: %v", err)
	}
}

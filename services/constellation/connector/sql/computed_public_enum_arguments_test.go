package sql_test

import (
	"encoding/json"
	"errors"
	"log/slog"
	"testing"

	csql "github.com/nhost/nhost/services/constellation/connector/sql"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/metadata"
)

const computedPublicEnumDDL = `
CREATE TYPE public.p14_public_mood AS ENUM ('sad','happy');
CREATE FUNCTION cf_select.p14_public_enum(item cf_select.items, m public.p14_public_mood DEFAULT 'happy')
 RETURNS text LANGUAGE sql STABLE AS $$ SELECT coalesce(m::text, 'NULL') $$;
CREATE FUNCTION cf_select.p14_public_enum_array(item cf_select.items, m public.p14_public_mood[] DEFAULT '{happy}')
 RETURNS text LANGUAGE sql STABLE AS $$ SELECT coalesce(array_to_string(m, ','), 'NULL') $$;
`

func computedPublicEnumConnector(t *testing.T) *csql.Connector {
	t.Helper()

	fixture := computedTestDB(t)
	if _, err := fixture.Exec(t.Context(), computedPublicEnumDDL); err != nil {
		t.Fatalf("install public enum fixture: %v", err)
	}

	md, err := metadata.FromHasuraJSON(computedFixture(t, "metadata.json"))
	if err != nil {
		t.Fatal(err)
	}

	parent := &md.Databases[0].Tables[0]
	for _, name := range []string{"p14_public_enum", "p14_public_enum_array"} {
		parent.ComputedFields = append(parent.ComputedFields, metadata.ComputedField{
			Name: name,
			Definition: metadata.ComputedFieldDefinition{
				Function: metadata.FunctionSource{Schema: "cf_select", Name: name},
			},
		})
		parent.SelectPermissions[1].Permission.ComputedFields = append(
			parent.SelectPermissions[1].Permission.ComputedFields, name)
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
		t.Fatalf("public enum fixture inconsistencies: %+v", got)
	}

	return conn
}

//nolint:paralleltest,cyclop,gocognit // One testdb owns the public enum and array matrix.
func TestComputedPublicEnumArguments(t *testing.T) {
	conn := computedPublicEnumConnector(t)

	schemas, err := conn.GetSchema()
	if err != nil {
		t.Fatal(err)
	}

	for _, role := range []string{"admin", "cf_reader"} {
		defs := schemas[role].ToAST().Definitions
		for _, kind := range []struct{ field, scalar string }{
			{"p14_public_enum", "p14_public_mood"},
			{"p14_public_enum_array", "_p14_public_mood"},
		} {
			field := defs.ForName("cf_select_items").Fields.ForName(kind.field)

			args := defs.ForName(kind.field + "_cf_select_items_args")
			if field == nil || args == nil || args.Fields.ForName("m") == nil ||
				args.Fields.ForName(
					"m",
				).Type.Name() != kind.scalar || field.Arguments.ForName("args") == nil ||
				defs.ForName(kind.scalar) == nil {
				t.Fatalf("%s %s public enum args unavailable", role, kind.field)
			}
		}
	}

	denied := schemas["cf_no_grant"].ToAST().Definitions
	if denied.ForName("cf_select_items").Fields.ForName("p14_public_enum") != nil ||
		denied.ForName("cf_select_items").Fields.ForName("p14_public_enum_array") != nil {
		t.Fatal("ungranted role sees public enum computed fields")
	}

	for _, tc := range []struct{ name, field, args, want string }{
		{"scalar bare", "p14_public_enum", `(args:{m:happy})`, "happy"},
		{"scalar quoted", "p14_public_enum", `(args:{m:"happy"})`, "happy"},
		{"scalar null", "p14_public_enum", `(args:{m:null})`, "NULL"},
		{"scalar default", "p14_public_enum", "", "happy"},
		{"array quoted", "p14_public_enum_array", `(args:{m:"{happy}"})`, "happy"},
		{"array null", "p14_public_enum_array", `(args:{m:null})`, "NULL"},
		{"array default", "p14_public_enum_array", "", "happy"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			query := `{cf_select_items(where:{id:{_eq:1}}){` + tc.field + tc.args + `}}`
			for _, role := range []string{"admin", "cf_reader"} {
				got, err := customArgumentQuery(t, conn, role, query, nil)
				if err != nil {
					t.Fatalf("%s: %v", role, err)
				}

				b, err := json.Marshal(got)
				if err != nil ||
					string(b) != `{"cf_select_items":[{"`+tc.field+`":"`+tc.want+`"}]}` {
					t.Fatalf("%s: %s (%v)", role, b, err)
				}
			}
		})
	}

	for _, tc := range []struct{ name, field, input, state string }{
		{"scalar invalid", "p14_public_enum", `"angry"`, "22P02"},
		{"array bare malformed", "p14_public_enum_array", `happy`, "22P02"},
		{"array invalid", "p14_public_enum_array", `"{angry}"`, "22P02"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			query := `{cf_select_items(where:{id:{_eq:1}}){` + tc.field + `(args:{m:` + tc.input + `})}}`
			assertSetofKindError(t, conn, "admin", query, tc.state)
		})
	}

	for _, tc := range []struct{ name, field, input, scalar string }{
		{"scalar numeric", "p14_public_enum", `1`, "p14_public_mood"},
		{"array list", "p14_public_enum_array", `[happy]`, "_p14_public_mood"},
		{"array numeric", "p14_public_enum_array", `1`, "_p14_public_mood"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			query := `{cf_select_items(where:{id:{_eq:1}}){` + tc.field + `(args:{m:` + tc.input + `})}}`
			_, err := customArgumentQuery(t, conn, "cf_reader", query, nil)

			var validation *arguments.QueryValidationError
			if !errors.As(err, &validation) ||
				validation.Error() != "A string is expected for type: "+tc.scalar {
				t.Fatalf("parse failure: %v", err)
			}

			ext, ok := validation.AsMap()["extensions"].(map[string]any)
			if !ok || ext["code"] != "parse-failed" ||
				ext["path"] != "$.selectionSet.cf_select_items.selectionSet."+tc.field+".args.args.m" {
				t.Fatalf("parse path/code: %+v", validation.AsMap())
			}
		})
	}
}

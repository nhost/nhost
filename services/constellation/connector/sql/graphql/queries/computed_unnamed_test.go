package queries_test

import (
	"reflect"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/metadata"
)

//nolint:cyclop // The argument combinations share one isolated catalog and schema fixture.
func TestUnnamedComputedArgumentNumberedByUserInputs(t *testing.T) {
	t.Parallel()
	//nolint:dogsled // The fixture provides a fresh isolated database, objects and metadata.
	_, pool, _, md, _ := computedTestFixture(t)
	if _, err := pool.Exec(
		t.Context(),
		`CREATE FUNCTION cf_select.item_unnamed(cf_select.items, integer)
RETURNS integer LANGUAGE sql STABLE AS $$ SELECT $2 $$;
CREATE FUNCTION cf_select.item_unnamed_first(integer, item cf_select.items)
RETURNS integer LANGUAGE sql STABLE AS $$ SELECT $1 + item.id $$;
CREATE FUNCTION cf_select.item_mixed(item cf_select.items, scale integer, integer)
RETURNS integer LANGUAGE sql STABLE AS $$ SELECT scale + $3 $$;
CREATE FUNCTION cf_select.item_two_unnamed(cf_select.items, integer, integer)
RETURNS integer LANGUAGE sql STABLE AS $$ SELECT $2 + $3 $$;`,
	); err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct {
		name, rowArg string
	}{{"item_unnamed", ""}, {"item_unnamed_first", "item"}, {"item_mixed", "item"}, {"item_two_unnamed", ""}} {
		md.Tables[0].ComputedFields = append(md.Tables[0].ComputedFields, metadata.ComputedField{
			Name: tc.name, Definition: metadata.ComputedFieldDefinition{
				Function:      metadata.FunctionSource{Schema: "cf_select", Name: tc.name},
				TableArgument: tc.rowArg,
			},
		})
	}

	for i := range md.Tables[0].SelectPermissions {
		if md.Tables[0].SelectPermissions[i].Role == "cf_reader" {
			md.Tables[0].SelectPermissions[i].Permission.ComputedFields = append(
				md.Tables[0].SelectPermissions[i].Permission.ComputedFields,
				"item_unnamed",
				"item_unnamed_first",
				"item_mixed",
				"item_two_unnamed",
			)
		}
	}

	pgPool, err := postgres.Open(t.Context(), pool.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatal(err)
	}

	client := postgres.NewClient(pgPool)
	t.Cleanup(client.Close)

	objects, err := client.Introspect(t.Context(), md)
	if err != nil {
		t.Fatal(err)
	}

	caps := schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect())
	caps.SupportsComputedScalarSelection = true

	generated, err := schema.GenerateForRole(objects, "cf_reader", md, caps)
	if err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct {
		field string
		args  []string
	}{
		{field: "item_unnamed", args: []string{"arg_1"}},
		{field: "item_unnamed_first", args: []string{"arg_1"}},
		{field: "item_mixed", args: []string{"arg_1", "scale"}},
		{field: "item_two_unnamed", args: []string{"arg_1", "arg_2"}},
	} {
		field := generated.ToAST().Definitions.ForName("cf_select_items").Fields.ForName(tc.field)

		input := generated.ToAST().Definitions.ForName(tc.field + "_cf_select_items_args")
		if field == nil || input == nil || len(input.Fields) != len(tc.args) {
			t.Fatalf("%s: field=%+v input=%+v", tc.field, field, input)
		}

		for _, name := range tc.args {
			if input.Fields.ForName(name) == nil {
				t.Fatalf("%s missing argument %s: %+v", tc.field, name, input)
			}
		}
	}

	roots, _, err := queries.BuildRoots(objects, md, dialect.NewPostgresDialect(), caps)
	if err != nil {
		t.Fatal(err)
	}

	doc, err := parser.ParseQuery(
		&ast.Source{
			Input: `query { cf_select_items(where:{id:{_eq:1}}) { item_unnamed(args:{arg_1:7}) item_unnamed_first(args:{arg_1:6}) item_mixed(args:{scale:5,arg_1:8}) item_two_unnamed(args:{arg_1:2,arg_2:9}) } }`,
		},
	)
	if err != nil {
		t.Fatal(err)
	}

	ops, err := roots.BuildQuery(doc.Operations[0], doc.Fragments, nil, "cf_reader", nil)
	if err != nil {
		t.Fatal(err)
	}

	if len(ops) != 1 {
		t.Fatalf("operations = %d", len(ops))
	}

	if got := computedResult(t, pool, ops[0]); !reflect.DeepEqual(got, []any{
		map[string]any{
			"item_unnamed":       float64(7),
			"item_unnamed_first": float64(7),
			"item_mixed":         float64(13),
			"item_two_unnamed":   float64(11),
		},
	}) {
		t.Fatalf("unnamed argument result: %#v", got)
	}

	for _, query := range []string{
		`query { cf_select_items { item_unnamed(args:{arg_2:7}) } }`,
		`query { cf_select_items { item_two_unnamed(args:{arg_2:9}) } }`,
	} {
		missing, parseErr := parser.ParseQuery(&ast.Source{Input: query})
		if parseErr != nil {
			t.Fatal(parseErr)
		}

		if _, buildErr := roots.BuildQuery(
			missing.Operations[0],
			missing.Fragments,
			nil,
			"cf_reader",
			nil,
		); buildErr == nil {
			t.Fatalf("missing required arg_1 did not fail for %s", query)
		}
	}
}

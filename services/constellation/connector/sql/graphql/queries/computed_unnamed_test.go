package queries_test

import (
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestUnnamedComputedArgumentNeverAdvertised(t *testing.T) {
	t.Parallel()
	//nolint:dogsled // The fixture provides a fresh isolated database, objects and metadata.
	_, pool, _, md, _ := computedTestFixture(t)
	if _, err := pool.Exec(
		t.Context(),
		`CREATE FUNCTION cf_select.item_unnamed(cf_select.items, integer)
RETURNS integer LANGUAGE sql STABLE AS $$ SELECT $2 $$`,
	); err != nil {
		t.Fatal(err)
	}

	md.Tables[0].ComputedFields = append(md.Tables[0].ComputedFields, metadata.ComputedField{
		Name: "item_unnamed", Definition: metadata.ComputedFieldDefinition{
			Function: metadata.FunctionSource{Schema: "cf_select", Name: "item_unnamed"},
		},
	})
	for i := range md.Tables[0].SelectPermissions {
		if md.Tables[0].SelectPermissions[i].Role == "cf_reader" {
			md.Tables[0].SelectPermissions[i].Permission.ComputedFields = append(
				md.Tables[0].SelectPermissions[i].Permission.ComputedFields, "item_unnamed",
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

	if field := generated.ToAST().Definitions.ForName(
		"cf_select_items",
	).Fields.ForName(
		"item_unnamed",
	); field != nil {
		t.Fatalf("unexecutable field advertised: %+v", field)
	}

	if arg := generated.ToAST().Definitions.ForName(
		"item_unnamed_cf_select_items_args",
	); arg != nil {
		t.Fatalf("unexecutable argument type advertised: %+v", arg)
	}

	roots, _, err := queries.BuildRoots(objects, md, dialect.NewPostgresDialect(), caps)
	if err != nil {
		t.Fatal(err)
	}
	// A direct BuildRoots call, even without reconciliation, must reject the
	// deferred field rather than demanding an invisible arg_2 at runtime.
	doc, err := parser.ParseQuery(&ast.Source{Input: `query { cf_select_items { item_unnamed } }`})
	if err != nil {
		t.Fatal(err)
	}

	if _, err := roots.BuildQuery(
		doc.Operations[0],
		doc.Fragments,
		nil,
		"cf_reader",
		nil,
	); err == nil {
		t.Fatal("unexecutable unnamed argument reached SQL")
	}
}

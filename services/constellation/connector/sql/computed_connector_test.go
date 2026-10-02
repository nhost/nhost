package sql_test

import (
	"encoding/json"
	"log/slog"
	"os"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	csql "github.com/nhost/nhost/services/constellation/connector/sql"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

//nolint:cyclop // Exercises role schema, execution, test override and default-on production construction in one isolated testdb.
func TestComputedScalarConnectorDefaultOnAndOverride(t *testing.T) {
	t.Parallel()

	fixture := "../../integration/"

	ddl, err := os.ReadFile(
		fixture + "nhost/migrations/default/1790001000000_computed_fields/up.sql",
	)
	if err != nil {
		t.Fatal(err)
	}

	seed, err := os.ReadFile(fixture + "nhost/seeds/default/40-computed-fields.sql")
	if err != nil {
		t.Fatal(err)
	}

	raw, err := os.ReadFile(fixture + "computedfields/testdata/metadata.json")
	if err != nil {
		t.Fatal(err)
	}

	md, err := metadata.FromHasuraJSON(raw)
	if err != nil {
		t.Fatal(err)
	}

	pool := testdb.NewPostgres(t, string(ddl), string(seed))

	pgPool, err := postgres.Open(t.Context(), pool.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatal(err)
	}

	driver := postgres.NewClient(pgPool)
	// An explicit test override must be projected consistently to schema and roots.
	caps := schema.Capabilities{SupportsComputedScalarSelection: true}

	connector, err := csql.NewConnector(
		t.Context(),
		driver,
		&md.Databases[0],
		nil,
		slog.Default(),
		caps,
	)
	if err != nil {
		driver.Close()
		t.Fatal(err)
	}

	t.Cleanup(connector.Close)

	schemas, err := connector.GetSchema()
	if err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct {
		role    string
		granted bool
	}{{"cf_reader", true}, {"cf_no_grant", false}} {
		doc := schemas[tc.role].ToAST()

		item := doc.Definitions.ForName("cf_select_items")
		if item == nil {
			t.Fatalf("%s: no table schema", tc.role)
		}

		field := item.Fields.ForName("item_second")
		if (field != nil) != tc.granted {
			t.Fatalf("%s: computed field visibility = %t", tc.role, field != nil)
		}

		args := doc.Definitions.ForName("item_second_cf_select_items_args")
		if (args != nil) != tc.granted {
			t.Fatalf("%s: _args visibility = %t", tc.role, args != nil)
		}
	}

	query, err := parser.ParseQuery(
		&ast.Source{
			Input: `query { cf_select_items(where:{id:{_eq:1}}) { item_second(args:{multiplier:2}) item_payload(path:"status") } }`,
		},
	)
	if err != nil {
		t.Fatal(err)
	}

	result, err := connector.Execute(
		t.Context(),
		query.Operations[0],
		query.Fragments,
		nil,
		"cf_reader",
		nil,
		slog.Default(),
	)
	if err != nil {
		t.Fatal(err)
	}

	var rows []struct {
		Second  float64 `json:"item_second"`
		Payload string  `json:"item_payload"`
	}

	body, err := json.Marshal(result["cf_select_items"])
	if err != nil {
		t.Fatal(err)
	}

	if err := json.Unmarshal(body, &rows); err != nil {
		t.Fatal(err)
	}

	if len(rows) != 1 || rows[0].Second != 25 || rows[0].Payload != "ready" {
		t.Fatalf("connector response: %s", body)
	}
	// Production construction enables PostgreSQL scalar selections using the
	// same effective metadata and database function signatures.
	defaultPool, err := postgres.Open(t.Context(), pool.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatal(err)
	}

	defaultConnector, err := csql.NewConnector(
		t.Context(),
		postgres.NewClient(defaultPool),
		&md.Databases[0],
		nil,
		slog.Default(),
	)
	if err != nil {
		defaultPool.Close()
		t.Fatal(err)
	}

	t.Cleanup(defaultConnector.Close)

	defaultSchemas, err := defaultConnector.GetSchema()
	if err != nil {
		t.Fatal(err)
	}

	if defaultSchemas["cf_reader"].ToAST().Definitions.ForName(
		"cf_select_items",
	).Fields.ForName(
		"item_second",
	) == nil {
		t.Fatal("production connector omitted scalar selection")
	}
}

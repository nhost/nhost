package sql_test

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"log/slog"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	csql "github.com/nhost/nhost/services/constellation/connector/sql"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func computedFixture(t *testing.T, filename string) []byte {
	t.Helper()

	content, err := os.ReadFile(
		filepath.Join("../../integration/computedfields/testdata", filename),
	)
	if err != nil {
		t.Fatalf("read computed fixture %s: %v", filename, err)
	}

	return content
}

func assertComputedFixtureSchema(t *testing.T, roleSchema *graph.Schema) {
	t.Helper()

	if roleSchema == nil {
		t.Fatal("computed fixture role has no schema")
	}

	for _, obj := range roleSchema.Types {
		if obj.Name != "cf_fixture_items" {
			continue
		}

		for _, field := range obj.Fields {
			if field.Name == "item_label" {
				t.Fatal("untracked computed function appeared as a GraphQL field")
			}
		}

		return
	}

	t.Fatal("tracked fixture table is missing from the role schema")
}

// TestComputedFieldsFixtureSmoke exercises the checked-in, independent
// Constellation path against an isolated testdb; it needs no Hasura endpoint.
func TestComputedFieldsFixtureSmoke(t *testing.T) {
	t.Parallel()

	meta, err := metadata.FromHasuraJSON(computedFixture(t, "metadata.json"))
	if err != nil {
		t.Fatalf("load computed fixture metadata: %v", err)
	}

	if len(meta.Databases) != 1 {
		t.Fatalf("expected one computed fixture source, got %d", len(meta.Databases))
	}

	pool := testdb.NewPostgres(
		t,
		string(computedFixture(t, "schema.sql")),
		string(computedFixture(t, "seed.sql")),
	)

	pgPool, err := postgres.Open(t.Context(), pool.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatalf("connect to computed fixture database: %v", err)
	}

	conn, err := csql.NewConnector(
		t.Context(), postgres.NewClient(pgPool), &meta.Databases[0], nil, slog.Default(),
	)
	if err != nil {
		pgPool.Close()
		t.Fatalf("build computed fixture connector: %v", err)
	}

	t.Cleanup(conn.Close)

	schemas, err := conn.GetSchema()
	if err != nil {
		t.Fatalf("get computed fixture schemas: %v", err)
	}

	assertComputedFixtureSchema(t, schemas["cf_reader"])

	doc, err := parser.ParseQuery(&ast.Source{Input: `query {
		cf_fixture_items(order_by: {id: asc}) { id label }
	}`})
	if err != nil {
		t.Fatalf("parse computed fixture smoke query: %v", err)
	}

	result, err := conn.Execute(
		t.Context(), doc.Operations[0], nil, nil, "cf_reader", nil, slog.Default(),
	)
	if err != nil {
		t.Fatalf("execute computed fixture smoke query: %v", err)
	}

	payload, ok := result["cf_fixture_items"].(jsontext.Value)
	if !ok {
		t.Fatalf("expected JSON result for fixture table, got %T", result["cf_fixture_items"])
	}

	var rows []struct {
		ID    int    `json:"id"`
		Label string `json:"label"`
	}
	if err := json.Unmarshal(payload, &rows); err != nil {
		t.Fatalf("decode computed fixture result: %v", err)
	}

	want := []struct {
		ID    int    `json:"id"`
		Label string `json:"label"`
	}{{1, "first"}, {2, "second"}}
	if diff := cmp.Diff(want, rows); diff != "" {
		t.Errorf("fixture results differ (-want +got):\n%s", diff)
	}
}

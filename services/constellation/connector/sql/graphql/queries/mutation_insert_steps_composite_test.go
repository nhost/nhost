package queries_test

import (
	"log/slog"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestDependentInsertCompositeUUIDCitextProductPath(t *testing.T) {
	t.Parallel()
	seed := testdb.NewPostgres(t, `CREATE EXTENSION IF NOT EXISTS citext;
CREATE TABLE composite_parent(id uuid, label citext, PRIMARY KEY(id,label));
CREATE TABLE composite_child(row_id integer PRIMARY KEY, id uuid, label citext,
 FOREIGN KEY(id,label) REFERENCES composite_parent(id,label));`)

	pool, err := postgres.Open(t.Context(), seed.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(pool.Close)

	md := &metadata.DatabaseMetadata{
		Name: "default",
		Kind: "postgres",
		Tables: []metadata.TableMetadata{
			{
				Table: metadata.TableSource{Schema: "public", Name: "composite_parent"},
				ArrayRelationships: []metadata.ArrayRelationship{
					{Name: "children", Using: metadata.RelationshipUsing{
						ManualConfiguration: &metadata.ManualConfiguration{
							RemoteTable: metadata.TableSource{
								Schema: "public",
								Name:   "composite_child",
							},
							ColumnMapping: map[string]string{"id": "id", "label": "label"},
						},
					}},
				},
			},
			{Table: metadata.TableSource{Schema: "public", Name: "composite_child"}},
		},
	}
	client := postgres.NewClient(pool)

	objects, err := client.Introspect(t.Context(), md)
	if err != nil {
		t.Fatal(err)
	}

	roots, _, err := queries.BuildRoots(objects, md, dialect.NewPostgresDialect())
	if err != nil {
		t.Fatal(err)
	}

	doc, err := parser.ParseQuery(&ast.Source{Input: `mutation {
insert_composite_parent_one(object:{id:"550e8400-e29b-41d4-a716-446655440000",label:"Quoted λ",children:{data:[{row_id:1}]}}){id label children{row_id id label}}
}`})
	if err != nil {
		t.Fatal(err)
	}

	ops, err := roots.BuildQuery(doc.Operations[0], doc.Fragments, nil, "admin", nil)
	if err != nil {
		t.Fatal(err)
	}

	if len(ops) != 1 || ops[0].Insert == nil {
		t.Fatalf("missing dependent plan: %#v", ops)
	}

	if _, err := client.ExecuteOperations(
		t.Context(),
		ops,
		slog.New(slog.DiscardHandler),
	); err != nil {
		t.Fatal(err)
	}

	var id, label string
	if err := pool.QueryRow(t.Context(), `SELECT id::text, label::text FROM composite_child WHERE row_id=1`).
		Scan(&id, &label); err != nil {
		t.Fatal(err)
	}

	if id != "550e8400-e29b-41d4-a716-446655440000" || label != "Quoted λ" {
		t.Fatalf("composite typed FK = %q/%q", id, label)
	}
}

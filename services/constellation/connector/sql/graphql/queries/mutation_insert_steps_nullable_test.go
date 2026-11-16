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

func TestDependentInsertCapturedNullSourceRemainsNull(t *testing.T) {
	t.Parallel()

	ddl := dependentInsertDDL + `ALTER TABLE parent ADD COLUMN optional_token text;
ALTER TABLE child ADD COLUMN optional_token text;`
	seed := testdb.NewPostgres(t, ddl)

	pool, err := postgres.Open(t.Context(), seed.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(pool.Close)

	md := dependentInsertMetadata()
	md.Tables[0].ArrayRelationships = append(
		md.Tables[0].ArrayRelationships,
		metadata.ArrayRelationship{
			Name: "nullable_children",
			Using: metadata.RelationshipUsing{ManualConfiguration: &metadata.ManualConfiguration{
				RemoteTable:   metadata.TableSource{Schema: "public", Name: "child"},
				ColumnMapping: map[string]string{"optional_token": "optional_token"},
			}},
		},
	)
	client := postgres.NewClient(pool)

	objects, err := client.Introspect(t.Context(), md)
	if err != nil {
		t.Fatal(err)
	}

	roots, _, err := queries.BuildRoots(objects, md, dialect.NewPostgresDialect())
	if err != nil {
		t.Fatal(err)
	}

	doc, parseErr := parser.ParseQuery(&ast.Source{Input: `mutation {
insert_parent_one(object:{id:1,nullable_children:{data:[{id:10}]}}){id}
}`})
	if parseErr != nil {
		t.Fatal(parseErr)
	}

	ops, err := roots.BuildQuery(doc.Operations[0], doc.Fragments, nil, "admin", nil)
	if err != nil {
		t.Fatal(err)
	}

	if _, err := client.ExecuteOperations(
		t.Context(),
		ops,
		slog.New(slog.DiscardHandler),
	); err != nil {
		t.Fatal(err)
	}

	var token *string
	if err := pool.QueryRow(t.Context(), `SELECT optional_token FROM child WHERE id=10`).
		Scan(&token); err != nil {
		t.Fatal(err)
	}

	if token != nil {
		t.Fatalf("captured nullable FK source rebound as %q, want SQL NULL", *token)
	}
}

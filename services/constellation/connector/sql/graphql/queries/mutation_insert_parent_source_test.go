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

// TestDependentInsertParentNameCollision ensures a before-parent relationship
// named "parent" cannot replace the inherited FK source for an array or an
// implicit after-parent object. The child role cannot supply parent_id itself.
//
//nolint:gocognit // Each relationship kind is exercised through role execution and persisted FK assertions.
func TestDependentInsertParentNameCollision(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name, query, target string
	}{
		{
			name:   "array child",
			target: "child",
			query:  `mutation {insert_parent_one(object:{id:1,label:"outer",rel_arr_00000:{data:[{id:10,parent:{data:{id:77}}}]}}){id}}`,
		},
		{
			name:   "after-parent object",
			target: "obj_after",
			query:  `mutation {insert_parent_one(object:{id:1,label:"outer",obj_rel_0000:{data:{id:10,parent:{data:{id:77}}}}}){id}}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			seed := testdb.NewPostgres(
				t,
				dependentInsertDDL+`ALTER TABLE obj_after ADD COLUMN before_id integer REFERENCES obj_before(id);`,
			)

			pool, err := postgres.Open(t.Context(), seed.Config().ConnConfig.ConnString())
			if err != nil {
				t.Fatal(err)
			}

			t.Cleanup(pool.Close)

			md := dependentInsertMetadata()
			before := metadata.ObjectRelationship{Name: "parent", Using: metadata.RelationshipUsing{
				ForeignKeyColumns: []string{"before_id"},
			}}
			md.Tables[2].ObjectRelationships = []metadata.ObjectRelationship{before}

			md.Tables[3].ObjectRelationships = []metadata.ObjectRelationship{before}
			for i := range md.Tables {
				cols := []string{"id", "label", "before_id", "parent_id"}
				if i == 2 || i == 3 {
					cols = []string{"id", "before_id"} // parent_id intentionally not granted
				}

				md.Tables[i].InsertPermissions = []metadata.InsertPermission{
					{Role: "writer", Permission: metadata.InsertPermissionConfig{
						Columns: cols, Check: map[string]any{},
					}},
				}
				md.Tables[i].SelectPermissions = []metadata.SelectPermission{
					{Role: "writer", Permission: metadata.SelectPermissionConfig{
						Columns: []string{"id"}, Filter: map[string]any{},
					}},
				}
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

			doc, err := parser.ParseQuery(&ast.Source{Input: tt.query})
			if err != nil {
				t.Fatal(err)
			}

			ops, err := roots.BuildQuery(doc.Operations[0], doc.Fragments, nil, "writer", nil)
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

			var parentID, beforeID int
			if err := pool.QueryRow(t.Context(), `SELECT parent_id, before_id FROM `+tt.target+` WHERE id=10`).
				Scan(&parentID, &beforeID); err != nil {
				t.Fatal(err)
			}

			if parentID != 1 || beforeID != 77 {
				t.Fatalf("%s parent_id/before_id = %d/%d, want 1/77", tt.target, parentID, beforeID)
			}
		})
	}
}

package queries_test

import (
	"path/filepath"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/internal/lib/testhelpers"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestDefaultInsertSQL(t *testing.T) {
	t.Parallel()

	objects := introspection.NewObjects()
	objects.Schemas["public"] = &introspection.Schema{Tables: map[string]*introspection.Table{
		"defaults": {
			Schema: "public", Name: "defaults",
			Columns: []introspection.Column{
				{Name: "id", Type: "int8", IsGenerated: true, IsIdentity: true},
				{Name: "label", Type: "text", Default: new("'default'::text")},
			},
			PrimaryKeys: []string{"id"},
		},
	}}
	md := &metadata.DatabaseMetadata{
		Name: "default", Kind: "postgres", Tables: []metadata.TableMetadata{{
			Table: metadata.TableSource{Schema: "public", Name: "defaults"},
			SelectPermissions: []metadata.SelectPermission{
				{
					Role:       "checked",
					Permission: metadata.SelectPermissionConfig{Columns: []string{"id", "label"}},
				},
			},
			InsertPermissions: []metadata.InsertPermission{{
				Role: "checked", Permission: metadata.InsertPermissionConfig{
					Columns: []string{
						"label",
					},
					Check: map[string]any{"id": map[string]any{"_gt": 0}},
				},
			}},
		}},
	}

	roots, _, err := queries.BuildRoots(objects, md, dialect.NewPostgresDialect())
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	tests := []struct{ name, role, query string }{
		{"single", "admin", `mutation { insert_defaults_one(object: {}) { id label } }`},
		{
			"multiple",
			"admin",
			`mutation { insert_defaults(objects: [{}, {}]) { affected_rows returning { id label } } }`,
		},
		{
			"post-check",
			"checked",
			`mutation { insert_defaults(objects: [{}, {}]) { affected_rows returning { id label } } }`,
		},
		{
			"upsert",
			"admin",
			`mutation { insert_defaults_one(object: {}, on_conflict: {constraint: defaults_pkey, update_columns: []}) { id label } }`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			doc, err := parser.ParseQuery(&ast.Source{Input: tt.query})
			if err != nil {
				t.Fatalf("ParseQuery: %v", err)
			}

			ops, err := roots.BuildQuery(doc.Operations[0], doc.Fragments, nil, tt.role, nil)
			if err != nil {
				t.Fatalf("BuildQuery: %v", err)
			}

			normalize(ops)
			testhelpers.GoldenJSON(
				t,
				filepath.Join("testdata", "TestDefaultInsertSQL", tt.name+".json"),
				ops,
				*updateGolden,
			)
		})
	}
}

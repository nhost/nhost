package queries_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestInsertCollectionObjectVariables(t *testing.T) {
	t.Parallel()

	objects := introspection.NewObjects()
	objects.Schemas["public"] = &introspection.Schema{Tables: map[string]*introspection.Table{
		"files": {
			Schema: "public", Name: "files",
			Columns: []introspection.Column{
				{Name: "id", Type: "text"},
				{Name: "name", Type: "text"},
			},
			PrimaryKeys: []string{"id"},
		},
	}}
	md := &metadata.DatabaseMetadata{
		Name: "default", Kind: "postgres", Tables: []metadata.TableMetadata{{
			Table: metadata.TableSource{Schema: "public", Name: "files"},
		}},
	}

	roots, _, err := queries.BuildRoots(objects, md, dialect.NewPostgresDialect())
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	build := func(t *testing.T, query string, variables map[string]any) []core.SQLOperation {
		t.Helper()

		doc, err := parser.ParseQuery(&ast.Source{Input: query})
		if err != nil {
			t.Fatalf("ParseQuery: %v", err)
		}

		ops, err := roots.BuildQuery(doc.Operations[0], doc.Fragments, variables, "admin", nil)
		if err != nil {
			t.Fatalf("BuildQuery: %v", err)
		}

		return ops
	}

	first := map[string]any{"id": "first", "name": "hello.txt"}
	second := map[string]any{"id": "second", "name": "world.txt"}

	tests := []struct {
		name        string
		query       string
		variables   map[string]any
		wantObjects []any
	}{
		{
			name: "single object variable in list",
			query: `mutation InsertFile($object: files_insert_input!) {
				insert_files(objects: [$object]) { affected_rows }
			}`,
			variables:   map[string]any{"object": first},
			wantObjects: []any{first},
		},
		{
			name: "multiple object variables in list",
			query: `mutation($first: files_insert_input!, $second: files_insert_input!) {
				insert_files(objects: [$first, $second]) { affected_rows }
			}`,
			variables:   map[string]any{"first": first, "second": second},
			wantObjects: []any{first, second},
		},
		{
			name: "mixed object variable and inline object",
			query: `mutation($object: files_insert_input!, $name: String!) {
				insert_files(objects: [$object, {id: "second", name: $name}]) { affected_rows }
			}`,
			variables:   map[string]any{"object": first, "name": "world.txt"},
			wantObjects: []any{first, second},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			want := build(t, `mutation($objects: [files_insert_input!]!) {
				insert_files(objects: $objects) { affected_rows }
			}`, map[string]any{"objects": tt.wantObjects})
			got := build(t, tt.query, tt.variables)

			if diff := cmp.Diff(want, got); diff != "" {
				t.Errorf(
					"insert operations differ from whole-list variable (-want +got):\n%s",
					diff,
				)
			}
		})
	}
}

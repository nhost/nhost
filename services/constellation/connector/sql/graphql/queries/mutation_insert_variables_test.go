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

func TestNestedInsertArrayObjectVariables(t *testing.T) {
	t.Parallel()

	objects := introspection.NewObjects()
	objects.Schemas["public"] = &introspection.Schema{Tables: map[string]*introspection.Table{
		"authors": {
			Schema: "public", Name: "authors",
			Columns:     []introspection.Column{{Name: "id", Type: "text"}},
			PrimaryKeys: []string{"id"},
		},
		"posts": {
			Schema: "public", Name: "posts",
			Columns: []introspection.Column{
				{Name: "author_id", Type: "text"},
				{Name: "title", Type: "text"},
			},
		},
	}}
	md := &metadata.DatabaseMetadata{
		Name: "default", Kind: "postgres", Tables: []metadata.TableMetadata{
			{
				Table: metadata.TableSource{Schema: "public", Name: "authors"},
				ArrayRelationships: []metadata.ArrayRelationship{{
					Name: "posts", Using: metadata.RelationshipUsing{
						ManualConfiguration: &metadata.ManualConfiguration{
							RemoteTable:   metadata.TableSource{Schema: "public", Name: "posts"},
							ColumnMapping: map[string]string{"id": "author_id"},
						},
					},
				}},
			},
			{Table: metadata.TableSource{Schema: "public", Name: "posts"}},
		},
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

		if len(ops) != 1 || ops[0].Insert == nil {
			t.Fatalf("expected a dependent insert plan, got %+v", ops)
		}

		return ops
	}

	first := map[string]any{"title": "First's post"}
	second := map[string]any{"title": "Second's post"}

	tests := []struct {
		name      string
		query     string
		variables map[string]any
		wantPosts []any
	}{
		{
			name: "single object variable in list",
			query: `mutation($post: posts_insert_input!) {
				insert_authors_one(object: {id: "author", posts: {data: [$post]}}) { id }
			}`,
			variables: map[string]any{"post": first},
			wantPosts: []any{first},
		},
		{
			name: "multiple object variables in list",
			query: `mutation($a: posts_insert_input!, $b: posts_insert_input!) {
				insert_authors_one(object: {id: "author", posts: {data: [$a, $b]}}) { id }
			}`,
			variables: map[string]any{"a": first, "b": second},
			wantPosts: []any{first, second},
		},
		{
			name: "mixed variable and inline object",
			query: `mutation($post: posts_insert_input!, $title: String!) {
				insert_authors_one(object: {
					id: "author", posts: {data: [$post, {title: $title}]}
				}) { id }
			}`,
			variables: map[string]any{"post": first, "title": "Second's post"},
			wantPosts: []any{first, second},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			want := build(t, `mutation($posts: [posts_insert_input!]!) {
				insert_authors_one(object: {id: "author", posts: {data: $posts}}) { id }
			}`, map[string]any{"posts": tt.wantPosts})
			got := build(t, tt.query, tt.variables)

			// Compare the dependent statements and their bound parameters, not the empty op.SQL.
			if diff := cmp.Diff(want, got); diff != "" {
				t.Errorf("insert plans differ from whole-list variable (-want +got):\n%s", diff)
			}
		})
	}
}

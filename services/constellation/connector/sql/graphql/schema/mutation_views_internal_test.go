package schema

import (
	"slices"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// TestGenerateTableMutationFields_SkipsReadOnlyViews verifies that
// generateTableMutationFields produces no insert/update/delete fields for
// relations introspected as views with IsInsertable=false and
// IsUpdatable=false (Postgres reports this for UNION ALL views, views over
// aggregates, etc.). The admin role is used because the bug surfaced
// specifically on admin: per-role permission gating already filtered the
// mutations away for user/public roles.
func TestGenerateTableMutationFields_SkipsReadOnlyViews(t *testing.T) {
	t.Parallel()

	tableMeta := &metadata.TableMetadata{
		Table: metadata.TableSource{Schema: "public", Name: "content_feed"},
		Configuration: metadata.TableConfiguration{
			CustomName: "contentFeed",
		},
	}
	tableInfo := &introspection.Table{
		Schema:       "public",
		Name:         "content_feed",
		IsView:       true,
		IsInsertable: false,
		IsUpdatable:  false,
		Columns: []introspection.Column{
			{Name: "id", Type: "uuid"},
			{Name: "source", Type: "text"},
			{Name: "title", Type: "text"},
		},
	}

	var fields []*graph.Field
	generateTableMutationFields(
		&fields, tableMeta, tableInfo, "contentFeed", "public.content_feed", roleAdmin,
	)

	if len(fields) != 0 {
		names := make([]string, 0, len(fields))
		for _, f := range fields {
			names = append(names, f.Name)
		}

		t.Fatalf("expected no mutation fields for read-only view, got %v", names)
	}
}

// TestGenerateTableMutationFields_UpdatableViewGetsMutations verifies that a
// view Postgres reports as both insertable and updatable (simple SELECT-FROM
// views like public.published_news) still produces the full set of mutation
// fields for the admin role — matching Hasura's behaviour.
func TestGenerateTableMutationFields_UpdatableViewGetsMutations(t *testing.T) {
	t.Parallel()

	tableMeta := &metadata.TableMetadata{
		Table: metadata.TableSource{Schema: "public", Name: "published_news"},
		Configuration: metadata.TableConfiguration{
			CustomName: "publishedNews",
		},
	}
	tableInfo := &introspection.Table{
		Schema:       "public",
		Name:         "published_news",
		IsView:       true,
		IsInsertable: true,
		IsUpdatable:  true,
		Columns: []introspection.Column{
			{Name: "id", Type: "uuid"},
			{Name: "title", Type: "text"},
		},
	}

	var fields []*graph.Field
	generateTableMutationFields(
		&fields, tableMeta, tableInfo, "publishedNews", "public.published_news", roleAdmin,
	)

	names := make([]string, 0, len(fields))
	for _, f := range fields {
		names = append(names, f.Name)
	}

	wantContains := []string{
		"delete_publishedNews",
		"insert_publishedNews",
		"insert_publishedNews_one",
		"update_publishedNews",
		"update_publishedNews_many",
	}
	for _, want := range wantContains {
		if !slices.Contains(names, want) {
			t.Errorf("expected mutation field %q for updatable view, got %v", want, names)
		}
	}
}

// TestGenerateTableMutationFields_BaseTableGetsMutations is the regression
// counterpart: base tables (IsView=false) must continue to receive
// mutations for admin, regardless of the IsInsertable/IsUpdatable flags
// (which are tautologically true for tables).
func TestGenerateTableMutationFields_BaseTableGetsMutations(t *testing.T) {
	t.Parallel()

	tableMeta := &metadata.TableMetadata{
		Table: metadata.TableSource{Schema: "public", Name: "news"},
		Configuration: metadata.TableConfiguration{
			CustomName: "news",
		},
	}
	tableInfo := &introspection.Table{
		Schema:       "public",
		Name:         "news",
		IsView:       false,
		IsInsertable: true,
		IsUpdatable:  true,
		PrimaryKeys:  []string{"id"},
		Columns: []introspection.Column{
			{Name: "id", Type: "uuid"},
			{Name: "title", Type: "text"},
		},
	}

	var fields []*graph.Field
	generateTableMutationFields(
		&fields, tableMeta, tableInfo, "news", "public.news", roleAdmin,
	)

	if len(fields) == 0 {
		t.Fatal("expected mutation fields for base table, got none")
	}
}

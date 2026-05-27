package schema

import (
	"slices"
	"strings"
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
		&metadata.DatabaseMetadata{},
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
		&metadata.DatabaseMetadata{},
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
		&metadata.DatabaseMetadata{},
	)

	if len(fields) == 0 {
		t.Fatal("expected mutation fields for base table, got none")
	}
}

// TestGenerateTableMutationFields_NonAdminRoleSkipsReadOnlyView locks in the
// AND-semantics of the mutation gate for non-admin roles: even when the role
// has explicit insert/update/delete permissions configured in metadata, a
// view introspected as IsInsertable=false / IsUpdatable=false must still
// emit no mutation fields. The role-permission branch of the gate must not
// override the database's read-only verdict. The admin subtest above covers
// the role==admin half of the OR; this covers the permission-bearing half.
func TestGenerateTableMutationFields_NonAdminRoleSkipsReadOnlyView(t *testing.T) {
	t.Parallel()

	tableMeta := &metadata.TableMetadata{
		Table: metadata.TableSource{Schema: "public", Name: "content_feed"},
		Configuration: metadata.TableConfiguration{
			CustomName: "contentFeed",
		},
		InsertPermissions: []metadata.InsertPermission{
			{Role: "user", Permission: metadata.InsertPermissionConfig{Columns: []string{"id"}}},
		},
		UpdatePermissions: []metadata.UpdatePermission{
			{Role: "user", Permission: metadata.UpdatePermissionConfig{Columns: []string{"id"}}},
		},
		DeletePermissions: []metadata.DeletePermission{
			{Role: "user", Permission: metadata.DeletePermissionConfig{}},
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
			{Name: "title", Type: "text"},
		},
	}

	var fields []*graph.Field
	generateTableMutationFields(
		&fields, tableMeta, tableInfo, "contentFeed", "public.content_feed", "user",
		&metadata.DatabaseMetadata{},
	)

	if len(fields) != 0 {
		names := make([]string, 0, len(fields))
		for _, f := range fields {
			names = append(names, f.Name)
		}

		t.Fatalf(
			"expected no mutation fields for read-only view despite role permissions, got %v",
			names,
		)
	}
}

// TestGenerateForRole_ObjRelToReadOnlyViewHasNoDanglingRef verifies that when a
// base writable table declares an object relationship targeting a view the
// database reports as read-only (IsInsertable=false), the parent's
// `_insert_input` does NOT carry a `<view>_obj_rel_insert_input` field —
// because `generateTableMutationInputTypes` never emits that type for an
// IsInsertable=false target. Without the gate in `getRelationshipTargetInputField`
// (and the matching skip in `findRelationships`), admin schemas would dangle
// a reference to an undeclared type. This exercises the admin role specifically
// because per-role permission gating cannot mask read-only views for admin.
func TestGenerateForRole_ObjRelToReadOnlyViewHasNoDanglingRef(t *testing.T) {
	t.Parallel()

	md := &metadata.DatabaseMetadata{
		Tables: []metadata.TableMetadata{
			{
				Table: metadata.TableSource{Schema: "public", Name: "news"},
				ObjectRelationships: []metadata.ObjectRelationship{
					{
						Name: "feed",
						Using: metadata.RelationshipUsing{
							ManualConfiguration: &metadata.ManualConfiguration{
								RemoteTable: metadata.TableSource{
									Schema: "public", Name: "content_feed",
								},
								ColumnMapping: map[string]string{"id": "id"},
							},
						},
					},
				},
			},
			{
				Table: metadata.TableSource{Schema: "public", Name: "content_feed"},
			},
		},
	}

	objects := introspection.NewObjects()
	objects.Schemas["public"] = &introspection.Schema{
		Tables: map[string]*introspection.Table{
			"news": {
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
			},
			"content_feed": {
				Schema:       "public",
				Name:         "content_feed",
				IsView:       true,
				IsInsertable: false,
				IsUpdatable:  false,
				Columns: []introspection.Column{
					{Name: "id", Type: "uuid"},
					{Name: "title", Type: "text"},
				},
			},
		},
	}

	sch, err := GenerateForRole(objects, roleAdmin, md, Capabilities{
		Kind: KindPostgres,
	})
	if err != nil {
		t.Fatalf("GenerateForRole returned error: %v", err)
	}

	// Find the parent's _insert_input and assert it does not reference
	// content_feed_obj_rel_insert_input.
	var newsInsertInput *graph.InputObjectType

	for _, in := range sch.Inputs {
		if in.Name == "news_insert_input" {
			newsInsertInput = in
			break
		}
	}

	if newsInsertInput == nil {
		t.Fatal("expected news_insert_input to be generated")
	}

	for _, f := range newsInsertInput.Fields {
		typeName := f.Type.NamedType
		if typeName == "" && f.Type.Elem != nil {
			typeName = f.Type.Elem.NamedType
		}

		if strings.Contains(typeName, "content_feed_obj_rel_insert_input") ||
			strings.Contains(typeName, "content_feed_arr_rel_insert_input") {
			t.Fatalf(
				"news_insert_input field %q references undeclared type %q "+
					"(content_feed is read-only: IsInsertable=false)",
				f.Name, typeName,
			)
		}
	}

	// And assert the dangling type itself was indeed not emitted.
	for _, in := range sch.Inputs {
		if in.Name == "content_feed_obj_rel_insert_input" ||
			in.Name == "content_feed_arr_rel_insert_input" {
			t.Fatalf(
				"expected no %s for read-only view target, got %s emitted",
				in.Name, in.Name,
			)
		}
	}
}

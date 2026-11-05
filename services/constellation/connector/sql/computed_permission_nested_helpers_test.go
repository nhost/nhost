package sql_test

import (
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/metadata"
)

type nestedReviewArray struct{ name, table, fk string }

func nestedReviewTable(
	name string, columns []string, objects map[string]string, arrays []nestedReviewArray,
	computed map[string]string, check map[string]any,
) metadata.TableMetadata {
	table := metadata.TableMetadata{Table: metadata.TableSource{Schema: "cf_select", Name: name}}
	for rel, fk := range objects {
		table.ObjectRelationships = append(table.ObjectRelationships, metadata.ObjectRelationship{
			Name: rel, Using: metadata.RelationshipUsing{ForeignKeyColumns: []string{fk}},
		})
	}

	for _, rel := range arrays {
		table.ArrayRelationships = append(table.ArrayRelationships, metadata.ArrayRelationship{
			Name: rel.name, Using: metadata.RelationshipUsing{
				ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
					Columns: []string{
						rel.fk,
					},
					Table: metadata.TableSource{Schema: "cf_select", Name: rel.table},
				},
			},
		})
	}

	for field, function := range computed {
		table.ComputedFields = append(table.ComputedFields, metadata.ComputedField{
			Name: field, Definition: metadata.ComputedFieldDefinition{
				Function: metadata.FunctionSource{Schema: "cf_select", Name: function},
			},
		})
	}

	if check == nil {
		check = map[string]any{}
	}

	table.InsertPermissions = []metadata.InsertPermission{
		{
			Role:       "phase9_guard",
			Permission: metadata.InsertPermissionConfig{Columns: columns, Check: check},
		},
	}
	table.SelectPermissions = []metadata.SelectPermission{{
		Role: "phase9_guard", Permission: metadata.SelectPermissionConfig{Columns: columns},
	}}

	return table
}

func nestedReviewRun(
	t *testing.T, ddl string, tables []metadata.TableMetadata, query string,
) (map[string]any, func(string) int, error) {
	t.Helper()

	md, db := permissionFixture(t)
	if _, err := db.Exec(t.Context(), ddl); err != nil {
		t.Fatal(err)
	}

	md.Tables = append(md.Tables, tables...)

	conn, inc := permissionConnector(t, md, db.Config().ConnString())
	if len(inc.Snapshot()) != 0 {
		t.Fatalf("unexpected inconsistencies: %+v", inc.Snapshot())
	}

	doc, err := parser.ParseQuery(&ast.Source{Input: query})
	if err != nil {
		t.Fatal(err)
	}

	result, execErr := conn.Execute(t.Context(), doc.Operations[0], doc.Fragments, nil,
		"phase9_guard", nil, slog.Default())
	count := func(sql string) int {
		t.Helper()

		var n int
		if err := db.QueryRow(t.Context(), sql).Scan(&n); err != nil {
			t.Fatal(err)
		}

		return n
	}

	if execErr != nil {
		return result, count, fmt.Errorf("executing nested insert: %w", execErr)
	}

	return result, count, nil
}

func assertNestedReviewPermission(t *testing.T, err error, denied bool) {
	t.Helper()

	if !denied {
		if err != nil {
			t.Fatalf("positive insert check: %v", err)
		}

		return
	}

	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "ZZ901" {
		t.Fatalf("denied insert must fail with ZZ901, got %v", err)
	}
}

// runPermissionCase keeps each test's DB/schema-mutating matrix serial while
// independent top-level tests can use the default parallel test budget.
func runPermissionCase(t *testing.T, name string, test func(*testing.T)) {
	t.Helper()
	t.Run(name, test)
}

// TestComputedPermissionSecuritySuite keeps the isolated testdb matrix serial
// inside one parallel top-level test, respecting the default shared pool budget.
func TestComputedPermissionSecuritySuite(t *testing.T) {
	t.Parallel()
	runPermissionCase(t, "ComputedFunctionBodyVisibility", verifyComputedFunctionBodyVisibility)
	runPermissionCase(t, "NestedMultiRowObjectCheckOrder", verifyNestedMultiRowObjectCheckOrder)
	runPermissionCase(
		t,
		"NestedPartitionedArrayObjectPermissionCheck",
		verifyNestedPartitionedArrayObjectPermissionCheck,
	)
	runPermissionCase(
		t,
		"ComputedPermissionOperatorSessionOperands",
		verifyComputedPermissionOperatorSessionOperands,
	)
	runPermissionCase(
		t,
		"ComputedPermissionRootColumnComparison",
		verifyComputedPermissionRootColumnComparison,
	)
	runPermissionCase(
		t,
		"ComputedPermissionReverseTableOrder",
		verifyComputedPermissionReverseTableOrder,
	)
	runPermissionCase(
		t,
		"ComputedPermissionObjectAggregateName",
		verifyComputedPermissionObjectAggregateName,
	)
	runPermissionCase(
		t,
		"ComputedPermissionOperatorCapabilities",
		verifyComputedPermissionOperatorCapabilities,
	)
	runPermissionCase(
		t,
		"ComputedPermissionMissingSessionVariable",
		verifyComputedPermissionMissingSessionVariable,
	)
	runPermissionCase(
		t,
		"ComputedPermissionNestedObjectInsert",
		verifyComputedPermissionNestedObjectInsert,
	)
	runPermissionCase(
		t,
		"ComputedPermissionNestedObjectCollection",
		verifyComputedPermissionNestedObjectCollection,
	)
	runPermissionCase(t, "NestedObjectInsertOtherRoutes", verifyNestedObjectInsertOtherRoutes)
	runPermissionCase(t, "NestedArrayChildOtherParentRoute", verifyNestedArrayChildOtherParentRoute)
	runPermissionCase(
		t,
		"NestedObjectUpsertReplacesCommittedVersion",
		verifyNestedObjectUpsertReplacesCommittedVersion,
	)
	runPermissionCase(
		t,
		"ComputedInvalidPermissionKindsKeepSource",
		verifyComputedInvalidPermissionKindsKeepSource,
	)
	runPermissionCase(t, "NestedArrayUpsertWithoutParentPK", verifyNestedArrayUpsertWithoutParentPK)
	runPermissionCase(
		t,
		"PermissionAliasPairsDoNotBroadenRows",
		verifyPermissionAliasPairsDoNotBroadenRows,
	)
	runPermissionCase(t, "ComputedJSONPermissionRevoked", verifyComputedJSONPermissionRevoked)
	runPermissionCase(
		t,
		"NestedArrayGrandparentPermissionCheck",
		verifyNestedArrayGrandparentPermissionCheck,
	)
}

// A STABLE permission function reads the database snapshot, not just its row
// argument: earlier ordered inserts must be visible and later ones must not.
//
//nolint:gocognit // Keep the nine snapshot/rollback outcomes in one serial testdb matrix.
func verifyComputedFunctionBodyVisibility(t *testing.T) {
	t.Helper()

	parentCheck := map[string]any{"item_tag_count": map[string]any{"_eq": 0}}
	parentDenied := map[string]any{"item_tag_count": map[string]any{"_gt": 0}}
	childCheck := map[string]any{"tag_parent_label": map[string]any{"_eq": "parent"}}
	memberCheck := map[string]any{"tag_has_member": map[string]any{"_eq": true}}
	memberDenied := map[string]any{"tag_has_member": map[string]any{"_eq": false}}

	const (
		parent      = `id:90091,owner_id:1,label:"parent",amount:1,payload:{}`
		otherParent = `id:90091,owner_id:1,label:"other",amount:1,payload:{}`
		child       = `id:90091,label:"x"`
		member      = `{id:90091,owner_id:1,label:"member:x",amount:1,payload:{}}`
		carrier     = `{id:90092,owner_id:1,label:"y",amount:1,payload:{},tags:{data:[{id:90091,label:"x"}]}}`
	)

	for _, tc := range []struct {
		name, root, query   string
		itemCheck, tagCheck map[string]any
		accepted            bool
		items, tags         int
	}{
		{
			name: "array child reads new parent allow", root: "insert_cf_select_items_one",
			query:    `mutation { insert_cf_select_items_one(object:{` + parent + `,tags:{data:[{` + child + `}]}}) { id } }`,
			tagCheck: childCheck, accepted: true, items: 1, tags: 1,
		},
		{
			name: "array child reads new parent deny", root: "insert_cf_select_items_one",
			query:    `mutation { insert_cf_select_items_one(object:{` + otherParent + `,tags:{data:[{` + child + `}]}}) { id } }`,
			tagCheck: childCheck,
		},
		{
			name: "object parent read by child allow", root: "insert_cf_select_tags_one",
			query:    `mutation { insert_cf_select_tags_one(object:{id:90091,label:"x",item:{data:{` + parent + `}}}) { id } }`,
			tagCheck: childCheck, accepted: true, items: 1, tags: 1,
		},
		{
			name: "object parent read by child deny", root: "insert_cf_select_tags_one",
			query:    `mutation { insert_cf_select_tags_one(object:{id:90091,label:"x",item:{data:{` + otherParent + `}}}) { id } }`,
			tagCheck: childCheck,
		},
		{
			name: "earlier root membership visible allow", root: "insert_cf_select_items",
			query:    `mutation { insert_cf_select_items(objects:[` + member + `,` + carrier + `]) { affected_rows } }`,
			tagCheck: memberCheck, accepted: true, items: 2, tags: 1,
		},
		{
			name: "earlier root membership visible deny", root: "insert_cf_select_items",
			query:    `mutation { insert_cf_select_items(objects:[` + member + `,` + carrier + `]) { affected_rows } }`,
			tagCheck: memberDenied,
		},
		{
			name: "later root membership invisible deny", root: "insert_cf_select_items",
			query:    `mutation { insert_cf_select_items(objects:[` + carrier + `,` + member + `]) { affected_rows } }`,
			tagCheck: memberCheck,
		},
		{
			name: "parent check before own arrays allow", root: "insert_cf_select_items_one",
			query:     `mutation { insert_cf_select_items_one(object:{` + parent + `,tags:{data:[{` + child + `}]}}) { id } }`,
			itemCheck: parentCheck, accepted: true, items: 1, tags: 1,
		},
		{
			name: "parent check before own arrays deny", root: "insert_cf_select_items_one",
			query:     `mutation { insert_cf_select_items_one(object:{` + parent + `,tags:{data:[{` + child + `}]}}) { id } }`,
			itemCheck: parentDenied,
		},
	} {
		runPermissionCase(t, tc.name, func(t *testing.T) {
			t.Helper()

			md, db := permissionFixture(t)
			if _, err := db.Exec(t.Context(), `
CREATE FUNCTION cf_select.tag_parent_label(tag cf_select.tags) RETURNS text LANGUAGE sql STABLE
AS $$ SELECT label FROM cf_select.items WHERE id = tag.item_id $$;
CREATE FUNCTION cf_select.tag_has_member(tag cf_select.tags) RETURNS boolean LANGUAGE sql STABLE
AS $$ SELECT EXISTS(SELECT 1 FROM cf_select.items WHERE label = 'member:' || tag.label) $$;
CREATE FUNCTION cf_select.item_tag_count(item cf_select.items) RETURNS bigint LANGUAGE sql STABLE
AS $$ SELECT count(*) FROM cf_select.tags WHERE item_id = item.id $$;`); err != nil {
				t.Fatal(err)
			}

			item := &md.Tables[0]
			tag := &md.Tables[1]
			item.ArrayRelationships = []metadata.ArrayRelationship{{
				Name: "tags", Using: metadata.RelationshipUsing{
					ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
						Columns: []string{"item_id"}, Table: tag.Table,
					},
				},
			}}
			tag.ObjectRelationships = []metadata.ObjectRelationship{
				{
					Name:  "item",
					Using: metadata.RelationshipUsing{ForeignKeyColumns: []string{"item_id"}},
				},
			}

			item.ComputedFields = append(item.ComputedFields, metadata.ComputedField{
				Name: "item_tag_count", Definition: metadata.ComputedFieldDefinition{
					Function: metadata.FunctionSource{Schema: "cf_select", Name: "item_tag_count"},
				},
			})
			for _, field := range []string{"tag_parent_label", "tag_has_member"} {
				tag.ComputedFields = append(tag.ComputedFields, metadata.ComputedField{
					Name: field, Definition: metadata.ComputedFieldDefinition{
						Function: metadata.FunctionSource{Schema: "cf_select", Name: field},
					},
				})
			}

			item.InsertPermissions = append(item.InsertPermissions, metadata.InsertPermission{
				Role: "phase9_guard", Permission: metadata.InsertPermissionConfig{
					Columns: []string{
						"id",
						"owner_id",
						"label",
						"amount",
						"payload",
					},
					Check: tc.itemCheck,
				},
			})
			tag.InsertPermissions = append(tag.InsertPermissions, metadata.InsertPermission{
				Role: "phase9_guard", Permission: metadata.InsertPermissionConfig{
					Columns: []string{"id", "item_id", "label"}, Check: tc.tagCheck,
				},
			})
			item.SelectPermissions = append(item.SelectPermissions, computedGuard(nil))
			tag.SelectPermissions = append(tag.SelectPermissions, computedGuard(nil))

			conn, inc := permissionConnector(t, md, db.Config().ConnString())
			if entries := inc.Snapshot(); len(entries) != 0 {
				t.Fatalf("unexpected inconsistencies: %+v", entries)
			}

			doc, err := parser.ParseQuery(&ast.Source{Input: tc.query})
			if err != nil {
				t.Fatal(err)
			}

			result, err := conn.Execute(t.Context(), doc.Operations[0], doc.Fragments,
				nil, "phase9_guard", nil, slog.Default())
			if tc.accepted {
				if err != nil || result[tc.root] == nil {
					t.Fatalf("allowed insert: result=%#v, error=%v", result, err)
				}
			} else {
				assertNestedReviewPermission(t, err, true)

				if !strings.Contains(
					err.Error(),
					"failed to execute operation "+tc.root+": failed to scan result row:",
				) {
					t.Fatalf("denial lost root operation wrapper: %v", err)
				}
			}

			for _, table := range []struct {
				name, query string
				want        int
			}{
				{"items", "SELECT count(*) FROM cf_select.items WHERE id >= 90000", tc.items},
				{"tags", "SELECT count(*) FROM cf_select.tags WHERE id >= 90000", tc.tags},
			} {
				var count int
				if err := db.QueryRow(t.Context(), table.query).Scan(&count); err != nil {
					t.Fatal(err)
				}

				if count != table.want {
					t.Fatalf("persisted %s rows = %d, want %d", table.name, count, table.want)
				}
			}
		})
	}
}

package sql_test

import (
	"reflect"
	"testing"

	"github.com/nhost/nhost/services/constellation/metadata"
)

// A column comparison inside a relationship must use the outer request's
// source alias, not the nested row or a literal "$" column name.
func verifyComputedPermissionRootColumnComparison(t *testing.T) {
	t.Helper()

	for _, tc := range []struct {
		name         string
		filter       map[string]any
		want         []int
		customRoot   bool
		customTarget bool
	}{
		{"computed root", map[string]any{"tags": map[string]any{"tag_parent_label": map[string]any{"_ceq": []any{"$", "label"}}}}, []int{1, 2}, false, false},
		{"computed root customized SQL RHS", map[string]any{"tags": map[string]any{"tag_parent_label": map[string]any{"_ceq": []any{"$", "label"}}}}, []int{1, 2}, true, false},
		{"computed mixed scopes", map[string]any{"tags": map[string]any{"tag_parent_label": map[string]any{"_ceq": []any{"$", "label"}, "_cne": "label"}}}, []int{1, 2}, false, false},
		{"computed current customized SQL RHS", map[string]any{"tags": map[string]any{"tag_parent_label": map[string]any{"_cne": "label"}}}, []int{1, 2}, false, true},
		{"computed current", map[string]any{"tags": map[string]any{"tag_parent_label": map[string]any{"_ceq": []any{"label"}}}}, []int{}, false, false},
		{"plain root", map[string]any{"tags": map[string]any{"label": map[string]any{"_cne": []any{"$", "label"}}}}, []int{1, 2}, false, false},
		{"exists root", map[string]any{"_exists": map[string]any{"_table": map[string]any{"schema": "cf_select", "name": "tags"}, "_where": map[string]any{"tag_parent_label": map[string]any{"_ceq": []any{"$", "label"}}}}}, []int{1, 2}, false, false},
	} {
		runPermissionCase(t, tc.name, func(t *testing.T) {
			t.Helper()

			md, db := permissionFixture(t)
			if tc.customRoot {
				md.Tables[0].Configuration.ColumnConfig = map[string]metadata.ColumnConfig{
					"label": {CustomName: "display_label"},
				}
			}

			if tc.customTarget {
				md.Tables[1].Configuration.ColumnConfig = map[string]metadata.ColumnConfig{
					"label": {CustomName: "display_label"},
				}
			}

			if _, err := db.Exec(
				t.Context(),
				`CREATE FUNCTION cf_select.tag_parent_label(tag cf_select.tags)
RETURNS text LANGUAGE sql STABLE AS $$ SELECT label FROM cf_select.items WHERE id = tag.item_id $$`,
			); err != nil {
				t.Fatal(err)
			}

			md.Tables[1].ComputedFields = append(
				md.Tables[1].ComputedFields,
				metadata.ComputedField{
					Name: "tag_parent_label", Definition: metadata.ComputedFieldDefinition{
						Function: metadata.FunctionSource{
							Schema: "cf_select",
							Name:   "tag_parent_label",
						},
					},
				},
			)
			md.Tables[0].ArrayRelationships = append(
				md.Tables[0].ArrayRelationships,
				metadata.ArrayRelationship{
					Name: "tags",
					Using: metadata.RelationshipUsing{
						ManualConfiguration: &metadata.ManualConfiguration{
							RemoteTable:   metadata.TableSource{Schema: "cf_select", Name: "tags"},
							ColumnMapping: map[string]string{"id": "item_id"},
						},
					},
				},
			)
			md.Tables[0].SelectPermissions = append(
				md.Tables[0].SelectPermissions,
				computedGuard(tc.filter),
			)

			conn, inc := permissionConnector(t, md, db.Config().ConnString())
			if entries := inc.Snapshot(); len(entries) != 0 {
				t.Fatalf("unexpected inconsistencies: %+v", entries)
			}

			got := permissionIDs(
				t,
				conn,
				"phase9_guard",
				`query { cf_select_items(order_by:{id:asc}) { id } }`,
				"cf_select_items",
			)
			if !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("filtered items = %v, want %v", got, tc.want)
			}
		})
	}
}

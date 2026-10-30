package sql_test

import (
	"fmt"
	"testing"
)

// Both spellings are independent ANDed entries, not competing map keys.
// Rebuild repeatedly because metadata map iteration used to choose which
// predicate survived when normalising a permission.
func verifyPermissionAliasPairsDoNotBroadenRows(t *testing.T) {
	t.Helper()

	for _, tc := range []struct {
		name   string
		filter func(string) map[string]any
	}{
		{"and", func(field string) map[string]any {
			return map[string]any{
				"_and": []any{map[string]any{"id": map[string]any{"_eq": 1}}},
				"$and": []any{map[string]any{field: map[string]any{"_eq": "second"}}},
			}
		}},
		{"not", func(field string) map[string]any {
			return map[string]any{
				"_not": map[string]any{"id": map[string]any{"_eq": 1}},
				"$not": map[string]any{field: map[string]any{"_eq": "second"}},
			}
		}},
		{"exists", func(field string) map[string]any {
			return map[string]any{
				"_exists": map[string]any{
					"_table": map[string]any{"schema": "cf_select", "name": "items"},
					"_where": map[string]any{field: map[string]any{"_eq": "first"}},
				},
				"$exists": map[string]any{
					"_table": map[string]any{"schema": "cf_select", "name": "items"},
					"_where": map[string]any{field: map[string]any{"_eq": "absent"}},
				},
			}
		}},
		{"comparison", func(field string) map[string]any {
			return map[string]any{field: map[string]any{"_eq": "first", "$eq": "second"}}
		}},
	} {
		for _, field := range []string{"label", "item_label"} {
			runPermissionCase(t, tc.name+"/"+field, func(t *testing.T) {
				t.Helper()

				for build := range 4 {
					runPermissionCase(t, fmt.Sprintf("build_%d", build), func(t *testing.T) {
						t.Helper()
						md, db := permissionFixture(t)
						md.Tables[0].SelectPermissions = append(md.Tables[0].SelectPermissions,
							computedGuard(tc.filter(field)))

						conn, inc := permissionConnector(t, md, db.Config().ConnString())
						if entries := inc.Snapshot(); len(entries) != 0 {
							t.Fatalf("unexpected inconsistencies: %+v", entries)
						}

						if ids := permissionIDs(
							t,
							conn,
							"phase9_guard",
							`query { cf_select_items(order_by:{id:asc}) { id } }`,
							"cf_select_items",
						); len(ids) != 0 {
							t.Fatalf("alias pair exposed rows %v", ids)
						}
					})
				}
			})
		}
	}
}

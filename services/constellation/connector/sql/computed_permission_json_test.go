package sql_test

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/metadata"
)

// Hasura rejects json (not jsonb) in permission bool expressions regardless
// of operator. The revocation must be granular to the permission, not source.
func verifyComputedJSONPermissionRevoked(t *testing.T) {
	t.Helper()

	for _, tc := range []struct {
		name, field string
		operand     map[string]any
		revoked     bool
	}{
		{"json null check", "item_json", map[string]any{"_is_null": false}, true},
		{"json equality", "item_json", map[string]any{"_eq": map[string]any{"status": "ready"}}, true},
		{"jsonb control", "item_payload", map[string]any{"_is_null": false}, false},
	} {
		runPermissionCase(t, tc.name, func(t *testing.T) {
			t.Helper()

			md, db := permissionFixture(t)
			if _, err := db.Exec(
				t.Context(),
				`CREATE FUNCTION cf_select.item_json(item cf_select.items)
RETURNS json LANGUAGE sql STABLE AS $$ SELECT item.payload::json $$`,
			); err != nil {
				t.Fatal(err)
			}

			md.Tables[0].ComputedFields = append(md.Tables[0].ComputedFields,
				metadata.ComputedField{
					Name: "item_json", Definition: metadata.ComputedFieldDefinition{
						Function: metadata.FunctionSource{Schema: "cf_select", Name: "item_json"},
					},
				})
			md.Tables[0].SelectPermissions = append(md.Tables[0].SelectPermissions,
				computedGuard(map[string]any{tc.field: tc.operand}))
			conn, inc := permissionConnector(t, md, db.Config().ConnString())

			schemas, err := conn.GetSchema()
			if err != nil {
				t.Fatal(err)
			}

			if (schemas["phase9_guard"] == nil) != tc.revoked {
				t.Fatalf(
					"role availability mismatch; revoked=%v, inconsistencies=%+v",
					tc.revoked,
					inc.Snapshot(),
				)
			}

			if schemas["cf_reader"] == nil {
				t.Fatal("unrelated grant lost its source")
			}

			if tc.revoked && !hasPermissionInconsistency(inc, "cf_select.items.phase9_guard") {
				t.Fatalf("missing permission inconsistency: %+v", inc.Snapshot())
			}
		})
	}
}

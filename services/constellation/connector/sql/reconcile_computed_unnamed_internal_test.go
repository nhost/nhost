//nolint:revive,nolintlint // package name "sql" shadows database/sql; this package never imports it.
package sql

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestUnnamedComputedUserArgumentDeferred(t *testing.T) {
	t.Parallel()

	md, objects := computedReconcileFixture()
	fn := objects.ComputedFunctions[introspection.ComputedTable{Schema: "public", Name: "users"}]["label"].Function
	fn.Arguments = append(fn.Arguments, introspection.ComputedFunctionArgument{
		Mode: "i",
		Type: introspection.PostgreSQLType{Schema: "pg_catalog", Name: "integer", Kind: "b"},
	})
	md.Tables[0].SelectPermissions = []metadata.SelectPermission{{
		Role: "reader", Permission: metadata.SelectPermissionConfig{
			Columns: []string{"id"}, ComputedFields: []string{"label"},
		},
	}}

	inc := metadata.NewInconsistencies()

	got := reconcileMetadata(t.Context(), nil, inc, md, objects)
	for _, field := range got.Tables[0].ComputedFields {
		if field.Name == "label" {
			t.Fatal("unnamed argument became an executable computed field")
		}
	}

	if len(got.Tables[0].SelectPermissions) != 1 ||
		got.Tables[0].SelectPermissions[0].Role != "reader" {
		t.Fatalf(
			"deferred signature revoked unaffected grant: %+v",
			got.Tables[0].SelectPermissions,
		)
	}
}

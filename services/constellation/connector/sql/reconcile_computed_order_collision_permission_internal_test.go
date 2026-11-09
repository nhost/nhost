//nolint:revive,nolintlint // package name "sql" shadows database/sql; this package never imports it.
package sql

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestComputedTableOrderCollisionRevokesDependentPredicateOnly(t *testing.T) {
	t.Parallel()

	md, objects := computedReconcileFixture()
	objects.Schemas["public"].Tables["users"].Columns = append(
		objects.Schemas["public"].Tables["users"].Columns,
		introspection.Column{Name: "posts_for_user_aggregate", Type: "text"},
	)
	md.Tables[0].SelectPermissions = []metadata.SelectPermission{
		{Role: "guarded", Permission: metadata.SelectPermissionConfig{
			Columns: []string{"id"}, Filter: map[string]any{
				"posts_for_user": map[string]any{"id": map[string]any{"_eq": "1"}},
			},
		}},
		{Role: "safe", Permission: metadata.SelectPermissionConfig{Columns: []string{"id"}}},
	}
	inc := metadata.NewInconsistencies()

	effective := reconcileMetadata(t.Context(), nil, inc, md, objects)
	if len(effective.Tables[0].SelectPermissions) != 1 ||
		effective.Tables[0].SelectPermissions[0].Role != "safe" ||
		!hasComputedInconsistency(inc, metadata.InconsistencyKindComputedField) ||
		!hasComputedInconsistency(inc, metadata.InconsistencyKindSelectPermission) {
		t.Fatalf("collision bypassed predicate or removed unrelated grant: %+v, %+v",
			effective.Tables[0].SelectPermissions, inc.Snapshot())
	}
}

package queries_test

import (
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// buildObjectsWithUsersTable builds a minimal *introspection.Objects with a
// single public.users table that has one primary-key column "id".
func buildObjectsWithUsersTable() *introspection.Objects {
	objs := introspection.NewObjects()
	objs.Schemas["public"] = &introspection.Schema{
		Tables: map[string]*introspection.Table{
			"users": {
				Schema:      "public",
				Name:        "users",
				Columns:     []introspection.Column{{Name: "id", Type: "uuid"}},
				PrimaryKeys: []string{"id"},
			},
		},
	}

	return objs
}

// tableMetaFor returns a minimal TableMetadata for a tracked table in the
// "public" schema.
func tableMetaFor(name string) metadata.TableMetadata {
	return metadata.TableMetadata{Table: metadata.TableSource{Schema: "public", Name: name}}
}

func TestBuildRoots_TableMissingFromIntrospection(t *testing.T) {
	t.Parallel()

	// Objects contain users; metadata tracks orders. Initialize should fail.
	objects := buildObjectsWithUsersTable()
	md := &metadata.DatabaseMetadata{Tables: []metadata.TableMetadata{tableMetaFor("orders")}}

	_, _, err := queries.BuildRoots(objects, md, &dialect.PostgresDialect{})
	if err == nil {
		t.Fatal("expected error for table missing from introspection, got nil")
	}

	if !strings.Contains(err.Error(), "public.orders") {
		t.Errorf("error should mention schema.table, got: %v", err)
	}
}

func TestBuildRoots_FunctionMissingFromIntrospectionIsSkipped(t *testing.T) {
	t.Parallel()

	// Track a function that doesn't exist in introspection. errFunctionNotFound
	// should cause it to be skipped silently.
	objects := buildObjectsWithUsersTable()
	md := &metadata.DatabaseMetadata{
		Tables: []metadata.TableMetadata{tableMetaFor("users")},
		Functions: []metadata.FunctionMetadata{
			{Function: metadata.FunctionSource{Schema: "public", Name: "missing_fn"}},
		},
	}

	roots, ops, err := queries.BuildRoots(objects, md, &dialect.PostgresDialect{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if roots.Operations == nil || ops == nil {
		t.Fatalf("expected non-nil Roots and Ops, got roots=%v ops=%v", roots, ops)
	}

	// users root field should still be registered; missing_fn should not exist anywhere.
	for _, m := range roots.Operations {
		for fieldName := range m {
			if fieldName == "missing_fn" {
				t.Errorf("expected missing_fn to be skipped, but found it in roots")
			}
		}
	}
}

// TestBuildRoots_FunctionReturningUnknownTableIsSkipped covers the
// defense-in-depth path: reconcile is expected to drop a function whose
// return-type table is not tracked (errBaseTableForFunctionNotFound is no
// longer fatal), but if one slips into BuildRoots the function is silently
// skipped so the rest of the source keeps serving.
func TestBuildRoots_FunctionReturningUnknownTableIsSkipped(t *testing.T) {
	t.Parallel()

	objects := introspection.NewObjects()
	objects.Schemas["public"] = &introspection.Schema{
		Tables: map[string]*introspection.Table{
			"users": {
				Schema:      "public",
				Name:        "users",
				Columns:     []introspection.Column{{Name: "id", Type: "uuid"}},
				PrimaryKeys: []string{"id"},
			},
		},
	}
	objects.Functions["public.search_orders"] = &introspection.Function{
		Arguments: nil,
		ReturnType: introspection.FunctionReturnType{
			Type:        "",
			IsSetOf:     true,
			TableSchema: "public",
			TableName:   "orders", // not tracked in metadata
		},
		Volatility: introspection.VolatilityStable,
	}
	md := &metadata.DatabaseMetadata{
		Tables: []metadata.TableMetadata{tableMetaFor("users")},
		Functions: []metadata.FunctionMetadata{
			{Function: metadata.FunctionSource{Schema: "public", Name: "search_orders"}},
		},
	}

	roots, _, err := queries.BuildRoots(objects, md, &dialect.PostgresDialect{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// users root field should still be registered; search_orders should not exist.
	for _, m := range roots.Operations {
		for fieldName := range m {
			if fieldName == "search_orders" {
				t.Errorf("expected search_orders to be skipped, but found it in roots")
			}
		}
	}
}

func TestBuildRoots_HappyPathRegistersTableRoots(t *testing.T) {
	t.Parallel()

	objects := buildObjectsWithUsersTable()
	md := &metadata.DatabaseMetadata{Tables: []metadata.TableMetadata{tableMetaFor("users")}}

	roots, ops, err := queries.BuildRoots(objects, md, &dialect.PostgresDialect{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if ops == nil {
		t.Fatal("expected non-nil Ops")
	}

	queryRoots, ok := roots.Operations[queries.OperationQuery]
	if !ok {
		t.Fatal("expected query roots to be present")
	}

	if _, ok := queryRoots["users"]; !ok {
		t.Errorf("expected 'users' collection root to be registered, got: %v", keys(queryRoots))
	}

	if _, ok := queryRoots["users_by_pk"]; !ok {
		t.Errorf("expected 'users_by_pk' root to be registered, got: %v", keys(queryRoots))
	}
}

func keys[V any](m map[string]V) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}

	return out
}

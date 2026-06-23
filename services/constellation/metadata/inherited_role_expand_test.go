package metadata_test

import (
	"slices"
	"testing"

	"github.com/nhost/nhost/services/constellation/metadata"
)

// tableWith builds a single-table, single-database metadata with the given
// permissions, ready to expand.
func metaWith(inherited []metadata.InheritedRole, table metadata.TableMetadata) *metadata.Metadata {
	return &metadata.Metadata{
		Databases: []metadata.DatabaseMetadata{
			{Name: "default", Tables: []metadata.TableMetadata{table}},
		},
		InheritedRoles: inherited,
	}
}

func findSelect(t *metadata.TableMetadata, role string) *metadata.SelectPermissionConfig {
	for i := range t.SelectPermissions {
		if t.SelectPermissions[i].Role == role {
			return &t.SelectPermissions[i].Permission
		}
	}

	return nil
}

func TestExpandInheritedRoles_SelectUnionAndOrFilter(t *testing.T) {
	t.Parallel()

	meta := metaWith(
		[]metadata.InheritedRole{{RoleName: "manager", RoleSet: []string{"employee", "auditor"}}},
		metadata.TableMetadata{
			Table: metadata.TableSource{Schema: "public", Name: "orders"},
			SelectPermissions: []metadata.SelectPermission{
				{Role: "employee", Permission: metadata.SelectPermissionConfig{
					Columns: []string{"id", "amount"},
					Filter:  map[string]any{"owner": map[string]any{"_eq": "X-Hasura-User-Id"}},
				}},
				{Role: "auditor", Permission: metadata.SelectPermissionConfig{
					Columns:           []string{"id", "region"},
					Filter:            map[string]any{"region": map[string]any{"_eq": "EU"}},
					AllowAggregations: true,
				}},
			},
		},
	)

	inc := metadata.NewInconsistencies()
	metadata.ExpandInheritedRoles(t.Context(), meta, inc, nil)

	if n := len(inc.Snapshot()); n != 0 {
		t.Fatalf("unexpected inconsistencies: %+v", inc.Snapshot())
	}

	got := findSelect(&meta.Databases[0].Tables[0], "manager")
	if got == nil {
		t.Fatal("manager select permission not synthesized")
	}

	if want := []string{"amount", "id", "region"}; !slices.Equal(got.Columns, want) {
		t.Errorf("columns = %v, want %v (sorted union)", got.Columns, want)
	}

	if !got.AllowAggregations {
		t.Error("allow_aggregations should be true (auditor allows)")
	}

	orClauses, ok := got.Filter["_or"].([]any)
	if !ok || len(orClauses) != 2 {
		t.Fatalf("filter should be {_or:[..2..]}, got %v", got.Filter)
	}
}

func TestExpandInheritedRoles_UnrestrictedParentWins(t *testing.T) {
	t.Parallel()

	meta := metaWith(
		[]metadata.InheritedRole{{RoleName: "manager", RoleSet: []string{"employee", "superuser"}}},
		metadata.TableMetadata{
			Table: metadata.TableSource{Schema: "public", Name: "orders"},
			SelectPermissions: []metadata.SelectPermission{
				{Role: "employee", Permission: metadata.SelectPermissionConfig{
					Columns: []string{"id"},
					Filter:  map[string]any{"owner": map[string]any{"_eq": "X-Hasura-User-Id"}},
				}},
				{Role: "superuser", Permission: metadata.SelectPermissionConfig{
					Columns: []string{"id", "secret"},
					Filter:  map[string]any{}, // no restriction
				}},
			},
		},
	)

	metadata.ExpandInheritedRoles(t.Context(), meta, metadata.NewInconsistencies(), nil)

	got := findSelect(&meta.Databases[0].Tables[0], "manager")
	if got == nil {
		t.Fatal("manager select permission not synthesized")
	}

	if len(got.Filter) != 0 {
		t.Errorf("filter = %v, want {} (unrestricted parent makes union unrestricted)", got.Filter)
	}
}

func TestExpandInheritedRoles_OnlyWhereAParentHasThePermission(t *testing.T) {
	t.Parallel()

	// employee has select but not delete; manager must get select but no delete.
	meta := metaWith(
		[]metadata.InheritedRole{{RoleName: "manager", RoleSet: []string{"employee"}}},
		metadata.TableMetadata{
			Table: metadata.TableSource{Schema: "public", Name: "orders"},
			SelectPermissions: []metadata.SelectPermission{
				{
					Role:       "employee",
					Permission: metadata.SelectPermissionConfig{Columns: []string{"id"}},
				},
			},
		},
	)

	metadata.ExpandInheritedRoles(t.Context(), meta, metadata.NewInconsistencies(), nil)

	tbl := &meta.Databases[0].Tables[0]
	if findSelect(tbl, "manager") == nil {
		t.Error("manager select should be synthesized")
	}

	for _, p := range tbl.DeletePermissions {
		if p.Role == "manager" {
			t.Error("manager delete should NOT be synthesized (no parent has delete)")
		}
	}
}

func TestExpandInheritedRoles_ExplicitWinsAndIdempotent(t *testing.T) {
	t.Parallel()

	explicit := metadata.SelectPermissionConfig{Columns: []string{"only_this"}}
	meta := metaWith(
		[]metadata.InheritedRole{{RoleName: "manager", RoleSet: []string{"employee"}}},
		metadata.TableMetadata{
			Table: metadata.TableSource{Schema: "public", Name: "orders"},
			SelectPermissions: []metadata.SelectPermission{
				{
					Role:       "employee",
					Permission: metadata.SelectPermissionConfig{Columns: []string{"id", "amount"}},
				},
				{Role: "manager", Permission: explicit},
			},
		},
	)

	metadata.ExpandInheritedRoles(t.Context(), meta, metadata.NewInconsistencies(), nil)
	// second call must not double-append.
	metadata.ExpandInheritedRoles(t.Context(), meta, metadata.NewInconsistencies(), nil)

	tbl := &meta.Databases[0].Tables[0]
	count := 0

	for _, p := range tbl.SelectPermissions {
		if p.Role == "manager" {
			count++

			if !slices.Equal(p.Permission.Columns, []string{"only_this"}) {
				t.Errorf("explicit manager permission was overwritten: %v", p.Permission.Columns)
			}
		}
	}

	if count != 1 {
		t.Errorf("manager select permission count = %d, want 1 (explicit wins, idempotent)", count)
	}
}

func TestExpandInheritedRoles_NestedExpandsInOrder(t *testing.T) {
	t.Parallel()

	// senior inherits from manager, which inherits from employee.
	meta := metaWith(
		[]metadata.InheritedRole{
			{RoleName: "senior", RoleSet: []string{"manager"}},
			{RoleName: "manager", RoleSet: []string{"employee"}},
		},
		metadata.TableMetadata{
			Table: metadata.TableSource{Schema: "public", Name: "orders"},
			SelectPermissions: []metadata.SelectPermission{
				{
					Role:       "employee",
					Permission: metadata.SelectPermissionConfig{Columns: []string{"id"}},
				},
			},
		},
	)

	inc := metadata.NewInconsistencies()
	metadata.ExpandInheritedRoles(t.Context(), meta, inc, nil)

	if n := len(inc.Snapshot()); n != 0 {
		t.Fatalf("unexpected inconsistencies for nested roles: %+v", inc.Snapshot())
	}

	tbl := &meta.Databases[0].Tables[0]
	for _, role := range []string{"manager", "senior"} {
		if findSelect(tbl, role) == nil {
			t.Errorf("%s select permission not synthesized (nested expansion failed)", role)
		}
	}
}

func TestExpandInheritedRoles_MissingParentRecordsInconsistency(t *testing.T) {
	t.Parallel()

	meta := metaWith(
		[]metadata.InheritedRole{{RoleName: "manager", RoleSet: []string{"ghost"}}},
		metadata.TableMetadata{
			Table:             metadata.TableSource{Schema: "public", Name: "orders"},
			SelectPermissions: []metadata.SelectPermission{},
		},
	)

	inc := metadata.NewInconsistencies()
	metadata.ExpandInheritedRoles(t.Context(), meta, inc, nil)

	snap := inc.Snapshot()
	if len(snap) != 1 {
		t.Fatalf("expected 1 inconsistency, got %d: %+v", len(snap), snap)
	}

	if snap[0].Kind != metadata.InconsistencyKindInheritedRole || snap[0].Name != "manager" {
		t.Errorf("inconsistency = %+v, want kind=inherited_role name=manager", snap[0])
	}

	if findSelect(&meta.Databases[0].Tables[0], "manager") != nil {
		t.Error("manager permission should not be synthesized when a parent is missing")
	}
}

func TestExpandInheritedRoles_CycleRecordsInconsistency(t *testing.T) {
	t.Parallel()

	// a <- b and b <- a: neither parent ever becomes resolvable.
	meta := metaWith(
		[]metadata.InheritedRole{
			{RoleName: "a", RoleSet: []string{"b"}},
			{RoleName: "b", RoleSet: []string{"a"}},
		},
		metadata.TableMetadata{Table: metadata.TableSource{Schema: "public", Name: "orders"}},
	)

	inc := metadata.NewInconsistencies()
	metadata.ExpandInheritedRoles(t.Context(), meta, inc, nil)

	if n := len(inc.Snapshot()); n != 2 {
		t.Fatalf("expected 2 inconsistencies for the cycle, got %d: %+v", n, inc.Snapshot())
	}
}

func TestExpandInheritedRoles_FunctionsAndActions(t *testing.T) {
	t.Parallel()

	meta := &metadata.Metadata{
		Databases: []metadata.DatabaseMetadata{{
			Name: "default",
			Functions: []metadata.FunctionMetadata{{
				Function:    metadata.FunctionSource{Schema: "public", Name: "do_thing"},
				Permissions: []metadata.FunctionPermission{{Role: "employee"}},
			}},
		}},
		Actions: []metadata.ActionMetadata{{
			Name:        "sendEmail",
			Permissions: []metadata.ActionPermission{{Role: "auditor"}},
		}},
		InheritedRoles: []metadata.InheritedRole{
			{RoleName: "manager", RoleSet: []string{"employee", "auditor"}},
		},
	}

	metadata.ExpandInheritedRoles(t.Context(), meta, metadata.NewInconsistencies(), nil)

	fnRoles := meta.Databases[0].Functions[0].Permissions
	if !slices.ContainsFunc(
		fnRoles,
		func(p metadata.FunctionPermission) bool { return p.Role == "manager" },
	) {
		t.Error("manager function permission not synthesized")
	}

	actRoles := meta.Actions[0].Permissions
	if !slices.ContainsFunc(
		actRoles,
		func(p metadata.ActionPermission) bool { return p.Role == "manager" },
	) {
		t.Error("manager action permission not synthesized")
	}
}

func findInsert(t *metadata.TableMetadata, role string) *metadata.InsertPermissionConfig {
	for i := range t.InsertPermissions {
		if t.InsertPermissions[i].Role == role {
			return &t.InsertPermissions[i].Permission
		}
	}

	return nil
}

func findUpdate(t *metadata.TableMetadata, role string) *metadata.UpdatePermissionConfig {
	for i := range t.UpdatePermissions {
		if t.UpdatePermissions[i].Role == role {
			return &t.UpdatePermissions[i].Permission
		}
	}

	return nil
}

func findDelete(t *metadata.TableMetadata, role string) *metadata.DeletePermissionConfig {
	for i := range t.DeletePermissions {
		if t.DeletePermissions[i].Role == role {
			return &t.DeletePermissions[i].Permission
		}
	}

	return nil
}

// TestExpandInheritedRoles_InsertUnionCheckAndSet covers insert synthesis:
// the column union, the OR-combination of restricted Check expressions, and
// the first-wins (role_set order) merge of the Set preset map.
func TestExpandInheritedRoles_InsertUnionCheckAndSet(t *testing.T) {
	t.Parallel()

	meta := metaWith(
		[]metadata.InheritedRole{{RoleName: "manager", RoleSet: []string{"employee", "auditor"}}},
		metadata.TableMetadata{
			Table: metadata.TableSource{Schema: "public", Name: "orders"},
			InsertPermissions: []metadata.InsertPermission{
				{Role: "employee", Permission: metadata.InsertPermissionConfig{
					Columns: []string{"id", "amount"},
					Check:   map[string]any{"amount": map[string]any{"_gt": 0}},
					Set:     map[string]any{"tenant": "X-Hasura-Tenant-Id", "source": "employee"},
				}},
				{Role: "auditor", Permission: metadata.InsertPermissionConfig{
					Columns: []string{"id", "region"},
					Check:   map[string]any{"region": map[string]any{"_eq": "EU"}},
					Set:     map[string]any{"tenant": "auditor-tenant"},
				}},
			},
		},
	)

	inc := metadata.NewInconsistencies()
	metadata.ExpandInheritedRoles(t.Context(), meta, inc, nil)

	if n := len(inc.Snapshot()); n != 0 {
		t.Fatalf("unexpected inconsistencies: %+v", inc.Snapshot())
	}

	got := findInsert(&meta.Databases[0].Tables[0], "manager")
	if got == nil {
		t.Fatal("manager insert permission not synthesized")
	}

	if want := []string{"amount", "id", "region"}; !slices.Equal(got.Columns, want) {
		t.Errorf("columns = %v, want %v (sorted union)", got.Columns, want)
	}

	orClauses, ok := got.Check["_or"].([]any)
	if !ok || len(orClauses) != 2 {
		t.Fatalf("check should be {_or:[..2..]}, got %v", got.Check)
	}

	// first-wins in role_set order: employee precedes auditor, so employee's
	// "tenant" value is kept and "source" survives untouched.
	if got.Set["tenant"] != "X-Hasura-Tenant-Id" {
		t.Errorf("set[tenant] = %v, want employee value (first wins)", got.Set["tenant"])
	}

	if got.Set["source"] != "employee" {
		t.Errorf("set[source] = %v, want %q", got.Set["source"], "employee")
	}
}

// TestExpandInheritedRoles_UpdateUnionFiltersChecksSet covers update synthesis:
// column union, OR-combination of both Filter and Check, and first-wins Set.
func TestExpandInheritedRoles_UpdateUnionFiltersChecksSet(t *testing.T) {
	t.Parallel()

	meta := metaWith(
		[]metadata.InheritedRole{{RoleName: "manager", RoleSet: []string{"employee", "auditor"}}},
		metadata.TableMetadata{
			Table: metadata.TableSource{Schema: "public", Name: "orders"},
			UpdatePermissions: []metadata.UpdatePermission{
				{Role: "employee", Permission: metadata.UpdatePermissionConfig{
					Columns: []string{"amount"},
					Filter:  map[string]any{"owner": map[string]any{"_eq": "X-Hasura-User-Id"}},
					Check:   map[string]any{"amount": map[string]any{"_gt": 0}},
					Set:     map[string]any{"updated_by": "X-Hasura-User-Id"},
				}},
				{Role: "auditor", Permission: metadata.UpdatePermissionConfig{
					Columns: []string{"region"},
					Filter:  map[string]any{"region": map[string]any{"_eq": "EU"}},
					Check:   map[string]any{"region": map[string]any{"_eq": "EU"}},
					Set:     map[string]any{"updated_by": "auditor"},
				}},
			},
		},
	)

	metadata.ExpandInheritedRoles(t.Context(), meta, metadata.NewInconsistencies(), nil)

	got := findUpdate(&meta.Databases[0].Tables[0], "manager")
	if got == nil {
		t.Fatal("manager update permission not synthesized")
	}

	if want := []string{"amount", "region"}; !slices.Equal(got.Columns, want) {
		t.Errorf("columns = %v, want %v (sorted union)", got.Columns, want)
	}

	if orClauses, ok := got.Filter["_or"].([]any); !ok || len(orClauses) != 2 {
		t.Fatalf("filter should be {_or:[..2..]}, got %v", got.Filter)
	}

	if orClauses, ok := got.Check["_or"].([]any); !ok || len(orClauses) != 2 {
		t.Fatalf("check should be {_or:[..2..]}, got %v", got.Check)
	}

	if got.Set["updated_by"] != "X-Hasura-User-Id" {
		t.Errorf("set[updated_by] = %v, want employee value (first wins)", got.Set["updated_by"])
	}
}

// TestExpandInheritedRoles_DeleteOrFilter covers delete synthesis:
// the OR-combination of the contributing parents' row filters.
func TestExpandInheritedRoles_DeleteOrFilter(t *testing.T) {
	t.Parallel()

	meta := metaWith(
		[]metadata.InheritedRole{{RoleName: "manager", RoleSet: []string{"employee", "auditor"}}},
		metadata.TableMetadata{
			Table: metadata.TableSource{Schema: "public", Name: "orders"},
			DeletePermissions: []metadata.DeletePermission{
				{Role: "employee", Permission: metadata.DeletePermissionConfig{
					Filter: map[string]any{"owner": map[string]any{"_eq": "X-Hasura-User-Id"}},
				}},
				{Role: "auditor", Permission: metadata.DeletePermissionConfig{
					Filter: map[string]any{"region": map[string]any{"_eq": "EU"}},
				}},
			},
		},
	)

	metadata.ExpandInheritedRoles(t.Context(), meta, metadata.NewInconsistencies(), nil)

	got := findDelete(&meta.Databases[0].Tables[0], "manager")
	if got == nil {
		t.Fatal("manager delete permission not synthesized")
	}

	if orClauses, ok := got.Filter["_or"].([]any); !ok || len(orClauses) != 2 {
		t.Fatalf("filter should be {_or:[..2..]}, got %v", got.Filter)
	}
}

// TestExpandInheritedRoles_WriteUnrestrictedParentWins asserts the
// unrestricted-parent shortcut for the write permission kinds: a parent whose
// insert Check / update Filter+Check / delete Filter is empty (no restriction)
// makes the synthesized union unrestricted ({}), regardless of a sibling
// parent's restriction.
func TestExpandInheritedRoles_WriteUnrestrictedParentWins(t *testing.T) {
	t.Parallel()

	meta := metaWith(
		[]metadata.InheritedRole{{RoleName: "manager", RoleSet: []string{"employee", "superuser"}}},
		metadata.TableMetadata{
			Table: metadata.TableSource{Schema: "public", Name: "orders"},
			InsertPermissions: []metadata.InsertPermission{
				{Role: "employee", Permission: metadata.InsertPermissionConfig{
					Check: map[string]any{"amount": map[string]any{"_gt": 0}},
				}},
				{Role: "superuser", Permission: metadata.InsertPermissionConfig{
					Check: map[string]any{}, // no restriction
				}},
			},
			UpdatePermissions: []metadata.UpdatePermission{
				{Role: "employee", Permission: metadata.UpdatePermissionConfig{
					Filter: map[string]any{"owner": map[string]any{"_eq": "X-Hasura-User-Id"}},
					Check:  map[string]any{"amount": map[string]any{"_gt": 0}},
				}},
				{Role: "superuser", Permission: metadata.UpdatePermissionConfig{
					Filter: map[string]any{}, // no restriction
					Check:  map[string]any{}, // no restriction
				}},
			},
			DeletePermissions: []metadata.DeletePermission{
				{Role: "employee", Permission: metadata.DeletePermissionConfig{
					Filter: map[string]any{"owner": map[string]any{"_eq": "X-Hasura-User-Id"}},
				}},
				{Role: "superuser", Permission: metadata.DeletePermissionConfig{
					Filter: map[string]any{}, // no restriction
				}},
			},
		},
	)

	metadata.ExpandInheritedRoles(t.Context(), meta, metadata.NewInconsistencies(), nil)

	tbl := &meta.Databases[0].Tables[0]

	ins := findInsert(tbl, "manager")
	if ins == nil {
		t.Fatal("manager insert permission not synthesized")
	}

	if len(ins.Check) != 0 {
		t.Errorf("insert check = %v, want {} (unrestricted parent wins)", ins.Check)
	}

	upd := findUpdate(tbl, "manager")
	if upd == nil {
		t.Fatal("manager update permission not synthesized")
	}

	if len(upd.Filter) != 0 {
		t.Errorf("update filter = %v, want {} (unrestricted parent wins)", upd.Filter)
	}

	if len(upd.Check) != 0 {
		t.Errorf("update check = %v, want {} (unrestricted parent wins)", upd.Check)
	}

	del := findDelete(tbl, "manager")
	if del == nil {
		t.Fatal("manager delete permission not synthesized")
	}

	if len(del.Filter) != 0 {
		t.Errorf("delete filter = %v, want {} (unrestricted parent wins)", del.Filter)
	}
}

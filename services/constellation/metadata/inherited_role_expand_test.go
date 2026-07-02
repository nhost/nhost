package metadata_test

import (
	"reflect"
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

// TestExpandInheritedRoles_MutationIdenticalInherited verifies that when every
// contributing parent holds the SAME mutation permission, the inherited role
// receives it verbatim. Hasura inherits insert/update/delete permissions only
// when they are identical across the role set.
func TestExpandInheritedRoles_MutationIdenticalInherited(t *testing.T) {
	t.Parallel()

	insertCfg := metadata.InsertPermissionConfig{
		Columns: []string{"id", "amount"},
		Check:   map[string]any{"amount": map[string]any{"_gt": 0}},
		Set:     map[string]any{"tenant": "X-Hasura-Tenant-Id"},
	}
	updateCfg := metadata.UpdatePermissionConfig{
		Columns: []string{"amount"},
		Filter:  map[string]any{"owner": map[string]any{"_eq": "X-Hasura-User-Id"}},
		Check:   map[string]any{"amount": map[string]any{"_gt": 0}},
		Set:     map[string]any{"updated_by": "X-Hasura-User-Id"},
	}
	deleteCfg := metadata.DeletePermissionConfig{
		Filter: map[string]any{"owner": map[string]any{"_eq": "X-Hasura-User-Id"}},
	}

	meta := metaWith(
		[]metadata.InheritedRole{{RoleName: "manager", RoleSet: []string{"employee", "auditor"}}},
		metadata.TableMetadata{
			Table: metadata.TableSource{Schema: "public", Name: "orders"},
			InsertPermissions: []metadata.InsertPermission{
				{Role: "employee", Permission: insertCfg},
				{Role: "auditor", Permission: insertCfg},
			},
			UpdatePermissions: []metadata.UpdatePermission{
				{Role: "employee", Permission: updateCfg},
				{Role: "auditor", Permission: updateCfg},
			},
			DeletePermissions: []metadata.DeletePermission{
				{Role: "employee", Permission: deleteCfg},
				{Role: "auditor", Permission: deleteCfg},
			},
		},
	)

	inc := metadata.NewInconsistencies()
	metadata.ExpandInheritedRoles(t.Context(), meta, inc, nil)

	if n := len(inc.Snapshot()); n != 0 {
		t.Fatalf("unexpected inconsistencies: %+v", inc.Snapshot())
	}

	tbl := &meta.Databases[0].Tables[0]

	if ins := findInsert(tbl, "manager"); ins == nil {
		t.Fatal("manager insert permission not synthesized")
	} else if !reflect.DeepEqual(*ins, insertCfg) {
		t.Errorf("insert = %+v, want %+v (inherited verbatim)", *ins, insertCfg)
	}

	if upd := findUpdate(tbl, "manager"); upd == nil {
		t.Fatal("manager update permission not synthesized")
	} else if !reflect.DeepEqual(*upd, updateCfg) {
		t.Errorf("update = %+v, want %+v (inherited verbatim)", *upd, updateCfg)
	}

	if del := findDelete(tbl, "manager"); del == nil {
		t.Fatal("manager delete permission not synthesized")
	} else if !reflect.DeepEqual(*del, deleteCfg) {
		t.Errorf("delete = %+v, want %+v (inherited verbatim)", *del, deleteCfg)
	}
}

// TestExpandInheritedRoles_MutationConflictRecordsInconsistency verifies that
// when contributing parents disagree on a mutation permission, the inherited
// role does NOT receive a most-permissive union (which would over-grant write
// access); the permission is skipped and an InconsistencyKindInheritedRole is
// recorded for the table.
func TestExpandInheritedRoles_MutationConflictRecordsInconsistency(t *testing.T) {
	t.Parallel()

	meta := metaWith(
		[]metadata.InheritedRole{{RoleName: "manager", RoleSet: []string{"employee", "auditor"}}},
		metadata.TableMetadata{
			Table: metadata.TableSource{Schema: "public", Name: "orders"},
			InsertPermissions: []metadata.InsertPermission{
				{Role: "employee", Permission: metadata.InsertPermissionConfig{
					Columns: []string{"id", "amount"},
					Check:   map[string]any{"amount": map[string]any{"_gt": 0}},
				}},
				{Role: "auditor", Permission: metadata.InsertPermissionConfig{
					Columns: []string{"id", "region"},
					Check:   map[string]any{"region": map[string]any{"_eq": "EU"}},
				}},
			},
			UpdatePermissions: []metadata.UpdatePermission{
				{Role: "employee", Permission: metadata.UpdatePermissionConfig{
					Filter: map[string]any{"owner": map[string]any{"_eq": "X-Hasura-User-Id"}},
				}},
				{Role: "auditor", Permission: metadata.UpdatePermissionConfig{
					Filter: map[string]any{"region": map[string]any{"_eq": "EU"}},
				}},
			},
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

	inc := metadata.NewInconsistencies()
	metadata.ExpandInheritedRoles(t.Context(), meta, inc, nil)

	tbl := &meta.Databases[0].Tables[0]
	if got := findInsert(tbl, "manager"); got != nil {
		t.Errorf("insert should not be synthesized on conflict, got %+v", *got)
	}

	if got := findUpdate(tbl, "manager"); got != nil {
		t.Errorf("update should not be synthesized on conflict, got %+v", *got)
	}

	if got := findDelete(tbl, "manager"); got != nil {
		t.Errorf("delete should not be synthesized on conflict, got %+v", *got)
	}

	snap := inc.Snapshot()
	if len(snap) != 3 {
		t.Fatalf(
			"want 3 inconsistencies (insert/update/delete conflict), got %d: %+v",
			len(snap),
			snap,
		)
	}

	for _, i := range snap {
		if i.Kind != metadata.InconsistencyKindInheritedRole {
			t.Errorf(
				"inconsistency kind = %q, want %q",
				i.Kind,
				metadata.InconsistencyKindInheritedRole,
			)
		}

		if i.Name != "manager" || i.Source != "public.orders" {
			t.Errorf(
				"inconsistency = {Source:%q Name:%q}, want {public.orders manager}",
				i.Source,
				i.Name,
			)
		}
	}
}

// TestExpandInheritedRoles_MutationSingleParentInheritedVerbatim verifies that
// when only one parent holds a mutation permission, the inherited role receives
// it verbatim (a single contributor is trivially identical) with no
// inconsistency recorded.
func TestExpandInheritedRoles_MutationSingleParentInheritedVerbatim(t *testing.T) {
	t.Parallel()

	insertCfg := metadata.InsertPermissionConfig{
		Columns: []string{"id", "amount"},
		Check:   map[string]any{"amount": map[string]any{"_gt": 0}},
	}

	meta := metaWith(
		[]metadata.InheritedRole{{RoleName: "manager", RoleSet: []string{"employee", "auditor"}}},
		metadata.TableMetadata{
			Table: metadata.TableSource{Schema: "public", Name: "orders"},
			// Only employee has an insert permission; auditor holds a select
			// permission so it still counts as a known parent role.
			SelectPermissions: []metadata.SelectPermission{
				{
					Role:       "auditor",
					Permission: metadata.SelectPermissionConfig{Columns: []string{"id"}},
				},
			},
			InsertPermissions: []metadata.InsertPermission{
				{Role: "employee", Permission: insertCfg},
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
		t.Fatal("manager insert permission not synthesized from single parent")
	}

	if !reflect.DeepEqual(*got, insertCfg) {
		t.Errorf("insert = %+v, want %+v (single parent inherited verbatim)", *got, insertCfg)
	}
}

// TestExpandInheritedRoles_SelectUnrestrictedParentWins asserts the
// unrestricted-parent shortcut for select: a parent whose row filter is empty
// (no restriction) makes the synthesized union unrestricted ({}), regardless of
// a sibling parent's restriction. (Mutation kinds no longer union; see the
// identical/conflict tests above.)
func TestExpandInheritedRoles_SelectUnrestrictedParentWins(t *testing.T) {
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
					Columns: []string{"id"},
					Filter:  map[string]any{}, // no restriction
				}},
			},
		},
	)

	metadata.ExpandInheritedRoles(t.Context(), meta, metadata.NewInconsistencies(), nil)

	sel := findSelect(&meta.Databases[0].Tables[0], "manager")
	if sel == nil {
		t.Fatal("manager select permission not synthesized")
	}

	if len(sel.Filter) != 0 {
		t.Errorf("select filter = %v, want {} (unrestricted parent wins)", sel.Filter)
	}
}

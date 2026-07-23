package metadata

import (
	"context"
	"fmt"
	"log/slog"
	"slices"
	"strings"
)

// ExpandInheritedRoles materializes each inherited role into concrete per-role
// permissions on database tables, functions, and actions by merging the
// permissions of its parent roles. It mutates meta in place, appending
// synthesized permission entries keyed by the inherited role name on every
// table (select/insert/update/delete), function, and action where at least one
// parent holds a permission of that kind.
//
// Remote-schema permissions are NOT considered: a parent's remote-schema access
// is not unioned into the inherited role, and a parent whose only permission is
// a remote_schemas[].permissions SDL block is not recognized as a known role.
// An inherited role whose only resolvable parent is such a remote-only role is
// therefore left unexpanded and recorded as an InconsistencyKindInheritedRole.
// Remote-schema role inheritance is out of scope; see
// docs/user/hasura-metadata-support.md.
//
// The merge is the most-permissive union: selectable/insertable/updatable
// columns are unioned; row filters and check expressions are OR-combined (a
// parent with no restriction makes the union unrestricted); aggregation access
// is granted if any parent allows it; column presets are merged with the first
// parent (in role_set order) winning a key conflict.
//
// An existing explicit permission for the inherited role is left untouched
// (explicit wins), which also makes ExpandInheritedRoles idempotent. Inherited
// roles whose parents are themselves inherited are expanded in dependency order
// (via a fixpoint) so a child sees its parent's synthesized permissions. A
// parent that is absent, or an inheritance cycle, leaves the inherited role
// unexpanded and is recorded as an InconsistencyKindInheritedRole — mirroring
// Hasura's resolveInheritedRole, which drops an inherited role when a parent is
// not found.
//
// NOTE: this implements the schema-surface + permissive-union semantics; it
// does not implement Hasura's cell-level null-masking (returning null for cells
// a particular contributing parent could not see). That nuance is out of scope.
func ExpandInheritedRoles(
	ctx context.Context,
	meta *Metadata,
	inc *Inconsistencies,
	logger *slog.Logger,
) {
	if meta == nil || len(meta.InheritedRoles) == 0 {
		return
	}

	known := collectKnownRoles(meta)
	expanded := make(map[string]bool, len(meta.InheritedRoles))

	// Fixpoint: expand any inherited role whose parents are all resolvable,
	// repeating until a pass makes no progress. This naturally orders nested
	// inherited roles (a child waits for its inherited parent) and leaves
	// unresolvable roles (missing parent / cycle) unexpanded.
	for {
		progress := false

		for _, ir := range meta.InheritedRoles {
			if expanded[ir.RoleName] || !allKnown(ir.RoleSet, known) {
				continue
			}

			expandOne(meta, ir)
			known[ir.RoleName] = true
			expanded[ir.RoleName] = true
			progress = true
		}

		if !progress {
			break
		}
	}

	for _, ir := range meta.InheritedRoles {
		if expanded[ir.RoleName] {
			continue
		}

		unresolved := make([]string, 0, len(ir.RoleSet))
		for _, parent := range ir.RoleSet {
			if !known[parent] {
				unresolved = append(unresolved, parent)
			}
		}

		inc.Record(
			ctx, logger, InconsistencyKindInheritedRole, "", ir.RoleName,
			fmt.Sprintf(
				"inherited role not expanded: unresolved parent role(s): %s",
				strings.Join(unresolved, ", "),
			),
		)
	}
}

func allKnown(roles []string, known map[string]bool) bool {
	for _, r := range roles {
		if !known[r] {
			return false
		}
	}

	return true
}

// collectKnownRoles returns every role that holds an explicit permission on a
// database table, function, or action, plus the admin role. Remote-schema
// permission roles are intentionally excluded (remote-schema inheritance is out
// of scope; see ExpandInheritedRoles). Inherited role names are added by
// ExpandInheritedRoles as they are expanded.
func collectKnownRoles(meta *Metadata) map[string]bool {
	known := map[string]bool{RoleAdmin: true}

	for di := range meta.Databases {
		db := &meta.Databases[di]

		for ti := range db.Tables {
			t := &db.Tables[ti]
			for _, p := range t.SelectPermissions {
				known[p.Role] = true
			}

			for _, p := range t.InsertPermissions {
				known[p.Role] = true
			}

			for _, p := range t.UpdatePermissions {
				known[p.Role] = true
			}

			for _, p := range t.DeletePermissions {
				known[p.Role] = true
			}
		}

		for fi := range db.Functions {
			for _, p := range db.Functions[fi].Permissions {
				known[p.Role] = true
			}
		}
	}

	for ai := range meta.Actions {
		for _, p := range meta.Actions[ai].Permissions {
			known[p.Role] = true
		}
	}

	return known
}

func expandOne(meta *Metadata, ir InheritedRole) {
	for di := range meta.Databases {
		db := &meta.Databases[di]

		for ti := range db.Tables {
			t := &db.Tables[ti]
			expandTableSelect(t, ir)
			expandTableInsert(t, ir)
			expandTableUpdate(t, ir)
			expandTableDelete(t, ir)
		}

		for fi := range db.Functions {
			expandFunction(&db.Functions[fi], ir)
		}
	}

	for ai := range meta.Actions {
		expandAction(&meta.Actions[ai], ir)
	}
}

func expandTableSelect(t *TableMetadata, ir InheritedRole) {
	if hasRole(t.SelectPermissions, ir.RoleName, selectRole) {
		return
	}

	var (
		columns  [][]string
		filters  []map[string]any
		allowAgg bool
		found    bool
	)

	for _, parent := range ir.RoleSet {
		for i := range t.SelectPermissions {
			if t.SelectPermissions[i].Role != parent {
				continue
			}

			found = true
			columns = append(columns, t.SelectPermissions[i].Permission.Columns)
			filters = append(filters, t.SelectPermissions[i].Permission.Filter)
			allowAgg = allowAgg || t.SelectPermissions[i].Permission.AllowAggregations
		}
	}

	if !found {
		return
	}

	t.SelectPermissions = append(t.SelectPermissions, SelectPermission{
		Role: ir.RoleName,
		Permission: SelectPermissionConfig{
			Columns:           unionColumns(columns),
			Filter:            orFilters(filters),
			AllowAggregations: allowAgg,
		},
	})
}

func expandTableInsert(t *TableMetadata, ir InheritedRole) {
	if hasRole(t.InsertPermissions, ir.RoleName, insertRole) {
		return
	}

	var (
		columns [][]string
		checks  []map[string]any
		sets    []map[string]any
		found   bool
	)

	for _, parent := range ir.RoleSet {
		for i := range t.InsertPermissions {
			if t.InsertPermissions[i].Role != parent {
				continue
			}

			found = true
			columns = append(columns, t.InsertPermissions[i].Permission.Columns)
			checks = append(checks, t.InsertPermissions[i].Permission.Check)
			sets = append(sets, t.InsertPermissions[i].Permission.Set)
		}
	}

	if !found {
		return
	}

	t.InsertPermissions = append(t.InsertPermissions, InsertPermission{
		Role: ir.RoleName,
		Permission: InsertPermissionConfig{
			Columns: unionColumns(columns),
			Check:   orFilters(checks),
			Set:     mergePresets(sets),
		},
	})
}

func expandTableUpdate(t *TableMetadata, ir InheritedRole) {
	if hasRole(t.UpdatePermissions, ir.RoleName, updateRole) {
		return
	}

	var (
		columns [][]string
		filters []map[string]any
		checks  []map[string]any
		sets    []map[string]any
		found   bool
	)

	for _, parent := range ir.RoleSet {
		for i := range t.UpdatePermissions {
			if t.UpdatePermissions[i].Role != parent {
				continue
			}

			found = true
			columns = append(columns, t.UpdatePermissions[i].Permission.Columns)
			filters = append(filters, t.UpdatePermissions[i].Permission.Filter)
			checks = append(checks, t.UpdatePermissions[i].Permission.Check)
			sets = append(sets, t.UpdatePermissions[i].Permission.Set)
		}
	}

	if !found {
		return
	}

	t.UpdatePermissions = append(t.UpdatePermissions, UpdatePermission{
		Role: ir.RoleName,
		Permission: UpdatePermissionConfig{
			Columns: unionColumns(columns),
			Filter:  orFilters(filters),
			Check:   orFilters(checks),
			Set:     mergePresets(sets),
		},
	})
}

func expandTableDelete(t *TableMetadata, ir InheritedRole) {
	if hasRole(t.DeletePermissions, ir.RoleName, deleteRole) {
		return
	}

	var (
		filters []map[string]any
		found   bool
	)

	for _, parent := range ir.RoleSet {
		for i := range t.DeletePermissions {
			if t.DeletePermissions[i].Role != parent {
				continue
			}

			found = true
			filters = append(filters, t.DeletePermissions[i].Permission.Filter)
		}
	}

	if !found {
		return
	}

	t.DeletePermissions = append(t.DeletePermissions, DeletePermission{
		Role:       ir.RoleName,
		Permission: DeletePermissionConfig{Filter: orFilters(filters)},
	})
}

func expandFunction(f *FunctionMetadata, ir InheritedRole) {
	if slices.ContainsFunc(f.Permissions, func(p FunctionPermission) bool {
		return p.Role == ir.RoleName
	}) {
		return
	}

	for _, parent := range ir.RoleSet {
		if slices.ContainsFunc(f.Permissions, func(p FunctionPermission) bool {
			return p.Role == parent
		}) {
			f.Permissions = append(f.Permissions, FunctionPermission{Role: ir.RoleName})

			return
		}
	}
}

func expandAction(a *ActionMetadata, ir InheritedRole) {
	if slices.ContainsFunc(a.Permissions, func(p ActionPermission) bool {
		return p.Role == ir.RoleName
	}) {
		return
	}

	for _, parent := range ir.RoleSet {
		if slices.ContainsFunc(a.Permissions, func(p ActionPermission) bool {
			return p.Role == parent
		}) {
			a.Permissions = append(a.Permissions, ActionPermission{Role: ir.RoleName})

			return
		}
	}
}

func selectRole(p SelectPermission) string { return p.Role }
func insertRole(p InsertPermission) string { return p.Role }
func updateRole(p UpdatePermission) string { return p.Role }
func deleteRole(p DeletePermission) string { return p.Role }

func hasRole[T any](perms []T, role string, roleOf func(T) string) bool {
	return slices.ContainsFunc(perms, func(p T) bool { return roleOf(p) == role })
}

// unionColumns returns the sorted, de-duplicated union of the column groups.
func unionColumns(groups [][]string) []string {
	seen := make(map[string]struct{})

	var out []string

	for _, g := range groups {
		for _, c := range g {
			if _, ok := seen[c]; ok {
				continue
			}

			seen[c] = struct{}{}

			out = append(out, c)
		}
	}

	slices.Sort(out)

	return out
}

// orFilters OR-combines the contributing parents' boolean expressions. A parent
// whose expression is empty (no restriction) makes the whole union
// unrestricted, returning {}. A single contributing expression is returned
// as-is; multiple are wrapped in {_or: [...]}.
func orFilters(filters []map[string]any) map[string]any {
	clauses := make([]any, 0, len(filters))

	for _, f := range filters {
		if len(f) == 0 {
			return map[string]any{}
		}

		clauses = append(clauses, f)
	}

	switch len(clauses) {
	case 0:
		return map[string]any{}
	case 1:
		if only, ok := clauses[0].(map[string]any); ok {
			return only
		}

		return map[string]any{}
	default:
		return map[string]any{"_or": clauses}
	}
}

// mergePresets merges column-preset maps with the first contributor (in
// role_set order) winning a key conflict. It returns nil when no parent sets a
// preset, so the synthesized permission omits an empty "set".
func mergePresets(sets []map[string]any) map[string]any {
	out := make(map[string]any)

	for _, s := range sets {
		for k, v := range s {
			if _, ok := out[k]; !ok {
				out[k] = v
			}
		}
	}

	if len(out) == 0 {
		return nil
	}

	return out
}

//nolint:revive,nolintlint // package name "sql" shadows database/sql; this package never imports it.
package sql

import (
	"context"
	"fmt"
	"log/slog"
	"slices"

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// reconcileMetadata walks dbMeta against the introspected objects and returns
// a filtered copy in which every entity that does not exist in the source has
// been removed. Each removal is recorded on inc (pass nil to discard).
//
// What gets reconciled:
//   - Tables: dropped when absent from objects (kind=table).
//   - Tables flagged is_enum: dropped entirely when objects.EnumValues
//     carries no rows for the table (kind=enum_values). Demoting to a
//     regular table would silently widen the input contract for FK columns
//     pointing at it, so the failure is surfaced as a missing table
//     instead — matching Hasura's behaviour.
//   - Columns: ColumnConfig keys, SelectPermission.Columns,
//     InsertPermission.Columns, UpdatePermission.Columns and the keys of
//     InsertPermission.Set / UpdatePermission.Set are dropped when no such
//     column exists on the introspected table (kind=column).
//   - Functions: dropped when absent from objects.Functions (kind=function).
//   - Object/Array relationships: dropped when the target table (only when
//     it lives in the same source) does not exist (kind=relationship).
//
// Reconciliation is intentionally scoped: Hasura-expression Filter/Check
// trees inside permissions are not walked because they reference columns
// through a separate parser; a missing column inside those expressions still
// surfaces as a query-time error today. Cross-source relationship targets
// are also not validated here — the composer's relationship layer handles
// those.
func reconcileMetadata(
	ctx context.Context,
	logger *slog.Logger,
	inc *metadata.Inconsistencies,
	dbMeta *metadata.DatabaseMetadata,
	objects *introspection.Objects,
) *metadata.DatabaseMetadata {
	if dbMeta == nil {
		return nil
	}

	out := *dbMeta

	out.Tables = reconcileTables(ctx, logger, inc, dbMeta.Name, dbMeta.Tables, objects)
	out.Functions = reconcileFunctions(
		ctx, logger, inc, dbMeta.Name, dbMeta.Functions, objects,
	)

	return &out
}

// reconcileTables drops tables missing from objects, then reconciles each
// surviving table's enum flag, columns, and relationships against the set of
// surviving tables.
func reconcileTables(
	ctx context.Context,
	logger *slog.Logger,
	inc *metadata.Inconsistencies,
	dbName string,
	tables []metadata.TableMetadata,
	objects *introspection.Objects,
) []metadata.TableMetadata {
	surviving := make([]metadata.TableMetadata, 0, len(tables))
	survivingNames := make(map[string]struct{}, len(tables))

	for i := range tables {
		t := tables[i]

		if _, ok := objects.GetTable(t.Table.Schema, t.Table.Name); !ok {
			inc.RecordTable(
				ctx, logger,
				dbName,
				t.Table.Schema, t.Table.Name,
				"table not found in source",
			)

			continue
		}

		if t.IsEnum {
			if _, ok := objects.GetEnumValues(t.Table.Schema, t.Table.Name); !ok {
				// Hasura parity: a table flagged is_enum that cannot
				// produce values (missing rows, invalid shape, query
				// failure) is dropped entirely. Demoting to a regular
				// table would silently widen the input contract for
				// every FK column pointing at it, which is the wrong
				// shape of failure to absorb.
				inc.RecordEnumValues(
					ctx, logger,
					dbName,
					t.Table.Schema, t.Table.Name,
					"table cannot be used as an enum: "+
						"no usable values found (missing rows, "+
						"invalid shape, or query failure)",
				)

				continue
			}
		}

		surviving = append(surviving, t)
		survivingNames[qualifyTable(t.Table.Schema, t.Table.Name)] = struct{}{}
	}

	for i := range surviving {
		t := &surviving[i]

		introspected, _ := objects.GetTable(t.Table.Schema, t.Table.Name)
		cols := columnNameSet(introspected)

		reconcileColumnConfig(ctx, logger, inc, dbName, t, cols)
		reconcilePermissionColumns(ctx, logger, inc, dbName, t, cols)
		reconcileRelationships(ctx, logger, inc, dbName, t, survivingNames)
	}

	return surviving
}

// columnNameSet returns the set of column names exposed by t. The empty case
// (nil t) is handled defensively so callers do not have to.
func columnNameSet(t *introspection.Table) map[string]struct{} {
	if t == nil {
		return nil
	}

	out := make(map[string]struct{}, len(t.Columns))
	for _, col := range t.Columns {
		out[col.Name] = struct{}{}
	}

	return out
}

// qualifyTable joins schema.table into the same form used by
// metadata.RecordTable for the inconsistency Name. Used here for the
// survivingNames set and for embedding the relationship target in a reason
// string.
func qualifyTable(schema, table string) string {
	if schema == "" {
		return table
	}

	return schema + "." + table
}

// reconcileColumnConfig drops ColumnConfig entries whose key is not a column
// on the table. The common steady-state case is that every key survives, so
// we walk once to detect any drop before allocating a replacement map.
func reconcileColumnConfig(
	ctx context.Context,
	logger *slog.Logger,
	inc *metadata.Inconsistencies,
	dbName string,
	t *metadata.TableMetadata,
	cols map[string]struct{},
) {
	if len(t.Configuration.ColumnConfig) == 0 {
		return
	}

	anyMissing := false

	for col := range t.Configuration.ColumnConfig {
		if _, ok := cols[col]; !ok {
			anyMissing = true

			break
		}
	}

	if !anyMissing {
		return
	}

	filtered := make(map[string]metadata.ColumnConfig, len(t.Configuration.ColumnConfig))

	for col, cfg := range t.Configuration.ColumnConfig {
		if _, ok := cols[col]; !ok {
			inc.RecordColumn(
				ctx, logger,
				dbName,
				t.Table.Schema, t.Table.Name, col,
				"column referenced in column_config not found in source",
			)

			continue
		}

		filtered[col] = cfg
	}

	if len(filtered) == 0 {
		t.Configuration.ColumnConfig = nil

		return
	}

	t.Configuration.ColumnConfig = filtered
}

// reconcilePermissionColumns walks select/insert/update permission column
// lists and insert/update Set maps, dropping references to nonexistent
// columns.
func reconcilePermissionColumns(
	ctx context.Context,
	logger *slog.Logger,
	inc *metadata.Inconsistencies,
	dbName string,
	t *metadata.TableMetadata,
	cols map[string]struct{},
) {
	// The slice headers we received were value-copied from the caller's
	// dbMeta, but they still alias the same backing array. Clone before
	// taking &t.XxxPermissions[i] so writes through p don't leak into the
	// caller's metadata. Mirrors reconcileRelationships.
	t.SelectPermissions = slices.Clone(t.SelectPermissions)
	for i := range t.SelectPermissions {
		p := &t.SelectPermissions[i]
		p.Permission.Columns = filterColumnList(
			ctx, logger, inc, dbName, t, p.Role, "select_permission.columns",
			p.Permission.Columns, cols,
		)
	}

	t.InsertPermissions = slices.Clone(t.InsertPermissions)
	for i := range t.InsertPermissions {
		p := &t.InsertPermissions[i]
		p.Permission.Columns = filterColumnList(
			ctx, logger, inc, dbName, t, p.Role, "insert_permission.columns",
			p.Permission.Columns, cols,
		)
		p.Permission.Set = filterColumnKeyMap(
			ctx, logger, inc, dbName, t, p.Role, "insert_permission.set",
			p.Permission.Set, cols,
		)
	}

	t.UpdatePermissions = slices.Clone(t.UpdatePermissions)
	for i := range t.UpdatePermissions {
		p := &t.UpdatePermissions[i]
		p.Permission.Columns = filterColumnList(
			ctx, logger, inc, dbName, t, p.Role, "update_permission.columns",
			p.Permission.Columns, cols,
		)
		p.Permission.Set = filterColumnKeyMap(
			ctx, logger, inc, dbName, t, p.Role, "update_permission.set",
			p.Permission.Set, cols,
		)
	}
}

func filterColumnList(
	ctx context.Context,
	logger *slog.Logger,
	inc *metadata.Inconsistencies,
	dbName string,
	t *metadata.TableMetadata,
	role, where string,
	list []string,
	cols map[string]struct{},
) []string {
	if len(list) == 0 {
		return list
	}

	anyMissing := false

	for _, col := range list {
		if _, ok := cols[col]; !ok {
			anyMissing = true

			break
		}
	}

	if !anyMissing {
		return list
	}

	out := make([]string, 0, len(list))

	for _, col := range list {
		if _, ok := cols[col]; ok {
			out = append(out, col)

			continue
		}

		inc.RecordColumn(
			ctx, logger,
			dbName,
			t.Table.Schema, t.Table.Name, col,
			fmt.Sprintf(
				"column referenced in %s for role %q not found in source",
				where, role,
			),
		)
	}

	if len(out) == 0 {
		return nil
	}

	return out
}

func filterColumnKeyMap(
	ctx context.Context,
	logger *slog.Logger,
	inc *metadata.Inconsistencies,
	dbName string,
	t *metadata.TableMetadata,
	role, where string,
	m map[string]any,
	cols map[string]struct{},
) map[string]any {
	if len(m) == 0 {
		return m
	}

	anyMissing := false

	for k := range m {
		if _, ok := cols[k]; !ok {
			anyMissing = true

			break
		}
	}

	if !anyMissing {
		return m
	}

	out := make(map[string]any, len(m))

	for k, v := range m {
		if _, ok := cols[k]; ok {
			out[k] = v

			continue
		}

		inc.RecordColumn(
			ctx, logger,
			dbName,
			t.Table.Schema, t.Table.Name, k,
			fmt.Sprintf(
				"column referenced in %s for role %q not found in source",
				where, role,
			),
		)
	}

	if len(out) == 0 {
		return nil
	}

	return out
}

// reconcileRelationships drops local object/array relationships whose target
// table no longer survives in this source. Cross-source relationships
// (ManualConfiguration.Source != "" pointing elsewhere) are left alone — the
// composer is responsible for those.
func reconcileRelationships(
	ctx context.Context,
	logger *slog.Logger,
	inc *metadata.Inconsistencies,
	dbName string,
	t *metadata.TableMetadata,
	surviving map[string]struct{},
) {
	t.ObjectRelationships = slices.DeleteFunc(
		slices.Clone(t.ObjectRelationships),
		func(rel metadata.ObjectRelationship) bool {
			return shouldDropRelationship(
				ctx, logger, inc, dbName, t, rel.Name, rel.Using, surviving,
			)
		},
	)

	t.ArrayRelationships = slices.DeleteFunc(
		slices.Clone(t.ArrayRelationships),
		func(rel metadata.ArrayRelationship) bool {
			return shouldDropRelationship(
				ctx, logger, inc, dbName, t, rel.Name, rel.Using, surviving,
			)
		},
	)
}

func shouldDropRelationship(
	ctx context.Context,
	logger *slog.Logger,
	inc *metadata.Inconsistencies,
	dbName string,
	t *metadata.TableMetadata,
	relName string,
	using metadata.RelationshipUsing,
	surviving map[string]struct{},
) bool {
	target, sourceOverride, ok := relationshipTarget(using)
	if !ok {
		return false
	}

	if sourceOverride != "" && sourceOverride != dbName {
		return false
	}

	if _, exists := surviving[qualifyTable(target.Schema, target.Name)]; exists {
		return false
	}

	inc.RecordRelationship(
		ctx, logger,
		dbName,
		t.Table.Schema, t.Table.Name, relName,
		fmt.Sprintf(
			"relationship target %q not tracked in source",
			qualifyTable(target.Schema, target.Name),
		),
	)

	return true
}

// relationshipTarget extracts the target table reference from a Using clause.
// Returns ok=false when the Using has no explicit target (foreign-key-column
// shorthand resolves through introspection elsewhere).
func relationshipTarget(using metadata.RelationshipUsing) (metadata.TableSource, string, bool) {
	if using.ForeignKeyConstraint != nil {
		return using.ForeignKeyConstraint.Table, "", true
	}

	if using.ManualConfiguration != nil {
		return using.ManualConfiguration.RemoteTable,
			using.ManualConfiguration.Source,
			true
	}

	return metadata.TableSource{}, "", false //nolint:exhaustruct
}

// reconcileFunctions drops functions whose source schema.name does not exist
// in the introspected objects.
func reconcileFunctions(
	ctx context.Context,
	logger *slog.Logger,
	inc *metadata.Inconsistencies,
	dbName string,
	functions []metadata.FunctionMetadata,
	objects *introspection.Objects,
) []metadata.FunctionMetadata {
	if len(functions) == 0 {
		return functions
	}

	out := make([]metadata.FunctionMetadata, 0, len(functions))

	for i := range functions {
		fn := functions[i]
		if _, ok := objects.GetFunction(fn.Function.Schema, fn.Function.Name); ok {
			out = append(out, fn)

			continue
		}

		inc.RecordFunction(
			ctx, logger,
			dbName,
			fn.Function.Schema, fn.Function.Name,
			"function not found in source",
		)
	}

	if len(out) == 0 {
		return nil
	}

	return out
}

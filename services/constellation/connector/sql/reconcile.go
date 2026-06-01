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

	survivingTables := make(map[string]struct{}, len(out.Tables))
	for i := range out.Tables {
		survivingTables[qualifyTable(out.Tables[i].Table.Schema, out.Tables[i].Table.Name)] = struct{}{}
	}

	out.Functions = reconcileFunctions(
		ctx, logger, inc, dbMeta.Name, dbMeta.Functions, objects, survivingTables,
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
		reconcileRelationshipFKIntrospection(ctx, logger, inc, dbName, t, introspected, objects)
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

// reconcileRelationshipFKIntrospection drops object/array relationships whose
// foreign-key shape cannot be resolved against the introspected schema, even
// though their target table is tracked in metadata. The earlier
// reconcileRelationships pass only checks that the target survives in
// metadata; it cannot see two additional failure modes that would otherwise
// abort the whole connector at BuildRoots time:
//
//   - **Forward `ForeignKeyColumns`** — the relationship resolves its target
//     through introspection (`LookupForwardFKTarget`). When the parent
//     table's introspected ForeignKeys contain no entry for the listed
//     columns, or the listed columns disagree on the target table, the
//     resolved target ends up empty and the queries package raises
//     `errRelationshipTargetTableIntrospectionNotFound`.
//   - **Reverse `ForeignKeyConstraint`** — the FK columns named in the
//     constraint live on the target table. Each must have a matching
//     introspected `ForeignKey` on that target; an unmatched column would
//     otherwise render as `"alias".""` at execution time
//     (`errRelationshipReverseFKColumnUnmatched`).
//
// Both shapes are per-relationship inconsistencies, so we record them as
// `InconsistencyKindRelationship` and drop just the offending relationship.
// Cross-source relationships (`ManualConfiguration.Source` pointing
// elsewhere) and remote-schema relationships are skipped because they do not
// rely on the local FK introspection.
func reconcileRelationshipFKIntrospection(
	ctx context.Context,
	logger *slog.Logger,
	inc *metadata.Inconsistencies,
	dbName string,
	t *metadata.TableMetadata,
	parentIntrospected *introspection.Table,
	objects *introspection.Objects,
) {
	if parentIntrospected == nil {
		return
	}

	t.ObjectRelationships = slices.DeleteFunc(
		t.ObjectRelationships,
		func(rel metadata.ObjectRelationship) bool {
			return shouldDropOnFKIntrospection(
				ctx, logger, inc, dbName, t, rel.Name, rel.Using,
				parentIntrospected, objects,
			)
		},
	)

	t.ArrayRelationships = slices.DeleteFunc(
		t.ArrayRelationships,
		func(rel metadata.ArrayRelationship) bool {
			return shouldDropOnFKIntrospection(
				ctx, logger, inc, dbName, t, rel.Name, rel.Using,
				parentIntrospected, objects,
			)
		},
	)
}

// shouldDropOnFKIntrospection returns true when a relationship's FK shape
// cannot be paired against introspection — see reconcileRelationshipFKIntrospection
// for the failure-mode catalogue. The Using shapes handled here mirror the
// queries package's buildJoinCondition decision tree exactly so a drop here
// guarantees buildJoinCondition would have failed.
func shouldDropOnFKIntrospection(
	ctx context.Context,
	logger *slog.Logger,
	inc *metadata.Inconsistencies,
	dbName string,
	t *metadata.TableMetadata,
	relName string,
	using metadata.RelationshipUsing,
	parentIntrospected *introspection.Table,
	objects *introspection.Objects,
) bool {
	// Remote-schema and cross-source relationships do not consume local FK
	// introspection; the composer validates them separately.
	if using.ManualConfiguration != nil &&
		(using.ManualConfiguration.RemoteSchema != "" ||
			(using.ManualConfiguration.Source != "" &&
				using.ManualConfiguration.Source != dbName)) {
		return false
	}

	switch {
	case len(using.ForeignKeyColumns) > 0:
		return dropIfForwardFKBroken(
			ctx, logger, inc, dbName, t, relName,
			using.ForeignKeyColumns, parentIntrospected, objects,
		)
	case using.ForeignKeyConstraint != nil:
		return dropIfReverseFKBroken(
			ctx, logger, inc, dbName, t, relName,
			using.ForeignKeyConstraint, objects,
		)
	}

	return false
}

// dropIfForwardFKBroken handles forward `ForeignKeyColumns` relationships:
// the target table is discovered via the parent's introspected ForeignKeys.
// If every listed column has a matching FK and all listed columns agree on
// the same target, the relationship is kept. Otherwise the relationship is
// dropped and recorded.
func dropIfForwardFKBroken(
	ctx context.Context,
	logger *slog.Logger,
	inc *metadata.Inconsistencies,
	dbName string,
	t *metadata.TableMetadata,
	relName string,
	fkColumns []string,
	parentIntrospected *introspection.Table,
	objects *introspection.Objects,
) bool {
	targetSchema, targetTable := parentIntrospected.LookupForwardFKTarget(fkColumns)
	if targetSchema == "" || targetTable == "" {
		inc.RecordRelationship(
			ctx, logger,
			dbName,
			t.Table.Schema, t.Table.Name, relName,
			fmt.Sprintf(
				"relationship target unresolved: foreign_key_columns %v have no "+
					"matching foreign key on %s",
				fkColumns, qualifyTable(t.Table.Schema, t.Table.Name),
			),
		)

		return true
	}

	if _, ok := objects.GetTable(targetSchema, targetTable); !ok {
		inc.RecordRelationship(
			ctx, logger,
			dbName,
			t.Table.Schema, t.Table.Name, relName,
			fmt.Sprintf(
				"relationship target %q not found in source introspection",
				qualifyTable(targetSchema, targetTable),
			),
		)

		return true
	}

	return false
}

// dropIfReverseFKBroken handles reverse `ForeignKeyConstraint` relationships:
// the FK columns live on the target table and must each have a matching
// introspected ForeignKey there. Missing target table or unmatched column
// both abort the per-relationship build at queries time, so we drop and
// record here.
func dropIfReverseFKBroken(
	ctx context.Context,
	logger *slog.Logger,
	inc *metadata.Inconsistencies,
	dbName string,
	t *metadata.TableMetadata,
	relName string,
	constraint *metadata.ForeignKeyConstraint,
	objects *introspection.Objects,
) bool {
	targetTable, ok := objects.GetTable(constraint.Table.Schema, constraint.Table.Name)
	if !ok {
		inc.RecordRelationship(
			ctx, logger,
			dbName,
			t.Table.Schema, t.Table.Name, relName,
			fmt.Sprintf(
				"relationship target %q not found in source introspection",
				qualifyTable(constraint.Table.Schema, constraint.Table.Name),
			),
		)

		return true
	}

	for _, col := range constraint.Columns {
		matched := false

		for _, fk := range targetTable.ForeignKeys {
			if fk.ColumnName == col {
				matched = true
				break
			}
		}

		if !matched {
			inc.RecordRelationship(
				ctx, logger,
				dbName,
				t.Table.Schema, t.Table.Name, relName,
				fmt.Sprintf(
					"reverse-FK column %q on %s has no matching foreign key in source",
					col,
					qualifyTable(constraint.Table.Schema, constraint.Table.Name),
				),
			)

			return true
		}
	}

	return false
}

// relationshipTarget extracts the target table reference from a Using clause.
// Returns ok=false when the Using has no explicit SQL-table target:
//   - foreign-key-column shorthand resolves through introspection elsewhere
//   - to_remote_schema relationships (ManualConfiguration.RemoteSchema != "")
//     have an empty RemoteTable by design and resolve through the
//     remote-schema connector, not against this source's table set
func relationshipTarget(using metadata.RelationshipUsing) (metadata.TableSource, string, bool) {
	if using.ForeignKeyConstraint != nil {
		return using.ForeignKeyConstraint.Table, "", true
	}

	if using.ManualConfiguration != nil {
		if using.ManualConfiguration.RemoteSchema != "" {
			return metadata.TableSource{}, "", false //nolint:exhaustruct
		}

		return using.ManualConfiguration.RemoteTable,
			using.ManualConfiguration.Source,
			true
	}

	return metadata.TableSource{}, "", false //nolint:exhaustruct
}

// reconcileFunctions drops functions whose source schema.name does not exist
// in the introspected objects, whose return type is not a table type, or
// whose declared return-table is not a surviving tracked table. The latter
// two checks close BuildRoots-time gaps that would otherwise abort the whole
// connector:
//
//   - A function whose return type is not a table type (scalar, RECORD, etc.)
//     is rejected by the queries package with errFunctionDoesNotReturnTableType.
//   - A function whose return type names a table that no longer survives
//     (table missing from source, or never tracked) was formerly surfaced as
//     errBaseTableForFunctionNotFound.
//
// Recording the failure here drops just the offending function and lets the
// rest of the source keep serving.
func reconcileFunctions(
	ctx context.Context,
	logger *slog.Logger,
	inc *metadata.Inconsistencies,
	dbName string,
	functions []metadata.FunctionMetadata,
	objects *introspection.Objects,
	survivingTables map[string]struct{},
) []metadata.FunctionMetadata {
	if len(functions) == 0 {
		return functions
	}

	out := make([]metadata.FunctionMetadata, 0, len(functions))

	for i := range functions {
		fn := functions[i]

		fnInfo, ok := objects.GetFunction(fn.Function.Schema, fn.Function.Name)
		if !ok {
			inc.RecordFunction(
				ctx, logger,
				dbName,
				fn.Function.Schema, fn.Function.Name,
				"function not found in source",
			)

			continue
		}

		// Functions that don't return a table type cannot register a root
		// field (the queries package raises
		// errFunctionDoesNotReturnTableType). Drop here so the rest of the
		// source keeps serving.
		if !fnInfo.ReturnType.IsTableType() {
			inc.RecordFunction(
				ctx, logger,
				dbName,
				fn.Function.Schema, fn.Function.Name,
				"function does not return a table type",
			)

			continue
		}

		baseKey := qualifyTable(
			fnInfo.ReturnType.TableSchema, fnInfo.ReturnType.TableName,
		)
		if _, tracked := survivingTables[baseKey]; !tracked {
			inc.RecordFunction(
				ctx, logger,
				dbName,
				fn.Function.Schema, fn.Function.Name,
				fmt.Sprintf(
					"function base table %q is not tracked in source",
					baseKey,
				),
			)

			continue
		}

		out = append(out, fn)
	}

	if len(out) == 0 {
		return nil
	}

	return out
}

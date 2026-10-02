//nolint:revive,nolintlint // package name "sql" shadows database/sql; this package never imports it.
package sql

import (
	"context"
	"fmt"
	"log/slog"
	"slices"
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// computedIndex keeps the original field names even when a signature is
// invalid. A filter referencing a removed field must not become unrestricted.
type computedIndex map[introspection.ComputedTable]map[string]computedKind

type computedKind uint8

const (
	computedInvalid computedKind = iota
	computedScalar
	computedTable
	// Non-base argument kinds remain deferred until their GraphQL input
	// coercion is implemented; supported base-return selections stay exposed.
	computedDeferred
	computedDeferredTable
)

func reconcileComputedFields(
	ctx context.Context, logger *slog.Logger, inc *metadata.Inconsistencies,
	original *metadata.DatabaseMetadata, effective *metadata.DatabaseMetadata,
	objects *introspection.Objects,
) {
	index := make(computedIndex)

	tracked := make(map[introspection.ComputedTable]struct{}, len(effective.Tables))
	for _, table := range effective.Tables {
		tracked[introspection.ComputedTable{Schema: table.Table.Schema, Name: table.Table.Name}] = struct{}{}
	}

	for i := range effective.Tables {
		t := &effective.Tables[i]
		key := introspection.ComputedTable{Schema: t.Table.Schema, Name: t.Table.Name}
		index[key] = make(map[string]computedKind)

		indexComputedGrants(t.SelectPermissions, index[key])

		counts := make(map[string]int, len(t.ComputedFields))
		for _, field := range t.ComputedFields {
			counts[field.Name]++
		}

		fields := make([]metadata.ComputedField, 0, len(t.ComputedFields))
		for _, field := range t.ComputedFields {
			kind, reason := validateComputedField(original.Kind, t, field, objects, tracked)
			if counts[field.Name] > 1 {
				reason = "duplicate computed field name"
			}

			if reason != "" {
				inc.RecordComputedField(ctx, logger, original.Name, key.Schema, key.Name,
					field.Name, reason)

				if field.Name != "" {
					index[key][field.Name] = computedInvalid
				}

				continue
			}

			index[key][field.Name] = kind
			// Deferred signatures must not enter the effective metadata even
			// if a later rollout enables computed-field schema capabilities.
			if kind != computedDeferred && kind != computedDeferredTable {
				fields = append(fields, field)
			}
		}

		t.ComputedFields = fields
	}

	for i := range effective.Tables {
		t := &effective.Tables[i]
		reconcileComputedPermissions(
			ctx,
			logger,
			inc,
			original.Name,
			t,
			effective.Tables,
			objects,
			index,
		)
	}
}

// A grant identifies a computed name even when its definition is absent;
// names with neither definition nor grant remain ordinary unknown keys.
func indexComputedGrants(permissions []metadata.SelectPermission, names map[string]computedKind) {
	for _, permission := range permissions {
		for _, name := range permission.Permission.ComputedFields {
			if name != "" {
				names[name] = computedInvalid
			}
		}
	}
}

func validateComputedField(
	backend string, table *metadata.TableMetadata, field metadata.ComputedField,
	objects *introspection.Objects, tracked map[introspection.ComputedTable]struct{},
) (computedKind, string) {
	if field.DecodeError != "" {
		return computedInvalid, field.DecodeError
	}

	if backend != "postgres" && backend != "" {
		return computedInvalid, "computed fields require PostgreSQL"
	}

	if field.Name == "" || field.Definition.Function.Name == "" {
		return computedInvalid, "computed field name and function are required"
	}

	if reason := computedNameConflict(table, field.Name, objects); reason != "" {
		return computedInvalid, reason
	}

	lookup, found := objects.GetComputedFunction(table.Table.Schema, table.Table.Name, field.Name)
	if !found || lookup.Function == nil {
		if lookup.Reason != "" {
			return computedInvalid, lookup.Reason
		}

		return computedInvalid, "computed function not found in source"
	}

	return validateComputedSignature(field, lookup.Function, tracked)
}

func computedNameConflict(
	table *metadata.TableMetadata,
	name string,
	objects *introspection.Objects,
) string {
	if !validComputedName(name) {
		return "computed field name is not a GraphQL identifier"
	}

	if strings.HasPrefix(name, "__") {
		return "computed field name is reserved"
	}

	for _, col := range objectsColumnNames(objects, table.Table) {
		if col == name || table.Configuration.ColumnConfig[col].CustomName == name {
			return "computed field conflicts with a column"
		}
	}

	for _, rel := range table.ObjectRelationships {
		if rel.Name == name {
			return "computed field conflicts with a relationship"
		}
	}

	for _, rel := range table.ArrayRelationships {
		if rel.Name == name || rel.Name+"_aggregate" == name {
			return "computed field conflicts with a relationship"
		}
	}

	for _, rel := range table.RemoteRelationships {
		if rel.Name == name {
			return "computed field conflicts with a remote relationship"
		}
	}

	return ""
}

func validComputedName(name string) bool {
	if name == "" {
		return false
	}

	for i, r := range name {
		letter := r >= 'A' && r <= 'Z' || r >= 'a' && r <= 'z' || r == '_'

		digit := r >= '0' && r <= '9'
		if !letter && (i == 0 || !digit) {
			return false
		}
	}

	return true
}

func validateComputedSignature(field metadata.ComputedField, fn *introspection.ComputedFunction,
	tracked map[introspection.ComputedTable]struct{},
) (computedKind, string) {
	if reason := validateComputedArguments(field, fn); reason != "" {
		return computedInvalid, reason
	}

	if fn.Volatility != introspection.VolatilityStable &&
		fn.Volatility != introspection.VolatilityImmutable {
		return computedInvalid, "computed function must be stable or immutable"
	}

	if fn.ReturnRelOID != 0 {
		if fn.ReturnType.Kind != "c" {
			return computedInvalid, "computed table return must be composite"
		}

		target := introspection.ComputedTable{
			Schema: fn.ReturnType.Schema,
			Name:   fn.ReturnType.Name,
		}
		if _, ok := tracked[target]; !ok || !fn.ReturnSet {
			return computedInvalid, "computed function must return SETOF a tracked table"
		}

		if computedHasUnclassifiedArgument(fn) {
			return computedDeferredTable, ""
		}

		return computedTable, ""
	}

	if fn.ReturnSet {
		return computedInvalid, "scalar computed function cannot return SETOF"
	}

	if fn.ReturnType.Kind != "b" {
		return computedInvalid, "computed scalar return type is not a BASE type"
	}

	if computedHasUnclassifiedArgument(fn) {
		return computedDeferred, ""
	}

	return computedScalar, ""
}

func computedHasUnclassifiedArgument(fn *introspection.ComputedFunction) bool {
	for i, arg := range fn.Arguments {
		if i != fn.RowArgument && arg.Type.Kind != "b" {
			return true
		}
	}

	return false
}

func validateComputedArguments(
	field metadata.ComputedField,
	fn *introspection.ComputedFunction,
) string {
	if fn.RowArgument < 0 || fn.RowArgument >= len(fn.Arguments) ||
		fn.Arguments[fn.RowArgument].Mode != "i" {
		return "invalid row argument"
	}

	if field.Definition.SessionArgument != "" &&
		!hasComputedSessionArgument(fn, field.Definition.SessionArgument) {
		return "session argument must name an input JSON argument"
	}

	for i, arg := range fn.Arguments {
		if i == fn.RowArgument {
			continue
		}

		if arg.Mode != "i" || !computedScalarArgumentKind(arg.Type.Kind) {
			return "unsupported computed function argument type or mode"
		}
	}

	return ""
}

func computedScalarArgumentKind(kind string) bool {
	switch kind {
	case "b", "d", "e", "r", "m":
		return true
	default:
		return false
	}
}

func hasComputedSessionArgument(fn *introspection.ComputedFunction, name string) bool {
	for i, arg := range fn.Arguments {
		if i != fn.RowArgument && arg.Name == name && arg.Mode == "i" &&
			arg.Type.Schema == "pg_catalog" && arg.Type.Kind == "b" &&
			(arg.Type.Name == "json" || arg.Type.Name == "jsonb") {
			return true
		}
	}

	return false
}

func objectsColumnNames(objects *introspection.Objects, table metadata.TableSource) []string {
	info, ok := objects.GetTable(table.Schema, table.Name)
	if !ok {
		return nil
	}

	return tableColumnNames(info)
}

func reconcileComputedPermissions(
	ctx context.Context, logger *slog.Logger, inc *metadata.Inconsistencies,
	source string, table *metadata.TableMetadata, tables []metadata.TableMetadata,
	objects *introspection.Objects, index computedIndex,
) {
	table.SelectPermissions = slices.DeleteFunc(
		slices.Clone(table.SelectPermissions), func(p metadata.SelectPermission) bool {
			return invalidComputedSelect(ctx, logger, inc, source, table, p, tables, objects, index)
		},
	)
	table.InsertPermissions = slices.DeleteFunc(
		slices.Clone(table.InsertPermissions), func(p metadata.InsertPermission) bool {
			return dropComputedPredicate(ctx, logger, inc, source, table, p.Role, "insert",
				p.Permission.Check, tables, objects, index)
		},
	)
	table.UpdatePermissions = slices.DeleteFunc(
		slices.Clone(table.UpdatePermissions), func(p metadata.UpdatePermission) bool {
			return dropComputedPredicate(ctx, logger, inc, source, table, p.Role, "update",
				p.Permission.Filter, tables, objects, index) ||
				dropComputedPredicate(ctx, logger, inc, source, table, p.Role, "update",
					p.Permission.Check, tables, objects, index)
		},
	)
	table.DeletePermissions = slices.DeleteFunc(
		slices.Clone(table.DeletePermissions), func(p metadata.DeletePermission) bool {
			return dropComputedPredicate(ctx, logger, inc, source, table, p.Role, "delete",
				p.Permission.Filter, tables, objects, index)
		},
	)
}

func invalidComputedSelect(ctx context.Context, logger *slog.Logger, inc *metadata.Inconsistencies,
	source string, table *metadata.TableMetadata, p metadata.SelectPermission,
	tables []metadata.TableMetadata, objects *introspection.Objects, index computedIndex,
) bool {
	if len(p.Permission.InvalidComputedFields) > 0 {
		return recordComputedPermission(ctx, logger, inc, source, table, p.Role, "select",
			p.Permission.InvalidComputedFields[0].DecodeError)
	}

	key := introspection.ComputedTable{Schema: table.Table.Schema, Name: table.Table.Name}
	for _, grant := range p.Permission.ComputedFields {
		kind, exists := index[key][grant]
		if !exists || kind == computedInvalid || kind == computedTable ||
			kind == computedDeferredTable {
			return recordComputedPermission(ctx, logger, inc, source, table, p.Role, "select",
				fmt.Sprintf("invalid scalar computed field grant %q", grant))
		}
	}

	return dropComputedPredicate(ctx, logger, inc, source, table, p.Role, "select",
		p.Permission.Filter, tables, objects, index)
}

func recordComputedPermission(
	ctx context.Context,
	logger *slog.Logger,
	inc *metadata.Inconsistencies,
	source string,
	table *metadata.TableMetadata,
	role, operation, reason string,
) bool {
	inc.RecordPermission(
		ctx,
		logger,
		operation,
		source,
		table.Table.Schema,
		table.Table.Name,
		role,
		reason,
	)

	return true
}

func dropComputedPredicate(ctx context.Context, logger *slog.Logger, inc *metadata.Inconsistencies,
	source string, table *metadata.TableMetadata, role, operation string, predicate map[string]any,
	tables []metadata.TableMetadata, objects *introspection.Objects, index computedIndex,
) bool {
	if dep := computedDependency(predicate, table, tables, objects, index); dep != "" {
		return recordComputedPermission(ctx, logger, inc, source, table, role, operation,
			fmt.Sprintf("computed predicate %q is not executable", dep))
	}

	return false
}

// computedDependency only classifies names identified by a definition or
// grant. All other unknown keys remain the existing permission parser's job.
func computedDependency(expr any, table *metadata.TableMetadata, tables []metadata.TableMetadata,
	objects *introspection.Objects, index computedIndex,
) string {
	obj, ok := expr.(map[string]any)
	if !ok || table == nil {
		return ""
	}

	for key, value := range obj {
		if dep := computedDependencyKey(key, value, table, tables, objects, index); dep != "" {
			return dep
		}
	}

	return ""
}

func computedDependencyKey(key string, value any, table *metadata.TableMetadata,
	tables []metadata.TableMetadata, objects *introspection.Objects, index computedIndex,
) string {
	switch key {
	case "_and", "_or":
		if list, ok := value.([]any); ok {
			for _, child := range list {
				if dep := computedDependency(child, table, tables, objects, index); dep != "" {
					return dep
				}
			}

			return ""
		}

		return computedDependency(value, table, tables, objects, index)
	case "_not":
		return computedDependency(value, table, tables, objects, index)
	case "_exists":
		return computedExistsDependency(value, table, tables, objects, index)
	default:
		identity := introspection.ComputedTable{Schema: table.Table.Schema, Name: table.Table.Name}
		// SQL columns (including customized names), local relationships and
		// their aggregate keys take precedence over rejected computed names.
		if computedKeyIsColumn(key, table, objects) {
			return ""
		}

		if next := computedRelationshipTable(table, key, tables, objects); next != nil {
			return computedDependency(value, next, tables, objects, index)
		}

		if before, ok := strings.CutSuffix(key, "_aggregate"); ok {
			// Object relationships have no aggregate key; their suffixed names
			// can instead identify computed fields on the current table.
			next := computedArrayRelationshipTable(table, before, tables, objects)
			if next != nil {
				return computedAggregateDependency(value, next, tables, objects, index)
			}
		}

		if _, found := index[identity][key]; found {
			return key
		}

		return ""
	}
}

func computedKeyIsColumn(
	key string,
	table *metadata.TableMetadata,
	objects *introspection.Objects,
) bool {
	for _, column := range objectsColumnNames(objects, table.Table) {
		if column == key || table.Configuration.ColumnConfig[column].CustomName == key {
			return true
		}
	}

	return false
}

func computedExistsDependency(value any, table *metadata.TableMetadata,
	tables []metadata.TableMetadata, objects *introspection.Objects, index computedIndex,
) string {
	exists, ok := value.(map[string]any)
	if !ok {
		return ""
	}

	target, ok := exists["_table"].(map[string]any)
	if !ok {
		return ""
	}

	schema, _ := target["schema"].(string)
	name, _ := target["name"].(string)

	if schema == "" {
		schema = table.Table.Schema
	}

	return computedDependency(
		exists["_where"],
		findComputedTable(tables, schema, name),
		tables,
		objects,
		index,
	)
}

func computedAggregateDependency(value any, target *metadata.TableMetadata,
	tables []metadata.TableMetadata, objects *introspection.Objects, index computedIndex,
) string {
	body, ok := value.(map[string]any)
	if !ok {
		return ""
	}

	for _, aggregate := range body {
		args, ok := aggregate.(map[string]any)
		if !ok {
			continue
		}

		identity := introspection.ComputedTable{
			Schema: target.Table.Schema,
			Name:   target.Table.Name,
		}
		if dep := computedAggregateArgument(
			args["arguments"],
			index[identity],
			target,
			objects,
		); dep != "" {
			return dep
		}

		if dep := computedDependency(args["filter"], target, tables, objects, index); dep != "" {
			return dep
		}
	}

	return ""
}

func computedAggregateArgument(value any, fields map[string]computedKind,
	table *metadata.TableMetadata, objects *introspection.Objects,
) string {
	switch typed := value.(type) {
	case string:
		if _, found := fields[typed]; found && !computedKeyIsColumn(typed, table, objects) {
			return typed
		}
	case []string:
		for _, field := range typed {
			if dep := computedAggregateArgument(field, fields, table, objects); dep != "" {
				return dep
			}
		}
	case []any:
		for _, field := range typed {
			if dep := computedAggregateArgument(field, fields, table, objects); dep != "" {
				return dep
			}
		}
	}

	return ""
}

func findComputedTable(
	tables []metadata.TableMetadata,
	schema, name string,
) *metadata.TableMetadata {
	for i := range tables {
		if tables[i].Table.Schema == schema && tables[i].Table.Name == name {
			return &tables[i]
		}
	}

	return nil
}

func computedRelationshipTable(
	table *metadata.TableMetadata,
	name string,
	tables []metadata.TableMetadata,
	objects *introspection.Objects,
) *metadata.TableMetadata {
	for _, rel := range table.ObjectRelationships {
		if rel.Name == name {
			return computedRelationshipTarget(table, rel.Using, tables, objects)
		}
	}

	return computedArrayRelationshipTable(table, name, tables, objects)
}

func computedArrayRelationshipTable(
	table *metadata.TableMetadata, name string, tables []metadata.TableMetadata,
	objects *introspection.Objects,
) *metadata.TableMetadata {
	for _, rel := range table.ArrayRelationships {
		if rel.Name == name {
			return computedRelationshipTarget(table, rel.Using, tables, objects)
		}
	}

	return nil
}

func computedRelationshipTarget(table *metadata.TableMetadata, using metadata.RelationshipUsing,
	tables []metadata.TableMetadata, objects *introspection.Objects,
) *metadata.TableMetadata {
	if target, source, ok := relationshipTarget(using); ok {
		if source != "" {
			return nil
		}

		return findComputedTable(tables, target.Schema, target.Name)
	}

	if using.ForeignKeyConstraint != nil {
		target := using.ForeignKeyConstraint.Table
		return findComputedTable(tables, target.Schema, target.Name)
	}

	if info, ok := objects.GetTable(
		table.Table.Schema,
		table.Table.Name,
	); ok &&
		len(using.ForeignKeyColumns) != 0 {
		schema, name := info.LookupForwardFKTarget(using.ForeignKeyColumns)
		return findComputedTable(tables, schema, name)
	}

	return nil
}

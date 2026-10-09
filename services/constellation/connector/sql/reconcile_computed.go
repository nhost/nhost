//nolint:revive,nolintlint // package name "sql" shadows database/sql; this package never imports it.
package sql

import (
	"context"
	"fmt"
	"log/slog"
	"slices"
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
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
		ambiguousSiblings := make(map[string]struct{})

		indexComputedGrants(t.SelectPermissions, index[key])

		counts := computedNameCounts(t.ComputedFields)

		fields := make([]metadata.ComputedField, 0, len(t.ComputedFields))
		for _, field := range t.ComputedFields {
			kind, reason := validateComputedField(original.Kind, t, field, objects, tracked)
			if computedAggregateSiblingConflict(t, field.Name) {
				ambiguousSiblings[field.Name] = struct{}{}
			}

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
			fields = append(fields, field)
		}

		t.ComputedFields = omitComputedOrderCollisions(
			ctx, logger, inc, original.Name, t, objects, index[key], fields,
		)
		omitAmbiguousComputedGrants(t, ambiguousSiblings)
	}

	for i := range effective.Tables {
		reconcileComputedPermissions(
			ctx,
			logger,
			inc,
			original.Name,
			&effective.Tables[i],
			effective.Tables,
			objects,
			index,
		)
	}
}

// The synthesized order key of an argument-free table field must not shadow
// an existing orderable field. Resolve scalar signatures before testing table
// fields so the result does not depend on computed_fields list order.
func omitComputedOrderCollisions(
	ctx context.Context, logger *slog.Logger, inc *metadata.Inconsistencies,
	source string, table *metadata.TableMetadata, objects *introspection.Objects,
	index map[string]computedKind, fields []metadata.ComputedField,
) []metadata.ComputedField {
	scalars := make(map[string]struct{})
	for _, field := range fields {
		if index[field.Name] != computedScalar {
			continue
		}

		lookup, _ := objects.GetComputedFunction(table.Table.Schema, table.Table.Name, field.Name)
		if lookup.Function != nil && !computedHasUserArguments(lookup.Function, field) {
			scalars[field.Name] = struct{}{}
		}
	}

	return slices.DeleteFunc(fields, func(field metadata.ComputedField) bool {
		if index[field.Name] != computedTable {
			return false
		}

		lookup, _ := objects.GetComputedFunction(table.Table.Schema, table.Table.Name, field.Name)
		if lookup.Function == nil {
			return false
		}

		if computedHasUserArguments(lookup.Function, field) {
			return false
		}

		sibling := field.Name + "_aggregate"
		if !computedOrderNameConflict(table, sibling, objects, scalars) {
			return false
		}

		inc.RecordComputedField(
			ctx,
			logger,
			source,
			table.Table.Schema,
			table.Table.Name,
			field.Name,
			fmt.Sprintf("computed aggregate order field %q conflicts with an order field", sibling),
		)
		index[field.Name] = computedInvalid

		return true
	})
}

func computedHasUserArguments(
	fn *introspection.ComputedFunction,
	field metadata.ComputedField,
) bool {
	for _, name := range fn.GraphQLArgumentNames(field.Definition.SessionArgument) {
		if name != "" {
			return true
		}
	}

	return false
}

func computedNameCounts(fields []metadata.ComputedField) map[string]int {
	counts := make(map[string]int, len(fields))
	for _, field := range fields {
		counts[field.Name]++
	}

	return counts
}

// A sibling collision has a valid relationship and a separately invalid
// computed selection. Remove only that selection's grant; retaining the
// invalid grant would revoke the role's otherwise valid select root.
func omitAmbiguousComputedGrants(table *metadata.TableMetadata, siblings map[string]struct{}) {
	for i := range table.SelectPermissions {
		permission := &table.SelectPermissions[i].Permission
		permission.ComputedFields = slices.DeleteFunc(
			slices.Clone(permission.ComputedFields),
			func(name string) bool {
				_, ambiguous := siblings[name]
				return ambiguous
			},
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

// Only the generated aggregate sibling of an array relationship has this
// exception. Exact relationship and column collisions keep their usual
// invalid-grant behavior.
func computedAggregateSiblingConflict(table *metadata.TableMetadata, name string) bool {
	for _, rel := range table.ArrayRelationships {
		if name == rel.Name+"_aggregate" {
			return true
		}
	}

	return false
}

// A relationship with this exact name contributes an order key only when it
// is an object relationship. An array relationship named X_aggregate instead
// contributes X_aggregate_aggregate; X matching an array aggregate sibling is
// already rejected by computedNameConflict.
func computedOrderNameConflict(
	table *metadata.TableMetadata, sibling string, objects *introspection.Objects,
	scalars map[string]struct{},
) bool {
	for _, col := range objectsColumnNames(objects, table.Table) {
		name := table.Configuration.ColumnConfig[col].CustomName
		if name == "" {
			name = col
		}

		if name == sibling {
			return true
		}
	}

	for _, rel := range table.ObjectRelationships {
		if rel.Name == sibling {
			return true
		}
	}

	for _, rel := range table.ArrayRelationships {
		if rel.Name+"_aggregate" == sibling {
			return true
		}
	}

	_, found := scalars[sibling]

	return found
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
		if _, ok := tracked[target]; !ok {
			return computedInvalid, "computed function must return a tracked table"
		}

		return computedTable, ""
	}

	if fn.ReturnType.Kind != "b" || fn.ReturnType.IsArray {
		return computedInvalid, "computed scalar return type is not a BASE type"
	}

	// Only independently classified scalar SETOF types are executable. Catalog
	// BASE also includes unrelated extension, vector and spatial types.
	if fn.ReturnSet && !supportedComputedScalarSetof(fn.ReturnType.Schema, fn.ReturnType.Name) {
		return computedInvalid, "unsupported SETOF scalar return type"
	}

	return computedScalar, ""
}

func supportedComputedScalarSetof(schema, name string) bool {
	if schema == "public" && name == "citext" {
		return true
	}

	if schema != "pg_catalog" {
		return false
	}

	switch name {
	case "text", "numeric", "int4", "float8", "bool", "date", "uuid", "jsonb":
		return true
	default:
		return false
	}
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

	// A duplicate or reserved input field makes validation drop the whole role,
	// rather than just this computed selection. Check only the exposed slots.
	seen := make(map[string]struct{})
	for _, name := range fn.GraphQLArgumentNames(field.Definition.SessionArgument) {
		if name == "" {
			continue
		}

		if !validComputedName(name) {
			return "computed function argument name is not a GraphQL identifier"
		}

		if strings.HasPrefix(name, "__") {
			return "computed function argument name is reserved"
		}

		if _, duplicate := seen[name]; duplicate {
			return "duplicate computed function argument name"
		}

		seen[name] = struct{}{}
	}

	return ""
}

func computedScalarArgumentKind(kind string) bool {
	switch kind {
	case "b", "c", "d", "e", "r", "m":
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
		if !exists || kind != computedScalar {
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
	if dep := computedDependency(
		predicate,
		table,
		table,
		tables,
		objects,
		index,
		false,
	); dep != "" {
		return recordComputedPermission(ctx, logger, inc, source, table, role, operation,
			fmt.Sprintf("permission predicate %q is not executable", dep))
	}

	return false
}

// computedDependency classifies fields identified by a definition or grant,
// plus malformed/missing targets of the known _exists operator. Other unknown
// filter keys remain the existing permission parser's job.
func computedDependency(
	expr any,
	table, root *metadata.TableMetadata,
	tables []metadata.TableMetadata,
	objects *introspection.Objects,
	index computedIndex,
	insideAggregate bool,
) string {
	obj, ok := expr.(map[string]any)
	if !ok || table == nil {
		return ""
	}

	for key, value := range obj {
		if dep := computedDependencyKey(
			key,
			value,
			table,
			root,
			tables,
			objects,
			index,
			insideAggregate,
		); dep != "" {
			return dep
		}
	}

	return ""
}

func computedDependencyKey(key string, value any, table, root *metadata.TableMetadata,
	tables []metadata.TableMetadata, objects *introspection.Objects, index computedIndex,
	insideAggregate bool,
) string {
	switch key {
	case "_and", "_or", "$and", "$or":
		if list, ok := value.([]any); ok {
			for _, child := range list {
				if dep := computedDependency(
					child,
					table,
					root,
					tables,
					objects,
					index,
					insideAggregate,
				); dep != "" {
					return dep
				}
			}

			return ""
		}

		return computedDependency(value, table, root, tables, objects, index, insideAggregate)
	case "_not", "$not":
		return computedDependency(value, table, root, tables, objects, index, insideAggregate)
	case "_exists", "$exists":
		return computedExistsDependency(value, table, root, tables, objects, index, insideAggregate)
	default:
		identity := introspection.ComputedTable{Schema: table.Table.Schema, Name: table.Table.Name}
		// SQL columns (including customized names), local relationships and
		// their aggregate keys take precedence over rejected computed names.
		if computedKeyIsColumn(key, table, objects) {
			return ""
		}

		if next := computedRelationshipTable(table, key, tables, objects); next != nil {
			return computedDependency(value, next, root, tables, objects, index, insideAggregate)
		}

		if before, ok := strings.CutSuffix(key, "_aggregate"); ok {
			// Retain computed-free aggregate handling; only identifiable invalid
			// computed arguments/filters revoke this permission.
			if next := computedArrayRelationshipTable(table, before, tables, objects); next != nil {
				return computedAggregateDependency(value, next, root, tables, objects, index)
			}
		}

		if kind, found := index[identity][key]; found {
			if !insideAggregate && executableComputedPredicate(
				kind, table, root, key, value, tables, objects, index,
			) {
				return ""
			}

			return key
		}

		return ""
	}
}

func executableComputedPredicate(
	kind computedKind,
	table, root *metadata.TableMetadata,
	name string,
	value any,
	tables []metadata.TableMetadata, objects *introspection.Objects, index computedIndex,
) bool {
	if !computedPermissionInput(table, name, objects) {
		return false
	}

	lookup, ok := objects.GetComputedFunction(table.Table.Schema, table.Table.Name, name)
	if !ok || lookup.Function == nil {
		return false
	}

	if kind == computedScalar {
		return computedPermissionOperators(
			lookup.Function.ReturnType.Name,
			value,
			table,
			root,
			objects,
		)
	}

	if kind != computedTable {
		return false
	}

	target := findComputedTable(tables,
		lookup.Function.ReturnType.Schema, lookup.Function.ReturnType.Name)
	if target == nil {
		return false
	}

	if _, ok := value.(map[string]any); !ok {
		return false
	}

	return computedTablePredicateKnown(value, target, root, tables, objects, index)
}

// A recognized table function scopes its nested predicate. Unlike an ordinary
// unknown root permission key, an unknown key inside that function is
// identifiable as part of the table predicate and revokes only its permission.
//
//nolint:gocognit,cyclop // Nested boolean, _exists and target-field branches fail closed per permission.
func computedTablePredicateKnown(value any, table, root *metadata.TableMetadata,
	tables []metadata.TableMetadata, objects *introspection.Objects, index computedIndex,
) bool {
	fields, ok := value.(map[string]any)
	if !ok || table == nil {
		return false
	}

	for key, child := range fields {
		switch key {
		case "_and", "_or", "$and", "$or":
			list, ok := child.([]any)
			if !ok {
				return false
			}

			for _, item := range list {
				if !computedTablePredicateKnown(item, table, root, tables, objects, index) {
					return false
				}
			}
		case "_not", "$not":
			if !computedTablePredicateKnown(child, table, root, tables, objects, index) {
				return false
			}
		case "_exists", "$exists":
			exists, ok := child.(map[string]any)
			if !ok {
				return false
			}

			schema, name, ok := computedExistsTable(exists["_table"])
			if !ok {
				return false
			}

			if !computedTablePredicateKnown(exists["_where"],
				findComputedTable(tables, schema, name), root, tables, objects, index) {
				return false
			}
		default:
			if !computedTablePredicateFieldKnown(key, child, table, root, tables, objects, index) {
				return false
			}
		}
	}

	return true
}

func computedTablePredicateFieldKnown(key string, value any, table, root *metadata.TableMetadata,
	tables []metadata.TableMetadata, objects *introspection.Objects, index computedIndex,
) bool {
	// Metadata permission predicates use physical SQL column names, even when
	// the target table exposes a different GraphQL name for that column.
	if info, ok := objects.GetTable(table.Table.Schema, table.Table.Name); ok {
		for _, column := range info.Columns {
			if column.Name == key {
				return where.SupportedComputedTableColumnComparison(
					column.Type, column.IsArray, value,
					computedPermissionColumnResolver(table, root, objects),
				)
			}
		}
	}

	if next := computedRelationshipTable(table, key, tables, objects); next != nil {
		return computedTablePredicateKnown(value, next, root, tables, objects, index)
	}

	if before, ok := strings.CutSuffix(key, "_aggregate"); ok {
		if computedArrayRelationshipTable(table, before, tables, objects) != nil {
			// Relationship-aggregate permission predicates are rejected by Hasura;
			// this key is inside a known table computation, so revoke its permission.
			return false
		}
	}

	identity := introspection.ComputedTable{Schema: table.Table.Schema, Name: table.Table.Name}
	kind, found := index[identity][key]

	return found &&
		executableComputedPredicate(kind, table, root, key, value, tables, objects, index)
}

// A permission predicate uses the same argument-free scalar expression as
// user bool_exp. A valid selection with required/optional user arguments is
// not a valid permission input; its permission must remain unavailable.
func computedPermissionInput(
	table *metadata.TableMetadata,
	name string,
	objects *introspection.Objects,
) bool {
	lookup, ok := objects.GetComputedFunction(table.Table.Schema, table.Table.Name, name)
	if !ok || lookup.Function == nil {
		return false
	}

	for _, field := range table.ComputedFields {
		if field.Name != name {
			continue
		}

		for _, arg := range lookup.Function.GraphQLArgumentNames(field.Definition.SessionArgument) {
			if arg != "" {
				return false
			}
		}

		return true
	}

	return false
}

func computedPermissionOperators(sqlType string, value any, table, root *metadata.TableMetadata,
	objects *introspection.Objects,
) bool {
	comparison, ok := value.(map[string]any)
	if !ok {
		comparison = map[string]any{"_eq": value}
	}

	return where.SupportedComputedPermissionComparison(sqlType, comparison,
		computedPermissionColumnResolver(table, root, objects))
}

func computedPermissionColumnResolver(table, root *metadata.TableMetadata,
	objects *introspection.Objects,
) func(string, bool) (string, bool, bool) {
	return func(name string, atRoot bool) (string, bool, bool) {
		lookupTable := table
		if atRoot {
			lookupTable = root
		}

		if lookupTable == nil {
			return "", false, false
		}

		info, found := objects.GetTable(lookupTable.Table.Schema, lookupTable.Table.Name)
		if !found {
			return "", false, false
		}

		for _, col := range info.Columns {
			if col.Name == name {
				return col.Type, col.IsArray, true
			}
		}

		return "", false, false
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

// computedExistsTable follows Hasura's QualifiedTable default: an omitted or
// null schema (or a bare table name) means public, never the containing table's
// schema. Explicit schema, including SQLite's empty schema, retains precedence.
func computedExistsTable(value any) (string, string, bool) {
	switch ref := value.(type) {
	case string:
		return "public", ref, ref != ""
	case map[string]any:
		schema := "public"
		if raw, exists := ref["schema"]; exists && raw != nil {
			var ok bool

			schema, ok = raw.(string)
			if !ok {
				return "", "", false
			}
		}

		name, ok := ref["name"].(string)

		return schema, name, ok && name != ""
	default:
		return "", "", false
	}
}

func computedExistsDependency(value any, _, root *metadata.TableMetadata,
	tables []metadata.TableMetadata, objects *introspection.Objects, index computedIndex,
	insideAggregate bool,
) string {
	exists, ok := value.(map[string]any)
	if !ok {
		return "_exists"
	}

	schema, name, ok := computedExistsTable(exists["_table"])
	if !ok {
		return "_exists"
	}

	target := findComputedTable(tables, schema, name)
	if target == nil {
		return "_exists"
	}

	if _, ok := exists["_where"].(map[string]any); !ok {
		return "_exists"
	}

	return computedDependency(
		exists["_where"],
		target,
		root, tables,
		objects,
		index,
		insideAggregate,
	)
}

func computedAggregateDependency(value any, target, root *metadata.TableMetadata,
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

		// Hasura rejects relationship-aggregate permission filters. Continue
		// revoking only identifiable computed references in this shape; leave
		// ordinary aggregate permission parsing unchanged.
		if dep := computedDependency(
			args["filter"],
			target,
			root,
			tables,
			objects,
			index,
			true,
		); dep != "" {
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

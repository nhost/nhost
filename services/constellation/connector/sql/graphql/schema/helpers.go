package schema

import (
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// getSelectPermission returns the select permission for a role, or nil if not found.
func getSelectPermission(
	tableMeta *metadata.TableMetadata,
	role string,
) *metadata.SelectPermission {
	for i := range tableMeta.SelectPermissions {
		if tableMeta.SelectPermissions[i].Role == role {
			return &tableMeta.SelectPermissions[i]
		}
	}

	return nil
}

// getInsertPermission returns the insert permission for a role, or nil if not found.
func getInsertPermission(
	tableMeta *metadata.TableMetadata,
	role string,
) *metadata.InsertPermission {
	for i := range tableMeta.InsertPermissions {
		if tableMeta.InsertPermissions[i].Role == role {
			return &tableMeta.InsertPermissions[i]
		}
	}

	return nil
}

// getUpdatePermission returns the update permission for a role, or nil if not found.
func getUpdatePermission(
	tableMeta *metadata.TableMetadata,
	role string,
) *metadata.UpdatePermission {
	for i := range tableMeta.UpdatePermissions {
		if tableMeta.UpdatePermissions[i].Role == role {
			return &tableMeta.UpdatePermissions[i]
		}
	}

	return nil
}

// getDeletePermission returns the delete permission for a role, or nil if not found.
func getDeletePermission(
	tableMeta *metadata.TableMetadata,
	role string,
) *metadata.DeletePermission {
	for i := range tableMeta.DeletePermissions {
		if tableMeta.DeletePermissions[i].Role == role {
			return &tableMeta.DeletePermissions[i]
		}
	}

	return nil
}

// getQualifiedName returns the qualified table name for descriptions.
// Omits schema name for "public" schema tables and for unschemaed tables
// (SQLite, whose introspector reports every table under schema "").
func getQualifiedName(schema, table string) string {
	if schema == "public" || schema == "" {
		return table
	}

	return schema + "." + table
}

// getDefaultTypeName returns the default GraphQL type name for a table.
// For public schema tables (and unschemaed SQLite tables), returns just the
// table name. For non-public schemas, returns schema_table to match Hasura's
// behavior.
func getDefaultTypeName(schema, table string) string {
	if schema == "public" || schema == "" {
		return table
	}

	return schema + "_" + table
}

// getCustomOrDefaultTypeName returns the custom name if set, otherwise the default type name.
func getCustomOrDefaultTypeName(tableMeta *metadata.TableMetadata) string {
	if tableMeta.Configuration.CustomName != "" {
		return tableMeta.Configuration.CustomName
	}

	return getDefaultTypeName(tableMeta.Table.Schema, tableMeta.Table.Name)
}

// getColumnDescription returns the column comment as a description string, or empty if none.
func getColumnDescription(col *introspection.Column) string {
	if col.Comment != nil {
		return *col.Comment
	}

	return ""
}

// getCustomColumnName returns the custom column name if configured, or realName otherwise.
func getCustomColumnName(tableMeta *metadata.TableMetadata, realName string) string {
	if colConfig, ok := tableMeta.Configuration.ColumnConfig[realName]; ok &&
		colConfig.CustomName != "" {
		return colConfig.CustomName
	}

	return realName
}

// getAllowedColumns returns a map of allowed column names for the given role.
// For admin role, all columns are allowed.
func getAllowedColumns(
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	role string,
) map[string]struct{} {
	if role == roleAdmin {
		allowed := make(map[string]struct{})
		for _, col := range tableInfo.Columns {
			allowed[col.Name] = struct{}{}
		}

		return allowed
	}

	perm := getSelectPermission(tableMeta, role)
	if perm == nil {
		return make(map[string]struct{})
	}

	allowed := make(map[string]struct{})
	for _, col := range perm.Permission.Columns {
		allowed[col] = struct{}{}
	}

	return allowed
}

// getUpdateAllowedColumns returns the set of columns allowed for UPDATE operations for the given role.
func getUpdateAllowedColumns(
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	role string,
) map[string]struct{} {
	if role == roleAdmin {
		allowed := make(map[string]struct{})
		for _, col := range tableInfo.Columns {
			if col.IsGenerated {
				continue // Skip generated columns as they can't be updated
			}

			allowed[col.Name] = struct{}{}
		}

		return allowed
	}

	perm := getUpdatePermission(tableMeta, role)
	if perm == nil {
		return make(map[string]struct{})
	}

	allowed := make(map[string]struct{})
	for _, col := range perm.Permission.Columns {
		if _, ok := perm.Permission.Set[col]; ok {
			continue // Skip columns set by presets
		}

		if isGeneratedColumn(tableInfo, col) {
			continue // Skip generated columns as they can't be updated
		}

		allowed[col] = struct{}{}
	}

	return allowed
}

// getInsertAllowedColumns returns the set of columns allowed for INSERT operations for the given role.
func getInsertAllowedColumns(
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	role string,
) map[string]struct{} {
	if role == roleAdmin {
		allowed := make(map[string]struct{})
		for _, col := range tableInfo.Columns {
			if col.IsGenerated {
				continue // Skip generated columns as they can't be inserted
			}

			allowed[col.Name] = struct{}{}
		}

		return allowed
	}

	perm := getInsertPermission(tableMeta, role)
	if perm == nil {
		return make(map[string]struct{})
	}

	allowed := make(map[string]struct{})
	for _, col := range perm.Permission.Columns {
		if _, ok := perm.Permission.Set[col]; ok {
			continue // Skip columns set by default values
		}

		if isGeneratedColumn(tableInfo, col) {
			continue // Skip generated columns as they can't be inserted
		}

		allowed[col] = struct{}{}
	}

	return allowed
}

// allPKColumnsAllowed returns true if all primary key columns are in the allowed set.
// Hasura only generates by-PK queries/subscriptions when the role can select all PK columns.
func allPKColumnsAllowed(
	primaryKeys []string,
	allowedColumns map[string]struct{},
) bool {
	for _, pk := range primaryKeys {
		if _, ok := allowedColumns[pk]; !ok {
			return false
		}
	}

	return true
}

// allowAggregations returns true if aggregations are allowed for the given role.
func allowAggregations(tableMeta *metadata.TableMetadata, role string) bool {
	if role == roleAdmin {
		return true
	}

	perm := getSelectPermission(tableMeta, role)
	if perm == nil {
		return false
	}

	return perm.Permission.AllowAggregations
}

// postgresTypeToGraphQL maps PostgreSQL types to GraphQL types.
// Only maps to built-in GraphQL types when there's a clear equivalent.
// Everything else becomes a custom scalar with its own type name.
func postgresTypeToGraphQL(pgType string, isNullable bool) *graph.Type {
	typeName := normalizePostgresTypeToGraphQL(pgType)

	if isNullable {
		return graph.NewNamedType(typeName)
	}

	return graph.NewNonNullType(typeName)
}

// getGraphQLScalarType returns the GraphQL scalar type name for a PostgreSQL type.
func getGraphQLScalarType(pgType string) string {
	return normalizePostgresTypeToGraphQL(pgType)
}

// normalizePostgresTypeToGraphQL converts a PostgreSQL type to a valid GraphQL type name.
func normalizePostgresTypeToGraphQL(pgType string) string {
	// Only map to built-in GraphQL types
	//nolint:goconst,nolintlint
	switch pgType {
	case "integer", "int", "int4":
		return "Int"
	case "int2", "smallint":
		return "smallint"
	case "int8":
		return "bigint"
	case "boolean", "bool":
		return "Boolean"
	case "text", "varchar", "character varying", "char", "character", "name":
		return "String"
	default:
		// Everything else uses its own type name
		return pgType
	}
}

// targetIsInsertable reports whether the relationship target's underlying
// relation accepts inserts according to the introspected IsInsertable flag.
// Returns true when objects is nil or the target is missing from
// introspection — callers treat a missing flag as "no veto" so non-view
// targets keep their existing behaviour. This is the gate that keeps
// _obj_rel_insert_input / _arr_rel_insert_input references in a parent's
// _insert_input from dangling against a read-only view target.
func targetIsInsertable(
	objects *introspection.Objects,
	targetMeta *metadata.TableMetadata,
) bool {
	if objects == nil || targetMeta == nil {
		return true
	}

	targetInfo, ok := objects.GetTable(targetMeta.Table.Schema, targetMeta.Table.Name)
	if !ok {
		return true
	}

	return targetInfo.IsInsertable
}

func getRelationshipTarget(
	tableInfo *introspection.Table,
	tables []metadata.TableMetadata,
	using metadata.RelationshipUsing,
) *metadata.TableMetadata {
	targetSchema, targetTable := getRelationshipTargetSchemaAndTable(tableInfo, using)

	if targetTable != "" {
		for i := range tables {
			if tables[i].Table.Schema == targetSchema && tables[i].Table.Name == targetTable {
				return &tables[i]
			}
		}
	}

	return nil
}

// getRelationshipTargetSchemaAndTable resolves the schema-qualified target
// table referenced by a relationship's Using clause. For the forward-FK
// shortcut (ForeignKeyColumns) the target is read off the first matching
// introspection FK; all listed columns must agree on the same target schema
// and name, otherwise the function returns empty strings so the caller drops
// the relationship as misconfigured.
func getRelationshipTargetSchemaAndTable(
	tableInfo *introspection.Table,
	using metadata.RelationshipUsing,
) (string, string) {
	switch {
	case using.ForeignKeyConstraint != nil:
		return using.ForeignKeyConstraint.Table.Schema,
			using.ForeignKeyConstraint.Table.Name
	case using.ManualConfiguration != nil:
		return using.ManualConfiguration.RemoteTable.Schema,
			using.ManualConfiguration.RemoteTable.Name
	case len(using.ForeignKeyColumns) > 0:
		return tableInfo.LookupForwardFKTarget(using.ForeignKeyColumns)
	}

	return "", ""
}

// isRemoteRelationship checks if a relationship crosses connector boundaries.
// This includes db→db (different source) and db→rs (remote schema) relationships.
func isRemoteRelationship(using metadata.RelationshipUsing) bool {
	if using.ManualConfiguration == nil {
		return false
	}

	return using.ManualConfiguration.Source != "" || using.ManualConfiguration.RemoteSchema != ""
}

// getRelationshipTargetName returns the custom name of the target table for a local relationship.
// Returns empty string for remote relationships (handled centrally by the controller).
func getRelationshipTargetName(
	md *metadata.DatabaseMetadata,
	tableInfo *introspection.Table,
	using metadata.RelationshipUsing,
) string {
	if isRemoteRelationship(using) {
		return ""
	}

	targetSchema, targetTable := getRelationshipTargetSchemaAndTable(tableInfo, using)
	if targetTable == "" {
		return ""
	}

	for i := range md.Tables {
		if md.Tables[i].Table.Schema == targetSchema && md.Tables[i].Table.Name == targetTable {
			return getCustomOrDefaultTypeName(&md.Tables[i])
		}
	}

	return ""
}

// isTargetTableAccessible checks if the target table of a local relationship
// is accessible for the role.
func isTargetTableAccessible(
	md *metadata.DatabaseMetadata,
	tableInfo *introspection.Table,
	using metadata.RelationshipUsing,
	role string,
) bool {
	if role == roleAdmin {
		return true
	}

	targetSchema, targetTable := getRelationshipTargetSchemaAndTable(tableInfo, using)
	if targetTable == "" {
		return false
	}

	for i := range md.Tables {
		if md.Tables[i].Table.Schema == targetSchema && md.Tables[i].Table.Name == targetTable {
			return getSelectPermission(&md.Tables[i], role) != nil
		}
	}

	return false
}

// isTargetTableAggregationAllowed checks if aggregations are allowed for the
// target table of a local relationship.
func isTargetTableAggregationAllowed(
	md *metadata.DatabaseMetadata,
	tableInfo *introspection.Table,
	using metadata.RelationshipUsing,
	role string,
) bool {
	targetSchema, targetTable := getRelationshipTargetSchemaAndTable(tableInfo, using)
	if targetTable == "" {
		return false
	}

	for i := range md.Tables {
		if md.Tables[i].Table.Schema == targetSchema && md.Tables[i].Table.Name == targetTable {
			return allowAggregations(&md.Tables[i], role)
		}
	}

	return false
}

// getColumnGraphQLType returns the GraphQL type for a column.
// If the column references an enum table via foreign key, it returns the enum type.
// Otherwise, it returns the standard PostgreSQL type mapping.
func getColumnGraphQLType(
	col *introspection.Column,
	tableInfo *introspection.Table,
	md *metadata.DatabaseMetadata,
) *graph.Type {
	return columnGraphQLType(col, tableInfo, md, col.IsNullable)
}

// getColumnGraphQLTypePKArg returns the GraphQL type for a PK-arg column,
// always wrapped in NonNull. SQLite does not imply NOT NULL from a bare
// `PRIMARY KEY` declaration, so introspected PK columns can carry
// IsNullable=true even though Hasura's contract requires `T!` on every
// `_by_pk` arg and `_pk_columns_input` field.
func getColumnGraphQLTypePKArg(
	col *introspection.Column,
	tableInfo *introspection.Table,
	md *metadata.DatabaseMetadata,
) *graph.Type {
	return columnGraphQLType(col, tableInfo, md, false)
}

func columnGraphQLType(
	col *introspection.Column,
	tableInfo *introspection.Table,
	md *metadata.DatabaseMetadata,
	nullable bool,
) *graph.Type {
	// Check if this column has a foreign key to an enum table
	for _, fk := range tableInfo.ForeignKeys {
		if fk.ColumnName == col.Name { //nolint:nestif
			// Find the target table in metadata
			for i := range md.Tables {
				targetTable := &md.Tables[i]
				if targetTable.Table.Schema == fk.ForeignSchema &&
					targetTable.Table.Name == fk.ForeignTable {
					// Check if target is an enum table
					if targetTable.IsEnum {
						// Get custom table name
						customTableName := getCustomOrDefaultTypeName(targetTable)

						// Return enum type
						if nullable {
							return graph.NewNamedType(customTableName + "_enum")
						}

						return graph.NewNonNullType(customTableName + "_enum")
					}
				}
			}
		}
	}

	// Handle array columns as GraphQL list types
	if col.IsArray {
		elemType := normalizePostgresTypeToGraphQL(col.Type)
		// Hasura convention: [ElemType!] for nullable, [ElemType!]! for non-null
		if nullable {
			return graph.NewListType(graph.NewNonNullType(elemType))
		}

		return graph.NewNonNullListType(graph.NewNonNullType(elemType))
	}

	// Fall back to standard type mapping
	return postgresTypeToGraphQL(col.Type, nullable)
}

// hasJSONBColumns returns true if the table has any JSONB columns in allowedColumns.
func hasJSONBColumns(
	tableInfo *introspection.Table,
	allowedColumns map[string]struct{},
) bool {
	for _, col := range tableInfo.Columns {
		if _, ok := allowedColumns[col.Name]; !ok {
			continue
		}

		if col.Type == "jsonb" { //nolint:goconst,nolintlint
			return true
		}
	}

	return false
}

// isGeneratedColumn returns true if the column is a generated column.
func isGeneratedColumn(tableInfo *introspection.Table, columnName string) bool {
	for _, col := range tableInfo.Columns {
		if col.Name == columnName {
			return col.IsGenerated
		}
	}

	return false
}

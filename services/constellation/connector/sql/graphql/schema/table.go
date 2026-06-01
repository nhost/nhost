package schema

import (
	"fmt"

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// generateForTable generates all GraphQL schema elements for a single table.
func generateForTable( //nolint:funlen,cyclop
	schema *graph.Schema,
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	role string,
	objects *introspection.Objects,
	md *metadata.DatabaseMetadata,
	queryFields *[]*graph.Field,
	mutationFields *[]*graph.Field,
	subscriptionFields *[]*graph.Field,
	usedScalars map[string]struct{},
	selectUsedScalars map[string]struct{},
	selectUsedArrayElementTypes map[string]struct{},
	neededEnums map[string]struct{},
	generatedAggregateOrderBy map[string]struct{},
	generatedAggregateBoolExp map[string]struct{},
	tablesWithObjRelInsert map[string]struct{},
	tablesWithArrRelInsert map[string]struct{},
	caps Capabilities,
) {
	customTableName := getCustomOrDefaultTypeName(tableMeta)
	qualifiedName := getQualifiedName(tableMeta.Table.Schema, tableMeta.Table.Name)
	allowedColumns := getAllowedColumns(tableMeta, tableInfo, role)

	for _, col := range tableInfo.Columns {
		if _, ok := allowedColumns[col.Name]; ok {
			scalarType := getGraphQLScalarType(col.Type)
			usedScalars[scalarType] = struct{}{}
			selectUsedScalars[scalarType] = struct{}{}

			if col.IsArray && caps.SupportsArrays {
				selectUsedArrayElementTypes[scalarType] = struct{}{}
			}

			if is, enumKey := isEnumColumn(&col, tableInfo, md); is {
				neededEnums[enumKey] = struct{}{}
			}
		}
	}

	// Also collect scalars from insert/update-allowed columns.
	// These may not overlap with select-allowed columns, but their types
	// are referenced in mutation input types (_insert_input, _set_input, etc.)
	if role == roleAdmin ||
		getInsertPermission(tableMeta, role) != nil ||
		getUpdatePermission(tableMeta, role) != nil ||
		getDeletePermission(tableMeta, role) != nil {
		insertCols := getInsertAllowedColumns(tableMeta, tableInfo, role)
		updateCols := getUpdateAllowedColumns(tableMeta, tableInfo, role)

		for _, col := range tableInfo.Columns {
			if _, ok := allowedColumns[col.Name]; ok {
				continue // already tracked above
			}

			_, inInsert := insertCols[col.Name]
			_, inUpdate := updateCols[col.Name]

			if inInsert || inUpdate {
				scalarType := getGraphQLScalarType(col.Type)
				usedScalars[scalarType] = struct{}{}
			}
		}
	}

	generateTableObjectType(
		schema, tableMeta, tableInfo, customTableName, allowedColumns, role, md,
		objects, generatedAggregateOrderBy, caps,
	)

	generateTableQueryFields(
		queryFields,
		tableMeta,
		tableInfo,
		customTableName,
		qualifiedName,
		allowedColumns,
		role,
		md,
		caps,
	)

	generateTableMutationFields(
		mutationFields, tableMeta, tableInfo, customTableName, qualifiedName, role, md,
	)

	generateTableSubscriptionFields(
		subscriptionFields,
		tableMeta,
		tableInfo,
		customTableName,
		qualifiedName,
		allowedColumns,
		role,
		md,
		caps,
	)

	if allowAggregations(tableMeta, role) {
		generateAggregateTypes(
			schema, tableMeta, tableInfo, customTableName, qualifiedName, allowedColumns, md, caps,
		)
	}

	generateTableInputTypes(
		schema, tableMeta,
		tableInfo,
		customTableName,
		qualifiedName,
		allowedColumns,
		role,
		md,
		objects,
		generatedAggregateBoolExp,
		selectUsedScalars,
		caps,
	)

	if (tableInfo.IsInsertable || tableInfo.IsUpdatable) &&
		(role == roleAdmin ||
			getInsertPermission(tableMeta, role) != nil ||
			getUpdatePermission(tableMeta, role) != nil ||
			getDeletePermission(tableMeta, role) != nil) {
		generateTableMutationInputTypes(
			schema, tableMeta, tableInfo, customTableName, qualifiedName, md, objects, role,
			tablesWithObjRelInsert, tablesWithArrRelInsert,
		)
	}

	generateTableSelectColumnEnum(
		schema,
		tableMeta,
		tableInfo,
		customTableName,
		qualifiedName,
		allowedColumns,
	)
}

// addGlobalEnums adds enums that are used globally across all tables.
func addGlobalEnums(schema *graph.Schema) {
	// order_by enum (used by all tables for sorting)
	schema.Enums = append(schema.Enums, &graph.EnumType{ //nolint:exhaustruct
		Name:        "order_by",
		Description: "column ordering options",
		Values: []*graph.EnumValue{
			{Name: "asc", Description: "in ascending order, nulls last"},
			{Name: "asc_nulls_first", Description: "in ascending order, nulls first"},
			{Name: "asc_nulls_last", Description: "in ascending order, nulls last"},
			{Name: "desc", Description: "in descending order, nulls first"},
			{Name: "desc_nulls_first", Description: "in descending order, nulls first"},
			{Name: "desc_nulls_last", Description: "in descending order, nulls last"},
		},
	})

	// cursor_ordering enum (used by streaming subscriptions)
	schema.Enums = append(schema.Enums, &graph.EnumType{ //nolint:exhaustruct
		Name:        "cursor_ordering",
		Description: "ordering argument of a cursor",
		Values: []*graph.EnumValue{
			{Name: "ASC", Description: "ascending ordering of the cursor"},
			{Name: "DESC", Description: "descending ordering of the cursor"},
		},
	})
}

// generateObjectRelationshipFields generates fields for object relationships (many-to-one, one-to-one).
func generateObjectRelationshipFields(
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	role string,
	md *metadata.DatabaseMetadata,
) []*graph.Field {
	fields := []*graph.Field{}

	for _, rel := range tableMeta.ObjectRelationships {
		targetCustomName := getRelationshipTargetName(md, tableInfo, rel.Using)
		if targetCustomName == "" {
			continue
		}

		if !isTargetTableAccessible(md, tableInfo, rel.Using, role) {
			continue
		}

		relType := graph.NewNonNullType(targetCustomName)
		if isObjectRelationshipNullable(tableInfo, rel.Using) {
			relType = graph.NewNamedType(targetCustomName)
		}

		fields = append(fields, &graph.Field{ //nolint:exhaustruct
			Name:        rel.Name,
			Description: "An object relationship",
			Type:        relType,
		})
	}

	return fields
}

// isObjectRelationshipNullable determines whether an object relationship field should be nullable
// in the GraphQL schema. A relationship is nullable when the related row may not exist:
//   - Reverse FK relationships (the remote table points back to this one) are always nullable.
//   - Forward FK relationships are nullable when ANY of the FK columns allows NULL values
//     (a composite FK with even one nullable column may evaluate to NULL on the join).
//   - Manual configurations and unresolvable cases default to nullable.
func isObjectRelationshipNullable(
	tableInfo *introspection.Table,
	using metadata.RelationshipUsing,
) bool {
	if using.ForeignKeyConstraint != nil && using.ForeignKeyConstraint.Table.Name != "" {
		return true
	}

	if len(using.ForeignKeyColumns) == 0 {
		return true
	}

	for _, fkName := range using.ForeignKeyColumns {
		found := false

		for _, col := range tableInfo.Columns {
			if col.Name != fkName {
				continue
			}

			found = true

			if col.IsNullable {
				return true
			}

			break
		}

		// Column not present in introspection — treat as unresolvable and
		// fall back to the nullable default rather than emitting a
		// non-nullable field that may break at runtime.
		if !found {
			return true
		}
	}

	return false
}

// generateArrayRelationshipFields generates fields for array relationships (one-to-many).
func generateArrayRelationshipFields(
	schema *graph.Schema,
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	role string,
	md *metadata.DatabaseMetadata,
	objects *introspection.Objects,
	generatedAggregateOrderBy map[string]struct{},
	caps Capabilities,
) []*graph.Field {
	fields := []*graph.Field{}

	for _, rel := range tableMeta.ArrayRelationships {
		targetCustomName := getRelationshipTargetName(md, tableInfo, rel.Using)
		if targetCustomName == "" {
			continue
		}

		if !isTargetTableAccessible(md, tableInfo, rel.Using, role) {
			continue
		}

		targetSchema, targetTable := getRelationshipTargetSchemaAndTable(tableInfo, rel.Using)

		// order_by on an array relationship references the target table's
		// aggregate_order_by type, so eagerly emit it before consuming the
		// type name below.
		if targetTable != "" {
			maybeGenerateAggregateOrderByForTargetTable(
				schema, md, objects, targetSchema, targetTable, role,
				generatedAggregateOrderBy, caps,
			)
		}

		fields = append(fields, &graph.Field{ //nolint:exhaustruct
			Name:        rel.Name,
			Description: "An array relationship",
			Type:        graph.NewNonNullListType(graph.NewNonNullType(targetCustomName)),
			Arguments:   collectionArguments(targetCustomName, caps),
		})

		if isTargetTableAggregationAllowed(md, tableInfo, rel.Using, role) {
			fields = append(fields, &graph.Field{ //nolint:exhaustruct
				Name:        rel.Name + "_aggregate",
				Description: "An aggregate relationship",
				Type:        graph.NewNonNullType(targetCustomName + "_aggregate"),
				Arguments:   collectionArguments(targetCustomName, caps),
			})
		}
	}

	return fields
}

// generateTableObjectType generates the GraphQL object type for a table.
func generateTableObjectType(
	schema *graph.Schema,
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	customTableName string,
	allowedColumns map[string]struct{},
	role string,
	md *metadata.DatabaseMetadata,
	objects *introspection.Objects,
	generatedAggregateOrderBy map[string]struct{},
	caps Capabilities,
) {
	fields := []*graph.Field{}

	for _, col := range tableInfo.Columns {
		if _, ok := allowedColumns[col.Name]; !ok {
			continue
		}

		field := &graph.Field{ //nolint:exhaustruct
			Name:        getCustomColumnName(tableMeta, col.Name),
			Description: getColumnDescription(&col),
			Type:        getColumnGraphQLType(&col, tableInfo, md),
		}

		// jsonb/json columns expose a `path` argument so callers can drill
		// into nested values without separate path-specific scalar types.
		if col.Type == "jsonb" || col.Type == "json" {
			field.Arguments = []*graph.Argument{
				{
					Name:        "path",
					Description: "JSON select path",
					Type:        graph.NewNamedType("String"),
				},
			}
		}

		fields = append(fields, field)
	}

	fields = append(
		fields, generateObjectRelationshipFields(tableMeta, tableInfo, role, md)...,
	)

	fields = append(
		fields,
		generateArrayRelationshipFields(
			schema, tableMeta, tableInfo, role, md, objects, generatedAggregateOrderBy, caps,
		)...,
	)

	// Match Hasura's default description format for downstream tooling
	// (codegen, IntrospectionQuery consumers) that key off of it.
	var description string
	if tableInfo.Comment != nil && *tableInfo.Comment != "" {
		description = *tableInfo.Comment
	} else {
		qualifiedName := getQualifiedName(tableMeta.Table.Schema, tableMeta.Table.Name)
		description = fmt.Sprintf(`columns and relationships of "%s"`, qualifiedName)
	}

	schema.Types = append(schema.Types, &graph.ObjectType{ //nolint:exhaustruct
		Name:        customTableName,
		Description: description,
		Fields:      fields,
	})
}

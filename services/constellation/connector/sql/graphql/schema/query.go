package schema

import (
	"fmt"

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// generateTableQueryFields generates query fields for a table.
func generateTableQueryFields(
	queryFields *[]*graph.Field,
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	customTableName string,
	qualifiedName string,
	allowedColumns map[string]struct{},
	role string,
	md *metadata.DatabaseMetadata,
	caps Capabilities,
) {
	*queryFields = append(
		*queryFields,
		generateCollectionField(tableMeta, customTableName, qualifiedName, caps),
	)

	// _by_pk requires the role to be able to read every primary-key column;
	// otherwise the field would error on an otherwise valid lookup.
	if len(tableInfo.PrimaryKeys) > 0 &&
		allPKColumnsAllowed(tableInfo.PrimaryKeys, allowedColumns) {
		*queryFields = append(
			*queryFields,
			generateByPkField(tableMeta, tableInfo, customTableName, qualifiedName, md),
		)
	}

	if allowAggregations(tableMeta, role) {
		*queryFields = append(
			*queryFields,
			generateAggregateField(tableMeta, customTableName, qualifiedName, caps),
		)
	}
}

// generateCollectionField generates a collection field for queries or subscriptions.
func generateCollectionField(
	tableMeta *metadata.TableMetadata,
	customTableName string,
	qualifiedName string,
	caps Capabilities,
) *graph.Field {
	collectionName := customTableName
	if tableMeta.Configuration.CustomRootFields.Select != "" {
		collectionName = tableMeta.Configuration.CustomRootFields.Select
	}

	arguments := collectionArguments(customTableName, caps)

	return &graph.Field{ //nolint:exhaustruct
		Name: collectionName,
		Description: fmt.Sprintf(
			"fetch data from the table: \"%s\"",
			qualifiedName,
		),
		Type:      graph.NewNonNullListType(graph.NewNonNullType(customTableName)),
		Arguments: arguments,
	}
}

// collectionArguments returns the standard arguments for collection fields,
// conditionally including distinct_on based on database capabilities.
func collectionArguments(customTableName string, caps Capabilities) []*graph.Argument {
	arguments := make([]*graph.Argument, 0, 5) //nolint:mnd

	if caps.SupportsDistinctOn {
		arguments = append(arguments, &graph.Argument{ //nolint:exhaustruct
			Name:        "distinct_on",
			Description: "distinct select on columns",
			Type: graph.NewListType(
				graph.NewNonNullType(customTableName + "_select_column"),
			),
		})
	}

	arguments = append(arguments,
		&graph.Argument{ //nolint:exhaustruct
			Name:        "limit",
			Description: "limit the number of rows returned",
			Type:        graph.NewNamedType("Int"),
		},
		&graph.Argument{ //nolint:exhaustruct
			Name:        "offset",
			Description: "skip the first n rows. Use only with order_by",
			Type:        graph.NewNamedType("Int"),
		},
		&graph.Argument{ //nolint:exhaustruct
			Name:        "order_by",
			Description: "sort the rows by one or more columns",
			Type: graph.NewListType(
				graph.NewNonNullType(customTableName + "_order_by"),
			),
		},
		&graph.Argument{ //nolint:exhaustruct
			Name:        "where",
			Description: "filter the rows returned",
			Type:        graph.NewNamedType(customTableName + "_bool_exp"),
		},
	)

	return arguments
}

// generateByPkField generates a by-primary-key field for queries or subscriptions.
func generateByPkField(
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	customTableName string,
	qualifiedName string,
	md *metadata.DatabaseMetadata,
) *graph.Field {
	byPkName := customTableName + "_by_pk"
	if tableMeta.Configuration.CustomRootFields.SelectByPk != "" {
		byPkName = tableMeta.Configuration.CustomRootFields.SelectByPk
	}

	pkArgs := make([]*graph.Argument, 0, len(tableInfo.PrimaryKeys))
	for _, pkColName := range tableInfo.PrimaryKeys {
		var (
			colType     *graph.Type
			description string
		)

		for i := range tableInfo.Columns {
			if tableInfo.Columns[i].Name == pkColName {
				colType = getColumnGraphQLTypePKArg(&tableInfo.Columns[i], tableInfo, md)
				description = getColumnDescription(&tableInfo.Columns[i])

				break
			}
		}

		if colType == nil {
			colType = graph.NewNonNullType("ID")
		}

		pkArgs = append(pkArgs, &graph.Argument{ //nolint:exhaustruct
			Name:        getCustomColumnName(tableMeta, pkColName),
			Description: description,
			Type:        colType,
		})
	}

	return &graph.Field{ //nolint:exhaustruct
		Name: byPkName,
		Description: fmt.Sprintf(
			"fetch data from the table: \"%s\" using primary key columns",
			qualifiedName,
		),
		Type:      graph.NewNamedType(customTableName),
		Arguments: pkArgs,
	}
}

// generateTableInputTypes generates all input types for a table.
func generateTableInputTypes(
	schema *graph.Schema,
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	customTableName string,
	qualifiedName string,
	allowedColumns map[string]struct{},
	role string,
	md *metadata.DatabaseMetadata,
	objects *introspection.Objects,
	generatedAggregateBoolExp map[string]struct{},
	usedScalars map[string]struct{},
	caps Capabilities,
) {
	generateTableQueryInputTypes(
		schema, tableMeta, tableInfo, customTableName, qualifiedName, allowedColumns, role, md,
		objects, generatedAggregateBoolExp, usedScalars, caps,
	)

	generateTableSubscriptionInputTypes(
		schema,
		tableMeta,
		tableInfo,
		customTableName,
		allowedColumns,
		md,
	)
}

// generateBoolExpRelationshipFields generates bool_exp input fields for relationships.
func generateBoolExpRelationshipFields(
	schema *graph.Schema,
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	role string,
	md *metadata.DatabaseMetadata,
	objects *introspection.Objects,
	generatedAggregateBoolExp map[string]struct{},
	usedScalars map[string]struct{},
	caps Capabilities,
) []*graph.InputField {
	fields := []*graph.InputField{}

	for _, rel := range tableMeta.ObjectRelationships {
		targetCustomName := getRelationshipTargetName(md, tableInfo, rel.Using)
		if targetCustomName == "" {
			continue
		}

		if !isTargetTableAccessible(md, tableInfo, rel.Using, role) {
			continue
		}

		fields = append(fields, &graph.InputField{ //nolint:exhaustruct
			Name: rel.Name,
			Type: graph.NewNamedType(targetCustomName + "_bool_exp"),
		})
	}

	for _, rel := range tableMeta.ArrayRelationships {
		targetCustomName := getRelationshipTargetName(md, tableInfo, rel.Using)
		if targetCustomName == "" {
			continue
		}

		if !isTargetTableAccessible(md, tableInfo, rel.Using, role) {
			continue
		}

		fields = append(fields, &graph.InputField{ //nolint:exhaustruct
			Name: rel.Name,
			Type: graph.NewNamedType(targetCustomName + "_bool_exp"),
		})

		targetTableMeta := getRelationshipTarget(tableInfo, md.Tables, rel.Using)

		if targetTableMeta != nil && allowAggregations(targetTableMeta, role) {
			// The aggregate bool_exp on the foreign side must exist before we
			// reference it; this lazily emits it the first time a relationship
			// pulls it in.
			maybeGenerateAggregateBoolExpForTargetTable(
				schema, md, objects, targetTableMeta.Table.Schema, targetTableMeta.Table.Name,
				role, generatedAggregateBoolExp, usedScalars, caps,
			)

			fields = append(fields, &graph.InputField{ //nolint:exhaustruct
				Name: rel.Name + "_aggregate",
				Type: graph.NewNamedType(targetCustomName + "_aggregate_bool_exp"),
			})
		}
	}

	return fields
}

// generateOrderByRelationshipFields generates order_by input fields for relationships.
func generateOrderByRelationshipFields(
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	role string,
	md *metadata.DatabaseMetadata,
) []*graph.InputField {
	fields := []*graph.InputField{}

	for _, rel := range tableMeta.ObjectRelationships {
		targetCustomName := getRelationshipTargetName(md, tableInfo, rel.Using)
		if targetCustomName == "" {
			continue
		}

		if !isTargetTableAccessible(md, tableInfo, rel.Using, role) {
			continue
		}

		fields = append(fields, &graph.InputField{ //nolint:exhaustruct
			Name: rel.Name,
			Type: graph.NewNamedType(targetCustomName + "_order_by"),
		})
	}

	// Array relationships always get an _aggregate order_by entry even when
	// aggregations are disabled on the target table: aggregate_order_by is
	// emitted whenever a table is referenced by any relationship.
	for _, rel := range tableMeta.ArrayRelationships {
		targetCustomName := getRelationshipTargetName(md, tableInfo, rel.Using)
		if targetCustomName == "" {
			continue
		}

		if !isTargetTableAccessible(md, tableInfo, rel.Using, role) {
			continue
		}

		fields = append(fields, &graph.InputField{ //nolint:exhaustruct
			Name: rel.Name + "_aggregate",
			Type: graph.NewNamedType(targetCustomName + "_aggregate_order_by"),
		})
	}

	return fields
}

// generateTableQueryInputTypes generates all input types for a table.
func generateTableQueryInputTypes( //nolint:funlen
	schema *graph.Schema,
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	customTableName string,
	qualifiedName string,
	allowedColumns map[string]struct{},
	role string,
	md *metadata.DatabaseMetadata,
	objects *introspection.Objects,
	generatedAggregateBoolExp map[string]struct{},
	usedScalars map[string]struct{},
	caps Capabilities,
) {
	// Generate bool_exp
	boolExpFields := []*graph.InputField{
		{
			Name: "_and",
			Type: graph.NewListType(graph.NewNonNullType(customTableName + "_bool_exp")),
		},
		{
			Name: "_not",
			Type: graph.NewNamedType(customTableName + "_bool_exp"),
		},
		{
			Name: "_or",
			Type: graph.NewListType(graph.NewNonNullType(customTableName + "_bool_exp")),
		},
	}

	for _, col := range tableInfo.Columns {
		if _, ok := allowedColumns[col.Name]; !ok {
			continue
		}

		var comparisonType string

		switch enumCompType := getEnumComparisonType(&col, tableInfo, md); {
		case enumCompType != "":
			comparisonType = enumCompType
		case col.IsArray && caps.SupportsArrays:
			comparisonType = caps.arrayComparisonExpName(getGraphQLScalarType(col.Type))
		default:
			comparisonType = caps.comparisonExpName(getGraphQLScalarType(col.Type))
		}

		boolExpFields = append(boolExpFields, &graph.InputField{ //nolint:exhaustruct
			Name:        getCustomColumnName(tableMeta, col.Name),
			Description: getColumnDescription(&col),
			Type:        graph.NewNamedType(comparisonType),
		})
	}

	boolExpFields = append(
		boolExpFields,
		generateBoolExpRelationshipFields(
			schema,
			tableMeta,
			tableInfo,
			role,
			md,
			objects,
			generatedAggregateBoolExp,
			usedScalars,
			caps,
		)...,
	)

	schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
		Name: customTableName + "_bool_exp",
		Description: fmt.Sprintf(
			"Boolean expression to filter rows from the table \"%s\". All fields are combined with a logical 'AND'.",
			qualifiedName,
		),
		Fields: boolExpFields,
	})

	orderByFields := []*graph.InputField{}

	for _, col := range tableInfo.Columns {
		if _, ok := allowedColumns[col.Name]; !ok {
			continue
		}

		orderByFields = append(orderByFields, &graph.InputField{ //nolint:exhaustruct
			Name:        getCustomColumnName(tableMeta, col.Name),
			Description: getColumnDescription(&col),
			Type:        graph.NewNamedType("order_by"),
		})
	}

	orderByFields = append(
		orderByFields,
		generateOrderByRelationshipFields(tableMeta, tableInfo, role, md)...,
	)

	schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
		Name: customTableName + "_order_by",
		Description: fmt.Sprintf(
			"Ordering options when selecting data from \"%s\".",
			qualifiedName,
		),
		Fields: orderByFields,
	})
}

// generateTableSelectColumnEnum generates the select_column enum for a table.
func generateTableSelectColumnEnum(
	schema *graph.Schema,
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	customTableName string,
	qualifiedName string,
	allowedColumns map[string]struct{},
) {
	values := []*graph.EnumValue{}

	for _, col := range tableInfo.Columns {
		if _, ok := allowedColumns[col.Name]; !ok {
			continue
		}

		description := getColumnDescription(&col)
		if description == "" {
			description = "column name"
		}

		values = append(values, &graph.EnumValue{ //nolint:exhaustruct
			Name:        getCustomColumnName(tableMeta, col.Name),
			Description: description,
		})
	}

	schema.Enums = append(schema.Enums, &graph.EnumType{ //nolint:exhaustruct
		Name: customTableName + "_select_column",
		Description: fmt.Sprintf(
			"select columns of table \"%s\"",
			qualifiedName,
		),
		Values: values,
	})
}

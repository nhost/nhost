package schema

import (
	"fmt"

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/connector/sql/pgtypes"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// generateAggregateField generates an aggregate field for queries or subscriptions.
func generateAggregateField(
	tableMeta *metadata.TableMetadata,
	customTableName string,
	qualifiedName string,
	caps Capabilities,
) *graph.Field {
	aggregateName := customTableName + "_aggregate"
	if tableMeta.Configuration.CustomRootFields.SelectAggregate != "" {
		aggregateName = tableMeta.Configuration.CustomRootFields.SelectAggregate
	}

	arguments := collectionArguments(customTableName, caps)

	return &graph.Field{ //nolint:exhaustruct
		Name: aggregateName,
		Description: fmt.Sprintf(
			"fetch aggregated fields from the table: \"%s\"",
			qualifiedName,
		),
		Type:      graph.NewNonNullType(customTableName + "_aggregate"),
		Arguments: arguments,
	}
}

// generateAggregateTypes generates all aggregate-related types for a table.
func generateAggregateTypes(
	schema *graph.Schema,
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	customTableName string,
	qualifiedName string,
	allowedColumns map[string]struct{},
	md *metadata.DatabaseMetadata,
	caps Capabilities,
) {
	generateMainAggregateType(schema, customTableName, qualifiedName)

	// hasMaxFields/hasMinFields drive optional emission in generateAggregateFieldsType below.
	hasMaxFields, hasMinFields := generateMinMaxFieldsTypes(
		schema, tableMeta, tableInfo, customTableName, allowedColumns, md, caps,
	)

	hasNumeric := hasNumericColumns(tableInfo, allowedColumns)
	if hasNumeric {
		generateNumericAggregateFieldsTypes(
			schema, tableMeta, tableInfo, customTableName, allowedColumns, caps,
		)
	}

	generateAggregateFieldsType(
		schema,
		customTableName,
		qualifiedName,
		hasMaxFields,
		hasMinFields,
		hasNumeric,
		caps,
	)
}

// generateMainAggregateType generates the main aggregate type (e.g., users_aggregate).
func generateMainAggregateType(
	schema *graph.Schema,
	customTableName string,
	qualifiedName string,
) {
	schema.Types = append(schema.Types, &graph.ObjectType{ //nolint:exhaustruct
		Name: customTableName + "_aggregate",
		Description: fmt.Sprintf(
			"aggregated selection of \"%s\"",
			qualifiedName,
		),
		Fields: []*graph.Field{
			{
				Name: "aggregate",
				Type: graph.NewNamedType(customTableName + "_aggregate_fields"),
			},
			{
				Name: "nodes",
				Type: graph.NewNonNullListType(graph.NewNonNullType(customTableName)),
			},
		},
	})
}

// generateAggregateFieldsType generates the aggregate_fields type (e.g., users_aggregate_fields).
func generateAggregateFieldsType(
	schema *graph.Schema,
	customTableName string,
	qualifiedName string,
	hasMaxFields bool,
	hasMinFields bool,
	hasNumericColumns bool,
	caps Capabilities,
) {
	aggregateFieldsFields := []*graph.Field{
		{
			Name: "count",
			Type: graph.NewNonNullType("Int"),
			Arguments: []*graph.Argument{
				{
					Name: "columns",
					Type: graph.NewListType(
						graph.NewNonNullType(customTableName + "_select_column"),
					),
				},
				{
					Name: "distinct",
					Type: graph.NewNamedType("Boolean"),
				},
			},
		},
	}

	if hasMaxFields {
		aggregateFieldsFields = append(aggregateFieldsFields, &graph.Field{ //nolint:exhaustruct
			Name: "max",
			Type: graph.NewNamedType(customTableName + "_max_fields"),
		})
	}

	if hasMinFields {
		aggregateFieldsFields = append(aggregateFieldsFields, &graph.Field{ //nolint:exhaustruct
			Name: "min",
			Type: graph.NewNamedType(customTableName + "_min_fields"),
		})
	}

	if hasNumericColumns {
		aggregateFieldsFields = appendNumericAggregateFields(
			aggregateFieldsFields, customTableName, caps,
		)
	}

	schema.Types = append(schema.Types, &graph.ObjectType{ //nolint:exhaustruct
		Name:        customTableName + "_aggregate_fields",
		Description: fmt.Sprintf("aggregate fields of \"%s\"", qualifiedName),
		Fields:      aggregateFieldsFields,
	})
}

// appendNumericAggregateFields appends the numeric aggregate fields to
// aggregate_fields in Hasura's canonical order. avg and sum are native on every
// backend and always emitted; the stddev/variance family is gated by
// caps.SupportsVarianceAggregates, since exposing it on SQLite — which lacks
// those aggregate functions — would surface an opaque runtime "no such function"
// error rather than a clean GraphQL validation error.
//
// This deliberately mirrors appendNumericAggregateOrderByFields: the same
// avg/[stddev]/sum/[var] gating shape over a different field type (graph.Field
// vs graph.InputField) and *_fields vs *_order_by type suffixes. Unifying the
// two behind a generic helper would be less readable than the explicit
// functions, hence the dupl suppression below.
//
//nolint:dupl // intentional mirror of appendNumericAggregateOrderByFields, see above.
func appendNumericAggregateFields(
	fields []*graph.Field,
	customTableName string,
	caps Capabilities,
) []*graph.Field {
	fields = append(fields, &graph.Field{ //nolint:exhaustruct
		Name: "avg",
		Type: graph.NewNamedType(customTableName + "_avg_fields"),
	})

	if caps.SupportsVarianceAggregates {
		fields = append(
			fields,
			&graph.Field{ //nolint:exhaustruct
				Name: "stddev",
				Type: graph.NewNamedType(customTableName + "_stddev_fields"),
			},
			&graph.Field{ //nolint:exhaustruct
				Name: "stddev_pop",
				Type: graph.NewNamedType(customTableName + "_stddev_pop_fields"),
			},
			&graph.Field{ //nolint:exhaustruct
				Name: "stddev_samp",
				Type: graph.NewNamedType(customTableName + "_stddev_samp_fields"),
			},
		)
	}

	fields = append(fields, &graph.Field{ //nolint:exhaustruct
		Name: "sum",
		Type: graph.NewNamedType(customTableName + "_sum_fields"),
	})

	if caps.SupportsVarianceAggregates {
		fields = append(
			fields,
			&graph.Field{ //nolint:exhaustruct
				Name: "var_pop",
				Type: graph.NewNamedType(customTableName + "_var_pop_fields"),
			},
			&graph.Field{ //nolint:exhaustruct
				Name: "var_samp",
				Type: graph.NewNamedType(customTableName + "_var_samp_fields"),
			},
			&graph.Field{ //nolint:exhaustruct
				Name: "variance",
				Type: graph.NewNamedType(customTableName + "_variance_fields"),
			},
		)
	}

	return fields
}

// generateMinMaxFieldsTypes generates min and max fields types for aggregates.
// Returns (hasMaxFields, hasMinFields) indicating if the types were generated.
func generateMinMaxFieldsTypes(
	schema *graph.Schema,
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	customTableName string,
	allowedColumns map[string]struct{},
	md *metadata.DatabaseMetadata,
	caps Capabilities,
) (bool, bool) {
	maxFields := []*graph.Field{}
	for _, col := range tableInfo.Columns {
		if _, ok := allowedColumns[col.Name]; !ok {
			continue
		}

		// Enum columns do not support min/max aggregation.
		if is, _ := isEnumColumn(&col, tableInfo, md); is {
			continue
		}

		if !supportsMinMaxAggregate(col, caps) {
			continue
		}

		// All aggregate result types are nullable: max() over an empty
		// set is NULL.
		maxFields = append(maxFields, &graph.Field{ //nolint:exhaustruct
			Name:        getCustomColumnName(tableMeta, col.Name),
			Description: getColumnDescription(&col),
			Type:        postgresTypeToGraphQL(col.Type, true),
		})
	}

	if len(maxFields) > 0 {
		schema.Types = append(schema.Types, &graph.ObjectType{ //nolint:exhaustruct
			Name:        customTableName + "_max_fields",
			Description: "aggregate max on columns",
			Fields:      maxFields,
		})
	}

	minFields := []*graph.Field{}
	for _, col := range tableInfo.Columns {
		if _, ok := allowedColumns[col.Name]; !ok {
			continue
		}

		if is, _ := isEnumColumn(&col, tableInfo, md); is {
			continue
		}

		if !supportsMinMaxAggregate(col, caps) {
			continue
		}

		minFields = append(minFields, &graph.Field{ //nolint:exhaustruct
			Name:        getCustomColumnName(tableMeta, col.Name),
			Description: getColumnDescription(&col),
			Type:        postgresTypeToGraphQL(col.Type, true),
		})
	}

	if len(minFields) > 0 {
		schema.Types = append(schema.Types, &graph.ObjectType{ //nolint:exhaustruct
			Name:        customTableName + "_min_fields",
			Description: "aggregate min on columns",
			Fields:      minFields,
		})
	}

	return len(maxFields) > 0, len(minFields) > 0
}

func supportsMinMaxAggregate(col introspection.Column, _ Capabilities) bool {
	if pgtypes.IsSpatial(col.Type) {
		return false
	}

	return col.SupportsMinMax
}

// generateNumericAggregateFieldType generates a single numeric aggregate field type.
func generateNumericAggregateFieldType(
	schema *graph.Schema,
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	customTableName string,
	allowedColumns map[string]struct{},
	aggregateName string,
	description string,
	fieldTypeFunc func(pgType string) *graph.Type,
) {
	fields := []*graph.Field{}
	for _, col := range tableInfo.Columns {
		if _, ok := allowedColumns[col.Name]; !ok {
			continue
		}

		if !col.SupportsAgg {
			continue
		}

		fields = append(fields, &graph.Field{ //nolint:exhaustruct
			Name:        getCustomColumnName(tableMeta, col.Name),
			Description: getColumnDescription(&col),
			Type:        fieldTypeFunc(col.Type),
		})
	}

	if len(fields) > 0 {
		schema.Types = append(schema.Types, &graph.ObjectType{ //nolint:exhaustruct
			Name:        customTableName + "_" + aggregateName + "_fields",
			Description: description,
			Fields:      fields,
		})
	}
}

// generateNumericAggregateFieldsTypes generates all numeric aggregate field
// types. avg and sum are emitted on every backend; the stddev/variance family
// is gated by caps.SupportsVarianceAggregates so SQLite (which lacks those
// aggregate functions) does not emit orphan *_stddev_fields/*_variance_fields
// object types whose corresponding aggregate_fields entries were suppressed.
func generateNumericAggregateFieldsTypes(
	schema *graph.Schema,
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	customTableName string,
	allowedColumns map[string]struct{},
	caps Capabilities,
) {
	floatType := func(_ string) *graph.Type { return graph.NewNamedType("Float") }

	generateNumericAggregateFieldType(
		schema, tableMeta, tableInfo, customTableName, allowedColumns,
		"avg", "aggregate avg on columns", floatType,
	)

	// sum() preserves the column type rather than promoting to Float.
	generateNumericAggregateFieldType(
		schema, tableMeta, tableInfo, customTableName, allowedColumns,
		"sum", "aggregate sum on columns",
		func(pgType string) *graph.Type { return postgresTypeToGraphQL(pgType, true) },
	)

	if !caps.SupportsVarianceAggregates {
		return
	}

	generateNumericAggregateFieldType(
		schema, tableMeta, tableInfo, customTableName, allowedColumns,
		"stddev", "aggregate stddev on columns", floatType,
	)

	generateNumericAggregateFieldType(
		schema, tableMeta, tableInfo, customTableName, allowedColumns,
		"stddev_pop", "aggregate stddev_pop on columns", floatType,
	)

	generateNumericAggregateFieldType(
		schema, tableMeta, tableInfo, customTableName, allowedColumns,
		"stddev_samp", "aggregate stddev_samp on columns", floatType,
	)

	generateNumericAggregateFieldType(
		schema, tableMeta, tableInfo, customTableName, allowedColumns,
		"var_pop", "aggregate var_pop on columns", floatType,
	)

	generateNumericAggregateFieldType(
		schema, tableMeta, tableInfo, customTableName, allowedColumns,
		"var_samp", "aggregate var_samp on columns", floatType,
	)

	generateNumericAggregateFieldType(
		schema, tableMeta, tableInfo, customTableName, allowedColumns,
		"variance", "aggregate variance on columns", floatType,
	)
}

// generateAggregateOrderByTypes generates aggregate order_by input types for a table.
// This should only be called when the table is referenced by relationships.
func generateAggregateOrderByTypes( //nolint:funlen
	schema *graph.Schema,
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	customTableName string,
	qualifiedName string,
	allowedColumns map[string]struct{},
	md *metadata.DatabaseMetadata,
	caps Capabilities,
) {
	maxOrderByFields := []*graph.InputField{}
	for _, col := range tableInfo.Columns {
		if _, ok := allowedColumns[col.Name]; !ok {
			continue
		}

		if !supportsMinMaxAggregate(col, caps) {
			continue
		}

		// Enum columns do not support min/max aggregation.
		if is, _ := isEnumColumn(&col, tableInfo, md); is {
			continue
		}

		maxOrderByFields = append(maxOrderByFields, &graph.InputField{ //nolint:exhaustruct
			Name:        getCustomColumnName(tableMeta, col.Name),
			Description: getColumnDescription(&col),
			Type:        graph.NewNamedType("order_by"),
		})
	}

	if len(maxOrderByFields) > 0 {
		schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
			Name:        customTableName + "_max_order_by",
			Description: fmt.Sprintf("order by max() on columns of table \"%s\"", qualifiedName),
			Fields:      maxOrderByFields,
		})
	}

	minOrderByFields := []*graph.InputField{}
	for _, col := range tableInfo.Columns {
		if _, ok := allowedColumns[col.Name]; !ok {
			continue
		}

		if !supportsMinMaxAggregate(col, caps) {
			continue
		}

		if is, _ := isEnumColumn(&col, tableInfo, md); is {
			continue
		}

		minOrderByFields = append(minOrderByFields, &graph.InputField{ //nolint:exhaustruct
			Name:        getCustomColumnName(tableMeta, col.Name),
			Description: getColumnDescription(&col),
			Type:        graph.NewNamedType("order_by"),
		})
	}

	if len(minOrderByFields) > 0 {
		schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
			Name:        customTableName + "_min_order_by",
			Description: fmt.Sprintf("order by min() on columns of table \"%s\"", qualifiedName),
			Fields:      minOrderByFields,
		})
	}

	hasNumeric := hasNumericColumns(tableInfo, allowedColumns)
	if hasNumeric {
		generateNumericAggregateOrderByInputTypes(
			schema, tableMeta, tableInfo, customTableName, qualifiedName, allowedColumns, caps,
		)
	}

	aggregateOrderByFields := []*graph.InputField{
		{
			Name: "count",
			Type: graph.NewNamedType("order_by"),
		},
	}

	if len(maxOrderByFields) > 0 {
		aggregateOrderByFields = append(
			aggregateOrderByFields,
			&graph.InputField{ //nolint:exhaustruct
				Name: "max",
				Type: graph.NewNamedType(customTableName + "_max_order_by"),
			},
		)
	}

	if len(minOrderByFields) > 0 {
		aggregateOrderByFields = append(
			aggregateOrderByFields,
			&graph.InputField{ //nolint:exhaustruct
				Name: "min",
				Type: graph.NewNamedType(customTableName + "_min_order_by"),
			},
		)
	}

	if hasNumeric {
		aggregateOrderByFields = appendNumericAggregateOrderByFields(
			aggregateOrderByFields, customTableName, caps,
		)
	}

	schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
		Name: customTableName + "_aggregate_order_by",
		Description: fmt.Sprintf(
			"order by aggregate values of table \"%s\"",
			qualifiedName,
		),
		Fields: aggregateOrderByFields,
	})
}

// appendNumericAggregateOrderByFields appends the numeric aggregate order_by
// fields to <table>_aggregate_order_by in Hasura's canonical order. avg and sum
// are accepted on every backend and always emitted; the stddev/variance family
// is gated by caps.SupportsStableVarianceOrderBy so the advertised order_by
// surface matches what the aggregate-order_by builder accepts at runtime —
// backends without stable variance ordering (SQLite) reject these functions, so
// emitting the fields here would surface an opaque rejection instead of a clean
// GraphQL validation error.
//
// This deliberately mirrors appendNumericAggregateFields: the same
// avg/[stddev]/sum/[var] gating shape over a different field type
// (graph.InputField vs graph.Field) and *_order_by vs *_fields type suffixes.
// Unifying the two behind a generic helper would be less readable than the
// explicit functions, hence the dupl suppression below.
//
//nolint:dupl // intentional mirror of appendNumericAggregateFields, see above.
func appendNumericAggregateOrderByFields(
	fields []*graph.InputField,
	customTableName string,
	caps Capabilities,
) []*graph.InputField {
	fields = append(fields, &graph.InputField{ //nolint:exhaustruct
		Name: "avg",
		Type: graph.NewNamedType(customTableName + "_avg_order_by"),
	})

	if caps.SupportsStableVarianceOrderBy {
		fields = append(
			fields,
			&graph.InputField{ //nolint:exhaustruct
				Name: "stddev",
				Type: graph.NewNamedType(customTableName + "_stddev_order_by"),
			},
			&graph.InputField{ //nolint:exhaustruct
				Name: "stddev_pop",
				Type: graph.NewNamedType(customTableName + "_stddev_pop_order_by"),
			},
			&graph.InputField{ //nolint:exhaustruct
				Name: "stddev_samp",
				Type: graph.NewNamedType(customTableName + "_stddev_samp_order_by"),
			},
		)
	}

	fields = append(fields, &graph.InputField{ //nolint:exhaustruct
		Name: "sum",
		Type: graph.NewNamedType(customTableName + "_sum_order_by"),
	})

	if caps.SupportsStableVarianceOrderBy {
		fields = append(
			fields,
			&graph.InputField{ //nolint:exhaustruct
				Name: "var_pop",
				Type: graph.NewNamedType(customTableName + "_var_pop_order_by"),
			},
			&graph.InputField{ //nolint:exhaustruct
				Name: "var_samp",
				Type: graph.NewNamedType(customTableName + "_var_samp_order_by"),
			},
			&graph.InputField{ //nolint:exhaustruct
				Name: "variance",
				Type: graph.NewNamedType(customTableName + "_variance_order_by"),
			},
		)
	}

	return fields
}

// generateNumericAggregateOrderByInputType generates a single numeric aggregate order_by input type.
func generateNumericAggregateOrderByInputType(
	schema *graph.Schema,
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	customTableName string,
	qualifiedName string,
	allowedColumns map[string]struct{},
	aggregateName string,
	description string,
) {
	fields := []*graph.InputField{}
	for _, col := range tableInfo.Columns {
		if _, ok := allowedColumns[col.Name]; !ok {
			continue
		}

		if !col.SupportsAgg {
			continue
		}

		fields = append(fields, &graph.InputField{ //nolint:exhaustruct
			Name:        getCustomColumnName(tableMeta, col.Name),
			Description: getColumnDescription(&col),
			Type:        graph.NewNamedType("order_by"),
		})
	}

	// Only generate the type if there are fields
	if len(fields) > 0 {
		schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
			Name:        customTableName + "_" + aggregateName + "_order_by",
			Description: fmt.Sprintf(description, qualifiedName),
			Fields:      fields,
		})
	}
}

// generateNumericAggregateOrderByInputTypes generates all numeric aggregate
// order_by input types in Hasura's canonical order. avg and sum are emitted on
// every backend; the stddev/variance family is gated by
// caps.SupportsStableVarianceOrderBy so SQLite (which rejects ordering by those
// functions at runtime) does not emit orphan *_stddev_order_by/*_variance_order_by
// input types whose corresponding aggregate_order_by entries were suppressed.
// The order_by entries this gating mirrors live in appendNumericAggregateOrderByFields.
func generateNumericAggregateOrderByInputTypes(
	schema *graph.Schema,
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	customTableName string,
	qualifiedName string,
	allowedColumns map[string]struct{},
	caps Capabilities,
) {
	generateNumericAggregateOrderByInputType(
		schema, tableMeta, tableInfo, customTableName, qualifiedName, allowedColumns,
		"avg", "order by avg() on columns of table \"%s\"",
	)

	if caps.SupportsStableVarianceOrderBy {
		generateNumericAggregateOrderByInputType(
			schema, tableMeta, tableInfo, customTableName, qualifiedName, allowedColumns,
			"stddev", "order by stddev() on columns of table \"%s\"",
		)

		generateNumericAggregateOrderByInputType(
			schema, tableMeta, tableInfo, customTableName, qualifiedName, allowedColumns,
			"stddev_pop", "order by stddev_pop() on columns of table \"%s\"",
		)

		generateNumericAggregateOrderByInputType(
			schema, tableMeta, tableInfo, customTableName, qualifiedName, allowedColumns,
			"stddev_samp", "order by stddev_samp() on columns of table \"%s\"",
		)
	}

	generateNumericAggregateOrderByInputType(
		schema, tableMeta, tableInfo, customTableName, qualifiedName, allowedColumns,
		"sum", "order by sum() on columns of table \"%s\"",
	)

	if caps.SupportsStableVarianceOrderBy {
		generateNumericAggregateOrderByInputType(
			schema, tableMeta, tableInfo, customTableName, qualifiedName, allowedColumns,
			"var_pop", "order by var_pop() on columns of table \"%s\"",
		)

		generateNumericAggregateOrderByInputType(
			schema, tableMeta, tableInfo, customTableName, qualifiedName, allowedColumns,
			"var_samp", "order by var_samp() on columns of table \"%s\"",
		)

		generateNumericAggregateOrderByInputType(
			schema, tableMeta, tableInfo, customTableName, qualifiedName, allowedColumns,
			"variance", "order by variance() on columns of table \"%s\"",
		)
	}
}

// hasNumericColumns returns true if the table has any numeric columns that support aggregation.
func hasNumericColumns(
	tableInfo *introspection.Table,
	allowedColumns map[string]struct{},
) bool {
	for _, col := range tableInfo.Columns {
		if _, ok := allowedColumns[col.Name]; ok && col.SupportsAgg {
			return true
		}
	}

	return false
}

// hasIncrementColumns checks if a table has any columns that support increment operations.
func hasIncrementColumns(
	tableInfo *introspection.Table,
	allowedColumns map[string]struct{},
) bool {
	for _, col := range tableInfo.Columns {
		if _, ok := allowedColumns[col.Name]; ok && col.SupportsInc {
			return true
		}
	}

	return false
}

// generateAggregateBoolExpTypes generates aggregate bool_exp input types for a table.
// These are used for filtering based on aggregates in array relationships.
func generateAggregateBoolExpTypes( //nolint:funlen
	schema *graph.Schema,
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	customTableName string,
	qualifiedName string,
	allowedColumns map[string]struct{},
	usedScalars map[string]struct{},
	caps Capabilities,
) {
	// Int (count predicate) and Boolean (bool_and/bool_or predicate) are referenced by
	// the generated input types; ensure their comparison_exp emissions are kept.
	usedScalars["Int"] = struct{}{}
	usedScalars["Boolean"] = struct{}{}

	booleanColumns := []string{}
	for _, col := range tableInfo.Columns {
		if _, ok := allowedColumns[col.Name]; !ok {
			continue
		}

		if getGraphQLScalarType(col.Type) == "Boolean" { //nolint:goconst,nolintlint
			booleanColumns = append(booleanColumns, getCustomColumnName(tableMeta, col.Name))
		}
	}

	aggregateBoolExpFields := []*graph.InputField{
		{
			Name: "count",
			Type: graph.NewNamedType(customTableName + "_aggregate_bool_exp_count"),
		},
	}

	if len(booleanColumns) > 0 {
		aggregateBoolExpFields = append(
			aggregateBoolExpFields,
			&graph.InputField{ //nolint:exhaustruct
				Name: "bool_and",
				Type: graph.NewNamedType(customTableName + "_aggregate_bool_exp_bool_and"),
			},
			&graph.InputField{ //nolint:exhaustruct
				Name: "bool_or",
				Type: graph.NewNamedType(customTableName + "_aggregate_bool_exp_bool_or"),
			},
		)

		boolAndEnumValues := make([]*graph.EnumValue, 0, len(booleanColumns))
		for _, colName := range booleanColumns {
			boolAndEnumValues = append(boolAndEnumValues, &graph.EnumValue{ //nolint:exhaustruct
				Name:        colName,
				Description: "column name",
			})
		}

		schema.Enums = append(schema.Enums, &graph.EnumType{ //nolint:exhaustruct
			Name: fmt.Sprintf(
				"%s_select_column_%s_aggregate_bool_exp_bool_and_arguments_columns",
				customTableName,
				customTableName,
			),
			Description: fmt.Sprintf(
				`select "%s_aggregate_bool_exp_bool_and_arguments_columns" columns of table "%s"`,
				customTableName,
				qualifiedName,
			),
			Values: boolAndEnumValues,
		})

		boolOrEnumValues := make([]*graph.EnumValue, 0, len(booleanColumns))
		for _, colName := range booleanColumns {
			boolOrEnumValues = append(boolOrEnumValues, &graph.EnumValue{ //nolint:exhaustruct
				Name:        colName,
				Description: "column name",
			})
		}

		schema.Enums = append(schema.Enums, &graph.EnumType{ //nolint:exhaustruct
			Name: fmt.Sprintf(
				"%s_select_column_%s_aggregate_bool_exp_bool_or_arguments_columns",
				customTableName,
				customTableName,
			),
			Description: fmt.Sprintf(
				`select "%s_aggregate_bool_exp_bool_or_arguments_columns" columns of table "%s"`,
				customTableName,
				qualifiedName,
			),
			Values: boolOrEnumValues,
		})

		schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
			Name: customTableName + "_aggregate_bool_exp_bool_and",
			Fields: []*graph.InputField{
				{
					Name: "arguments",
					Type: graph.NewNonNullType(
						fmt.Sprintf(
							"%s_select_column_%s_aggregate_bool_exp_bool_and_arguments_columns",
							customTableName,
							customTableName,
						),
					),
				},
				{
					Name: "distinct",
					Type: graph.NewNamedType("Boolean"),
				},
				{
					Name: "filter",
					Type: graph.NewNamedType(customTableName + "_bool_exp"),
				},
				{
					Name: "predicate",
					Type: graph.NewNonNullType(caps.comparisonExpName("Boolean")),
				},
			},
		})

		schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
			Name: customTableName + "_aggregate_bool_exp_bool_or",
			Fields: []*graph.InputField{
				{
					Name: "arguments",
					Type: graph.NewNonNullType(
						fmt.Sprintf(
							"%s_select_column_%s_aggregate_bool_exp_bool_or_arguments_columns",
							customTableName,
							customTableName,
						),
					),
				},
				{
					Name: "distinct",
					Type: graph.NewNamedType("Boolean"),
				},
				{
					Name: "filter",
					Type: graph.NewNamedType(customTableName + "_bool_exp"),
				},
				{
					Name: "predicate",
					Type: graph.NewNonNullType(caps.comparisonExpName("Boolean")),
				},
			},
		})
	}

	schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
		Name: customTableName + "_aggregate_bool_exp_count",
		Fields: []*graph.InputField{
			{
				Name: "arguments",
				Type: graph.NewListType(graph.NewNonNullType(customTableName + "_select_column")),
			},
			{
				Name: "distinct",
				Type: graph.NewNamedType("Boolean"),
			},
			{
				Name: "filter",
				Type: graph.NewNamedType(customTableName + "_bool_exp"),
			},
			{
				Name: "predicate",
				Type: graph.NewNonNullType(caps.comparisonExpName("Int")),
			},
		},
	})

	schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
		Name:   customTableName + "_aggregate_bool_exp",
		Fields: aggregateBoolExpFields,
	})
}

// maybeGenerateAggregateBoolExpForTargetTable generates aggregate bool_exp types for a target
// table if they haven't been generated yet. This is called when processing array relationships.
func maybeGenerateAggregateBoolExpForTargetTable(
	schema *graph.Schema,
	md *metadata.DatabaseMetadata,
	objects *introspection.Objects,
	targetSchema string,
	targetTable string,
	role string,
	generatedAggregateBoolExp map[string]struct{},
	usedScalars map[string]struct{},
	caps Capabilities,
) {
	tableKey := targetSchema + "." + targetTable

	if _, exists := generatedAggregateBoolExp[tableKey]; exists {
		return
	}

	var targetTableMeta *metadata.TableMetadata
	for i := range md.Tables {
		if md.Tables[i].Table.Schema == targetSchema && md.Tables[i].Table.Name == targetTable {
			targetTableMeta = &md.Tables[i]
			break
		}
	}

	if targetTableMeta == nil {
		return
	}

	tableInfo, ok := objects.GetTable(targetSchema, targetTable)
	if !ok {
		return
	}

	customTableName := getCustomOrDefaultTypeName(targetTableMeta)
	qualifiedName := getQualifiedName(targetSchema, targetTable)
	allowedColumns := getAllowedColumns(targetTableMeta, tableInfo, role)

	generateAggregateBoolExpTypes(
		schema,
		targetTableMeta,
		tableInfo,
		customTableName,
		qualifiedName,
		allowedColumns,
		usedScalars,
		caps,
	)

	generatedAggregateBoolExp[tableKey] = struct{}{}
}

// maybeGenerateAggregateOrderByForTargetTable generates aggregate order_by types for a target
// table if they haven't been generated yet. This is called when processing array relationships.
func maybeGenerateAggregateOrderByForTargetTable(
	schema *graph.Schema,
	md *metadata.DatabaseMetadata,
	objects *introspection.Objects,
	targetSchema string,
	targetTable string,
	role string,
	generatedAggregateOrderBy map[string]struct{},
	caps Capabilities,
) {
	tableKey := targetSchema + "." + targetTable

	if _, exists := generatedAggregateOrderBy[tableKey]; exists {
		return
	}

	var targetTableMeta *metadata.TableMetadata
	for i := range md.Tables {
		if md.Tables[i].Table.Schema == targetSchema && md.Tables[i].Table.Name == targetTable {
			targetTableMeta = &md.Tables[i]
			break
		}
	}

	if targetTableMeta == nil {
		return
	}

	tableInfo, ok := objects.GetTable(targetSchema, targetTable)
	if !ok {
		return
	}

	customTableName := getCustomOrDefaultTypeName(targetTableMeta)
	qualifiedName := getQualifiedName(targetSchema, targetTable)
	allowedColumns := getAllowedColumns(targetTableMeta, tableInfo, role)

	generateAggregateOrderByTypes(
		schema,
		targetTableMeta,
		tableInfo,
		customTableName,
		qualifiedName,
		allowedColumns,
		md,
		caps,
	)

	generatedAggregateOrderBy[tableKey] = struct{}{}
}

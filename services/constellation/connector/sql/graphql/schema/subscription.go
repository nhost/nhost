package schema

import (
	"fmt"

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// generateTableSubscriptionFields generates subscription fields for a table.
func generateTableSubscriptionFields(
	subscriptionFields *[]*graph.Field,
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	customTableName string,
	qualifiedName string,
	allowedColumns map[string]struct{},
	role string,
	caps Capabilities,
) {
	// Collection subscription
	*subscriptionFields = append(
		*subscriptionFields,
		generateCollectionField(tableMeta, customTableName, qualifiedName, caps),
	)

	// By primary key subscription (only if the role can select all PK columns)
	if len(tableInfo.PrimaryKeys) > 0 &&
		allPKColumnsAllowed(tableInfo.PrimaryKeys, allowedColumns) {
		*subscriptionFields = append(
			*subscriptionFields,
			generateByPkField(tableMeta, tableInfo, customTableName, qualifiedName),
		)
	}

	// Aggregate subscription
	if allowAggregations(tableMeta, role) {
		*subscriptionFields = append(
			*subscriptionFields,
			generateAggregateField(tableMeta, customTableName, qualifiedName, caps),
		)
	}

	// Stream subscription
	*subscriptionFields = append(
		*subscriptionFields,
		generateStreamField(tableMeta, customTableName, qualifiedName),
	)
}

// generateStreamField generates a streaming subscription field.
func generateStreamField(
	tableMeta *metadata.TableMetadata,
	customTableName string,
	qualifiedName string,
) *graph.Field {
	streamName := customTableName + "_stream"
	if tableMeta.Configuration.CustomRootFields.SelectStream != "" {
		streamName = tableMeta.Configuration.CustomRootFields.SelectStream
	}

	return &graph.Field{ //nolint:exhaustruct
		Name: streamName,
		Description: fmt.Sprintf(
			"fetch data from the table in a streaming manner: \"%s\"",
			qualifiedName,
		),
		Type: graph.NewNonNullListType(graph.NewNonNullType(customTableName)),
		Arguments: []*graph.Argument{
			{
				Name:        "batch_size",
				Description: "maximum number of rows returned in a single batch",
				Type:        graph.NewNonNullType("Int"),
			},
			{
				Name:        "cursor",
				Description: "cursor to stream the results returned by the query",
				Type: graph.NewNonNullListType(
					graph.NewNamedType(customTableName + "_stream_cursor_input"),
				),
			},
			{
				Name:        "where",
				Description: "filter the rows returned",
				Type:        graph.NewNamedType(customTableName + "_bool_exp"),
			},
		},
	}
}

// generateTableSubscriptionInputTypes generates all input types for a table.
func generateTableSubscriptionInputTypes(
	schema *graph.Schema,
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	customTableName string,
	allowedColumns map[string]struct{},
	md *metadata.DatabaseMetadata,
) {
	// Generate stream cursor value input
	cursorValueFields := []*graph.InputField{}
	for _, col := range tableInfo.Columns {
		if _, ok := allowedColumns[col.Name]; !ok {
			continue
		}

		// Get the column type (check if it's an enum)
		var colType *graph.Type
		if enumTableName := getEnumTableName(&col, tableInfo, md); enumTableName != "" {
			// Stream cursor inputs are always nullable
			colType = graph.NewNamedType(enumTableName + "_enum")
		} else {
			scalarType := getGraphQLScalarType(col.Type)
			// Stream cursor inputs are always nullable
			if col.IsArray {
				colType = graph.NewListType(graph.NewNonNullType(scalarType))
			} else {
				colType = graph.NewNamedType(scalarType)
			}
		}

		cursorValueFields = append(cursorValueFields, &graph.InputField{ //nolint:exhaustruct
			Name:        getCustomColumnName(tableMeta, col.Name),
			Description: getColumnDescription(&col),
			Type:        colType,
		})
	}

	schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
		Name:        customTableName + "_stream_cursor_value_input",
		Description: "Initial value of the column from where the streaming should start",
		Fields:      cursorValueFields,
	})

	// Generate stream cursor input
	schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
		Name:        customTableName + "_stream_cursor_input",
		Description: fmt.Sprintf("Streaming cursor of the table \"%s\"", customTableName),
		Fields: []*graph.InputField{
			{
				Name:        "initial_value",
				Description: "Stream column input with initial value",
				Type:        graph.NewNonNullType(customTableName + "_stream_cursor_value_input"),
			},
			{
				Name:        "ordering",
				Description: "cursor ordering",
				Type:        graph.NewNamedType("cursor_ordering"),
			},
		},
	})
}

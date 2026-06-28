package schema

import (
	"errors"
	"fmt"

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// ErrEnumValuesNotFound reports that an enum table marked as enum in metadata
// had no introspected values available when generating its GraphQL enum type.
var ErrEnumValuesNotFound = errors.New("enum values not found for enum table")

// isEnumColumn checks if a column references an enum table via foreign key.
func isEnumColumn(
	col *introspection.Column,
	tableInfo *introspection.Table,
	md *metadata.DatabaseMetadata,
) (bool, string) {
	for _, fk := range tableInfo.ForeignKeys {
		if fk.ColumnName == col.Name {
			// Find the target table in metadata
			for i := range md.Tables {
				targetTable := &md.Tables[i]
				if targetTable.Table.Schema == fk.ForeignSchema &&
					targetTable.Table.Name == fk.ForeignTable {
					return targetTable.IsEnum, fk.ForeignSchema + "." + fk.ForeignTable
				}
			}
		}
	}

	return false, ""
}

// getEnumTableName returns the custom table name of the enum table that a column references,
// or an empty string if the column does not reference an enum table.
func getEnumTableName(
	col *introspection.Column,
	tableInfo *introspection.Table,
	md *metadata.DatabaseMetadata,
) string {
	// Find the foreign key for this column
	for _, fk := range tableInfo.ForeignKeys {
		if fk.ColumnName == col.Name {
			// Find the target table in metadata
			for i := range md.Tables {
				targetTable := &md.Tables[i]
				if targetTable.Table.Schema == fk.ForeignSchema &&
					targetTable.Table.Name == fk.ForeignTable &&
					targetTable.IsEnum {
					return getCustomOrDefaultTypeName(targetTable)
				}
			}
		}
	}

	return ""
}

// getEnumComparisonType returns the enum comparison type name for a column,
// or an empty string if the column is not an enum.
func getEnumComparisonType(
	col *introspection.Column,
	tableInfo *introspection.Table,
	md *metadata.DatabaseMetadata,
) string {
	if enumTableName := getEnumTableName(col, tableInfo, md); enumTableName != "" {
		return enumTableName + "_enum_comparison_exp"
	}

	return ""
}

// generateEnumTypes generates GraphQL enum types from enum tables that are actually referenced.
func generateEnumTypes( //nolint:funlen
	schema *graph.Schema,
	md *metadata.DatabaseMetadata,
	enumValues map[string][]introspection.EnumValue,
	neededEnums map[string]struct{},
) error {
	for i := range md.Tables {
		tableMeta := &md.Tables[i]

		if !tableMeta.IsEnum {
			continue
		}

		// Only emit enum types for enums that an accessible table references --
		// otherwise the role sees enum types it cannot use.
		enumKey := tableMeta.Table.Schema + "." + tableMeta.Table.Name
		if _, needed := neededEnums[enumKey]; !needed {
			continue
		}

		customTableName := getCustomOrDefaultTypeName(tableMeta)

		key := tableMeta.Table.Schema + "." + tableMeta.Table.Name

		enumVals, ok := enumValues[key]
		if !ok {
			return fmt.Errorf("%w: %s.%s",
				ErrEnumValuesNotFound, tableMeta.Table.Schema, tableMeta.Table.Name)
		}

		evs := make([]*graph.EnumValue, 0, len(enumVals))
		for _, ev := range enumVals {
			evs = append(evs, &graph.EnumValue{ //nolint:exhaustruct
				Name:        ev.Value,
				Description: ev.Comment,
			})
		}

		schema.Enums = append(schema.Enums, &graph.EnumType{ //nolint:exhaustruct
			Name:   customTableName + "_enum",
			Values: evs,
		})

		schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
			Name: customTableName + "_enum_comparison_exp",
			Description: fmt.Sprintf(
				`Boolean expression to compare columns of type "%s_enum". All fields are combined with logical 'AND'.`,
				customTableName,
			),
			Fields: []*graph.InputField{
				{
					Name: "_eq",
					Type: graph.NewNamedType(customTableName + "_enum"),
				},
				{
					Name: "_in",
					Type: graph.NewListType(graph.NewNonNullType(customTableName + "_enum")),
				},
				{
					Name: "_is_null",
					Type: graph.NewNamedType("Boolean"),
				},
				{
					Name: "_neq",
					Type: graph.NewNamedType(customTableName + "_enum"),
				},
				{
					Name: "_nin",
					Type: graph.NewListType(graph.NewNonNullType(customTableName + "_enum")),
				},
			},
		})
	}

	return nil
}

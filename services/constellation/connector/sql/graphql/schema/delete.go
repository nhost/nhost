package schema

import (
	"fmt"

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// generateDeleteByPkField generates a delete-by-primary-key field.
func generateDeleteByPkField(
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	customTableName string,
	qualifiedName string,
	md *metadata.DatabaseMetadata,
) *graph.Field {
	deleteName := "delete_" + customTableName + "_by_pk"
	if tableMeta.Configuration.CustomRootFields.DeleteByPk != "" {
		deleteName = tableMeta.Configuration.CustomRootFields.DeleteByPk
	}

	pkArgs := make([]*graph.Argument, 0, len(tableInfo.PrimaryKeys))
	for _, pkColName := range tableInfo.PrimaryKeys {
		var (
			colType     *graph.Type
			description string
		)

		for i := range tableInfo.Columns {
			if tableInfo.Columns[i].Name == pkColName {
				// PK args are non-null. Primary-key columns are non-nullable in
				// introspection, so getColumnGraphQLType emits the NonNull form
				// for both the enum-FK and scalar-fallback branches.
				colType = getColumnGraphQLType(&tableInfo.Columns[i], tableInfo, md)
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
		Name: deleteName,
		Description: fmt.Sprintf(
			`delete single row from the table: "%s"`,
			qualifiedName,
		),
		Type:      graph.NewNamedType(customTableName),
		Arguments: pkArgs,
	}
}

// generateDeleteManyField generates a delete-many field.
func generateDeleteManyField(
	tableMeta *metadata.TableMetadata,
	customTableName string,
	qualifiedName string,
) *graph.Field {
	deleteName := "delete_" + customTableName
	if tableMeta.Configuration.CustomRootFields.Delete != "" {
		deleteName = tableMeta.Configuration.CustomRootFields.Delete
	}

	return &graph.Field{ //nolint:exhaustruct
		Name: deleteName,
		Description: fmt.Sprintf(
			`delete data from the table: "%s"`,
			qualifiedName,
		),
		Type: graph.NewNamedType(customTableName + "_mutation_response"),
		Arguments: []*graph.Argument{
			{
				Name:        "where",
				Description: "filter the rows which have to be deleted",
				Type:        graph.NewNonNullType(customTableName + "_bool_exp"),
			},
		},
	}
}

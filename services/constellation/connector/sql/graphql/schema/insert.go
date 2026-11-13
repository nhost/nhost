package schema

import (
	"fmt"

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// generateInsertOneField generates an insert-one field.
func generateInsertOneField(
	tableMeta *metadata.TableMetadata,
	customTableName string,
	qualifiedName string,
	hasConstraints bool,
) *graph.Field {
	insertName := "insert_" + customTableName + "_one"
	if tableMeta.Configuration.CustomRootFields.InsertOne != "" {
		insertName = tableMeta.Configuration.CustomRootFields.InsertOne
	}

	args := []*graph.Argument{
		{
			Name:        "object",
			Description: "the row to be inserted",
			Type:        graph.NewNonNullType(customTableName + "_insert_input"),
		},
	}
	if hasConstraints {
		args = append(args, &graph.Argument{ //nolint:exhaustruct
			Name:        "on_conflict",
			Description: "upsert condition",
			Type:        graph.NewNamedType(customTableName + "_on_conflict"),
		})
	}

	return &graph.Field{ //nolint:exhaustruct
		Name: insertName,
		Description: fmt.Sprintf(
			`insert a single row into the table: "%s"`,
			qualifiedName,
		),
		Type:      graph.NewNamedType(customTableName),
		Arguments: args,
	}
}

// generateInsertManyField generates an insert-many field.
func generateInsertManyField(
	tableMeta *metadata.TableMetadata,
	customTableName string,
	qualifiedName string,
	hasConstraints bool,
) *graph.Field {
	insertName := "insert_" + customTableName
	if tableMeta.Configuration.CustomRootFields.Insert != "" {
		insertName = tableMeta.Configuration.CustomRootFields.Insert
	}

	args := []*graph.Argument{
		{
			Name:        "objects",
			Description: "the rows to be inserted",
			Type: graph.NewNonNullListType(
				graph.NewNonNullType(customTableName + "_insert_input"),
			),
		},
	}
	if hasConstraints {
		args = append(args, &graph.Argument{ //nolint:exhaustruct
			Name:        "on_conflict",
			Description: "upsert condition",
			Type:        graph.NewNamedType(customTableName + "_on_conflict"),
		})
	}

	return &graph.Field{ //nolint:exhaustruct
		Name: insertName,
		Description: fmt.Sprintf(
			`insert data into the table: "%s"`,
			qualifiedName,
		),
		Type:      graph.NewNamedType(customTableName + "_mutation_response"),
		Arguments: args,
	}
}

// generateInsertInput generates the insert_input type.
func generateInsertInput(
	schema *graph.Schema,
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	customTableName string,
	qualifiedName string,
	allowedColumns map[string]struct{},
	md *metadata.DatabaseMetadata,
	insertableTables map[string]struct{},
) {
	fields := []*graph.InputField{}

	// insert_input columns are always nullable -- missing values default
	// from the database (NULL, DEFAULT, sequence) so the input must accept
	// omission even for NOT NULL columns.
	for _, col := range tableInfo.Columns {
		if _, ok := allowedColumns[col.Name]; !ok {
			continue
		}

		colType := getColumnGraphQLType(&col, tableInfo, md)

		if colType.NonNull {
			if colType.Elem != nil {
				colType = graph.NewListType(colType.Elem)
			} else {
				colType = graph.NewNamedType(colType.NamedType)
			}
		}

		fields = append(fields, &graph.InputField{ //nolint:exhaustruct
			Name:        getCustomColumnName(tableMeta, col.Name),
			Description: getColumnDescription(&col),
			Type:        colType,
		})
	}

	fields = append(
		fields,
		getInsertRelationshipFields(tableMeta, tableInfo, md, insertableTables)...)

	schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
		Name: customTableName + "_insert_input",
		Description: fmt.Sprintf(
			`input type for inserting data into table "%s"`,
			qualifiedName,
		),
		Fields:         fields,
		EmptySQLInsert: len(fields) == 0,
	})
}

func getInsertRelationshipFields(
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	md *metadata.DatabaseMetadata,
	insertableTables map[string]struct{},
) []*graph.InputField {
	var fields []*graph.InputField

	for _, rel := range tableMeta.ObjectRelationships {
		inputField := getRelationshipTargetInputField(
			md, tableInfo, rel.Using, rel.Name, "_obj_rel_insert_input", insertableTables,
		)
		if inputField != nil {
			fields = append(fields, inputField)
		}
	}

	for _, rel := range tableMeta.ArrayRelationships {
		inputField := getRelationshipTargetInputField(
			md, tableInfo, rel.Using, rel.Name, "_arr_rel_insert_input", insertableTables,
		)
		if inputField != nil {
			fields = append(fields, inputField)
		}
	}

	return fields
}

func getInsertRelationshipTargetName(
	md *metadata.DatabaseMetadata,
	tableInfo *introspection.Table,
	using metadata.RelationshipUsing,
	insertableTables map[string]struct{},
) string {
	targetName := getRelationshipTargetName(md, tableInfo, using)
	if _, ok := insertableTables[targetName]; !ok {
		return ""
	}

	return targetName
}

func getRelationshipTargetInputField(
	md *metadata.DatabaseMetadata,
	tableInfo *introspection.Table,
	using metadata.RelationshipUsing,
	relName string,
	suffix string,
	insertableTables map[string]struct{},
) *graph.InputField {
	targetName := getInsertRelationshipTargetName(md, tableInfo, using, insertableTables)
	if targetName == "" {
		return nil
	}

	return &graph.InputField{ //nolint:exhaustruct
		Name: relName,
		Type: graph.NewNamedType(targetName + suffix),
	}
}

// generateObjRelInsertInput generates the obj_rel_insert_input type for object relationships.
func generateObjRelInsertInput(
	schema *graph.Schema,
	customTableName string,
	qualifiedName string,
	hasConstraints bool,
) {
	fields := []*graph.InputField{
		{
			Name: "data",
			Type: graph.NewNonNullType(customTableName + "_insert_input"),
		},
	}

	if hasConstraints {
		fields = append(fields, &graph.InputField{ //nolint:exhaustruct
			Name:        "on_conflict",
			Description: "upsert condition",
			Type:        graph.NewNamedType(customTableName + "_on_conflict"),
		})
	}

	schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
		Name: customTableName + "_obj_rel_insert_input",
		Description: fmt.Sprintf(
			`input type for inserting object relation for remote table "%s"`,
			qualifiedName,
		),
		Fields: fields,
	})
}

// generateArrRelInsertInput generates the arr_rel_insert_input type for array relationships.
func generateArrRelInsertInput(
	schema *graph.Schema,
	customTableName string,
	qualifiedName string,
	hasConstraints bool,
) {
	fields := []*graph.InputField{
		{
			Name: "data",
			Type: graph.NewNonNullListType(graph.NewNonNullType(customTableName + "_insert_input")),
		},
	}

	if hasConstraints {
		fields = append(fields, &graph.InputField{ //nolint:exhaustruct
			Name:        "on_conflict",
			Description: "upsert condition",
			Type:        graph.NewNamedType(customTableName + "_on_conflict"),
		})
	}

	schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
		Name: customTableName + "_arr_rel_insert_input",
		Description: fmt.Sprintf(
			`input type for inserting array relation for remote table "%s"`,
			qualifiedName,
		),
		Fields: fields,
	})
}

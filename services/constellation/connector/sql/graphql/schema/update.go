package schema

import (
	"fmt"

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// generateUpdateByPkField generates an update-by-primary-key field.
func generateUpdateByPkField(
	tableMeta *metadata.TableMetadata,
	customTableName string,
	qualifiedName string,
	hasJSONB bool,
	hasNumeric bool,
) *graph.Field {
	updateName := "update_" + customTableName + "_by_pk"
	if tableMeta.Configuration.CustomRootFields.UpdateByPk != "" {
		updateName = tableMeta.Configuration.CustomRootFields.UpdateByPk
	}

	args := generateUpdateArguments(customTableName, hasJSONB, hasNumeric)

	args = append(args, &graph.Argument{ //nolint:exhaustruct
		Name: "pk_columns",
		Type: graph.NewNonNullType(customTableName + "_pk_columns_input"),
	})

	return &graph.Field{ //nolint:exhaustruct
		Name: updateName,
		Description: fmt.Sprintf(
			`update single row of the table: "%s"`,
			qualifiedName,
		),
		Type:      graph.NewNamedType(customTableName),
		Arguments: args,
	}
}

// generateUpdateManyField generates an update-many field.
func generateUpdateManyField(
	tableMeta *metadata.TableMetadata,
	customTableName string,
	qualifiedName string,
	hasJSONB bool,
	hasNumeric bool,
) *graph.Field {
	updateName := "update_" + customTableName
	if tableMeta.Configuration.CustomRootFields.Update != "" {
		updateName = tableMeta.Configuration.CustomRootFields.Update
	}

	args := generateUpdateArguments(customTableName, hasJSONB, hasNumeric)

	args = append(args, &graph.Argument{ //nolint:exhaustruct
		Name:        "where",
		Description: "filter the rows which have to be updated",
		Type:        graph.NewNonNullType(customTableName + "_bool_exp"),
	})

	return &graph.Field{ //nolint:exhaustruct
		Name: updateName,
		Description: fmt.Sprintf(
			`update data of the table: "%s"`,
			qualifiedName,
		),
		Type:      graph.NewNamedType(customTableName + "_mutation_response"),
		Arguments: args,
	}
}

// generateUpdateManyBatchField generates an update-many-batch field.
func generateUpdateManyBatchField(
	tableMeta *metadata.TableMetadata,
	customTableName string,
	qualifiedName string,
) *graph.Field {
	// When custom_name is unset we fall back to the schema-qualified
	// snake_case form so update_<schema>_<table>_many remains unambiguous
	// across schemas.
	var updateName string
	switch {
	case tableMeta.Configuration.CustomRootFields.UpdateMany != "":
		updateName = tableMeta.Configuration.CustomRootFields.UpdateMany
	case tableMeta.Configuration.CustomName != "":
		updateName = "update_" + customTableName + "_many"
	default:
		updateName = "update_" + getDefaultTypeName(
			tableMeta.Table.Schema, tableMeta.Table.Name) + "_many"
	}

	return &graph.Field{ //nolint:exhaustruct
		Name: updateName,
		Description: fmt.Sprintf(
			`update multiples rows of table: "%s"`,
			qualifiedName,
		),
		Type: graph.NewListType(graph.NewNamedType(customTableName + "_mutation_response")),
		Arguments: []*graph.Argument{
			{
				Name:        "updates",
				Description: "updates to execute, in order",
				Type: graph.NewNonNullListType(
					graph.NewNonNullType(customTableName + "_updates"),
				),
			},
		},
	}
}

// updateOp describes one of the per-row update operators (_set, _inc, _append,
// _delete_*, _prepend) emitted on both update arguments and updates input
// fields. Centralising the set keeps the two emission paths in sync — they
// previously diverged silently if a description was edited in one place but
// not the other.
type updateOp struct {
	suffix      string
	description string
}

func opName(suffix string) string {
	// Each entry's "suffix" is "_<op>_input"; the GraphQL field name is "_<op>".
	return suffix[:len(suffix)-len("_input")]
}

// generateUpdateArguments generates common update arguments.
func generateUpdateArguments(
	customTableName string,
	hasJSONB bool,
	hasNumeric bool,
) []*graph.Argument {
	ops := collectUpdateOps(hasJSONB, hasNumeric)
	args := make([]*graph.Argument, 0, len(ops))

	for _, op := range ops {
		args = append(args, &graph.Argument{ //nolint:exhaustruct
			Name:        opName(op.suffix),
			Description: op.description,
			Type:        graph.NewNamedType(customTableName + op.suffix),
		})
	}

	return args
}

// generateUpdatesInput generates the updates input type.
func generateUpdatesInput(
	schema *graph.Schema,
	customTableName string,
	hasJSONB bool,
	hasNumeric bool,
) {
	ops := collectUpdateOps(hasJSONB, hasNumeric)
	fields := make([]*graph.InputField, 0, len(ops)+1)

	for _, op := range ops {
		fields = append(fields, &graph.InputField{ //nolint:exhaustruct
			Name:        opName(op.suffix),
			Description: op.description,
			Type:        graph.NewNamedType(customTableName + op.suffix),
		})
	}

	fields = append(fields, &graph.InputField{ //nolint:exhaustruct
		Name:        "where",
		Description: "filter the rows which have to be updated",
		Type:        graph.NewNonNullType(customTableName + "_bool_exp"),
	})

	schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
		Name:   customTableName + "_updates",
		Fields: fields,
	})
}

// collectUpdateOps returns the ordered list of update operators applicable to a
// table, gated by jsonb/numeric capabilities. Order matches the original hand-
// rolled emission (jsonb ops, _inc, _set) so golden files are byte-stable.
func collectUpdateOps(hasJSONB, hasNumeric bool) []updateOp {
	ops := make([]updateOp, 0, len("jsonb")+2) //nolint:mnd // 5 jsonb ops + _inc + _set upper bound
	if hasJSONB {
		ops = append(ops,
			updateOp{
				suffix:      "_append_input",
				description: "append existing jsonb value of filtered columns with new jsonb value",
			},
			updateOp{
				suffix:      "_delete_at_path_input",
				description: "delete the field or element with specified path (for JSON arrays, negative integers count from the end)", //nolint:lll
			},
			updateOp{
				suffix:      "_delete_elem_input",
				description: "delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array", //nolint:lll
			},
			updateOp{
				suffix:      "_delete_key_input",
				description: "delete key/value pair or string element. key/value pairs are matched based on their key value",
			},
			updateOp{
				suffix:      "_prepend_input",
				description: "prepend existing jsonb value of filtered columns with new jsonb value",
			},
		)
	}

	if hasNumeric {
		ops = append(ops, updateOp{
			suffix:      "_inc_input",
			description: "increments the numeric columns with given value of the filtered values",
		})
	}

	ops = append(ops, updateOp{
		suffix:      "_set_input",
		description: "sets the columns of the filtered rows to the given values",
	})

	return ops
}

// generateUpdateColumnEnum generates the update_column enum.
func generateUpdateColumnEnum(
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

	description := "update columns of table \"" + qualifiedName + "\""

	if len(values) == 0 {
		// GraphQL forbids empty enum types, so when a role has no updatable
		// columns we emit a single _PLACEHOLDER value. Matches Hasura's
		// behaviour and keeps the schema parseable.
		description = "placeholder for update columns of table \"" + qualifiedName +
			"\" (current role has no relevant permissions)"

		values = append(values, &graph.EnumValue{ //nolint:exhaustruct
			Name:        "_PLACEHOLDER",
			Description: "placeholder (do not use)",
		})
	}

	schema.Enums = append(schema.Enums, &graph.EnumType{ //nolint:exhaustruct
		Name:        customTableName + "_update_column",
		Description: description,
		Values:      values,
	})
}

// generateIncInput generates the inc_input type for numeric columns.
func generateIncInput(
	schema *graph.Schema,
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	customTableName string,
	qualifiedName string,
	allowedColumns map[string]struct{},
	md *metadata.DatabaseMetadata,
) {
	fields := []*graph.InputField{}

	for _, col := range tableInfo.Columns {
		if _, ok := allowedColumns[col.Name]; !ok {
			continue
		}

		if col.SupportsInc {
			colType := getColumnGraphQLType(&col, tableInfo, md)

			// inc_input columns are always nullable -- a missing entry means
			// "no increment", not "set to zero".
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
	}

	if len(fields) > 0 {
		schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
			Name: customTableName + "_inc_input",
			Description: fmt.Sprintf(
				`input type for incrementing numeric columns in table "%s"`,
				qualifiedName,
			),
			Fields: fields,
		})
	}
}

// generateSetInput generates the set_input type.
func generateSetInput(
	schema *graph.Schema,
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	customTableName string,
	qualifiedName string,
	allowedColumns map[string]struct{},
	md *metadata.DatabaseMetadata,
) {
	fields := []*graph.InputField{}

	// set_input columns are always nullable -- a missing entry means "leave
	// the column alone", not "set to NULL".
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

	schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
		Name: customTableName + "_set_input",
		Description: fmt.Sprintf(
			`input type for updating data in table "%s"`,
			qualifiedName,
		),
		Fields: fields,
	})
}

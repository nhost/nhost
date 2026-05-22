package schema

import (
	"fmt"
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// generateTableMutationFields generates mutation fields for a table.
//
// Views participate in the schema as read-or-write relations depending on
// what the database itself allows. Postgres exposes that decision via
// information_schema.views.is_insertable_into / is_updatable; SQLite views
// are read-only unless an INSTEAD OF trigger exists (we conservatively treat
// every SQLite view as read-only). The IsInsertable / IsUpdatable flags on
// tableInfo capture those decisions and gate the corresponding mutations —
// even for admin, since admin's "unconditional CRUD" is itself conditional
// on the database accepting the write.
func generateTableMutationFields(
	mutationFields *[]*graph.Field,
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	customTableName string,
	qualifiedName string,
	role string,
) {
	// DELETE is intentionally gated on IsUpdatable. Postgres exposes
	// is_trigger_deletable independently of is_updatable, so an INSTEAD OF
	// trigger view can in principle be delete-only — but those are rare and
	// would need a dedicated introspection signal to surface here. Until we
	// add one, treat updatable-implies-deletable as the safe approximation:
	// it correctly covers ordinary tables and simple (non-trigger) views.
	if tableInfo.IsUpdatable &&
		(role == roleAdmin || getDeletePermission(tableMeta, role) != nil) {
		appendDeleteFields(mutationFields, tableMeta, tableInfo, customTableName, qualifiedName)
	}

	if tableInfo.IsInsertable &&
		(role == roleAdmin || getInsertPermission(tableMeta, role) != nil) {
		appendInsertFields(mutationFields, tableMeta, tableInfo, customTableName, qualifiedName)
	}

	if tableInfo.IsUpdatable &&
		(role == roleAdmin || getUpdatePermission(tableMeta, role) != nil) {
		appendUpdateFields(
			mutationFields,
			tableMeta,
			tableInfo,
			customTableName,
			qualifiedName,
			role,
		)
	}
}

func appendDeleteFields(
	mutationFields *[]*graph.Field,
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	customTableName string,
	qualifiedName string,
) {
	if len(tableInfo.PrimaryKeys) > 0 {
		*mutationFields = append(
			*mutationFields,
			generateDeleteByPkField(tableMeta, tableInfo, customTableName, qualifiedName),
		)
	}

	*mutationFields = append(
		*mutationFields,
		generateDeleteManyField(tableMeta, customTableName, qualifiedName),
	)
}

func appendInsertFields(
	mutationFields *[]*graph.Field,
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	customTableName string,
	qualifiedName string,
) {
	hasConstraints := len(tableInfo.PrimaryKeys) > 0 || len(tableInfo.UniqueConstraints) > 0

	*mutationFields = append(
		*mutationFields,
		generateInsertOneField(tableMeta, customTableName, qualifiedName, hasConstraints),
		generateInsertManyField(tableMeta, customTableName, qualifiedName, hasConstraints),
	)
}

// appendUpdateFields skips emission entirely when the role's update permission
// restricts every column away — an empty allowed-columns set leaves the role
// without any updatable fields, so emitting the update root field would
// produce an unusable mutation.
func appendUpdateFields(
	mutationFields *[]*graph.Field,
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	customTableName string,
	qualifiedName string,
	role string,
) {
	updateAllowedColumns := getUpdateAllowedColumns(tableMeta, tableInfo, role)
	if len(updateAllowedColumns) == 0 {
		return
	}

	hasJSONB := hasJSONBColumns(tableInfo, updateAllowedColumns)
	hasIncrement := hasIncrementColumns(tableInfo, updateAllowedColumns)

	if len(tableInfo.PrimaryKeys) > 0 {
		*mutationFields = append(
			*mutationFields,
			generateUpdateByPkField(
				tableMeta, customTableName, qualifiedName, hasJSONB, hasIncrement,
			),
		)
	}

	*mutationFields = append(
		*mutationFields,
		generateUpdateManyField(
			tableMeta, customTableName, qualifiedName, hasJSONB, hasIncrement,
		),
		generateUpdateManyBatchField(tableMeta, customTableName, qualifiedName),
	)
}

// generateTableMutationInputTypes generates all mutation input types for a table.
func generateTableMutationInputTypes( //nolint:funlen,cyclop
	schema *graph.Schema,
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	customTableName string,
	qualifiedName string,
	md *metadata.DatabaseMetadata,
	role string,
	tablesWithObjRelInsert map[string]struct{},
	tablesWithArrRelInsert map[string]struct{},
) {
	schema.Types = append(schema.Types, &graph.ObjectType{ //nolint:exhaustruct
		Name: customTableName + "_mutation_response",
		Description: fmt.Sprintf(
			`response of any mutation on the table "%s"`,
			qualifiedName,
		),
		Fields: []*graph.Field{
			{
				Name:        "affected_rows",
				Description: "number of rows affected by the mutation",
				Type:        graph.NewNonNullType("Int"),
			},
			{
				Name:        "returning",
				Description: "data from the rows affected by the mutation",
				Type:        graph.NewNonNullListType(graph.NewNonNullType(customTableName)),
			},
		},
	})

	_, hasObjRel := tablesWithObjRelInsert[customTableName]
	_, hasArrRel := tablesWithArrRelInsert[customTableName]

	insertAllowedColumns := getInsertAllowedColumns(tableMeta, tableInfo, role)
	if tableInfo.IsInsertable &&
		(role == roleAdmin || getInsertPermission(tableMeta, role) != nil ||
			hasObjRel || hasArrRel) {
		generateInsertInput(
			schema,
			tableMeta,
			tableInfo,
			customTableName,
			qualifiedName,
			insertAllowedColumns,
			md,
			role,
		)
	}

	updateAllowedColumns := getUpdateAllowedColumns(tableMeta, tableInfo, role)
	if tableInfo.IsUpdatable {
		generateJSONBInputTypes(schema, tableMeta, tableInfo, customTableName, updateAllowedColumns)
		generateIncInput(
			schema, tableMeta, tableInfo, customTableName, qualifiedName, updateAllowedColumns, md,
		)
	}

	if tableInfo.IsInsertable &&
		(role == roleAdmin || getInsertPermission(tableMeta, role) != nil) {
		generateOnConflictTypes(
			schema, tableInfo, customTableName, qualifiedName,
		)
	}

	if tableInfo.IsUpdatable &&
		(role == roleAdmin || getUpdatePermission(tableMeta, role) != nil) &&
		len(updateAllowedColumns) > 0 {
		hasJSONB := hasJSONBColumns(tableInfo, updateAllowedColumns)
		hasIncrement := hasIncrementColumns(tableInfo, updateAllowedColumns)

		if len(tableInfo.PrimaryKeys) > 0 {
			generatePkColumnsInput(schema, tableMeta, tableInfo, customTableName, qualifiedName)
		}

		generateSetInput(
			schema, tableMeta, tableInfo, customTableName, qualifiedName, updateAllowedColumns, md,
		)

		generateUpdatesInput(schema, customTableName, hasJSONB, hasIncrement)
	}

	if tableInfo.IsInsertable &&
		(role == roleAdmin || getInsertPermission(tableMeta, role) != nil) {
		hasConstraints := len(tableInfo.PrimaryKeys) > 0 || len(tableInfo.UniqueConstraints) > 0

		// _update_column enum is only referenced by _on_conflict.update_columns,
		// so it's only needed when the table has constraints (the gate for
		// _on_conflict generation).
		if hasConstraints {
			generateUpdateColumnEnum(
				schema, tableMeta, tableInfo, customTableName, qualifiedName, updateAllowedColumns,
			)
		}

		if _, ok := tablesWithObjRelInsert[customTableName]; ok {
			generateObjRelInsertInput(schema, customTableName, qualifiedName, hasConstraints)
		}

		if _, ok := tablesWithArrRelInsert[customTableName]; ok {
			generateArrRelInsertInput(schema, customTableName, qualifiedName, hasConstraints)
		}
	}
}

// generateJSONBInputTypes generates JSONB operation input types.
func generateJSONBInputTypes( //nolint:funlen
	schema *graph.Schema,
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	customTableName string,
	allowedColumns map[string]struct{},
) {
	appendFields := []*graph.InputField{}
	prependFields := []*graph.InputField{}
	deleteAtPathFields := []*graph.InputField{}
	deleteElemFields := []*graph.InputField{}
	deleteKeyFields := []*graph.InputField{}

	for _, col := range tableInfo.Columns {
		if _, ok := allowedColumns[col.Name]; !ok {
			continue
		}

		if col.Type == "jsonb" { //nolint:goconst,nolintlint
			columnName := getCustomColumnName(tableMeta, col.Name)

			colDescription := getColumnDescription(&col)

			appendFields = append(appendFields, &graph.InputField{ //nolint:exhaustruct
				Name:        columnName,
				Description: colDescription,
				Type:        graph.NewNamedType("jsonb"),
			})

			prependFields = append(prependFields, &graph.InputField{ //nolint:exhaustruct
				Name:        columnName,
				Description: colDescription,
				Type:        graph.NewNamedType("jsonb"),
			})

			deleteAtPathFields = append(deleteAtPathFields, &graph.InputField{ //nolint:exhaustruct
				Name:        columnName,
				Description: colDescription,
				Type:        graph.NewListType(graph.NewNonNullType("String")),
			})

			deleteElemFields = append(deleteElemFields, &graph.InputField{ //nolint:exhaustruct
				Name:        columnName,
				Description: colDescription,
				Type:        graph.NewNamedType("Int"),
			})

			deleteKeyFields = append(deleteKeyFields, &graph.InputField{ //nolint:exhaustruct
				Name:        columnName,
				Description: colDescription,
				Type:        graph.NewNamedType("String"),
			})
		}
	}

	if len(appendFields) > 0 {
		schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
			Name:        customTableName + "_append_input",
			Description: "append existing jsonb value of filtered columns with new jsonb value",
			Fields:      appendFields,
		})

		schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
			Name:        customTableName + "_prepend_input",
			Description: "prepend existing jsonb value of filtered columns with new jsonb value",
			Fields:      prependFields,
		})

		schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
			Name:        customTableName + "_delete_at_path_input",
			Description: "delete the field or element with specified path (for JSON arrays, negative integers count from the end)", //nolint:lll
			Fields:      deleteAtPathFields,
		})

		schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
			Name:        customTableName + "_delete_elem_input",
			Description: "delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array", //nolint:lll
			Fields:      deleteElemFields,
		})

		schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
			Name:        customTableName + "_delete_key_input",
			Description: "delete key/value pair or string element. key/value pairs are matched based on their key value",
			Fields:      deleteKeyFields,
		})
	}
}

// generatePkColumnsInput generates the pk_columns_input type.
func generatePkColumnsInput(
	schema *graph.Schema,
	tableMeta *metadata.TableMetadata,
	tableInfo *introspection.Table,
	customTableName string,
	qualifiedName string,
) {
	fields := []*graph.InputField{}

	for _, pkColName := range tableInfo.PrimaryKeys {
		for _, col := range tableInfo.Columns {
			if col.Name == pkColName {
				// PK columns are non-null.
				colType := postgresTypeToGraphQL(col.Type, false)

				fields = append(fields, &graph.InputField{ //nolint:exhaustruct
					Name:        getCustomColumnName(tableMeta, pkColName),
					Description: getColumnDescription(&col),
					Type:        colType,
				})

				break
			}
		}
	}

	schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
		Name:        customTableName + "_pk_columns_input",
		Description: "primary key columns input for table: " + qualifiedName,
		Fields:      fields,
	})
}

// generateOnConflictTypes generates on_conflict and constraint types.
func generateOnConflictTypes( //nolint:funlen
	schema *graph.Schema,
	tableInfo *introspection.Table,
	customTableName string,
	qualifiedName string,
) {
	constraintValues := []*graph.EnumValue{}

	if len(tableInfo.PrimaryKeys) > 0 {
		pkeyName := tableInfo.PrimaryKeyConstraintName
		if pkeyName == "" {
			// SQLite does not surface PK constraint names; fall back to the
			// idiomatic <table>_pkey form Postgres uses by default.
			pkeyName = tableInfo.Name + "_pkey"
		}

		var columnsSb strings.Builder
		for i, col := range tableInfo.PrimaryKeys {
			if i > 0 {
				columnsSb.WriteString(`", "`)
			}

			columnsSb.WriteString(col)
		}

		columns := columnsSb.String()

		constraintValues = append(constraintValues, &graph.EnumValue{ //nolint:exhaustruct
			Name: pkeyName,
			Description: fmt.Sprintf(
				`unique or primary key constraint on columns "%s"`,
				columns,
			),
		})
	}

	for _, constraint := range tableInfo.UniqueConstraints {
		var columnsSb strings.Builder
		for i, col := range constraint.Columns {
			if i > 0 {
				columnsSb.WriteString(`", "`)
			}

			columnsSb.WriteString(col)
		}

		columns := columnsSb.String()

		constraintValues = append(constraintValues, &graph.EnumValue{ //nolint:exhaustruct
			Name: constraint.Name,
			Description: fmt.Sprintf(
				`unique or primary key constraint on columns "%s"`,
				columns,
			),
		})
	}

	if len(constraintValues) > 0 {
		schema.Enums = append(schema.Enums, &graph.EnumType{ //nolint:exhaustruct
			Name: customTableName + "_constraint",
			Description: fmt.Sprintf(
				`unique or primary key constraints on table "%s"`,
				qualifiedName,
			),
			Values: constraintValues,
		})

		emptyArrayDefault := "[]"
		schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
			Name: customTableName + "_on_conflict",
			Description: fmt.Sprintf(
				`on_conflict condition type for table "%s"`,
				qualifiedName,
			),
			Fields: []*graph.InputField{
				{
					Name: "constraint",
					Type: graph.NewNonNullType(customTableName + "_constraint"),
				},
				{
					Name: "update_columns",
					Type: graph.NewNonNullListType(
						graph.NewNonNullType(customTableName + "_update_column"),
					),
					DefaultValue: &emptyArrayDefault,
				},
				{
					Name: "where",
					Type: graph.NewNamedType(customTableName + "_bool_exp"),
				},
			},
		})
	}
}

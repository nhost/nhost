package arguments

import (
	"fmt"
	"slices"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/permissions"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
)

// OnConflict represents a parsed on_conflict argument.
type OnConflict struct {
	ConstraintName string
	UpdateColumns  []string
	Where          where.Clause
}

// ToSQL generates the SQL ON CONFLICT clause with parameters.
// For example:
//
//	ON CONFLICT ON CONSTRAINT users_pkey
//	DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name
//	WHERE is_active = true
//
// Returns the SQL fragment, updated params slice, and updated param index.
func (oc *OnConflict) ToSQL(
	b *strings.Builder,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	if oc == nil {
		return params, paramIndex, nil
	}

	b.WriteString(" ON CONFLICT ON CONSTRAINT ")
	core.WriteQuotedIdentifier(b, oc.ConstraintName)

	if len(oc.UpdateColumns) == 0 {
		b.WriteString(" DO NOTHING")

		return params, paramIndex, nil
	}

	b.WriteString(" DO UPDATE SET ")

	for i, col := range oc.UpdateColumns {
		if i > 0 {
			b.WriteString(", ")
		}

		core.WriteQuotedIdentifier(b, col)
		b.WriteString(" = EXCLUDED.")
		core.WriteQuotedIdentifier(b, col)
	}

	if len(oc.Where) > 0 {
		b.WriteString(" WHERE ")

		var err error

		params, paramIndex, err = oc.Where.WriteCondition(b, "EXCLUDED", params, paramIndex)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to write on_conflict where clause: %w", err)
		}
	}

	return params, paramIndex, nil
}

// ParseOnConflict parses the on_conflict argument from GraphQL.
// The input format is:
//
//	{
//	  constraint: users_constraint_enum_value
//	  update_columns: [column1, column2]
//	  where: { column: { _eq: value } }
//	}
func ParseOnConflict( //nolint:funlen
	t Table,
	onConflictArg *ast.Argument,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
) (*OnConflict, error) {
	if onConflictArg == nil {
		return nil, nil //nolint:nilnil
	}

	onConflictValue, err := values.ResolveVariable(onConflictArg.Value, variables)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve on_conflict: %w", err)
	}

	if onConflictValue.Kind != ast.ObjectValue {
		return nil, fmt.Errorf("%w: on_conflict must be an object", ErrInvalidArgument)
	}

	oc := &OnConflict{
		UpdateColumns:  []string{},
		ConstraintName: "",
		Where:          nil,
	}

	for _, field := range onConflictValue.Children {
		switch field.Name {
		case "constraint":
			if field.Value.Kind != ast.EnumValue {
				return nil, fmt.Errorf(
					"%w: constraint must be an enum value", ErrInvalidArgument,
				)
			}

			oc.ConstraintName = field.Value.Raw

		case "update_columns":
			children, err := values.CoerceToChildValueList(field.Value, ast.EnumValue)
			if err != nil {
				return nil, fmt.Errorf(
					"%w: update_columns must be a list or an enum value",
					ErrInvalidArgument,
				)
			}

			for _, col := range children {
				if col.Value.Kind != ast.EnumValue {
					return nil, fmt.Errorf(
						"%w: update_columns must contain enum values",
						ErrInvalidArgument,
					)
				}

				colName := col.Value.Raw

				column := t.ColumnFromGraphqlName(colName)
				if column == nil {
					return nil, fmt.Errorf(
						"%w: column %s not found in table %s",
						ErrInvalidArgument,
						colName,
						t.TableName(),
					)
				}

				oc.UpdateColumns = append(oc.UpdateColumns, column.SQLName)
			}

		case argNameWhere:
			whereClause, err := t.ParseWhere(
				field.Value, variables, role, sessionVariables, 0, where.QueryAliases,
			)
			if err != nil {
				return nil, fmt.Errorf("failed to parse on_conflict.where: %w", err)
			}

			oc.Where = whereClause
		}
	}

	if oc.ConstraintName == "" {
		return nil, fmt.Errorf("%w: on_conflict.constraint is required", ErrInvalidArgument)
	}

	return oc, nil
}

// NestedInsert is a single nested insert spec parsed from a relationship field
// inside an insert object. The CTE-building method that consumes this lives in
// the parent queries package because it needs queries-internal table state
// (buildSingleInsertCTE) — NestedInsert itself is pure data plus the
// FK-application helper.
type NestedInsert struct {
	RelationshipName    string
	TargetTable         Table
	NestedObject        InsertObject
	OnConflict          *OnConflict
	ForeignKeyColumns   []string
	IsArrayRelationship bool
}

// ApplyArrayFKColumn appends the FK columns to the nested object (so they
// appear in the INSERT column list) and registers each one against the parent
// CTE. Only array relationships need this; for object relationships the parent
// owns the FK. Composite FKs are handled by iterating every column in
// ForeignKeyColumns.
//
// The FK-index entry is added unconditionally for array relationships, even
// when ColumnFromSQLName can't resolve a given FK column on the child table.
// The asymmetry is deliberate, per column: downstream consumers
// (buildInsertFromClause in the parent queries package) iterate the returned
// map to add the parent CTE to the FROM clause so that Postgres actually
// executes it. Skipping the map entry when the column resolution fails would
// drop the parent CTE from FROM and silently break the nested-insert chain.
// The buildInsertSelectClause iterates the column list (not the FK index) so
// a missing FK column there simply produces a SELECT that does not reference
// the parent — which is the correct outcome when the schema says no such FK
// column exists.
func (n *NestedInsert) ApplyArrayFKColumn(parentCTEName string) map[string]string {
	nestedFKIndex := make(map[string]string)
	if !n.IsArrayRelationship {
		return nestedFKIndex
	}

	for _, fkName := range n.ForeignKeyColumns {
		if fkColumn := n.TargetTable.ColumnFromSQLName(fkName); fkColumn != nil {
			n.NestedObject.Columns = append(n.NestedObject.Columns, InsertColumn{
				Column: fkColumn,
				Value:  nil,
			})
		}

		nestedFKIndex[fkName] = parentCTEName
	}

	return nestedFKIndex
}

// InsertColumn is a column/value pair in an insert object.
type InsertColumn struct {
	Column *core.Column
	Value  any
}

// InsertObject is a parsed insert object: the columns to insert plus any
// nested-insert children.
type InsertObject struct {
	Columns       []InsertColumn
	NestedInserts []NestedInsert
}

// ColumnNames returns the SQL names of the columns in the insert object, in
// the order they appear.
func (a *InsertObject) ColumnNames() []string {
	names := make([]string, len(a.Columns))
	for i, col := range a.Columns {
		names[i] = col.Column.SQLName
	}

	return names
}

// ParseInsert parses the arguments for an insert_one mutation. It extracts the
// object argument which contains the columns and values to insert.
func ParseInsert(
	t Table,
	arguments ast.ArgumentList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
) (InsertObject, *OnConflict, error) {
	objectArg := arguments.ForName("object")
	if objectArg == nil {
		return InsertObject{}, nil, fmt.Errorf(
			"%w: missing required argument: object", ErrInvalidArgument,
		)
	}

	objectValue, err := values.ResolveVariable(objectArg.Value, variables)
	if err != nil {
		return InsertObject{}, nil, fmt.Errorf("failed to resolve object: %w", err)
	}

	if objectValue.Kind != ast.ObjectValue {
		return InsertObject{}, nil, fmt.Errorf(
			"%w: object argument must be an object", ErrInvalidArgument,
		)
	}

	insertObj, err := parseInsertObject(t, objectValue, variables, role, sessionVariables)
	if err != nil {
		return InsertObject{}, nil, err
	}

	onConflictArg := arguments.ForName("on_conflict")

	onConflict, err := ParseOnConflict(t, onConflictArg, variables, role, sessionVariables)
	if err != nil {
		return InsertObject{}, nil, fmt.Errorf("failed to parse on_conflict: %w", err)
	}

	return insertObj, onConflict, nil
}

// ParseInsertCollection parses the arguments for an insert mutation (multiple
// rows). It extracts the objects argument which contains an array of objects
// to insert.
func ParseInsertCollection(
	t Table,
	arguments ast.ArgumentList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
) ([]InsertObject, *OnConflict, error) {
	objectsArg := arguments.ForName("objects")
	if objectsArg == nil {
		return nil, nil, fmt.Errorf(
			"%w: missing required argument: objects", ErrInvalidArgument,
		)
	}

	objectsValue, err := values.ResolveVariable(objectsArg.Value, variables)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to resolve objects: %w", err)
	}

	// GraphQL input coercion: a single object is accepted in place of a list.
	children, err := values.CoerceToChildValueList(objectsValue, ast.ObjectValue)
	if err != nil {
		return nil, nil, fmt.Errorf(
			"%w: objects argument must be a list or an object", ErrInvalidArgument,
		)
	}

	if len(children) == 0 {
		return nil, nil, fmt.Errorf(
			"%w: objects array cannot be empty", ErrInvalidArgument,
		)
	}

	insertObjs := make([]InsertObject, 0, len(children))

	for _, child := range children {
		if child.Value.Kind != ast.ObjectValue {
			return nil, nil, fmt.Errorf(
				"%w: each element in objects must be an object", ErrInvalidArgument,
			)
		}

		insertObj, err := parseInsertObject(t, child.Value, variables, role, sessionVariables)
		if err != nil {
			return nil, nil, err
		}

		insertObjs = append(insertObjs, insertObj)
	}

	onConflictArg := arguments.ForName("on_conflict")

	onConflict, err := ParseOnConflict(t, onConflictArg, variables, role, sessionVariables)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse on_conflict: %w", err)
	}

	return insertObjs, onConflict, nil
}

// parseInsertObject parses a single insert object value. Shared between
// insert_one and insert (multiple).
func parseInsertObject(
	t Table,
	objectValue *ast.Value,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
) (InsertObject, error) {
	columns := make([]InsertColumn, 0, len(objectValue.Children))
	nestedInserts := make([]NestedInsert, 0)

	for _, child := range objectValue.Children {
		customFieldName := child.Name

		relationship := t.Relationship(customFieldName)
		if relationship != nil {
			nested, err := parseNestedInsert(
				t, child, customFieldName, relationship, variables, role, sessionVariables,
			)
			if err != nil {
				return InsertObject{}, fmt.Errorf(
					"failed to parse nested insert for %s: %w", customFieldName, err,
				)
			}

			nestedInserts = append(nestedInserts, nested)

			continue
		}

		column := t.ColumnFromGraphqlName(customFieldName)
		if column == nil {
			return InsertObject{}, fmt.Errorf(
				"%w: column %s not found in table %s",
				ErrInvalidArgument,
				customFieldName,
				t.TableName(),
			)
		}

		value, err := values.ResolveASTValue(child.Value, variables)
		if err != nil {
			return InsertObject{}, fmt.Errorf(
				"failed to resolve field %s: %w",
				customFieldName,
				err,
			)
		}

		columns = append(columns, InsertColumn{
			Column: column,
			Value:  value,
		})
	}

	insertObj := InsertObject{
		Columns:       columns,
		NestedInserts: nestedInserts,
	}

	if err := ApplyInsertPresets(t, &insertObj, role, sessionVariables); err != nil {
		return InsertObject{}, fmt.Errorf("failed to apply insert presets: %w", err)
	}

	return insertObj, nil
}

// ApplyInsertPresets adds preset columns and values to the insert object.
// Presets are column values automatically set by the server based on
// permissions.
func ApplyInsertPresets(
	t Table,
	insertObj *InsertObject,
	role string,
	sessionVariables map[string]any,
) error {
	presets := t.InsertPresets(role)
	if len(presets) == 0 {
		return nil
	}

	// Iterate in sorted order so the column list (and resulting SQL/parameters)
	// is deterministic across runs — Go map iteration is randomized.
	colNames := make([]string, 0, len(presets))
	for colName := range presets {
		colNames = append(colNames, colName)
	}

	slices.Sort(colNames)

	for _, colName := range colNames {
		presetValue := presets[colName]

		col := t.ColumnFromSQLName(colName)
		if col == nil {
			return fmt.Errorf(
				"%w: preset column %s not found in table %s",
				ErrInvalidArgument,
				colName,
				t.TableName(),
			)
		}

		value, err := permissions.SubstituteSessionVariable(presetValue, sessionVariables)
		if err != nil {
			return fmt.Errorf(
				"failed to substitute session variable for preset column %s: %w",
				colName,
				err,
			)
		}

		insertObj.Columns = append(insertObj.Columns, InsertColumn{
			Column: col,
			Value:  value,
		})
	}

	return nil
}

// parseNestedInsert parses a nested insert via a relationship.
func parseNestedInsert( //nolint:funlen
	_ Table,
	child *ast.ChildValue,
	fieldName string,
	relationship Relationship,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
) (NestedInsert, error) {
	// Resolve the field value (could be a variable)
	fieldValue, err := values.ResolveVariable(child.Value, variables)
	if err != nil {
		return NestedInsert{}, fmt.Errorf(
			"failed to resolve nested insert for %s: %w",
			fieldName,
			err,
		)
	}

	// Nested inserts have the format: {data: {...}, on_conflict: {...}}
	if fieldValue.Kind != ast.ObjectValue {
		return NestedInsert{}, fmt.Errorf(
			"%w: nested insert for %s must be an object",
			ErrInvalidArgument,
			fieldName,
		)
	}

	nestedChild := fieldValue.Children.ForName("data")
	if nestedChild == nil {
		return NestedInsert{}, fmt.Errorf(
			"%w: missing data field for nested insert on relationship %s",
			ErrInvalidArgument,
			fieldName,
		)
	}

	nestedArguments := ast.ArgumentList{
		&ast.Argument{ //nolint:exhaustruct
			Name:  "object",
			Value: nestedChild,
		},
	}

	onConflictChild := fieldValue.Children.ForName("on_conflict")
	if onConflictChild != nil {
		nestedArguments = append(nestedArguments, &ast.Argument{ //nolint:exhaustruct
			Name:  "on_conflict",
			Value: onConflictChild,
		})
	}

	target := relationship.TargetTable()

	nestedInsertObj, onConflict, err := ParseInsert(
		target,
		nestedArguments,
		variables,
		role,
		sessionVariables,
	)
	if err != nil {
		return NestedInsert{}, fmt.Errorf(
			"failed to parse nested insert for %s: %w",
			fieldName,
			err,
		)
	}

	return NestedInsert{
		RelationshipName:    fieldName,
		TargetTable:         target,
		NestedObject:        nestedInsertObj,
		OnConflict:          onConflict,
		ForeignKeyColumns:   relationship.FKColumns(),
		IsArrayRelationship: relationship.IsArray(),
	}, nil
}

package arguments

import (
	"fmt"
	"slices"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/permissions"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
)

// OnConflict represents a parsed on_conflict argument.
type OnConflict struct {
	ConstraintName string
	// ConflictColumns are the SQL column names backing ConstraintName, resolved
	// at parse time from the table's introspected constraints. SQLite renders the
	// conflict target as a column list ("ON CONFLICT (col, ...)") because it has
	// no "ON CONSTRAINT <name>" form; PostgreSQL names the constraint and ignores
	// these. Empty when the constraint has no resolvable columns.
	ConflictColumns []string
	UpdateColumns   []string
	Where           where.Clause
	// TargetTableRef is the quoted table reference used to qualify
	// on_conflict.where predicates. PostgreSQL evaluates that predicate against
	// the existing conflict-target row, not the EXCLUDED/incoming row.
	TargetTableRef string
}

// OnConflictWhereWriter appends an additional DO UPDATE WHERE predicate.
// It returns hasCondition=false when nothing was written.
type OnConflictWhereWriter func(
	b *strings.Builder,
	params []any,
	paramIndex int,
) ([]any, int, bool, error)

// ToSQL generates the SQL ON CONFLICT clause with parameters.
// For example (PostgreSQL):
//
//	ON CONFLICT ON CONSTRAINT users_pkey
//	DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name
//	WHERE is_active = true
//
// The conflict target is rendered through the dialect, so SQLite emits
// "ON CONFLICT (\"col\", ...)" instead of the constraint-name form.
// Returns the SQL fragment, updated params slice, and updated param index.
func (oc *OnConflict) ToSQL(
	b *strings.Builder,
	d dialect.Dialect,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	return oc.ToSQLWithWhere(b, d, params, paramIndex, nil)
}

// ToSQLWithWhere generates the SQL ON CONFLICT clause and AND-combines an
// optional server-side predicate into DO UPDATE WHERE. The conflict target is
// rendered through the dialect (constraint name for PostgreSQL, column list for
// SQLite).
func (oc *OnConflict) ToSQLWithWhere(
	b *strings.Builder,
	d dialect.Dialect,
	params []any,
	paramIndex int,
	extraWhere OnConflictWhereWriter,
) ([]any, int, error) {
	if oc == nil {
		return params, paramIndex, nil
	}

	if err := d.WriteOnConflictTarget(b, oc.ConstraintName, oc.ConflictColumns); err != nil {
		return nil, 0, fmt.Errorf(
			"%w: failed to write on_conflict target: %w",
			ErrInvalidArgument,
			err,
		)
	}

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

	params, paramIndex, err := oc.writeWhere(b, params, paramIndex, extraWhere)
	if err != nil {
		return nil, 0, err
	}

	return params, paramIndex, nil
}

func (oc *OnConflict) writeWhere(
	b *strings.Builder,
	params []any,
	paramIndex int,
	extraWhere OnConflictWhereWriter,
) ([]any, int, error) {
	hasWhere := false

	if len(oc.Where) > 0 {
		b.WriteString(" WHERE ")

		var err error

		whereSource := oc.TargetTableRef
		if whereSource == "" {
			whereSource = "EXCLUDED"
		}

		params, paramIndex, err = oc.Where.WriteCondition(b, whereSource, params, paramIndex)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to write on_conflict where clause: %w", err)
		}

		hasWhere = true
	}

	if extraWhere == nil {
		return params, paramIndex, nil
	}

	var extra strings.Builder

	var (
		hasExtra bool
		err      error
	)

	params, paramIndex, hasExtra, err = extraWhere(&extra, params, paramIndex)
	if err != nil {
		return nil, 0, err
	}

	if !hasExtra {
		return params, paramIndex, nil
	}

	if hasWhere {
		b.WriteString(" AND (")
	} else {
		b.WriteString(" WHERE (")
	}

	b.WriteString(extra.String())
	b.WriteByte(')')

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
func ParseOnConflict(
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
		UpdateColumns:   []string{},
		ConstraintName:  "",
		ConflictColumns: nil,
		Where:           nil,
		TargetTableRef:  "",
	}

	for _, field := range onConflictValue.Children {
		switch field.Name {
		case "constraint":
			constraintName, err := parseOnConflictConstraint(field.Value, variables)
			if err != nil {
				return nil, err
			}

			oc.ConstraintName = constraintName

		case "update_columns":
			updateColumns, err := parseOnConflictUpdateColumns(t, field.Value, variables)
			if err != nil {
				return nil, err
			}

			oc.UpdateColumns = append(oc.UpdateColumns, updateColumns...)

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

	if err := resolveOnConflictTarget(t, oc); err != nil {
		return nil, err
	}

	return oc, nil
}

func resolveOnConflictTarget(t Table, oc *OnConflict) error {
	// SQLite identifies the conflict target by column list, so resolve the named
	// constraint's columns now (while the table's introspected metadata is in
	// scope). PostgreSQL ignores these and names the constraint directly.
	oc.ConflictColumns = t.ConflictColumns(oc.ConstraintName)
	if len(oc.ConflictColumns) == 0 && t.Dialect().RequiresOnConflictTargetColumns() {
		return fmt.Errorf(
			"%w: on_conflict.constraint %q does not resolve to any conflict columns",
			ErrInvalidArgument,
			oc.ConstraintName,
		)
	}

	oc.TargetTableRef = t.TableFromClause()

	return nil
}

func parseOnConflictConstraint(value *ast.Value, variables map[string]any) (string, error) {
	constraintValue, err := values.ResolveVariable(value, variables)
	if err != nil {
		return "", fmt.Errorf("failed to resolve on_conflict.constraint: %w", err)
	}

	if constraintValue.Kind != ast.EnumValue {
		return "", fmt.Errorf("%w: constraint must be an enum value", ErrInvalidArgument)
	}

	return constraintValue.Raw, nil
}

func parseOnConflictUpdateColumns(
	t Table, value *ast.Value, variables map[string]any,
) ([]string, error) {
	updateColumnsValue, err := values.ResolveVariable(value, variables)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve on_conflict.update_columns: %w", err)
	}

	children, err := values.CoerceToChildValueList(updateColumnsValue, ast.EnumValue)
	if err != nil {
		return nil, fmt.Errorf(
			"%w: update_columns must be a list or an enum value",
			ErrInvalidArgument,
		)
	}

	updateColumns := make([]string, 0, len(children))
	for _, col := range children {
		columnName, err := parseOnConflictUpdateColumnName(col.Value, variables)
		if err != nil {
			return nil, err
		}

		column := t.ColumnFromGraphqlName(columnName)
		if column == nil {
			return nil, fmt.Errorf(
				"%w: column %s not found in table %s",
				ErrInvalidArgument,
				columnName,
				t.TableName(),
			)
		}

		updateColumns = append(updateColumns, column.SQLName)
	}

	return updateColumns, nil
}

func parseOnConflictUpdateColumnName(value *ast.Value, variables map[string]any) (string, error) {
	columnValue, err := values.ResolveVariable(value, variables)
	if err != nil {
		return "", fmt.Errorf("failed to resolve on_conflict.update_columns: %w", err)
	}

	if columnValue.Kind != ast.EnumValue {
		return "", fmt.Errorf("%w: update_columns must contain enum values", ErrInvalidArgument)
	}

	return columnValue.Raw, nil
}

// NestedFKSource describes where a nested-insert FK column reads its value
// from. CTEName is the source CTE alias and ColumnName is the column selected
// from that CTE.
type NestedFKSource struct {
	CTEName    string
	ColumnName string
}

// NestedFKSources maps the insert-row FK column to the CTE column that supplies
// its value.
type NestedFKSources map[string]NestedFKSource

// NestedInsert is a single nested insert spec parsed from a relationship field
// inside an insert object. The CTE-building method that consumes this lives in
// the parent queries package because it needs queries-internal table state
// (buildSingleInsertCTE) — NestedInsert itself is pure data plus the
// FK-application helper.
//
// NestedObjects holds one element for object relationships and one-or-more
// elements for array relationships (Hasura accepts both `data: {...}` and
// `data: [{...}, ...]` for array relationships via GraphQL list-input
// coercion).
type NestedInsert struct {
	RelationshipName        string
	TargetTable             Table
	NestedObjects           []InsertObject
	OnConflict              *OnConflict
	ForeignKeyColumns       []string
	ForeignKeySourceColumns map[string]string
	IsArrayRelationship     bool
}

// ApplyArrayFKColumn appends the FK columns to every nested object (so they
// appear in the INSERT column list) and registers each one against the parent
// CTE. Only array relationships need this; for object relationships the parent
// owns the FK. Composite FKs are handled by iterating every FK/source-column
// mapping.
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
func (n *NestedInsert) ApplyArrayFKColumn(parentCTEName string) (NestedFKSources, error) {
	nestedFKIndex := make(NestedFKSources)
	if !n.IsArrayRelationship {
		return nestedFKIndex, nil
	}

	for _, fkName := range n.foreignKeyColumnsToPopulate() {
		sourceColumn, ok := n.ForeignKeySourceColumns[fkName]
		if !ok || sourceColumn == "" {
			return nil, fmt.Errorf(
				"%w: nested insert %s: missing source column for FK %s",
				ErrInvalidArgument,
				n.RelationshipName,
				fkName,
			)
		}

		fkColumn := n.TargetTable.ColumnFromSQLName(fkName)
		if fkColumn != nil {
			for i := range n.NestedObjects {
				n.NestedObjects[i].Columns = append(n.NestedObjects[i].Columns, InsertColumn{
					Column: fkColumn,
					Value:  nil,
				})
			}
		}

		nestedFKIndex[fkName] = NestedFKSource{
			CTEName:    parentCTEName,
			ColumnName: sourceColumn,
		}
	}

	return nestedFKIndex, nil
}

func (n *NestedInsert) foreignKeyColumnsToPopulate() []string {
	if len(n.ForeignKeySourceColumns) == 0 {
		return append([]string{}, n.ForeignKeyColumns...)
	}

	columns := make([]string, 0, len(n.ForeignKeySourceColumns))
	seen := make(map[string]struct{}, len(n.ForeignKeySourceColumns))

	for _, fkName := range n.ForeignKeyColumns {
		if _, ok := n.ForeignKeySourceColumns[fkName]; !ok {
			continue
		}

		columns = append(columns, fkName)
		seen[fkName] = struct{}{}
	}

	extraColumns := make([]string, 0, len(n.ForeignKeySourceColumns)-len(columns))
	for fkName := range n.ForeignKeySourceColumns {
		if _, ok := seen[fkName]; ok {
			continue
		}

		extraColumns = append(extraColumns, fkName)
	}

	slices.Sort(extraColumns)

	return append(columns, extraColumns...)
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

		column, err := parseInsertColumn(t, child, customFieldName, variables)
		if err != nil {
			return InsertObject{}, err
		}

		columns = append(columns, column)
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

func parseInsertColumn(
	t Table,
	child *ast.ChildValue,
	customFieldName string,
	variables map[string]any,
) (InsertColumn, error) {
	column := t.ColumnFromGraphqlName(customFieldName)
	if column == nil {
		return InsertColumn{}, fmt.Errorf(
			"%w: column %s not found in table %s",
			ErrInvalidArgument,
			customFieldName,
			t.TableName(),
		)
	}

	value, err := values.ResolveASTValue(child.Value, variables)
	if err != nil {
		return InsertColumn{}, fmt.Errorf(
			"failed to resolve field %s: %w",
			customFieldName,
			err,
		)
	}

	value, err = values.CoerceSQLValue(column.SQLType, value)
	if err != nil {
		return InsertColumn{}, fmt.Errorf(
			"failed to coerce field %s: %w",
			customFieldName,
			err,
		)
	}

	return InsertColumn{
		Column: column,
		Value:  value,
	}, nil
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

		value, err = values.CoerceSQLValue(col.SQLType, value)
		if err != nil {
			return fmt.Errorf("failed to coerce preset column %s: %w", colName, err)
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

	// Nested inserts have the format: {data: {...} | [{...}, ...], on_conflict: {...}}
	if fieldValue.Kind != ast.ObjectValue {
		return NestedInsert{}, fmt.Errorf(
			"%w: nested insert for %s must be an object",
			ErrInvalidArgument,
			fieldName,
		)
	}

	dataChild := fieldValue.Children.ForName("data")
	if dataChild == nil {
		return NestedInsert{}, fmt.Errorf(
			"%w: missing data field for nested insert on relationship %s",
			ErrInvalidArgument,
			fieldName,
		)
	}

	dataValue, err := values.ResolveVariable(dataChild, variables)
	if err != nil {
		return NestedInsert{}, fmt.Errorf(
			"failed to resolve nested data for %s: %w", fieldName, err,
		)
	}

	target := relationship.TargetTable()
	isArray := relationship.IsArray()

	nestedObjects, err := parseNestedDataObjects(
		target, dataValue, fieldName, isArray, variables, role, sessionVariables,
	)
	if err != nil {
		return NestedInsert{}, err
	}

	var onConflict *OnConflict

	if onConflictChild := fieldValue.Children.ForName("on_conflict"); onConflictChild != nil {
		onConflict, err = ParseOnConflict(
			target, &ast.Argument{ //nolint:exhaustruct
				Name:  "on_conflict",
				Value: onConflictChild,
			}, variables, role, sessionVariables,
		)
		if err != nil {
			return NestedInsert{}, fmt.Errorf(
				"failed to parse on_conflict for nested insert %s: %w", fieldName, err,
			)
		}
	}

	return NestedInsert{
		RelationshipName:        fieldName,
		TargetTable:             target,
		NestedObjects:           nestedObjects,
		OnConflict:              onConflict,
		ForeignKeyColumns:       relationship.FKColumns(),
		ForeignKeySourceColumns: relationship.FKSourceColumns(),
		IsArrayRelationship:     isArray,
	}, nil
}

// parseNestedDataObjects parses the `data` field of a nested insert into a
// slice of InsertObjects. For object relationships exactly one element is
// produced; array relationships accept a list (GraphQL input coercion lets a
// single object stand in for a singleton list).
func parseNestedDataObjects(
	target Table,
	dataValue *ast.Value,
	fieldName string,
	isArray bool,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
) ([]InsertObject, error) {
	if !isArray {
		if dataValue.Kind != ast.ObjectValue {
			return nil, fmt.Errorf(
				"%w: data for object relationship %s must be an object",
				ErrInvalidArgument, fieldName,
			)
		}

		obj, err := parseInsertObject(target, dataValue, variables, role, sessionVariables)
		if err != nil {
			return nil, fmt.Errorf("failed to parse nested insert for %s: %w", fieldName, err)
		}

		return []InsertObject{obj}, nil
	}

	children, err := values.CoerceToChildValueList(dataValue, ast.ObjectValue)
	if err != nil {
		return nil, fmt.Errorf(
			"%w: data for array relationship %s must be a list of objects",
			ErrInvalidArgument, fieldName,
		)
	}

	if len(children) == 0 {
		return nil, fmt.Errorf(
			"%w: data for array relationship %s cannot be empty",
			ErrInvalidArgument, fieldName,
		)
	}

	objects := make([]InsertObject, 0, len(children))

	for _, c := range children {
		if c.Value.Kind != ast.ObjectValue {
			return nil, fmt.Errorf(
				"%w: each element of data for array relationship %s must be an object",
				ErrInvalidArgument, fieldName,
			)
		}

		obj, err := parseInsertObject(target, c.Value, variables, role, sessionVariables)
		if err != nil {
			return nil, fmt.Errorf("failed to parse nested insert for %s: %w", fieldName, err)
		}

		objects = append(objects, obj)
	}

	return objects, nil
}

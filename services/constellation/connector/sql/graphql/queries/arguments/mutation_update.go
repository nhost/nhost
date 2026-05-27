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

// updateColumn is a (column, value) pair used by _set / _inc / _append /
// _prepend / _delete_key / _delete_elem.
type updateColumn struct {
	Column *core.Column
	Value  any
}

// updateDeleteAtPath is the (column, path) pair for the _delete_at_path JSONB
// operator.
type updateDeleteAtPath struct {
	Column *core.Column
	Path   []string
}

// Update is a parsed update mutation argument set.
type Update struct {
	Set          []updateColumn
	Inc          []updateColumn
	AppendJSONB  []updateColumn
	PrependJSONB []updateColumn
	DeleteKey    []updateColumn
	DeleteElem   []updateColumn
	DeleteAtPath []updateDeleteAtPath

	Where where.Clause
}

// WriteSQL writes the SET clause of an UPDATE statement (all variants of the
// update operators) using the given dialect for placeholders and type casts.
func (a Update) WriteSQL( //nolint:funlen
	b *strings.Builder,
	params []any,
	paramIndex int,
	dialect dialect.Dialect,
) ([]any, int) {
	firstSet := true

	for i, col := range a.Set {
		if !firstSet {
			b.WriteString(", ")
		}

		firstSet = false

		core.WriteQuotedIdentifier(b, col.Column.SQLName)
		b.WriteString(" = ")
		b.WriteString(dialect.TypeCast(dialect.Placeholder(paramIndex), col.Column.SQLType))

		params = append(params, a.Set[i].Value)

		paramIndex++
	}

	for i, col := range a.Inc {
		if !firstSet {
			b.WriteString(", ")
		}

		firstSet = false

		core.WriteQuotedIdentifier(b, col.Column.SQLName)
		b.WriteString(" = ")
		core.WriteQuotedIdentifier(b, col.Column.SQLName)
		b.WriteString(" + ")
		b.WriteString(dialect.TypeCast(dialect.Placeholder(paramIndex), col.Column.SQLType))

		params = append(params, a.Inc[i].Value)
		paramIndex++
	}

	for i, col := range a.AppendJSONB {
		if !firstSet {
			b.WriteString(", ")
		}

		firstSet = false

		core.WriteQuotedIdentifier(b, col.Column.SQLName)
		b.WriteString(" = ")
		core.WriteQuotedIdentifier(b, col.Column.SQLName)
		b.WriteString(" || ")
		b.WriteString(dialect.TypeCast(dialect.Placeholder(paramIndex), "jsonb"))

		params = append(params, a.AppendJSONB[i].Value)
		paramIndex++
	}

	for i, col := range a.PrependJSONB {
		if !firstSet {
			b.WriteString(", ")
		}

		firstSet = false

		core.WriteQuotedIdentifier(b, col.Column.SQLName)
		b.WriteString(" = ")
		b.WriteString(dialect.TypeCast(dialect.Placeholder(paramIndex), "jsonb"))
		b.WriteString(" || ")
		core.WriteQuotedIdentifier(b, col.Column.SQLName)

		params = append(params, a.PrependJSONB[i].Value)
		paramIndex++
	}

	for i, col := range a.DeleteKey {
		if !firstSet {
			b.WriteString(", ")
		}

		firstSet = false

		core.WriteQuotedIdentifier(b, col.Column.SQLName)
		b.WriteString(" = ")
		core.WriteQuotedIdentifier(b, col.Column.SQLName)
		b.WriteString(" - ")
		b.WriteString(dialect.Placeholder(paramIndex))

		params = append(params, a.DeleteKey[i].Value)
		paramIndex++
	}

	for i, col := range a.DeleteElem {
		if !firstSet {
			b.WriteString(", ")
		}

		firstSet = false

		core.WriteQuotedIdentifier(b, col.Column.SQLName)
		b.WriteString(" = ")
		core.WriteQuotedIdentifier(b, col.Column.SQLName)
		b.WriteString(" - ")
		b.WriteString(dialect.TypeCast(dialect.Placeholder(paramIndex), "int"))

		params = append(params, a.DeleteElem[i].Value)
		paramIndex++
	}

	for i, col := range a.DeleteAtPath {
		if !firstSet {
			b.WriteString(", ")
		}

		firstSet = false

		core.WriteQuotedIdentifier(b, col.Column.SQLName)
		b.WriteString(" = ")
		core.WriteQuotedIdentifier(b, col.Column.SQLName)
		b.WriteString(" #- ")
		b.WriteString(dialect.TypeCast(dialect.Placeholder(paramIndex), "text[]"))

		params = append(params, a.DeleteAtPath[i].Path)
		paramIndex++
	}

	return params, paramIndex
}

// ParseUpdate parses the arguments for an update mutation. It extracts the
// _set, _inc, _append, _prepend, _delete_key, _delete_elem, _delete_at_path
// operators and the where clause / pk_columns selector.
func ParseUpdate( //nolint:cyclop,funlen,gocognit
	t Table,
	arguments ast.ArgumentList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
) (Update, error) {
	var (
		set, inc     []updateColumn
		appendCols   []updateColumn
		prependCols  []updateColumn
		deleteKey    []updateColumn
		deleteElem   []updateColumn
		deleteAtPath []updateDeleteAtPath
		whereClause  where.Clause
		err          error
	)

	for _, arg := range arguments {
		switch arg.Name {
		case "_set":
			set, err = parseupdateColumnList(t, arg.Value, variables)
			if err != nil {
				return Update{}, fmt.Errorf("failed to parse _set: %w", err)
			}
		case "_inc":
			inc, err = parseupdateColumnList(t, arg.Value, variables)
			if err != nil {
				return Update{}, fmt.Errorf("failed to parse _inc: %w", err)
			}
		case "_append":
			appendCols, err = parseupdateColumnList(t, arg.Value, variables)
			if err != nil {
				return Update{}, fmt.Errorf("failed to parse _append: %w", err)
			}
		case "_prepend":
			prependCols, err = parseupdateColumnList(t, arg.Value, variables)
			if err != nil {
				return Update{}, fmt.Errorf("failed to parse _prepend: %w", err)
			}
		case "_delete_key":
			deleteKey, err = parseupdateColumnList(t, arg.Value, variables)
			if err != nil {
				return Update{}, fmt.Errorf("failed to parse _delete_key: %w", err)
			}
		case "_delete_elem":
			deleteElem, err = parseupdateColumnList(t, arg.Value, variables)
			if err != nil {
				return Update{}, fmt.Errorf("failed to parse _delete_elem: %w", err)
			}
		case "_delete_at_path":
			deleteAtPath, err = parseDeleteAtPathArgumentValue(t, arg.Value, variables)
			if err != nil {
				return Update{}, fmt.Errorf("failed to parse _delete_at_path: %w", err)
			}
		case argNameWhere:
			whereClause, err = t.ParseWhere(
				arg.Value, variables, role, sessionVariables, 0, where.QueryAliases,
			)
			if err != nil {
				return Update{}, fmt.Errorf("failed to parse where clause: %w", err)
			}
		case "pk_columns":
			whereClause, err = parsePkColumnsArgument(t, arg.Value, variables)
			if err != nil {
				return Update{}, fmt.Errorf("failed to parse pk_columns: %w", err)
			}

		default:
			return Update{}, fmt.Errorf(
				"%w: unexpected argument in update mutation: %s",
				ErrInvalidArgument,
				arg.Name,
			)
		}
	}

	update := Update{
		Set:          set,
		Inc:          inc,
		AppendJSONB:  appendCols,
		PrependJSONB: prependCols,
		DeleteKey:    deleteKey,
		DeleteElem:   deleteElem,
		DeleteAtPath: deleteAtPath,
		Where:        whereClause,
	}

	if err := ApplyUpdatePresets(t, &update, role, sessionVariables); err != nil {
		return Update{}, fmt.Errorf("failed to apply update presets: %w", err)
	}

	return update, nil
}

// ApplyUpdatePresets adds preset columns to the SET clause of an update
// operation. Presets are column values automatically set by the server based
// on permissions.
func ApplyUpdatePresets(
	t Table,
	update *Update,
	role string,
	sessionVariables map[string]any,
) error {
	presets := t.UpdatePresets(role)
	if len(presets) == 0 {
		return nil
	}

	// Iterate in sorted order so the SET clause (and resulting SQL/parameters)
	// is deterministic across runs — Go map iteration is randomized.
	colNames := make([]string, 0, len(presets))
	for colName := range presets {
		colNames = append(colNames, colName)
	}

	slices.Sort(colNames)

	for _, colName := range colNames {
		presetValue := presets[colName]

		value, err := permissions.SubstituteSessionVariable(presetValue, sessionVariables)
		if err != nil {
			return fmt.Errorf(
				"failed to substitute session variable for preset column %s: %w",
				colName,
				err,
			)
		}

		col := t.ColumnFromSQLName(colName)
		if col == nil {
			return fmt.Errorf(
				"%w: preset column %s not found in table %s",
				ErrInvalidArgument,
				colName,
				t.TableName(),
			)
		}

		update.Set = append(update.Set, updateColumn{
			Column: col,
			Value:  value,
		})
	}

	return nil
}

// ParseUpdateMany parses an updates argument of [_update_many] into a slice of
// Update values, one per element.
func ParseUpdateMany(
	t Table,
	arguments ast.ArgumentList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
) ([]Update, error) {
	updatesArg := arguments.ForName("updates")
	if updatesArg == nil {
		return nil, fmt.Errorf(
			"%w: missing required argument: updates", ErrInvalidArgument,
		)
	}

	updatesValue, err := values.ResolveVariable(updatesArg.Value, variables)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve updates: %w", err)
	}

	// Coerce single object to list (GraphQL input coercion)
	children, err := values.CoerceToChildValueList(updatesValue, ast.ObjectValue)
	if err != nil {
		return nil, fmt.Errorf(
			"%w: updates argument must be an array or an object", ErrInvalidArgument,
		)
	}

	if len(children) == 0 {
		return nil, fmt.Errorf(
			"%w: updates array cannot be empty", ErrInvalidArgument,
		)
	}

	updates := make([]Update, 0, len(children))

	for i, child := range children {
		// Convert object children to ArgumentList
		argList := make(ast.ArgumentList, 0, len(child.Value.Children))
		for _, grandChild := range child.Value.Children {
			argList = append(argList, &ast.Argument{ //nolint:exhaustruct
				Name:  grandChild.Name,
				Value: grandChild.Value,
			})
		}

		u, err := ParseUpdate(t, argList, variables, role, sessionVariables)
		if err != nil {
			return nil, fmt.Errorf("failed to parse update at index %d: %w", i, err)
		}

		updates = append(updates, u)
	}

	return updates, nil
}

// parsePkColumnsArgument parses the pk_columns argument into a where.Clause.
// Each field in pk_columns becomes an EqualsFilter.
func parsePkColumnsArgument(
	t Table,
	pkColumnsValue *ast.Value,
	variables map[string]any,
) (where.Clause, error) {
	// Resolve variable if needed
	pkColumnsValue, err := values.ResolveVariable(pkColumnsValue, variables)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve pk_columns: %w", err)
	}

	if pkColumnsValue.Kind != ast.ObjectValue {
		return nil, fmt.Errorf("%w: pk_columns must be an object", ErrInvalidArgument)
	}

	whereClause := make(where.Clause, 0, len(pkColumnsValue.Children))

	pkColumns := t.PKColumns()

	for _, child := range pkColumnsValue.Children {
		var pkColumn *core.Column

		for _, col := range pkColumns {
			if col.GraphqlName == child.Name {
				pkColumn = col
				break
			}
		}

		if pkColumn == nil {
			return nil, fmt.Errorf(
				"%w: column %s is not a primary key column in table %s",
				ErrInvalidArgument, child.Name, t.TableName(),
			)
		}

		value, err := values.ResolveASTValue(child.Value, variables)
		if err != nil {
			return nil, fmt.Errorf("failed to resolve pk column %s: %w", child.Name, err)
		}

		whereClause = append(whereClause, where.NewEqualsFilter(pkColumn, value, t.Dialect()))
	}

	return whereClause, nil
}

// parseupdateColumnList parses the _set/_inc/_append/_prepend/_delete_key/_delete_elem
// value: an object whose fields are GraphQL column names mapping to scalar values.
func parseupdateColumnList(
	t Table,
	setValue *ast.Value,
	variables map[string]any,
) ([]updateColumn, error) {
	setValue, err := values.ResolveVariable(setValue, variables)
	if err != nil {
		return nil, fmt.Errorf("resolving update argument: %w", err)
	}

	if setValue.Kind != ast.ObjectValue {
		return nil, fmt.Errorf("%w: argument must be an object", ErrInvalidArgument)
	}

	result := make([]updateColumn, 0, len(setValue.Children))

	for _, child := range setValue.Children {
		customFieldName := child.Name

		column := t.ColumnFromGraphqlName(customFieldName)
		if column == nil {
			return nil, fmt.Errorf(
				"%w: column %s not found in table %s",
				ErrInvalidArgument,
				customFieldName,
				t.TableName(),
			)
		}

		value, err := values.ResolveASTValue(child.Value, variables)
		if err != nil {
			return nil, fmt.Errorf("failed to resolve field %s: %w", customFieldName, err)
		}

		result = append(result, updateColumn{
			Column: column,
			Value:  value,
		})
	}

	return result, nil
}

// parseDeleteAtPathArgumentValue parses the _delete_at_path value: an object
// mapping column names to an array of strings (the JSONB path).
func parseDeleteAtPathArgumentValue(
	t Table,
	setValue *ast.Value,
	variables map[string]any,
) ([]updateDeleteAtPath, error) {
	setValue, err := values.ResolveVariable(setValue, variables)
	if err != nil {
		return nil, fmt.Errorf("resolving _delete_at_path argument: %w", err)
	}

	if setValue.Kind != ast.ObjectValue {
		return nil, fmt.Errorf("%w: _delete_at_path must be an object", ErrInvalidArgument)
	}

	result := make([]updateDeleteAtPath, 0, len(setValue.Children))

	for _, child := range setValue.Children {
		customFieldName := child.Name

		column := t.ColumnFromGraphqlName(customFieldName)
		if column == nil {
			return nil, fmt.Errorf(
				"%w: column %s not found in table %s",
				ErrInvalidArgument,
				customFieldName,
				t.TableName(),
			)
		}

		fieldValue, err := values.ResolveVariable(child.Value, variables)
		if err != nil {
			return nil, fmt.Errorf("failed to resolve field %s: %w", customFieldName, err)
		}

		path, err := values.ExtractStringArrayValues(fieldValue)
		if err != nil {
			return nil, fmt.Errorf(
				"_delete_at_path value for %s must be an array or a string: %w",
				customFieldName,
				err,
			)
		}

		result = append(result, updateDeleteAtPath{
			Column: column,
			Path:   path,
		})
	}

	return result, nil
}

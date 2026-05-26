package queries

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

// errMsgInsertPermissionFailed is the message embedded in dialect.ThrowError
// when an insert/update check constraint fails at execution time. Postgres
// raises it via RAISE, SQLite via a forced failure.
const (
	errMsgInsertPermissionFailed = "check constraint of an insert/update permission has failed"
	errCodePermissionDenied      = "ZZ901"
)

// buildCheckConstraintSelectClause builds the SELECT clause for the check_constraint CTE.
// It generates SELECT expressions with typed parameters for non-nested columns.
func (t *table) buildCheckConstraintSelectClause(
	b *strings.Builder,
	insertObj arguments.InsertObject,
	nestedFKColumns map[string]struct{},
	paramIndex int,
) int {
	firstCol := true

	for _, col := range insertObj.Columns {
		if _, isNested := nestedFKColumns[col.Column.SQLName]; isNested {
			continue
		}

		if !firstCol {
			b.WriteString(", ")
		}

		firstCol = false

		ph := t.dialect.Placeholder(paramIndex)
		if col.Column.SQLType != "" {
			b.WriteString(t.dialect.TypeCast(ph, col.Column.SQLType))
			b.WriteString(" AS ")
			core.WriteQuotedIdentifier(b, col.Column.SQLName)
		} else {
			b.WriteString(ph)
			b.WriteString(" AS ")
			core.WriteQuotedIdentifier(b, col.Column.SQLName)
		}

		paramIndex++
	}

	return paramIndex
}

// buildCheckConstraintWhereClause builds the WHERE clause for the check_constraint CTE.
// It applies insert permissions and substitutes session variables.
func (t *table) buildCheckConstraintWhereClause(
	b *strings.Builder,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, bool, error) {
	return t.permissions.WriteInsertCheck( //nolint:wrapcheck
		b, role, sessionVariables, params, paramIndex, "data",
	)
}

// buildCheckConstraintCTE builds the check_constraint CTE for permissions validation.
// Returns updated params, paramIndex, and whether permissions were applied.
func (t *table) buildCheckConstraintCTE(
	b *strings.Builder,
	checkCTEName string,
	insertObj arguments.InsertObject,
	nestedFKColumns map[string]struct{},
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, bool, error) {
	b.WriteString(checkCTEName)
	b.WriteString(" AS (SELECT * FROM (SELECT ") //nolint:unqueryvet

	paramIndex = t.buildCheckConstraintSelectClause(b, insertObj, nestedFKColumns, paramIndex)

	// Add NULL columns for any columns referenced by the permission check
	// that aren't in the insert data, to prevent "column does not exist" errors.
	t.appendMissingPermissionColumns(b, insertObj, nestedFKColumns, role)

	b.WriteString(") AS data WHERE ")

	var (
		hasCheckPermissions bool
		err                 error
	)

	params, paramIndex, hasCheckPermissions, err = t.buildCheckConstraintWhereClause(
		b,
		role,
		sessionVariables,
		params,
		paramIndex,
	)
	if err != nil {
		return nil, 0, false, err
	}

	b.WriteString("), ")

	return params, paramIndex, hasCheckPermissions, nil
}

// buildCheckCountCTE builds the check_count CTE that validates all rows passed permission checks.
// It throws an error if any row failed permissions (all-or-nothing behavior).
// cteName should be the base name (e.g., "mutation_result") or empty for multi-row case.
// expectedCount is the number of rows we expect to pass the permission check.
func (t *table) buildCheckCountCTE(
	b *strings.Builder,
	cteName string,
	checkCTEName string,
	expectedCount int,
) {
	var checkCountCTEName string
	if cteName != "" {
		checkCountCTEName = cteName + "_check_count"
	} else {
		checkCountCTEName = "check_count"
	}

	b.WriteString(checkCountCTEName)
	b.WriteString(" AS (SELECT ")
	b.WriteString("CASE WHEN (SELECT COUNT(*) FROM ")
	b.WriteString(checkCTEName)
	b.WriteString(") >= ")
	b.WriteString(strconv.Itoa(expectedCount))
	b.WriteByte(' ')
	b.WriteString("THEN 1 ")
	b.WriteString("ELSE (SELECT 0 FROM (SELECT ")
	b.WriteString(t.dialect.ThrowError(errMsgInsertPermissionFailed, errCodePermissionDenied))
	b.WriteString(") x) END AS status), ")
}

// buildSingleInsertCTEPreCheck builds a single-row insert using the pre-mutation permission check.
func (t *table) buildSingleInsertCTEPreCheck(
	b *strings.Builder,
	cteName string,
	insertObj arguments.InsertObject,
	onConflict *arguments.OnConflict,
	nestedFKIndex map[string]string,
	params []any,
	paramIndex int,
	role string,
	sessionVariables map[string]any,
) ([]any, int, error) {
	nestedFKColumns := make(map[string]struct{})
	for col := range nestedFKIndex {
		nestedFKColumns[col] = struct{}{}
	}

	checkCTEName := "check_" + cteName

	var (
		hasCheckPermissions bool
		err                 error
	)

	params, paramIndex, hasCheckPermissions, err = t.buildCheckConstraintCTE(
		b,
		checkCTEName,
		insertObj,
		nestedFKColumns,
		role,
		sessionVariables,
		params,
		paramIndex,
	)
	if err != nil {
		return nil, 0, err
	}

	// All-or-nothing: matches Hasura, the entire mutation fails if a row fails permissions.
	if hasCheckPermissions {
		t.buildCheckCountCTE(b, cteName, checkCTEName, 1)
	}

	params, paramIndex, err = t.buildInsertCTE(
		b,
		cteName,
		insertObj,
		onConflict,
		checkCTEName,
		nestedFKIndex,
		hasCheckPermissions,
		params,
		paramIndex,
	)
	if err != nil {
		return nil, 0, err
	}

	return params, paramIndex, nil
}

// buildSingleInsertCTEPostCheck builds a single-row insert using the post-mutation permission check.
// Used when generated columns are referenced by insert permissions.
func (t *table) buildSingleInsertCTEPostCheck(
	b *strings.Builder,
	cteName string,
	insertObj arguments.InsertObject,
	onConflict *arguments.OnConflict,
	nestedFKIndex map[string]string,
	params []any,
	paramIndex int,
	role string,
	sessionVariables map[string]any,
) ([]any, int, error) {
	nestedFKColumns := make(map[string]struct{})
	for col := range nestedFKIndex {
		nestedFKColumns[col] = struct{}{}
	}

	dataCTEName := "check_" + cteName

	b.WriteString(dataCTEName)
	b.WriteString(" AS (SELECT * FROM (SELECT ") //nolint:unqueryvet

	paramIndex = t.buildCheckConstraintSelectClause(b, insertObj, nestedFKColumns, paramIndex)
	b.WriteString(") AS data WHERE true), ")

	rawCTEName := "_" + cteName
	columnNames := insertObj.ColumnNames()

	b.WriteString(rawCTEName)
	b.WriteString(" AS (INSERT INTO ")
	b.WriteString(t.tableFromClause())

	t.buildInsertColumnsClause(b, columnNames)
	t.buildInsertSelectClause(b, columnNames, dataCTEName, nestedFKIndex)
	t.buildInsertFromClause(b, dataCTEName, nestedFKIndex)

	if onConflict != nil {
		var err error

		params, paramIndex, err = onConflict.ToSQL(b, params, paramIndex)
		if err != nil {
			return nil, 0, err //nolint:wrapcheck
		}
	}

	b.WriteString(" RETURNING *), ")

	postCheckName := cteName + "_post_check"

	var err error

	params, paramIndex, err = t.buildPostCheckCTEWithName(
		b, postCheckName, rawCTEName, role, sessionVariables, params, paramIndex,
	)
	if err != nil {
		return nil, 0, err
	}

	b.WriteString(cteName)
	b.WriteString(" AS (SELECT * FROM ") //nolint:unqueryvet
	b.WriteString(rawCTEName)
	b.WriteString(" WHERE (SELECT status FROM ")
	b.WriteString(postCheckName)
	b.WriteString(") = 1), ")

	return params, paramIndex, nil
}

// appendMissingPermissionColumns appends NULL-valued columns to the SELECT clause
// for columns referenced by the insert permission check that aren't in the insert data.
// Permission-side column discovery is delegated to permissions.Store; this method
// only emits the SQL.
func (t *table) appendMissingPermissionColumns(
	b *strings.Builder,
	insertObj arguments.InsertObject,
	nestedFKColumns map[string]struct{},
	role string,
) {
	present := make(map[string]struct{})
	for _, col := range insertObj.Columns {
		if _, isNested := nestedFKColumns[col.Column.SQLName]; !isNested {
			present[col.Column.SQLName] = struct{}{}
		}
	}

	missing := t.permissions.MissingInsertColumns(role, present, t.columnFromSQLName)
	for _, col := range missing {
		b.WriteString(", ")

		if col.SQLType != "" {
			b.WriteString(t.dialect.TypeCast("NULL", col.SQLType))
			b.WriteString(" AS ")
			core.WriteQuotedIdentifier(b, col.SQLName)
		} else {
			b.WriteString("NULL AS ")
			core.WriteQuotedIdentifier(b, col.SQLName)
		}
	}
}

// extendWithPermissionColumns delegates to permissions.Store; kept as an
// unexported method so the callsite in buildInsertMutationCTEPreCheck reads
// the same as before the extraction.
func (t *table) extendWithPermissionColumns(allColumns []string, role string) []string {
	return t.permissions.ExtendInsertColumns(allColumns, role, t.columnFromSQLName)
}

// permissionReferencesGeneratedColumns delegates to permissions.Store.
func (t *table) permissionReferencesGeneratedColumns(role string) bool {
	return t.permissions.ReferencesGeneratedColumns(role, t.columnFromSQLName)
}

// buildPostCheckCTEWithName builds a post-mutation permission check CTE with a custom name.
// This is used when generated columns are referenced by insert permissions,
// since their values are only available after the INSERT (via RETURNING *).
// The CTE checks that ALL inserted rows pass the permission filter applied
// against the actual data (where generated columns have their real computed values).
func (t *table) buildPostCheckCTEWithName(
	b *strings.Builder,
	checkName string,
	rawCTEName string,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	if !t.permissions.HasInsertCheck(role) {
		return params, paramIndex, nil
	}

	b.WriteString(checkName)
	b.WriteString(" AS (SELECT CASE WHEN (SELECT COUNT(*) FROM ")
	b.WriteString(rawCTEName)
	b.WriteString(" WHERE ")

	params, paramIndex, _, err := t.permissions.WriteInsertCheck(
		b, role, sessionVariables, params, paramIndex, rawCTEName,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to write post-check permission: %w", err)
	}

	b.WriteString(") = (SELECT COUNT(*) FROM ")
	b.WriteString(rawCTEName)
	b.WriteString(") THEN 1 ELSE (SELECT 0 FROM (SELECT ")
	b.WriteString(t.dialect.ThrowError(errMsgInsertPermissionFailed, errCodePermissionDenied))
	b.WriteString(") x) END AS status), ")

	return params, paramIndex, nil
}

// buildPostCheckCTE builds a post-mutation permission check CTE named "post_check".
func (t *table) buildPostCheckCTE(
	b *strings.Builder,
	rawCTEName string,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	return t.buildPostCheckCTEWithName(
		b, "post_check", rawCTEName, role, sessionVariables, params, paramIndex,
	)
}

// collectAllColumns collects all unique columns across all insert objects.
// Returns allColumns slice and a map of object index -> column -> value.
func (t *table) collectAllColumns(
	insertObjs []arguments.InsertObject,
	nestedFKColumns map[string]struct{},
) ([]string, []map[string]any) {
	allColumns := make([]string, 0)
	columnSet := make(map[string]struct{})
	columnToValue := make([]map[string]any, len(insertObjs))

	for objIdx, insertObj := range insertObjs {
		columnToValue[objIdx] = make(map[string]any)

		for _, col := range insertObj.Columns {
			colName := col.Column.SQLName

			if _, isNested := nestedFKColumns[colName]; isNested {
				continue
			}

			if _, seen := columnSet[colName]; !seen {
				columnSet[colName] = struct{}{}
				allColumns = append(allColumns, colName)
			}

			columnToValue[objIdx][colName] = col.Value
		}
	}

	return allColumns, columnToValue
}

// buildUnionAllSelect builds a UNION ALL SELECT for multiple insert objects.
// Each SELECT includes all columns, using NULL for missing values.
func (t *table) buildUnionAllSelect(
	b *strings.Builder,
	insertObjs []arguments.InsertObject,
	allColumns []string,
	columnToValue []map[string]any,
	params []any,
	paramIndex int,
) ([]any, int) {
	for i := range insertObjs {
		if i > 0 {
			b.WriteString(" UNION ALL ")
		}

		b.WriteString("SELECT ")

		for j, col := range allColumns {
			if j > 0 {
				b.WriteString(", ")
			}

			var colType string
			for _, tableCol := range t.columns {
				if tableCol.SQLName == col {
					colType = tableCol.SQLType
					break
				}
			}

			if value, hasValue := columnToValue[i][col]; hasValue { //nolint:nestif
				ph := t.dialect.Placeholder(paramIndex)
				if colType != "" {
					b.WriteString(t.dialect.TypeCast(ph, colType))
				} else {
					b.WriteString(ph)
				}

				b.WriteString(" AS ")
				core.WriteQuotedIdentifier(b, col)

				params = append(params, value)
				paramIndex++
			} else {
				if colType != "" {
					b.WriteString(t.dialect.TypeCast("NULL", colType))
				} else {
					b.WriteString("NULL")
				}

				b.WriteString(" AS ")
				core.WriteQuotedIdentifier(b, col)
			}
		}
	}

	return params, paramIndex
}

// buildCheckMutationResultCTE builds the check_mutation_result CTE with permissions.
// This CTE contains all rows to be inserted after permission filtering.
func (t *table) buildCheckMutationResultCTE(
	b *strings.Builder,
	insertObjs []arguments.InsertObject,
	allColumns []string,
	columnToValue []map[string]any,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, bool, error) {
	checkCTEName := "check_mutation_result"
	b.WriteString(checkCTEName)
	b.WriteString(" AS (SELECT * FROM (") //nolint:unqueryvet

	params, paramIndex = t.buildUnionAllSelect(
		b, insertObjs, allColumns, columnToValue, params, paramIndex,
	)

	b.WriteString(") AS data WHERE ")

	var (
		hasCheckPermissions bool
		err                 error
	)

	params, paramIndex, hasCheckPermissions, err = t.buildCheckConstraintWhereClause(
		b,
		role,
		sessionVariables,
		params,
		paramIndex,
	)
	if err != nil {
		return nil, 0, false, err
	}

	b.WriteString("), ")

	return params, paramIndex, hasCheckPermissions, nil
}

// buildMutationResultInsertCTE builds the final mutation_result INSERT CTE.
func (t *table) buildMutationResultInsertCTE(
	b *strings.Builder,
	allColumns []string,
	nestedFKIndex map[string]string,
	onConflict *arguments.OnConflict,
	hasCheckPermissions bool,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	checkCTEName := "check_mutation_result"

	finalColumns := append([]string{}, allColumns...)

	for col := range nestedFKIndex {
		finalColumns = append(finalColumns, col)
	}

	b.WriteString("mutation_result AS (INSERT INTO ")
	b.WriteString(t.tableFromClause())

	t.buildInsertColumnsClause(b, finalColumns)
	t.buildInsertSelectClause(b, finalColumns, checkCTEName, nestedFKIndex)
	t.buildInsertFromClause(b, checkCTEName, nestedFKIndex)

	if hasCheckPermissions {
		b.WriteString(" WHERE (SELECT status FROM check_count) = 1")
	}

	if onConflict != nil {
		var err error

		params, paramIndex, err = onConflict.ToSQL(b, params, paramIndex)
		if err != nil {
			return nil, 0, err //nolint:wrapcheck
		}
	}

	b.WriteString(" RETURNING *)")

	return params, paramIndex, nil
}

// buildInsertMutationCTEPreCheck builds insert CTEs using the pre-mutation permission check
// pattern. This is the default path when no generated columns are referenced by permissions.
func (t *table) buildInsertMutationCTEPreCheck(
	b *strings.Builder,
	insertObjs []arguments.InsertObject,
	allColumns []string,
	columnToValue []map[string]any,
	nestedFKIndex map[string]string,
	onConflict *arguments.OnConflict,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	// Include columns referenced by permission checks but not in the insert data,
	// preventing "column does not exist" errors (e.g., OR checking workspace_id).
	dataColumns := t.extendWithPermissionColumns(allColumns, role)

	var (
		hasCheckPermissions bool
		err                 error
	)

	params, paramIndex, hasCheckPermissions, err = t.buildCheckMutationResultCTE(
		b, insertObjs, dataColumns, columnToValue, role, sessionVariables, params, paramIndex,
	)
	if err != nil {
		return nil, 0, err
	}

	if hasCheckPermissions {
		t.buildCheckCountCTE(b, "", "check_mutation_result", len(insertObjs))
	}

	params, paramIndex, err = t.buildMutationResultInsertCTE(
		b, allColumns, nestedFKIndex, onConflict, hasCheckPermissions, params, paramIndex,
	)
	if err != nil {
		return nil, 0, err
	}

	return params, paramIndex, nil
}

// buildInsertMutationCTEPostCheck builds insert CTEs using the post-mutation permission check
// pattern. This is used when generated columns are referenced by insert permissions, because
// generated column values are only available after the INSERT (via RETURNING *).
//
// SQL structure:
//
//	insert_data AS (SELECT ... FROM (...) AS data),
//	_mutation_result AS (INSERT INTO ... SELECT ... FROM insert_data RETURNING *),
//	post_check AS (validate all rows pass permission filter against real data),
//	mutation_result AS (SELECT * FROM _mutation_result WHERE post_check passes)
func (t *table) buildInsertMutationCTEPostCheck(
	b *strings.Builder,
	insertObjs []arguments.InsertObject,
	allColumns []string,
	columnToValue []map[string]any,
	nestedFKIndex map[string]string,
	onConflict *arguments.OnConflict,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	b.WriteString("insert_data AS (SELECT * FROM (") //nolint:unqueryvet

	params, paramIndex = t.buildUnionAllSelect(
		b, insertObjs, allColumns, columnToValue, params, paramIndex,
	)

	b.WriteString(") AS data), ")

	finalColumns := append([]string{}, allColumns...)
	for col := range nestedFKIndex {
		finalColumns = append(finalColumns, col)
	}

	b.WriteString("_mutation_result AS (INSERT INTO ")
	b.WriteString(t.tableFromClause())

	t.buildInsertColumnsClause(b, finalColumns)
	t.buildInsertSelectClause(b, finalColumns, "insert_data", nestedFKIndex)
	t.buildInsertFromClause(b, "insert_data", nestedFKIndex)

	if onConflict != nil {
		var err error

		params, paramIndex, err = onConflict.ToSQL(b, params, paramIndex)
		if err != nil {
			return nil, 0, err //nolint:wrapcheck
		}
	}

	b.WriteString(" RETURNING *), ")

	var err error

	params, paramIndex, err = t.buildPostCheckCTE(
		b, "_mutation_result", role, sessionVariables, params, paramIndex,
	)
	if err != nil {
		return nil, 0, err
	}

	b.WriteString("mutation_result AS (SELECT * FROM _mutation_result") //nolint:unqueryvet
	b.WriteString(" WHERE (SELECT status FROM post_check) = 1)")

	return params, paramIndex, nil
}

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

// buildCheckConstraintWhereClause validates input rows against the insert permission.
func (t *table) buildCheckConstraintWhereClause(
	b *strings.Builder,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, bool, error) {
	return t.permissions.WriteInsertCheckSubstituted( //nolint:wrapcheck
		b, role, sessionVariables, params, paramIndex, "data", nil,
	)
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

// extendWithPermissionColumns delegates to permissions.Store; kept as an
// unexported method so the callsite in buildInsertMutationCTEPreCheck reads
// the same as before the extraction.
func (t *table) extendWithPermissionColumns(allColumns []string, role string) []string {
	return t.permissions.ExtendInsertColumns(allColumns, role, t.columnFromSQLName)
}

// requiresPostInsertCheck reports whether the insert-check for role must run
// after the INSERT (against RETURNING *) instead of against the input data,
// for the given onConflict (nil for a plain insert).
//
// Two conditions force the post-mutation path:
//
//  1. A check-referenced column's final value is only known after the INSERT
//     (generated/identity, or DB-defaulted and absent from the payload) — see
//     permissions.Store.RequiresPostInsertCheck. presentCols is the set of
//     columns carrying a concrete value for every row, computed by
//     insertPresentColumns.
//  2. The mutation is an upsert with a reachable DO UPDATE branch and a
//     non-empty insert check. The pre-check path enforces the insert check on
//     *every* input row via the all-or-nothing check_count gate, which would
//     wrongly reject a conflicting row that takes the UPDATE branch (and is
//     therefore governed by the UPDATE permission/check, not the INSERT check).
//     The post-check path scopes the insert check to rows that actually insert,
//     matching Hasura's per-row branch semantics. See upsertNeedsPostInsertCheck.
func (t *table) requiresPostInsertCheck(
	role string,
	presentCols map[string]struct{},
	onConflict *arguments.OnConflict,
) bool {
	if t.permissions.RequiresPostInsertCheck(role, presentCols, t.columnFromSQLName) {
		return true
	}

	return t.upsertNeedsPostInsertCheck(onConflict, role)
}

// upsertNeedsPostInsertCheck reports whether onConflict describes an upsert
// whose insert check must be scoped to inserted rows via the post-mutation
// path. It is true only when the DO UPDATE branch is reachable
// (len(UpdateColumns) > 0 — an empty list is DO NOTHING and never updates) and
// role carries a non-empty insert check. Without an insert check the pre-check
// path emits no check_count gate, so no asymmetry exists and the simpler
// pre-check path stays in use.
func (t *table) upsertNeedsPostInsertCheck(onConflict *arguments.OnConflict, role string) bool {
	if onConflict == nil || len(onConflict.UpdateColumns) == 0 {
		return false
	}

	return t.permissions.HasNonEmptyInsertCheck(role)
}

// insertPresentColumns intersects the explicit input columns across all rows.
func insertPresentColumns(
	insertObjs []arguments.InsertObject,
) map[string]struct{} {
	var present map[string]struct{}

	for i, obj := range insertObjs {
		rowCols := make(map[string]struct{}, len(obj.Columns))
		for _, col := range obj.Columns {
			rowCols[col.Column.SQLName] = struct{}{}
		}

		if i == 0 {
			present = rowCols

			continue
		}

		for col := range present {
			if _, ok := rowCols[col]; !ok {
				delete(present, col)
			}
		}
	}

	if present == nil {
		present = make(map[string]struct{})
	}

	return present
}

// buildPostCheckCTE checks real inserted rows after INSERT when needed.
func (t *table) buildPostCheckCTE(
	b *strings.Builder,
	rawCTEName string,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	if !t.permissions.HasInsertCheck(role) {
		return params, paramIndex, nil
	}

	b.WriteString("post_check")
	b.WriteString(" AS (SELECT CASE WHEN (SELECT COUNT(*) FROM ")
	b.WriteString(rawCTEName)
	b.WriteString(" WHERE ")

	params, paramIndex, _, err := t.permissions.WriteInsertCheckSubstituted(
		b, role, sessionVariables, params, paramIndex, rawCTEName, nil,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to write post-check permission: %w", err)
	}

	b.WriteString(") = (SELECT COUNT(*) FROM ")
	b.WriteString(rawCTEName)
	b.WriteString(") THEN 1 ELSE (SELECT 0 FROM (SELECT ")
	b.WriteString(t.dialect.ThrowError(errMsgInsertPermissionFailed, errCodePermissionDenied))
	b.WriteString(") x) END AS status)")

	return params, paramIndex, nil
}

// collectAllColumns collects all unique columns across all insert objects.
// Returns allColumns slice and a map of object index -> column -> value.
func (t *table) collectAllColumns(
	insertObjs []arguments.InsertObject,
) ([]string, []map[string]any) {
	allColumns := make([]string, 0)
	columnSet := make(map[string]struct{})
	columnToValue := make([]map[string]any, len(insertObjs))

	for objIdx, insertObj := range insertObjs {
		columnToValue[objIdx] = make(map[string]any)

		for _, col := range insertObj.Columns {
			colName := col.Column.SQLName

			if _, seen := columnSet[colName]; !seen {
				columnSet[colName] = struct{}{}
				allColumns = append(allColumns, colName)
			}

			columnToValue[objIdx][colName] = col.Value
		}
	}

	return allColumns, columnToValue
}

// buildUnionAllSelect batches relationship-free inputs with per-row defaults.
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

		params, paramIndex = t.writeUnionAllRow(
			b, allColumns, columnToValue[i], params, paramIndex,
		)
	}

	return params, paramIndex
}

// writeUnionAllRow emits the column list for a single UNION-ALL branch.
// columns present in rowValues emit a typed placeholder; remaining columns emit
// the column's DB default expression when one is registered, otherwise a typed
// NULL.
//
// Emitting the default inline (rather than NULL) is required for parity with
// Hasura on multi-row inserts whose rows have different column sets: when a
// NOT NULL DEFAULT column is supplied by some rows but omitted by others, a
// NULL branch would trip 23502 at INSERT time, whereas Hasura lets the DB
// default apply per row. Volatile defaults (now(), gen_random_uuid()) evaluate
// per row inside INSERT ... SELECT, so inline emission preserves per-row
// semantics.
func (t *table) writeUnionAllRow(
	b *strings.Builder,
	allColumns []string,
	rowValues map[string]any,
	params []any,
	paramIndex int,
) ([]any, int) {
	for j, col := range allColumns {
		if j > 0 {
			b.WriteString(", ")
		}

		tableCol := t.tableColumn(col)

		var (
			colType     string
			defaultExpr string
		)

		if tableCol != nil {
			colType = tableCol.SQLType
			defaultExpr = tableCol.DefaultExpr
		}

		value, hasValue := rowValues[col]
		if hasValue {
			params, paramIndex = t.writeTypedPlaceholder(b, col, colType, value, params, paramIndex)
		} else {
			t.writeAbsentColumn(b, col, colType, defaultExpr)
		}
	}

	return params, paramIndex
}

// tableColumn returns the registered column metadata for col on t, or nil if
// the column isn't in t.columns.
func (t *table) tableColumn(col string) *core.Column {
	for _, tableCol := range t.columns {
		if tableCol.SQLName == col {
			return tableCol
		}
	}

	return nil
}

// writeTypedPlaceholder emits a parameter placeholder for value, type-cast
// when colType is set, aliased as col, and appends value to params.
func (t *table) writeTypedPlaceholder(
	b *strings.Builder,
	col, colType string,
	value any,
	params []any,
	paramIndex int,
) ([]any, int) {
	if _, dependent := value.(core.InsertFKValue); dependent {
		b.WriteString(t.insertFKExpression(t.tableColumn(col), paramIndex))
	} else if tableCol := t.tableColumn(col); tableCol != nil && colType != "" {
		b.WriteString(t.valueExpression(tableCol, paramIndex))
	} else if colType != "" {
		b.WriteString(t.dialect.TypeCast(t.dialect.Placeholder(paramIndex), colType))
	} else {
		b.WriteString(t.dialect.Placeholder(paramIndex))
	}

	b.WriteString(" AS ")
	core.WriteQuotedIdentifier(b, col)

	return append(params, value), paramIndex + 1
}

// writeTypedNull emits a NULL literal, type-cast when colType is set, aliased
// as col.
func (t *table) writeTypedNull(b *strings.Builder, col, colType string) {
	if colType != "" {
		b.WriteString(t.dialect.TypeCast("NULL", colType))
	} else {
		b.WriteString("NULL")
	}

	b.WriteString(" AS ")
	core.WriteQuotedIdentifier(b, col)
}

// writeAbsentColumn emits the value used for a column missing from a row in a
// UNION-ALL data CTE branch. When defaultExpr is non-empty, the column's DB
// default expression is emitted inline (parenthesised and type-cast when
// colType is set) so the resulting INSERT ... SELECT supplies the default per
// row rather than NULL — see writeUnionAllRow for the Hasura-parity rationale.
// Otherwise it falls back to writeTypedNull.
func (t *table) writeAbsentColumn(b *strings.Builder, col, colType, defaultExpr string) {
	if defaultExpr == "" {
		t.writeTypedNull(b, col, colType)

		return
	}

	expr := "(" + defaultExpr + ")"

	if colType != "" {
		b.WriteString(t.dialect.TypeCast(expr, colType))
	} else {
		b.WriteString(expr)
	}

	b.WriteString(" AS ")
	core.WriteQuotedIdentifier(b, col)
}

// buildCheckMutationResultCTE validates flat input rows before INSERT.
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
	cteName string,
	allColumns []string,
	onConflict *arguments.OnConflict,
	plan upsertUpdateCheckPlan,
	hasCheckPermissions bool,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	checkCTEName := "check_mutation_result"

	finalColumns := allColumns

	b.WriteString(cteName)
	b.WriteString(" AS (INSERT INTO ")
	b.WriteString(t.tableFromClause())

	t.buildInsertColumnsClause(b, finalColumns)
	t.buildInsertSelectClause(b, finalColumns, checkCTEName)
	b.WriteString(" FROM ")
	b.WriteString(checkCTEName)

	if hasCheckPermissions {
		b.WriteString(" WHERE (SELECT status FROM check_count) = 1")
	}

	if onConflict != nil {
		var err error

		params, paramIndex, err = t.writeOnConflictSQL(
			b, onConflict, role, sessionVariables, params, paramIndex,
		)
		if err != nil {
			return nil, 0, err
		}
	}

	t.writeInsertReturning(b, plan)
	b.WriteByte(')')

	return params, paramIndex, nil
}

// buildInsertMutationCTEPreCheck builds insert CTEs using the pre-mutation permission check
// pattern. This is the default path when no check-referenced column requires
// post-INSERT evaluation (see requiresPostInsertCheck): the check predicate is
// validated against the input data subquery before the INSERT runs.
func (t *table) buildInsertMutationCTEPreCheck( //nolint:funlen // Linear SQL CTE template.
	b *strings.Builder,
	insertObjs []arguments.InsertObject,
	allColumns []string,
	columnToValue []map[string]any,
	onConflict *arguments.OnConflict,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	finalColumns := allColumns

	// Include columns referenced by permission checks but not in the insert data,
	// preventing "column does not exist" errors (e.g., OR checking workspace_id).
	dataColumns := t.extendWithPermissionColumns(finalColumns, role)

	var (
		hasCheckPermissions bool
		err                 error
	)

	params, paramIndex, hasCheckPermissions, err = t.buildCheckMutationResultCTE(
		b, insertObjs, dataColumns, columnToValue,
		role, sessionVariables, params, paramIndex,
	)
	if err != nil {
		return nil, 0, err
	}

	if hasCheckPermissions {
		t.buildCheckCountCTE(b, "", "check_mutation_result", len(insertObjs))
	}

	plan := t.prepareUpsertUpdateCheckPlan(
		b,
		"mutation_result",
		"check_mutation_result",
		onConflict,
		finalColumns,
		len(insertObjs),
		insertPresentColumns(insertObjs),
		role,
		false,
	)

	rawCTEName := rawCTENameForUpsertUpdateCheck("mutation_result", plan)

	params, paramIndex, err = t.buildMutationResultInsertCTE(
		b,
		rawCTEName,
		allColumns,
		onConflict,
		plan,
		hasCheckPermissions,
		role,
		sessionVariables,
		params,
		paramIndex,
	)
	if err != nil {
		return nil, 0, err
	}

	params, paramIndex, err = t.appendUpsertUpdateCheckAndFinalCTE(
		b, "mutation_result", rawCTEName, plan, role, sessionVariables, params, paramIndex,
	)
	if err != nil {
		return nil, 0, err
	}

	return params, paramIndex, nil
}

// buildInsertMutationCTEPostCheck builds insert CTEs using the post-mutation permission check
// pattern. This is used when an insert-check-referenced column's final value is only known
// after the INSERT runs (generated columns, or DB-defaulted columns omitted from the payload —
// see requiresPostInsertCheck), so the predicate is validated against RETURNING *.
//
// SQL structure:
//
//	insert_data AS (SELECT ... FROM (...) AS data),
//	_mutation_result AS (INSERT INTO ... SELECT ... FROM insert_data RETURNING *[, action marker]),
//	[mutation_result_upsert_inserts AS (SELECT inserted rows from _mutation_result),]
//	post_check AS (validate inserted rows pass permission filter against real data),
//	mutation_result AS (SELECT visible columns FROM _mutation_result WHERE post_check passes)
func (t *table) buildInsertMutationCTEPostCheck( //nolint:funlen // Linear SQL CTE template.
	b *strings.Builder,
	insertObjs []arguments.InsertObject,
	allColumns []string,
	columnToValue []map[string]any,
	onConflict *arguments.OnConflict,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	finalColumns := allColumns

	b.WriteString("insert_data AS (SELECT * FROM (") //nolint:unqueryvet

	params, paramIndex = t.buildUnionAllSelect(
		b, insertObjs, finalColumns, columnToValue, params, paramIndex,
	)

	b.WriteString(") AS data), ")

	plan := t.prepareUpsertUpdateCheckPlan(
		b,
		"mutation_result",
		"insert_data",
		onConflict,
		finalColumns,
		len(insertObjs),
		insertPresentColumns(insertObjs),
		role,
		true,
	)

	b.WriteString("_mutation_result AS (INSERT INTO ")
	b.WriteString(t.tableFromClause())

	t.buildInsertColumnsClause(b, finalColumns)
	t.buildInsertSelectClause(b, finalColumns, "insert_data")
	b.WriteString(" FROM insert_data")

	if onConflict != nil {
		var err error

		params, paramIndex, err = t.writeOnConflictSQL(
			b, onConflict, role, sessionVariables, params, paramIndex,
		)
		if err != nil {
			return nil, 0, err
		}
	}

	t.writeInsertReturning(b, plan)
	b.WriteString("), ")

	postCheckSourceCTEName := appendUpsertInsertedRowsCTE(b, plan, "_mutation_result")

	var err error

	params, paramIndex, err = t.buildPostCheckCTE(
		b, postCheckSourceCTEName, role, sessionVariables, params, paramIndex,
	)
	if err != nil {
		return nil, 0, err
	}

	params, paramIndex, err = t.appendUpsertUpdateCheckAndFinalCTE(
		b,
		"mutation_result",
		"_mutation_result",
		plan,
		role,
		sessionVariables,
		params,
		paramIndex,
		"post_check",
	)
	if err != nil {
		return nil, 0, err
	}

	return params, paramIndex, nil
}

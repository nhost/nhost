package queries

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
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
// It applies insert permissions and substitutes session variables. The
// optional tableSubs redirects relationship-EXISTS subqueries that target a
// table currently being inserted into to its parent CTE instead — needed for
// nested array-relationship inserts whose permission reaches the parent via
// a relationship.
func (t *table) buildCheckConstraintWhereClause(
	b *strings.Builder,
	role string,
	sessionVariables map[string]any,
	tableSubs where.TableSubstitutions,
	params []any,
	paramIndex int,
) ([]any, int, bool, error) {
	return t.permissions.WriteInsertCheckSubstituted( //nolint:wrapcheck
		b, role, sessionVariables, params, paramIndex, "data", tableSubs,
	)
}

// buildCheckConstraintCTE builds the check_constraint CTE for permissions validation.
// Returns updated params, paramIndex, and whether permissions were applied.
// tableSubs redirects relationship-EXISTS subqueries that target a table
// currently being inserted into to its parent CTE (nested array-rel inserts).
func (t *table) buildCheckConstraintCTE(
	b *strings.Builder,
	checkCTEName string,
	insertObj arguments.InsertObject,
	nestedFKColumns map[string]struct{},
	nestedFKIndex arguments.NestedFKSources,
	tableSubs where.TableSubstitutions,
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
	// FK columns drawn from a sibling CTE pull from that CTE instead of NULL
	// so the permission predicate sees the real id.
	fromCTEs := t.appendMissingPermissionColumns(
		b, insertObj, nestedFKColumns, nestedFKIndex, role,
	)

	writeFromCTEs(b, fromCTEs)

	b.WriteString(") AS data WHERE ")

	var (
		hasCheckPermissions bool
		err                 error
	)

	params, paramIndex, hasCheckPermissions, err = t.buildCheckConstraintWhereClause(
		b,
		role,
		sessionVariables,
		tableSubs,
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
	nestedFKIndex arguments.NestedFKSources,
	tableSubs where.TableSubstitutions,
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
		nestedFKIndex,
		tableSubs,
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
// Used when an insert permission references a column whose final value is only
// known after the INSERT runs (generated columns, or DB-defaulted columns the
// payload omits). tableSubs mirrors the pre-check path: when the post-check
// predicate reaches a sibling in-flight CTE via a relationship-EXISTS, it
// redirects the EXISTS subquery from the underlying table to the CTE so it
// sees the just-inserted rows. nil/empty for top-level inserts; populated for
// nested-insert children that key off a parent CTE.
func (t *table) buildSingleInsertCTEPostCheck(
	b *strings.Builder,
	cteName string,
	insertObj arguments.InsertObject,
	onConflict *arguments.OnConflict,
	nestedFKIndex arguments.NestedFKSources,
	tableSubs where.TableSubstitutions,
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
		b, postCheckName, rawCTEName, tableSubs, role, sessionVariables, params, paramIndex,
	)
	if err != nil {
		return nil, 0, err
	}

	b.WriteString(cteName)
	b.WriteString(" AS (SELECT * FROM ") //nolint:unqueryvet
	b.WriteString(rawCTEName)
	b.WriteString(" WHERE (SELECT status FROM ")
	b.WriteString(postCheckName)
	b.WriteString(") = 1)")

	return params, paramIndex, nil
}

// appendMissingPermissionColumns appends columns referenced by the insert
// permission check that aren't in the insert data. Columns mapped in
// nestedFKIndex (FK columns drawn from a sibling CTE) are emitted with their
// mapped source CTE column so the permission predicate sees the real value; other missing
// columns are emitted as typed NULLs to prevent "column does not exist"
// errors. Returns the unique sibling CTEs that must be added to the SELECT's
// FROM clause (in stable order of first appearance).
//
// Permission-side column discovery is delegated to permissions.Store; this
// method only emits the SQL.
func (t *table) appendMissingPermissionColumns(
	b *strings.Builder,
	insertObj arguments.InsertObject,
	nestedFKColumns map[string]struct{},
	nestedFKIndex arguments.NestedFKSources,
	role string,
) []string {
	present := make(map[string]struct{})
	for _, col := range insertObj.Columns {
		if _, isNested := nestedFKColumns[col.Column.SQLName]; !isNested {
			present[col.Column.SQLName] = struct{}{}
		}
	}

	missing := t.permissions.MissingInsertColumns(role, present, t.columnFromSQLName)

	seenCTE := make(map[string]struct{})

	var fromCTEs []string

	for _, col := range missing {
		b.WriteString(", ")

		if source, isFK := nestedFKIndex[col.SQLName]; isFK {
			writeFKSourceColumn(b, source.CTEName, source.ColumnName)
			b.WriteString(" AS ")
			core.WriteQuotedIdentifier(b, col.SQLName)

			if _, dup := seenCTE[source.CTEName]; !dup {
				seenCTE[source.CTEName] = struct{}{}
				fromCTEs = append(fromCTEs, source.CTEName)
			}

			continue
		}

		if col.SQLType != "" {
			b.WriteString(t.dialect.TypeCast("NULL", col.SQLType))
			b.WriteString(" AS ")
			core.WriteQuotedIdentifier(b, col.SQLName)
		} else {
			b.WriteString("NULL AS ")
			core.WriteQuotedIdentifier(b, col.SQLName)
		}
	}

	return fromCTEs
}

// extendWithPermissionColumns delegates to permissions.Store; kept as an
// unexported method so the callsite in buildInsertMutationCTEPreCheck reads
// the same as before the extraction.
func (t *table) extendWithPermissionColumns(allColumns []string, role string) []string {
	return t.permissions.ExtendInsertColumns(allColumns, role, t.columnFromSQLName)
}

// requiresPostInsertCheck reports whether the insert-check for role must run
// after the INSERT (against RETURNING *) instead of against the input data.
// See permissions.Store.RequiresPostInsertCheck for the rationale; presentCols
// is the set of columns that carry a concrete value for every row, computed by
// insertPresentColumns.
func (t *table) requiresPostInsertCheck(
	role string,
	presentCols map[string]struct{},
) bool {
	return t.permissions.RequiresPostInsertCheck(role, presentCols, t.columnFromSQLName)
}

// insertPresentColumns returns the set of column SQL names that carry a
// concrete value for every row in insertObjs: the intersection of the columns
// explicitly supplied across all rows, plus FK columns whose value is sourced
// from a parent CTE (nestedFKIndex). Columns outside this set fall back to
// their database default for at least one row, which the pre-mutation check
// can't observe — see requiresPostInsertCheck.
func insertPresentColumns(
	insertObjs []arguments.InsertObject,
	nestedFKIndex arguments.NestedFKSources,
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

	for col := range nestedFKIndex {
		present[col] = struct{}{}
	}

	return present
}

// buildPostCheckCTEWithName builds a post-mutation permission check CTE with a custom name.
// This is used when an insert permission references columns whose final value
// is only known after the INSERT runs (generated columns, or DB-defaulted
// columns omitted from the payload), since those values are only available
// via RETURNING *. The CTE checks that ALL inserted rows pass the permission
// filter applied against the actual data.
//
// tableSubs threads through to permissions.Store.WriteInsertCheckSubstituted
// so that, when the post-check predicate reaches an in-flight sibling CTE via
// a relationship-EXISTS, the EXISTS subquery reads the CTE instead of the
// underlying table. This matches the pre-check path's substitution semantics
// (see buildCheckConstraintWhereClause) and is required for nested
// array-relationship children whose check column is defaulted-and-absent.
func (t *table) buildPostCheckCTEWithName(
	b *strings.Builder,
	checkName string,
	rawCTEName string,
	tableSubs where.TableSubstitutions,
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

	params, paramIndex, _, err := t.permissions.WriteInsertCheckSubstituted(
		b, role, sessionVariables, params, paramIndex, rawCTEName, tableSubs,
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

// buildPostCheckCTE builds a post-mutation permission check CTE named
// "post_check". Top-level callers pass tableSubs=nil because there is no
// parent CTE in flight to substitute into.
func (t *table) buildPostCheckCTE(
	b *strings.Builder,
	rawCTEName string,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	return t.buildPostCheckCTEWithName(
		b, "post_check", rawCTEName, nil, role, sessionVariables, params, paramIndex,
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
// Each SELECT includes all columns. For columns mapped in nestedFKIndex (FK
// columns whose values come from a sibling CTE) it selects the mapped CTE
// column; for columns absent from columnToValue[i] it falls back to NULL; otherwise it
// emits a typed placeholder. When any FK columns are referenced, each UNION
// ALL branch joins the relevant CTE(s) via FROM so the permission predicate
// in the surrounding check CTE sees the real FK value rather than NULL.
func (t *table) buildUnionAllSelect(
	b *strings.Builder,
	insertObjs []arguments.InsertObject,
	allColumns []string,
	columnToValue []map[string]any,
	nestedFKIndex arguments.NestedFKSources,
	params []any,
	paramIndex int,
) ([]any, int) {
	fromCTEs := collectFKSourceCTEs(allColumns, nestedFKIndex)

	for i := range insertObjs {
		if i > 0 {
			b.WriteString(" UNION ALL ")
		}

		b.WriteString("SELECT ")

		params, paramIndex = t.writeUnionAllRow(
			b, allColumns, columnToValue[i], nestedFKIndex, params, paramIndex,
		)

		writeFromCTEs(b, fromCTEs)
	}

	return params, paramIndex
}

// writeUnionAllRow emits the column list for a single UNION-ALL branch.
// Columns mapped in nestedFKIndex select their mapped source CTE column;
// columns present in rowValues emit a typed placeholder; remaining columns emit a typed NULL.
func (t *table) writeUnionAllRow(
	b *strings.Builder,
	allColumns []string,
	rowValues map[string]any,
	nestedFKIndex arguments.NestedFKSources,
	params []any,
	paramIndex int,
) ([]any, int) {
	for j, col := range allColumns {
		if j > 0 {
			b.WriteString(", ")
		}

		if source, isFK := nestedFKIndex[col]; isFK {
			writeFKSourceColumn(b, source.CTEName, source.ColumnName)
			b.WriteString(" AS ")
			core.WriteQuotedIdentifier(b, col)

			continue
		}

		colType := t.columnSQLType(col)

		value, hasValue := rowValues[col]
		if hasValue {
			params, paramIndex = t.writeTypedPlaceholder(b, col, colType, value, params, paramIndex)
		} else {
			t.writeTypedNull(b, col, colType)
		}
	}

	return params, paramIndex
}

// columnSQLType returns the SQL type registered for col on t, or "" if the
// column isn't in t.columns. "" signals to callers that no type-cast should
// be emitted.
func (t *table) columnSQLType(col string) string {
	for _, tableCol := range t.columns {
		if tableCol.SQLName == col {
			return tableCol.SQLType
		}
	}

	return ""
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
	ph := t.dialect.Placeholder(paramIndex)
	if colType != "" {
		b.WriteString(t.dialect.TypeCast(ph, colType))
	} else {
		b.WriteString(ph)
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

func writeFKSourceColumn(b *strings.Builder, cteName, columnName string) {
	b.WriteString(cteName)
	b.WriteByte('.')
	core.WriteQuotedIdentifier(b, columnName)
}

// writeFromCTEs appends a `FROM cte1, cte2, ...` clause to b. No-op when ctes
// is empty.
func writeFromCTEs(b *strings.Builder, ctes []string) {
	for k, cte := range ctes {
		if k == 0 {
			b.WriteString(" FROM ")
		} else {
			b.WriteString(", ")
		}

		b.WriteString(cte)
	}
}

// collectFKSourceCTEs returns the unique source CTEs (in stable order of
// first appearance) referenced by columns that are mapped in nestedFKIndex.
// Stable ordering keeps the generated SQL deterministic.
func collectFKSourceCTEs(columns []string, nestedFKIndex arguments.NestedFKSources) []string {
	if len(nestedFKIndex) == 0 {
		return nil
	}

	seen := make(map[string]struct{}, len(nestedFKIndex))

	var ctes []string

	for _, col := range columns {
		source, ok := nestedFKIndex[col]
		if !ok || source.CTEName == "" {
			continue
		}

		if _, dup := seen[source.CTEName]; dup {
			continue
		}

		seen[source.CTEName] = struct{}{}
		ctes = append(ctes, source.CTEName)
	}

	return ctes
}

// buildCheckMutationResultCTE builds the check_mutation_result CTE with permissions.
// This CTE contains all rows to be inserted after permission filtering.
// This path is used only for top-level inserts; there is no in-flight parent
// to substitute into relationship-EXISTS subqueries, so tableSubs is always
// nil here.
func (t *table) buildCheckMutationResultCTE(
	b *strings.Builder,
	insertObjs []arguments.InsertObject,
	allColumns []string,
	columnToValue []map[string]any,
	nestedFKIndex arguments.NestedFKSources,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, bool, error) {
	checkCTEName := "check_mutation_result"
	b.WriteString(checkCTEName)
	b.WriteString(" AS (SELECT * FROM (") //nolint:unqueryvet

	params, paramIndex = t.buildUnionAllSelect(
		b, insertObjs, allColumns, columnToValue, nestedFKIndex, params, paramIndex,
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
		nil,
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
	nestedFKIndex arguments.NestedFKSources,
	onConflict *arguments.OnConflict,
	hasCheckPermissions bool,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	checkCTEName := "check_mutation_result"

	finalColumns := insertColumnsWithNestedFK(allColumns, nestedFKIndex)

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
// pattern. This is the default path when no check-referenced column requires
// post-INSERT evaluation (see requiresPostInsertCheck): the check predicate is
// validated against the input data subquery before the INSERT runs.
func (t *table) buildInsertMutationCTEPreCheck(
	b *strings.Builder,
	insertObjs []arguments.InsertObject,
	allColumns []string,
	columnToValue []map[string]any,
	nestedFKIndex arguments.NestedFKSources,
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
		b, insertObjs, dataColumns, columnToValue, nestedFKIndex,
		role, sessionVariables, params, paramIndex,
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
// pattern. This is used when an insert-check-referenced column's final value is only known
// after the INSERT runs (generated columns, or DB-defaulted columns omitted from the payload —
// see requiresPostInsertCheck), so the predicate is validated against RETURNING *.
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
	nestedFKIndex arguments.NestedFKSources,
	onConflict *arguments.OnConflict,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	b.WriteString("insert_data AS (SELECT * FROM (") //nolint:unqueryvet

	params, paramIndex = t.buildUnionAllSelect(
		b, insertObjs, allColumns, columnToValue, nestedFKIndex, params, paramIndex,
	)

	b.WriteString(") AS data), ")

	finalColumns := insertColumnsWithNestedFK(allColumns, nestedFKIndex)

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

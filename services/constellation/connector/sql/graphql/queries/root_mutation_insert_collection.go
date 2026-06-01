package queries

import (
	"fmt"
	"sort"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
)

func (t *table) buildMutationInsertCollectionSQL(
	field *ast.Field,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
) (core.SQLOperation, error) {
	alias := field.Alias
	if alias == "" {
		alias = field.Name
	}

	insertObjs, onConflict, err := arguments.ParseInsertCollection(
		t, field.Arguments, variables, role, sessionVariables,
	)
	if err != nil {
		return core.SQLOperation{}, fmt.Errorf("failed to parse insert arguments: %w", err)
	}

	selection, err := t.astToMutationSelection(field, fragments)
	if err != nil {
		return core.SQLOperation{}, fmt.Errorf("failed to parse selection set: %w", err)
	}

	b := getBuilder()

	params, err := t.buildInsertCollectionSQL(
		b,
		insertObjs,
		onConflict,
		selection,
		fragments,
		variables,
		role,
		sessionVariables,
		roots,
	)
	if err != nil {
		putBuilder(b)

		return core.SQLOperation{}, fmt.Errorf("failed to build insert query: %w", err)
	}

	sql := b.String()
	putBuilder(b)

	return core.SQLOperation{
		Name:          alias,
		SQL:           sql,
		Parameters:    params,
		StreamCursors: nil,
	}, nil
}

// buildInsertCollectionSQL reuses buildInsertMutationCTE and wraps it with the
// {affected_rows, returning} response selection.
func (t *table) buildInsertCollectionSQL(
	b *strings.Builder,
	insertObjs []arguments.InsertObject,
	onConflict *arguments.OnConflict,
	selection mutationSelection,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
) ([]any, error) {
	params := make([]any, 0, len(insertObjs)*8) //nolint:mnd
	paramIndex := 1

	cteSQL, params, paramIndex, nestedCTERefs, err := t.buildInsertMutationCTE(
		insertObjs,
		onConflict,
		role,
		sessionVariables,
		params,
		paramIndex,
	)
	if err != nil {
		return nil, err
	}

	b.WriteString(cteSQL)
	b.WriteString(" ")

	// The two force-ref sites cover non-overlapping selection shapes, not
	// duplicate coverage. When the user requests only `affected_rows`, the
	// returning subquery is omitted entirely, so the affected_rows COUNT sum
	// is the only structural reference to the gated nested chain. When the
	// user requests only `returning { ... }`, selection.affectedRows is nil,
	// so the returning-side WHERE no-op is the only reference. When both are
	// selected the references duplicate harmlessly. Removing either site
	// silently regresses the shape it covers.
	if len(nestedCTERefs.allNames) > 0 {
		nestedNames := sortedNestedCTENames(nestedCTERefs.allNames)
		if selection.affectedRows != nil {
			selection.affectedRows.nestedCTENames = nestedNames
		}

		selection.returning.nestedCTENames = nestedNames
	}

	params, _, err = selection.WriteSQL(
		b,
		fragments,
		variables,
		role,
		sessionVariables,
		roots,
		params,
		paramIndex,
	)
	if err != nil {
		return nil, fmt.Errorf("error building mutation selection SQL: %w", err)
	}

	return params, nil
}

// buildInsertColumnsClause builds the column list for the INSERT statement.
func (t *table) buildInsertColumnsClause(
	b *strings.Builder,
	columns []string,
) {
	b.WriteString(" (")

	for i, col := range columns {
		if i > 0 {
			b.WriteString(", ")
		}

		core.WriteQuotedIdentifier(b, col)
	}

	b.WriteString(") SELECT ")
}

// buildInsertSelectClause builds the SELECT clause for the INSERT statement.
// It references columns from the check_constraint CTE or nested insert CTEs.
func (t *table) buildInsertSelectClause(
	b *strings.Builder,
	columns []string,
	checkCTEName string,
	nestedFKIndex arguments.NestedFKSources,
) {
	for i, col := range columns {
		if i > 0 {
			b.WriteString(", ")
		}

		if source, isNested := nestedFKIndex[col]; isNested {
			writeFKSourceColumn(b, source.CTEName, source.ColumnName)
		} else {
			b.WriteString(checkCTEName)
			b.WriteByte('.')
			core.WriteQuotedIdentifier(b, col)
		}
	}
}

// buildInsertFromClause builds the FROM clause for the INSERT statement.
func (t *table) buildInsertFromClause(
	b *strings.Builder,
	checkCTEName string,
	nestedFKIndex arguments.NestedFKSources,
) {
	b.WriteString(" FROM ")
	b.WriteString(checkCTEName)

	for _, refCTEName := range sortedNestedFKSourceCTEs(nestedFKIndex) {
		b.WriteString(", ")
		b.WriteString(refCTEName)
	}
}

func sortedNestedFKSourceCTEs(nestedFKIndex arguments.NestedFKSources) []string {
	if len(nestedFKIndex) == 0 {
		return nil
	}

	seen := make(map[string]struct{}, len(nestedFKIndex))
	ctes := make([]string, 0, len(nestedFKIndex))

	for _, source := range nestedFKIndex {
		if source.CTEName == "" {
			continue
		}

		if _, ok := seen[source.CTEName]; ok {
			continue
		}

		seen[source.CTEName] = struct{}{}
		ctes = append(ctes, source.CTEName)
	}

	sort.Strings(ctes)

	return ctes
}

// buildInsertWhereClause builds the WHERE clause for the INSERT statement.
// It forces evaluation of the check_count CTE to ensure permissions passed.
func (t *table) buildInsertWhereClause(
	b *strings.Builder,
	cteName string,
	hasCheckPermissions bool,
) {
	if hasCheckPermissions {
		checkCountCTEName := cteName + "_check_count"

		b.WriteString(" WHERE (SELECT status FROM ")
		b.WriteString(checkCountCTEName)
		b.WriteString(") = 1")
	}
}

// buildInsertCTE builds the INSERT INTO ... RETURNING * CTE.
func (t *table) buildInsertCTE(
	b *strings.Builder,
	cteName string,
	insertObj arguments.InsertObject,
	onConflict *arguments.OnConflict,
	checkCTEName string,
	nestedFKIndex arguments.NestedFKSources,
	hasCheckPermissions bool,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	b.WriteString(cteName)
	b.WriteString(" AS (INSERT INTO ")
	b.WriteString(t.tableFromClause())

	columnNames := insertObj.ColumnNames()

	t.buildInsertColumnsClause(b, columnNames)
	t.buildInsertSelectClause(b, columnNames, checkCTEName, nestedFKIndex)
	t.buildInsertFromClause(b, checkCTEName, nestedFKIndex)
	t.buildInsertWhereClause(b, cteName, hasCheckPermissions)

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

// buildSingleInsertCTE builds the check_constraint CTE and INSERT statement for a single insert operation.
// This is used for both top-level inserts and nested inserts to ensure consistent permissions handling.
// Dispatches to the pre-check or post-check path via requiresPostInsertCheck:
// post-check whenever a check-referenced column's final value is only known
// after the INSERT (generated columns, or DB-defaulted columns absent from
// the payload), pre-check otherwise. tableSubs redirects relationship-EXISTS
// subqueries that target a table being inserted into in the same statement to
// its parent CTE — nil for top-level inserts, populated for nested ones.
func (t *table) buildSingleInsertCTE(
	b *strings.Builder,
	cteName string,
	insertObj arguments.InsertObject,
	onConflict *arguments.OnConflict,
	nestedFKIndex arguments.NestedFKSources, // column -> source CTE column for foreign keys
	tableSubs where.TableSubstitutions,
	params []any,
	paramIndex int,
	role string,
	sessionVariables map[string]any,
) ([]any, int, error) {
	presentCols := insertPresentColumns([]arguments.InsertObject{insertObj}, nestedFKIndex)
	if t.requiresPostInsertCheck(role, presentCols) {
		return t.buildSingleInsertCTEPostCheck(
			b, cteName, insertObj, onConflict, nestedFKIndex, tableSubs,
			params, paramIndex, role, sessionVariables,
		)
	}

	return t.buildSingleInsertCTEPreCheck(
		b, cteName, insertObj, onConflict, nestedFKIndex, tableSubs,
		params, paramIndex, role, sessionVariables,
	)
}

// buildInsertMutationCTE builds the complete WITH clause including all CTEs up to and including mutation_result.
// This is shared by both insert_one and insert (multiple rows). Dispatches to
// the pre-check or post-check path the same way buildSingleInsertCTE does.
// Returns the CTE SQL, updated params, paramIndex, nested-insert CTE refs, and error.
func (t *table) buildInsertMutationCTE(
	insertObjs []arguments.InsertObject,
	onConflict *arguments.OnConflict,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) (string, []any, int, nestedInsertCTERefs, error) {
	var b strings.Builder

	b.WriteString("WITH ")

	nestedCTESQL, params, paramIndex, err := t.buildNestedInsertCTEs(
		insertObjs, role, sessionVariables, params, paramIndex,
	)
	if err != nil {
		return "", nil, 0, nestedInsertCTERefs{}, err
	}

	if nestedCTESQL != "" {
		b.WriteString(nestedCTESQL)
		b.WriteString(", ")
	}

	params, paramIndex, err = t.buildParentInsertMutationCTEBody(
		&b, insertObjs, onConflict, role, sessionVariables, params, paramIndex,
	)
	if err != nil {
		return "", nil, 0, nestedInsertCTERefs{}, err
	}

	// Array-relationship nested CTEs reference columns from mutation_result, so
	// they have to be emitted after the parent INSERT CTE.
	arrayNestedSQL, params, paramIndex, err := t.buildArrayNestedInsertCTEs(
		insertObjs, role, sessionVariables, params, paramIndex,
	)
	if err != nil {
		return "", nil, 0, nestedInsertCTERefs{}, err
	}

	if arrayNestedSQL != "" {
		b.WriteString(", ")
		b.WriteString(arrayNestedSQL)
	}

	nestedCTERefs, err := t.buildNestedCTERefs(insertObjs)
	if err != nil {
		return "", nil, 0, nestedInsertCTERefs{}, err
	}

	return b.String(), params, paramIndex, nestedCTERefs, nil
}

// buildParentInsertMutationCTEBody emits the parent INSERT CTE(s) up to and
// including mutation_result.
//
// A multi-parent insert that carries any nested insert (array- or
// object-relationship) takes the partitioned parent path: one parent CTE per
// input row. Array-rel children source their FK from mutation_result_N and
// object-rel parents source their FK from nested_<rel>_N — both need a
// per-parent parent CTE rather than a single mutation_result cross-joined onto
// every row. All other inserts use the shared single-body path.
func (t *table) buildParentInsertMutationCTEBody(
	b *strings.Builder,
	insertObjs []arguments.InsertObject,
	onConflict *arguments.OnConflict,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	if len(insertObjs) > 1 &&
		(hasArrayNestedInserts(insertObjs) || hasObjectNestedInserts(insertObjs)) {
		nestedFKIndexes, err := t.buildPartitionedNestedFKIndexes(insertObjs)
		if err != nil {
			return nil, 0, err
		}

		return t.buildPartitionedParentInsertMutationCTEBody(
			b, insertObjs, nestedFKIndexes, onConflict, role, sessionVariables, params, paramIndex,
		)
	}

	nestedFKIndex, err := t.buildNestedFKIndex(insertObjs)
	if err != nil {
		return nil, 0, err
	}

	nestedFKColumns := nestedFKColumnSet(nestedFKIndex)

	allColumns, columnToValue := t.collectAllColumns(insertObjs, nestedFKColumns)

	return t.buildInsertMutationCTEBody(
		b, insertObjs, allColumns, columnToValue,
		nestedFKIndex, onConflict, role, sessionVariables, params, paramIndex,
	)
}

// sortedNestedCTENames sorts the CTE names so affected_rows and force-ref
// projections are deterministic for golden-file diffs. Sorting on the CTE name
// keeps the convention used by `nested_<rel>` so multi-relationship inserts
// produce stable SQL, including split CTEs for incompatible nested on_conflict
// clauses.
func sortedNestedCTENames(names []string) []string {
	if len(names) == 0 {
		return nil
	}

	values := append([]string(nil), names...)
	sort.Strings(values)

	return values
}

// buildInsertMutationCTEBody emits the check + INSERT CTEs for a top-level
// insert, dispatching to the post-check path when the insert permission must
// be validated against the inserted row (see requiresPostInsertCheck) or the
// pre-check path otherwise.
func (t *table) buildInsertMutationCTEBody(
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
	presentCols := insertPresentColumns(insertObjs, nestedFKIndex)
	if t.requiresPostInsertCheck(role, presentCols) {
		return t.buildInsertMutationCTEPostCheck(
			b, insertObjs, allColumns, columnToValue,
			nestedFKIndex, onConflict, role, sessionVariables, params, paramIndex,
		)
	}

	return t.buildInsertMutationCTEPreCheck(
		b, insertObjs, allColumns, columnToValue,
		nestedFKIndex, onConflict, role, sessionVariables, params, paramIndex,
	)
}

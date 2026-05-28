package queries

import (
	"fmt"
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

	cteSQL, params, paramIndex, _, err := t.buildInsertMutationCTE(
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
	nestedFKIndex map[string]string,
) {
	for i, col := range columns {
		if i > 0 {
			b.WriteString(", ")
		}

		if refCTEName, isNested := nestedFKIndex[col]; isNested {
			b.WriteString(refCTEName)
			b.WriteString(".\"id\"")
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
	nestedFKIndex map[string]string,
) {
	b.WriteString(" FROM ")
	b.WriteString(checkCTEName)

	for _, refCTEName := range nestedFKIndex {
		b.WriteString(", ")
		b.WriteString(refCTEName)
	}
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
	nestedFKIndex map[string]string,
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
// Dispatches to the pre-check or post-check path depending on whether insert
// permissions reference generated columns (whose values are only available
// after the INSERT runs). tableSubs redirects relationship-EXISTS subqueries
// that target a table being inserted into in the same statement to its
// parent CTE — nil for top-level inserts, populated for nested ones.
func (t *table) buildSingleInsertCTE(
	b *strings.Builder,
	cteName string,
	insertObj arguments.InsertObject,
	onConflict *arguments.OnConflict,
	nestedFKIndex map[string]string, // column -> CTE name mapping for foreign keys
	tableSubs where.TableSubstitutions,
	params []any,
	paramIndex int,
	role string,
	sessionVariables map[string]any,
) ([]any, int, error) {
	presentCols := insertPresentColumns([]arguments.InsertObject{insertObj}, nestedFKIndex)
	if t.requiresPostInsertCheck(role, presentCols) {
		return t.buildSingleInsertCTEPostCheck(
			b, cteName, insertObj, onConflict, nestedFKIndex,
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
// Returns the CTE SQL, updated params, paramIndex, nestedCTEs map, and error.
func (t *table) buildInsertMutationCTE(
	insertObjs []arguments.InsertObject,
	onConflict *arguments.OnConflict,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) (string, []any, int, map[string]string, error) {
	var b strings.Builder

	b.WriteString("WITH ")

	nestedCTESQL, params, paramIndex, err := t.buildNestedInsertCTEs(
		insertObjs, role, sessionVariables, params, paramIndex,
	)
	if err != nil {
		return "", nil, 0, nil, err
	}

	if nestedCTESQL != "" {
		b.WriteString(nestedCTESQL)
		b.WriteString(", ")
	}

	nestedFKIndex := t.buildNestedFKIndex(insertObjs)

	nestedFKColumns := make(map[string]struct{})
	for col := range nestedFKIndex {
		nestedFKColumns[col] = struct{}{}
	}

	allColumns, columnToValue := t.collectAllColumns(insertObjs, nestedFKColumns)

	params, paramIndex, err = t.buildInsertMutationCTEBody(
		&b, insertObjs, allColumns, columnToValue,
		nestedFKIndex, onConflict, role, sessionVariables, params, paramIndex,
	)
	if err != nil {
		return "", nil, 0, nil, err
	}

	// Array-relationship nested CTEs reference mutation_result.<pk>, so they
	// have to be emitted after the parent INSERT CTE.
	arrayNestedSQL, params, paramIndex, err := t.buildArrayNestedInsertCTEs(
		insertObjs, role, sessionVariables, params, paramIndex,
	)
	if err != nil {
		return "", nil, 0, nil, err
	}

	if arrayNestedSQL != "" {
		b.WriteString(", ")
		b.WriteString(arrayNestedSQL)
	}

	nestedCTEs := t.buildNestedCTEsMap(insertObjs)

	return b.String(), params, paramIndex, nestedCTEs, nil
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
	nestedFKIndex map[string]string,
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

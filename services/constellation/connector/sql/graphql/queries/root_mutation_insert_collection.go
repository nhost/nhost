package queries

import (
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

//nolint:funlen // One root dispatch retains shared validation for flat and dependent inserts.
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

	selection, err := t.astToMutationSelection(field, fragments, role)
	if err != nil {
		return core.SQLOperation{}, fmt.Errorf("failed to parse selection set: %w", err)
	}

	if hasArrayNestedInserts(insertObjs) || hasObjectNestedInserts(insertObjs) {
		if !t.dialect.SupportsDependentInsertSteps() {
			return newInsertOperation(alias, unsupportedInsertPlan()), nil
		}

		level, err := t.buildInsertLevel(insertObjs, onConflict, role, sessionVariables, nil,
			"objects", false)
		if err != nil {
			return core.SQLOperation{}, fmt.Errorf("failed to plan dependent insert: %w", err)
		}

		plan, err := t.buildInsertFinalSQL(level, selection, fragments, variables,
			role, sessionVariables, roots)
		if err != nil {
			return core.SQLOperation{}, fmt.Errorf("failed to build dependent insert: %w", err)
		}

		return newInsertOperation(alias, &plan), nil
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
		Sequential:    nil,
		Insert:        nil,
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

	cteSQL, params, paramIndex, err := t.buildInsertMutationCTE(
		insertObjs,
		onConflict,
		role,
		sessionVariables,
		params,
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

// buildInsertSelectClause projects checked flat-insert columns.
func (t *table) buildInsertSelectClause(b *strings.Builder, columns []string, checkCTEName string) {
	for i, col := range columns {
		if i > 0 {
			b.WriteString(", ")
		}

		b.WriteString(checkCTEName)
		b.WriteByte('.')
		core.WriteQuotedIdentifier(b, col)
	}
}

// buildInsertMutationCTE renders a single-level INSERT and its permission checks.
// Both flat inserts and each dependent step use it; only the step planner
// traverses relationships, so nested writes are never one multi-level statement.
func (t *table) buildInsertMutationCTE(
	insertObjs []arguments.InsertObject,
	onConflict *arguments.OnConflict,
	role string,
	sessionVariables map[string]any,
	params []any,
) (string, []any, int, error) {
	var b strings.Builder
	b.WriteString("WITH ")

	paramIndex := 1

	allColumns, columnToValue := t.collectAllColumns(insertObjs)

	params, paramIndex, err := t.buildInsertMutationCTEBody(
		&b, insertObjs, allColumns, columnToValue,
		onConflict, role, sessionVariables, params, paramIndex,
	)
	if err != nil {
		return "", nil, 0, err
	}

	return b.String(), params, paramIndex, nil
}

// buildInsertMutationCTEBody emits the check + INSERT CTEs for a single-level
// insert (flat or dependent step), dispatching to the post-check path when the insert permission must
// be validated against the inserted row (see requiresPostInsertCheck) or the
// pre-check path otherwise.
func (t *table) buildInsertMutationCTEBody(
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
	presentCols := insertPresentColumns(insertObjs)
	if t.requiresPostInsertCheck(role, presentCols, onConflict) {
		return t.buildInsertMutationCTEPostCheck(
			b, insertObjs, allColumns, columnToValue,
			onConflict, role, sessionVariables, params, paramIndex,
		)
	}

	return t.buildInsertMutationCTEPreCheck(
		b, insertObjs, allColumns, columnToValue,
		onConflict, role, sessionVariables, params, paramIndex,
	)
}

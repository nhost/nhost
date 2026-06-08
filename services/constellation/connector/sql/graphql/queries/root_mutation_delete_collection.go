package queries

import (
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
)

// buildMutationDeleteCollectionSQL is intentionally parallel to
// buildMutationUpdateSQL — both are CTE-mutation dispatchers that parse
// arguments, build the selection, emit the SQL, and wrap the builder pool. The
// shared structure is clearer kept side by side than abstracted, so dupl is
// suppressed here exactly as it is on the update twin.
//
//nolint:dupl
func (t *table) buildMutationDeleteCollectionSQL(
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

	whereClause, err := arguments.ParseDelete(
		t, field.Arguments, variables, role, sessionVariables,
	)
	if err != nil {
		return core.SQLOperation{}, fmt.Errorf("failed to parse delete arguments: %w", err)
	}

	selection, err := t.astToMutationSelection(field, fragments)
	if err != nil {
		return core.SQLOperation{}, fmt.Errorf("failed to parse selection set: %w", err)
	}

	b := getBuilder()

	params, err := t.buildDeleteCollectionSQL(
		b,
		whereClause,
		selection,
		fragments,
		variables,
		role,
		sessionVariables,
		roots,
	)
	if err != nil {
		putBuilder(b)

		return core.SQLOperation{}, fmt.Errorf("failed to build DELETE SQL: %w", err)
	}

	sql := b.String()
	putBuilder(b)

	return core.SQLOperation{
		Name:          alias,
		SQL:           sql,
		Parameters:    params,
		StreamCursors: nil,
		Sequential:    nil,
	}, nil
}

// buildDeleteCTEBody builds just the CTE body for a DELETE (without "WITH " prefix).
// Returns: "cteName AS (DELETE FROM ... WHERE ... RETURNING *)".
func (t *table) buildDeleteCTEBody(
	b *strings.Builder,
	cteName string,
	whereClause where.Clause,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	b.WriteString(cteName)
	b.WriteString(" AS (DELETE FROM ")
	b.WriteString(t.tableFromClause())
	b.WriteString(" WHERE ")

	var err error

	// Apply the user's WHERE clause
	if len(whereClause) > 0 {
		params, paramIndex, err = whereClause.WriteCondition(
			b, t.tableName, params, paramIndex,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to write WHERE clause: %w", err)
		}
	} else {
		// No WHERE clause means delete all rows (with permissions)
		b.WriteString("true")
	}

	if t.permissions.HasDeleteFilter(role) {
		b.WriteString(" AND (")

		params, paramIndex, _, err = t.permissions.WriteDeleteFilter(
			b, params, paramIndex, role, sessionVariables, t.tableName,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to apply delete permissions: %w", err)
		}

		b.WriteString(")")
	}

	b.WriteString(" RETURNING *)")

	return params, paramIndex, nil
}

// buildDeleteCollectionSQL builds the complete DELETE query with CTEs for permissions.
func (t *table) buildDeleteCollectionSQL(
	b *strings.Builder,
	whereClause where.Clause,
	selection mutationSelection,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
) ([]any, error) {
	var (
		params     = make([]any, 0, 8) //nolint:mnd
		paramIndex = 1
	)

	b.WriteString("WITH ")

	params, paramIndex, err := t.buildDeleteCTEBody(
		b,
		"mutation_result",
		whereClause,
		role,
		sessionVariables,
		params,
		paramIndex,
	)
	if err != nil {
		return nil, err
	}

	b.WriteString(" ")

	params, _, err = selection.WriteSQL(
		b, fragments, variables, role, sessionVariables, roots, params, paramIndex,
	)
	if err != nil {
		return nil, err
	}

	return params, nil
}

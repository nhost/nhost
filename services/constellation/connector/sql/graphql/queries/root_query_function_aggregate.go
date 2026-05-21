package queries

import (
	"fmt"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

// buildQueryFunctionAggregateSQL builds the SQL for a function aggregate query.
func (t *table) buildQueryFunctionAggregateSQL(
	fn *function,
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

	b := getBuilder()

	// Parse function arguments
	fnArgs, err := fn.parseFunctionArguments(field.Arguments, variables)
	if err != nil {
		putBuilder(b)

		return core.SQLOperation{}, fmt.Errorf("failed to parse function arguments: %w", err)
	}

	// Build the function call FROM clause
	fnCall, err := fn.buildFunctionFromClause(fnArgs, sessionVariables, []any{}, 1)
	if err != nil {
		putBuilder(b)

		return core.SQLOperation{}, fmt.Errorf("failed to build function FROM clause: %w", err)
	}

	// Build aggregate query using function as source
	params, _, err := t.writeQueryAggregateSQL(
		b,
		field,
		fragments,
		variables,
		role,
		sessionVariables,
		roots,
		fnCall.params,
		fnCall.paramIndex,
		alias,
		fnCall.fromClause,
		fnCall.sourceRef,
	)
	if err != nil {
		putBuilder(b)

		return core.SQLOperation{}, fmt.Errorf("failed to build function aggregate SQL: %w", err)
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

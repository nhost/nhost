package queries

import (
	"fmt"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

// buildQueryFunctionCollectionSQL builds the SQL for a function select query.
func (t *table) buildQueryFunctionCollectionSQL( //nolint:funlen
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

	// Outer aggregation: SELECT coalesce(json_agg("_root"), '[]') AS "alias" FROM (
	b.WriteString("SELECT ")
	b.WriteString(t.dialect.CoalesceJSONArray("_root"))
	b.WriteString(` AS "`)
	b.WriteString(alias)
	b.WriteString(`" FROM (`)

	params, _, err := t.buildQuerySQL(
		b,
		field,
		fragments,
		variables,
		role,
		sessionVariables,
		roots,
		fnCall.params,
		fnCall.paramIndex,
		"_root",
		"_root",
		fnCall.fromClause,
		fnCall.sourceRef,
		rootFieldName(field),
	)
	if err != nil {
		putBuilder(b)

		return core.SQLOperation{}, fmt.Errorf("failed to build function query SQL: %w", err)
	}

	b.WriteString(") AS \"_root\"")

	sql := b.String()
	putBuilder(b)

	return core.SQLOperation{
		Name:          alias,
		SQL:           sql,
		Parameters:    params,
		StreamCursors: nil,
	}, nil
}

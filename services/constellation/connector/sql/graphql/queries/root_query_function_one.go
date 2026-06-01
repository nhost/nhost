package queries

import (
	"fmt"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
)

// buildQueryFunctionOneSQL builds the SQL for a function that returns a single row.
func (t *table) buildQueryFunctionOneSQL(
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

	// Functions returning a single row are queried like by_pk; force LIMIT 1.
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
		func(whereClause where.Clause, modifiers []arguments.QueryModifier) (where.Clause, []arguments.QueryModifier) {
			return whereClause, append(modifiers, &arguments.Limit{Value: 1})
		},
	)
	if err != nil {
		putBuilder(b)

		return core.SQLOperation{}, fmt.Errorf("failed to build function query SQL: %w", err)
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

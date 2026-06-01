package queries

import (
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

func (t *table) buildMutationUpdateByPkSQL(
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

	update, err := arguments.ParseUpdate(t, field.Arguments, variables, role, sessionVariables)
	if err != nil {
		return core.SQLOperation{}, fmt.Errorf("failed to parse update_by_pk arguments: %w", err)
	}

	// update_by_pk returns a single object, not mutation_response
	// So we use astToQuerySelection instead of astToMutationSelection
	columns, relationships, err := t.astToQuerySelection(
		field,
		fragments,
	)
	if err != nil {
		return core.SQLOperation{}, fmt.Errorf("failed to parse selection set: %w", err)
	}

	b := getBuilder()

	params, err := t.buildUpdateByPkSQL(
		b, update, columns, relationships, fragments, variables, role, sessionVariables, roots,
		rootFieldName(field),
	)
	if err != nil {
		putBuilder(b)

		return core.SQLOperation{}, fmt.Errorf("failed to build UPDATE BY PK SQL: %w", err)
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

func (t *table) buildUpdateByPkSQL(
	b *strings.Builder,
	update arguments.Update,
	columns []columnSelection,
	relationships []relationshipSelection,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
	argumentPath string,
) ([]any, error) {
	var (
		params     = make([]any, 0, 8) //nolint:mnd
		paramIndex = 1
	)

	// Build WITH clause + UPDATE CTE
	b.WriteString("WITH ")

	var err error

	params, paramIndex, err = t.buildUpdateCTEBody(
		b,
		"mutation_result",
		update,
		role,
		sessionVariables,
		params,
		paramIndex,
	)
	if err != nil {
		return nil, err
	}

	b.WriteString(" ")

	// Build SELECT for single row (reusing buildFinalSelect from insert_one)
	// This returns row_to_json for the single updated object
	params, err = t.buildFinalSelect(
		b,
		columns,
		relationships,
		nil, // no nested selection CTEs
		nil, // no nested force-ref CTEs
		fragments,
		variables,
		role,
		sessionVariables,
		roots,
		params,
		paramIndex,
		argumentPath,
	)
	if err != nil {
		return nil, err
	}

	return params, nil
}

package queries

import (
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
)

func (t *table) buildMutationDeleteByPkSQL(
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

	whereClause, err := arguments.ParseDeleteByPk(t, field.Arguments, variables)
	if err != nil {
		return core.SQLOperation{}, fmt.Errorf("failed to parse delete_by_pk arguments: %w", err)
	}

	// delete_by_pk returns a single object, not mutation_response
	// So we use astToQuerySelection instead of astToMutationSelection
	columns, relationships, err := t.astToQuerySelection(
		field,
		fragments,
	)
	if err != nil {
		return core.SQLOperation{}, fmt.Errorf("failed to parse selection set: %w", err)
	}

	b := getBuilder()

	params, err := t.buildDeleteByPkSQL(
		b, field, whereClause, columns, relationships,
		fragments, variables, role, sessionVariables, roots,
	)
	if err != nil {
		putBuilder(b)

		return core.SQLOperation{}, fmt.Errorf("failed to build DELETE BY PK SQL: %w", err)
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

func (t *table) buildDeleteByPkSQL(
	b *strings.Builder,
	field *ast.Field,
	whereClause where.Clause,
	columns []columnSelection,
	relationships []relationshipSelection,
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

	// Build WITH clause + DELETE CTE
	b.WriteString("WITH ")

	var err error

	params, _, err = t.buildDeleteCTEBody(
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

	if err := t.buildDeleteFinalSelect(
		b, columns, relationships, fragments, variables, role,
		sessionVariables, roots, rootFieldName(field),
	); err != nil {
		return nil, err
	}

	return params, nil
}

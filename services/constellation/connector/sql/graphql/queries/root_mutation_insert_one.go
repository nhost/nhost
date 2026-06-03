package queries

import (
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

func (t *table) buildMutationInsertOneSQL(
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

	insertObj, onConflict, err := arguments.ParseInsert(
		t, field.Arguments, variables, role, sessionVariables,
	)
	if err != nil {
		return core.SQLOperation{}, fmt.Errorf("failed to parse insert_one arguments: %w", err)
	}

	columns, relationships, err := t.astToQuerySelection(
		field,
		fragments,
	)
	if err != nil {
		return core.SQLOperation{}, fmt.Errorf("failed to parse selection set: %w", err)
	}

	b := getBuilder()

	params, err := t.buildInsertSQL(
		b,
		insertObj,
		onConflict,
		columns,
		relationships,
		fragments,
		variables,
		role,
		sessionVariables,
		roots,
		rootFieldName(field),
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
	}, nil
}

// buildInsertSQL builds the complete INSERT query with CTEs for permissions.
func (t *table) buildInsertSQL(
	b *strings.Builder,
	insertObj arguments.InsertObject,
	onConflict *arguments.OnConflict,
	columns []columnSelection,
	relationships []relationshipSelection,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
	argumentPath string,
) ([]any, error) {
	params := make([]any, 0, 16) //nolint:mnd
	paramIndex := 1

	// Build the mutation CTEs
	cteSQL, params, paramIndex, nestedCTERefs, err := t.buildInsertMutationCTE(
		[]arguments.InsertObject{insertObj},
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

	// Build the final SELECT with field selection.
	params, err = t.buildFinalSelect(
		b,
		columns,
		relationships,
		nestedCTERefs.direct,
		nestedCTERefs.allNames,
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

package queries

import (
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

func (t *table) buildQueryCollectionSQL(
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

	params, _, err := t.writeQueryCollectionSQL(
		b,
		field,
		fragments,
		variables,
		role,
		sessionVariables,
		roots,
		[]any{},
		1,
		"_root",
		"_root",
	)
	if err != nil {
		putBuilder(b)

		return core.SQLOperation{}, fmt.Errorf("failed to build query SQL: %w", err)
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

// writeQueryCollectionSQL wraps buildQuerySQL with the outer json_agg/coalesce
// aggregation that yields a single JSON array per collection field, emitted
// into b.
func (t *table) writeQueryCollectionSQL(
	b *strings.Builder,
	field *ast.Field,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
	params []any,
	paramIndex int,
	alias string,
	relName string,
	queryModifiers ...queryModifierFunc,
) ([]any, int, error) {
	b.WriteString("SELECT ")
	b.WriteString(t.dialect.CoalesceJSONArray(alias))
	b.WriteString(` AS "`)
	b.WriteString(relName)
	b.WriteString(`" FROM (`)

	params, paramIndex, err := t.buildQuerySQL(
		b,
		field,
		fragments,
		variables,
		role,
		sessionVariables,
		roots,
		params,
		paramIndex,
		alias,
		alias,
		t.tableFromClause(),
		t.tableSourceRef(),
		queryModifiers...,
	)
	if err != nil {
		return nil, 0, err
	}

	b.WriteString(`) AS "`)
	b.WriteString(alias)
	b.WriteByte('"')

	return params, paramIndex, nil
}

package queries

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

func (t *table) buildMutationUpdateManySQL( //nolint:dupl
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

	updates, err := arguments.ParseUpdateMany(
		t, field.Arguments, variables, role, sessionVariables,
	)
	if err != nil {
		return core.SQLOperation{}, fmt.Errorf("failed to parse update_many arguments: %w", err)
	}

	selection, err := t.astToMutationSelection(field, fragments)
	if err != nil {
		return core.SQLOperation{}, fmt.Errorf("failed to parse selection set: %w", err)
	}

	b := getBuilder()

	params, err := t.writeMutationUpdateManySQL(
		b, updates, selection, fragments, variables, role, sessionVariables, roots,
	)
	if err != nil {
		putBuilder(b)

		return core.SQLOperation{}, fmt.Errorf("failed to build UPDATE MANY SQL: %w", err)
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

// writeMutationUpdateManySQL emits the SQL for the update_many root field —
// a sequence of update CTEs followed by a SELECT json_build_array — into b.
func (t *table) writeMutationUpdateManySQL(
	b *strings.Builder,
	updates []arguments.Update,
	selection mutationSelection,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
) ([]any, error) {
	var (
		params     = make([]any, 0, len(updates)*8) //nolint:mnd
		paramIndex = 1
		cteNames   = make([]string, len(updates))
		err        error
	)

	// Build CTEs
	b.WriteString("WITH ")

	for i := range updates {
		cteName := "mutation_result_" + strconv.Itoa(i)
		cteNames[i] = cteName

		if i > 0 {
			b.WriteString(", ")
		}

		params, paramIndex, err = t.buildUpdateCTEBody(
			b, cteName, updates[i], role, sessionVariables, params, paramIndex,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to build UPDATE SQL for index %d: %w", i, err)
		}
	}

	// Build SELECT with jsonb_build_array
	b.WriteString(" SELECT ")
	b.WriteString(t.dialect.JSONBuildArray())
	b.WriteByte('(')

	for i, cteName := range cteNames {
		if i > 0 {
			b.WriteString(", ")
		}

		b.WriteString("(")

		params, paramIndex, err = selection.WriteSQLWithCTE(
			b, cteName, fragments, variables, role, sessionVariables, roots, params, paramIndex,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to write SELECT for index %d: %w", i, err)
		}

		b.WriteString(")")
	}

	b.WriteString(")")

	return params, nil
}

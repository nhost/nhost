package queries

import (
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

// This file contains shared functions for building the final SELECT statement
// for single-row mutation operations (insert_one, update_by_pk, delete_by_pk).
//
// These functions are separate from the mutationSelection type which handles
// collection operations (insert, update, delete) with affected_rows and returning.

// buildColumnSelections builds the column selections from mutation_result for the final SELECT.
func (t *table) buildColumnSelections(
	b *strings.Builder,
	columns []columnSelection,
	first *bool,
	variables, sessionVariables map[string]any,
	params []any,
	paramIndex int,
	argumentPath string,
) ([]any, int, error) {
	for _, colSel := range columns {
		if !*first {
			b.WriteString(", ")
		}

		switch {
		case colSel.computed != nil:
			var err error

			params, paramIndex, err = t.writeComputedScalar(
				b, colSel, "mutation_result", childArgumentPath(argumentPath, colSel.field),
				variables, sessionVariables, params, paramIndex,
			)
			if err != nil {
				return nil, 0, fmt.Errorf("building computed mutation result: %w", err)
			}
		case colSel.literal != "":
			t.dialect.WriteJSONRowColumn(b, colSel.alias, "'"+colSel.literal+"'")
		default:
			expr := "mutation_result." + core.QuoteIdentifier(colSel.column.SQLName)
			t.dialect.WriteJSONRowColumn(
				b, colSel.alias, t.outputColumnExpression(expr, colSel.column),
			)
		}

		*first = false
	}

	return params, paramIndex, nil
}

// buildLateralJoinSelection builds a selection reference to a LATERAL join.
func (t *table) buildLateralJoinSelection(
	b *strings.Builder,
	relSel relationshipSelection,
	first *bool,
) {
	if !*first {
		b.WriteString(", ")
	}

	relAlias := sqlAlias("mutation_result.r.", relSel.alias)
	t.dialect.WriteJSONRowColumn(b, relSel.alias,
		`"`+relAlias+`"."`+relSel.alias+`"`)

	*first = false
}

// buildLateralJoins builds LEFT OUTER JOIN LATERAL for returning relationships.
func (t *table) buildLateralJoins(
	b *strings.Builder,
	relationships []relationshipSelection,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
	params []any,
	paramIndex int,
	argumentPath string,
) ([]any, int, error) {
	for _, relSel := range relationships {
		relAlias := sqlAlias("mutation_result.r.", relSel.alias)

		b.WriteString(" LEFT OUTER JOIN LATERAL (")

		var err error

		params, paramIndex, err = relSel.buildSelectionSQL(
			b,
			relSel.field,
			fragments,
			variables,
			role,
			sessionVariables,
			roots,
			params,
			paramIndex,
			"mutation_result",
			relAlias,
			argumentPath,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("error building relationship %s: %w", relSel.alias, err)
		}

		b.WriteString(`) AS "`)
		b.WriteString(relAlias)
		b.WriteString(`" ON ('true')`)
	}

	return params, paramIndex, nil
}

// buildFinalSelect builds the final SELECT statement that returns the mutated data.
// Used by insert_one and update_by_pk for single-row mutations with relationship support.
func (t *table) buildFinalSelect( //nolint:funlen
	b *strings.Builder,
	columns []columnSelection,
	relationships []relationshipSelection,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
	params []any,
	paramIndex int,
	argumentPath string,
) ([]any, error) {
	if len(columns) == 0 && len(relationships) == 0 {
		// No fields selected, just return the mutated row
		b.WriteString("SELECT ")
		b.WriteString(t.dialect.ToJSON("mutation_result.*"))
		b.WriteString(" FROM mutation_result")

		return params, nil
	}

	b.WriteString("SELECT ")
	t.dialect.WriteJSONRowPrefix(b)

	first := true

	// Add column selections
	var err error

	params, paramIndex, err = t.buildColumnSelections(
		b, columns, &first, variables, sessionVariables, params, paramIndex, argumentPath,
	)
	if err != nil {
		return nil, err
	}

	if t.dialect.SupportsLateral() {
		for _, rel := range relationships {
			t.buildLateralJoinSelection(b, rel, &first)
		}

		t.dialect.WriteJSONRowSuffixNoAlias(b)
		b.WriteString(" FROM mutation_result")

		// Add LEFT OUTER JOIN LATERAL for each returning relationship.
		params, _, err = t.buildLateralJoins(
			b, relationships, fragments, variables,
			role, sessionVariables, roots, params, paramIndex, argumentPath,
		)
		if err != nil {
			return nil, err
		}
	} else {
		// SQLite embeds relationships as correlated subqueries.
		for _, relSel := range relationships {
			if !first {
				b.WriteString(", ")
			}

			relAlias := sqlAlias("mutation_result.r.", relSel.alias)

			b.WriteByte('\'')
			b.WriteString(relSel.alias)
			b.WriteString("', (")

			var relErr error

			params, paramIndex, relErr = relSel.buildSelectionSQL(
				b, relSel.field, fragments, variables, role, sessionVariables,
				roots, params, paramIndex, "mutation_result", relAlias, argumentPath,
			)
			if relErr != nil {
				return nil, fmt.Errorf("error building relationship %s: %w", relSel.alias, relErr)
			}

			b.WriteString(")")

			first = false
		}

		t.dialect.WriteJSONRowSuffixNoAlias(b)
		b.WriteString(" FROM mutation_result")
	}

	return params, nil
}

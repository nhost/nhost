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
) {
	for _, colSel := range columns {
		if !*first {
			b.WriteString(", ")
		}

		if colSel.literal != "" {
			t.dialect.WriteJSONRowColumn(b, colSel.alias, "'"+colSel.literal+"'")
		} else {
			t.dialect.WriteJSONRowColumn(b, colSel.alias,
				"mutation_result."+core.QuoteIdentifier(colSel.column.SQLName))
		}

		*first = false
	}
}

// buildNestedInsertSelection builds a selection from a nested insert CTE.
func (t *table) buildNestedInsertSelection(
	b *strings.Builder,
	relSel relationshipSelection,
	cteName string,
	fragments ast.FragmentDefinitionList,
	first *bool,
) error {
	if !*first {
		b.WriteString(", ")
	}

	relColumns, _, err := relSel.relationship.table.astToQuerySelection(
		relSel.field,
		fragments,
	)
	if err != nil {
		return err
	}

	// For nested inserts, use a scalar subquery wrapping the JSON row
	nestedExpr := &strings.Builder{}
	nestedExpr.WriteString("(SELECT ")
	t.dialect.WriteJSONRowPrefix(nestedExpr)

	for j, sf := range relColumns {
		if j > 0 {
			nestedExpr.WriteString(", ")
		}

		t.dialect.WriteJSONRowColumn(nestedExpr, sf.alias,
			core.QuoteIdentifier(sf.column.SQLName))
	}

	t.dialect.WriteJSONRowSuffixNoAlias(nestedExpr)
	nestedExpr.WriteString(" FROM ")
	nestedExpr.WriteString(cteName)
	nestedExpr.WriteString(" LIMIT 1)")

	t.dialect.WriteJSONRowColumn(b, relSel.alias, nestedExpr.String())

	*first = false

	return nil
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

	relAlias := "mutation_result.r." + relSel.alias
	t.dialect.WriteJSONRowColumn(b, relSel.alias,
		`"`+relAlias+`"."`+relSel.alias+`"`)

	*first = false
}

func nestedSelectionCTEName(
	nestedSelectionCTEs map[string]string,
	relSel relationshipSelection,
) (string, bool) {
	key := relSel.alias
	if relSel.field != nil {
		key = relSel.field.Name
	}

	cteName, ok := nestedSelectionCTEs[key]

	return cteName, ok
}

// buildRelationshipSelectionsLateral builds relationship selections for LATERAL join mode.
func (t *table) buildRelationshipSelectionsLateral(
	b *strings.Builder,
	relationships []relationshipSelection,
	nestedSelectionCTEs map[string]string,
	fragments ast.FragmentDefinitionList,
	first *bool,
) error {
	for _, relSel := range relationships {
		if cteName, isNested := nestedSelectionCTEName(nestedSelectionCTEs, relSel); isNested {
			if err := t.buildNestedInsertSelection(
				b,
				relSel,
				cteName,
				fragments,
				first,
			); err != nil {
				return err
			}
		} else {
			t.buildLateralJoinSelection(b, relSel, first)
		}
	}

	return nil
}

// buildLateralJoins builds LEFT OUTER JOIN LATERAL for non-nested relationships.
func (t *table) buildLateralJoins(
	b *strings.Builder,
	relationships []relationshipSelection,
	nestedSelectionCTEs map[string]string,
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
		// Skip relationships that were direct nested inserts.
		if _, isNested := nestedSelectionCTEName(nestedSelectionCTEs, relSel); isNested {
			continue
		}

		relAlias := "mutation_result.r." + relSel.alias

		b.WriteString(" LEFT OUTER JOIN LATERAL (")

		var err error

		params, paramIndex, err = relSel.relationship.buildSelectionSQL(
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
	nestedSelectionCTEs map[string]string,
	nestedCTENames []string,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
	params []any,
	paramIndex int,
	argumentPath string,
) ([]any, error) {
	// nestedForceRefNames lists every nested-insert CTE this top-level
	// insert produced. Emitted as a no-op WHERE so the gated subset
	// (array-rel children with a post-INSERT check) is not elided by
	// Postgres. Non-gated CTEs are referenced redundantly but harmlessly
	// — see writeNestedCTEForceRef.
	nestedForceRefNames := sortedNestedCTENames(nestedCTENames)

	if len(columns) == 0 && len(relationships) == 0 {
		// No fields selected, just return the mutated row
		b.WriteString("SELECT ")
		b.WriteString(t.dialect.ToJSON("mutation_result.*"))
		b.WriteString(" FROM mutation_result")
		writeNestedCTEForceRef(b, nestedForceRefNames)

		return params, nil
	}

	b.WriteString("SELECT ")
	t.dialect.WriteJSONRowPrefix(b)

	first := true

	// Add column selections
	t.buildColumnSelections(b, columns, &first)

	if t.dialect.SupportsLateral() { //nolint:nestif
		// PostgreSQL: reference LATERAL aliases + nested CTE subqueries
		if err := t.buildRelationshipSelectionsLateral(
			b, relationships, nestedSelectionCTEs, fragments, &first,
		); err != nil {
			return nil, err
		}

		t.dialect.WriteJSONRowSuffixNoAlias(b)
		b.WriteString(" FROM mutation_result")

		// Add LEFT OUTER JOIN LATERAL for each non-nested relationship
		var err error

		params, _, err = t.buildLateralJoins(
			b, relationships, nestedSelectionCTEs, fragments, variables,
			role, sessionVariables, roots, params, paramIndex, argumentPath,
		)
		if err != nil {
			return nil, err
		}

		// Append the nested-CTE force reference AFTER the LATERAL joins
		// so it parses as a SELECT-level WHERE clause.
		writeNestedCTEForceRef(b, nestedForceRefNames)
	} else {
		// SQLite: embed relationships as correlated subqueries or nested CTE subqueries
		for _, relSel := range relationships {
			if cteName, isNested := nestedSelectionCTEName(nestedSelectionCTEs, relSel); isNested {
				if err := t.buildNestedInsertSelection(
					b, relSel, cteName, fragments, &first,
				); err != nil {
					return nil, err
				}
			} else {
				if !first {
					b.WriteString(", ")
				}

				relAlias := "mutation_result.r." + relSel.alias

				b.WriteByte('\'')
				b.WriteString(relSel.alias)
				b.WriteString("', (")

				var err error

				params, paramIndex, err = relSel.relationship.buildSelectionSQL(
					b, relSel.field, fragments, variables, role, sessionVariables,
					roots, params, paramIndex, "mutation_result", relAlias, argumentPath,
				)
				if err != nil {
					return nil, fmt.Errorf("error building relationship %s: %w", relSel.alias, err)
				}

				b.WriteString(")")

				first = false
			}
		}

		t.dialect.WriteJSONRowSuffixNoAlias(b)
		b.WriteString(" FROM mutation_result")
		writeNestedCTEForceRef(b, nestedForceRefNames)
	}

	return params, nil
}

// buildDeleteFinalSelect builds the final SELECT for delete_by_pk mutations.
// It returns columns normally but returns empty arrays for relationships
// since the related data cannot be fetched after deletion. The relationship
// arguments are still validated first (the same parsing the SELECT path runs),
// so an invalid argument rejects the whole mutation with no row deleted,
// matching Hasura, rather than being silently dropped by the empty-array path.
func (t *table) buildDeleteFinalSelect(
	b *strings.Builder,
	columns []columnSelection,
	relationships []relationshipSelection,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
	argumentPath string,
) error {
	if err := validateReturningRelationshipArgs(
		relationships, fragments, variables, role, sessionVariables, roots, argumentPath,
	); err != nil {
		return err
	}

	b.WriteString("SELECT ")
	t.dialect.WriteJSONRowPrefix(b)

	first := true

	for _, colSel := range columns {
		if !first {
			b.WriteString(", ")
		}

		if colSel.literal != "" {
			t.dialect.WriteJSONRowColumn(b, colSel.alias, "'"+colSel.literal+"'")
		} else {
			t.dialect.WriteJSONRowColumn(b, colSel.alias,
				"mutation_result."+core.QuoteIdentifier(colSel.column.SQLName))
		}

		first = false
	}

	// Add relationship selections as empty arrays
	for _, relSel := range relationships {
		if !first {
			b.WriteString(", ")
		}

		t.dialect.WriteJSONRowColumn(b, relSel.alias, t.dialect.EmptyJSONArray())

		first = false
	}

	t.dialect.WriteJSONRowSuffixNoAlias(b)
	b.WriteString(" FROM mutation_result")

	return nil
}

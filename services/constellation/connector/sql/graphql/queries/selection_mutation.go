package queries

import (
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
)

type mutationSelection struct {
	typenames    []typenameSelection
	affectedRows *selectionAffectedRows
	returning    selectionReturning
	dialect      dialect.Dialect
}

// WriteSQL writes the SELECT for mutation results against the default
// "mutation_result" CTE name.
func (s mutationSelection) WriteSQL(
	b *strings.Builder,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	return s.WriteSQLWithCTE(
		b, "mutation_result",
		fragments, variables, role, sessionVariables, roots, params, paramIndex,
	)
}

// WriteSQLWithCTE writes the SELECT for mutation results using a custom CTE name.
func (s mutationSelection) WriteSQLWithCTE(
	b *strings.Builder,
	cteName string,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	b.WriteString("SELECT ")
	b.WriteString(s.dialect.JSONBuildObject())
	b.WriteByte('(')

	hasReturning := s.hasReturningSelection()
	hasFields := false

	for i := range s.typenames {
		if hasFields {
			b.WriteString(", ")
		}

		s.typenames[i].Write(b)

		hasFields = true
	}

	if s.affectedRows != nil {
		if hasFields {
			b.WriteString(", ")
		}

		s.affectedRows.WriteSQLWithCTE(cteName, b)

		hasFields = true
	}

	if hasReturning && hasFields {
		b.WriteString(", ")
	}

	params, paramIndex, err := s.returning.writeSQLWithCTE(
		cteName, b, fragments, variables, role, sessionVariables, roots, params, paramIndex,
	)
	if err != nil {
		return nil, 0, err
	}

	if hasReturning {
		b.WriteString(") AS \"_e\"))")
	} else {
		b.WriteString(")")
	}

	if len(s.typenames) > 0 && !s.referencesMutationResult() {
		s.writeMutationResultForceRef(b, cteName)
	}

	return params, paramIndex, nil
}

func (s mutationSelection) hasReturningSelection() bool {
	return len(s.returning.columns) > 0 || len(s.returning.relationships) > 0
}

func (s mutationSelection) referencesMutationResult() bool {
	return s.affectedRows != nil || s.hasReturningSelection()
}

// writeMutationResultForceRef keeps typename-only mutation selections tied to
// the final mutation CTE. COUNT(*) is a logical no-op, but it forces PostgreSQL
// to evaluate permission-gating SELECT CTEs that feed mutation_result.
func (s mutationSelection) writeMutationResultForceRef(b *strings.Builder, cteName string) {
	b.WriteString(" WHERE (SELECT COUNT(*) FROM ")
	b.WriteString(cteName)
	b.WriteString(") IS NOT NULL")
}

type selectionAffectedRows struct {
	alias string
	// extraCountCTEs includes the non-root count supplied by dependent steps.
	extraCountCTEs []string
}

// WriteSQL writes the affected_rows JSON pair against the default
// "mutation_result" CTE.
func (s selectionAffectedRows) WriteSQL(b *strings.Builder) {
	s.WriteSQLWithCTE("mutation_result", b)
}

// WriteSQLWithCTE counts root rows and any separate dependent-step counts.
func (s selectionAffectedRows) WriteSQLWithCTE(cteName string, b *strings.Builder) {
	alias := s.alias
	if alias == "" {
		alias = "affected_rows"
	}

	b.WriteByte('\'')
	b.WriteString(alias)
	b.WriteString("', ")

	if len(s.extraCountCTEs) == 0 {
		b.WriteString("(SELECT COUNT(*) FROM ")
		b.WriteString(cteName)
		b.WriteByte(')')

		return
	}

	b.WriteString("((SELECT COUNT(*) FROM ")
	b.WriteString(cteName)
	b.WriteByte(')')

	for _, nested := range s.extraCountCTEs {
		b.WriteString(" + (SELECT COUNT(*) FROM ")
		b.WriteString(nested)
		b.WriteByte(')')
	}

	b.WriteByte(')')
}

type selectionReturning struct {
	alias         string
	argumentPath  string
	columns       []columnSelection
	relationships []relationshipSelection
	table         *table
	dialect       dialect.Dialect
}

// WriteSQL writes the returning JSON pair against the default
// "mutation_result" CTE.
func (s selectionReturning) WriteSQL(
	b *strings.Builder,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	return s.writeSQLWithCTE(
		"mutation_result",
		b, fragments, variables, role, sessionVariables, roots, params, paramIndex,
	)
}

func (s selectionReturning) writeSQLWithCTE(
	cteName string,
	b *strings.Builder,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	if len(s.columns) == 0 && len(s.relationships) == 0 {
		return params, paramIndex, nil
	}

	alias := s.alias
	if alias == "" {
		alias = "returning"
	}

	if s.dialect.SupportsLateral() {
		return s.writeReturningLateral(
			cteName, alias, b, fragments, variables, role,
			sessionVariables, roots, params, paramIndex,
		)
	}

	return s.writeReturningCorrelated(
		cteName, alias, b, fragments, variables, role,
		sessionVariables, roots, params, paramIndex,
	)
}

func (s selectionReturning) writeReturningLateral( //nolint:funlen
	cteName string,
	alias string,
	b *strings.Builder,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	// PostgreSQL: json_agg(row_to_json("_e")) over subquery + LATERAL JOINs
	b.WriteByte('\'')
	b.WriteString(alias)
	b.WriteString("', (SELECT COALESCE(")
	b.WriteString(s.dialect.JSONAggRawExpr(`row_to_json("_e")`))
	b.WriteString(", ")
	b.WriteString(s.dialect.EmptyJSONArray())
	b.WriteString(") FROM (SELECT ")

	for i, colSel := range s.columns {
		if i > 0 {
			b.WriteString(", ")
		}

		switch {
		case colSel.computed != nil:
			var err error

			params, paramIndex, err = s.table.writeComputedScalar(
				b, colSel, cteName, childArgumentPath(s.argumentPath, colSel.field),
				variables, sessionVariables, params, paramIndex,
			)
			if err != nil {
				return nil, 0, fmt.Errorf("building computed mutation returning: %w", err)
			}
		case colSel.literal != "":
			b.WriteByte('\'')
			b.WriteString(colSel.literal)
			b.WriteString(`' AS "`)
			b.WriteString(colSel.alias)
			b.WriteByte('"')
		default:
			expr := cteName + "." + core.QuoteIdentifier(colSel.column.SQLName)
			b.WriteString(outputColumnExpression(s.dialect, expr, colSel.column))
			b.WriteString(" AS ")
			core.WriteQuotedIdentifier(b, colSel.alias)
		}
	}

	if len(s.relationships) > 0 && len(s.columns) > 0 {
		b.WriteString(", ")
	}

	for i, relSel := range s.relationships {
		if i > 0 {
			b.WriteString(", ")
		}

		relAlias := sqlAlias(cteName, ".r.", relSel.alias)

		b.WriteByte('"')
		b.WriteString(relAlias)
		b.WriteString(`"."`)
		b.WriteString(relSel.alias)
		b.WriteString(`" AS "`)
		b.WriteString(relSel.alias)
		b.WriteByte('"')
	}

	b.WriteString(" FROM ")
	b.WriteString(cteName)

	params, paramIndex, err := s.writeLateralJoinsWithCTE(
		cteName, b, fragments, variables, role, sessionVariables, roots, params, paramIndex,
	)
	if err != nil {
		return nil, 0, err
	}

	return params, paramIndex, nil
}

func (s selectionReturning) writeReturningCorrelated( //nolint:funlen
	cteName string,
	alias string,
	b *strings.Builder,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	// SQLite: 'returning', (SELECT COALESCE(
	//   json_group_array(json_object('col1', cte."col1", ..., 'rel', (subquery))),
	//   '[]') FROM cte)
	b.WriteByte('\'')
	b.WriteString(alias)
	b.WriteString("', (SELECT COALESCE(json_group_array(json_object(")

	first := true

	for _, colSel := range s.columns {
		if !first {
			b.WriteString(", ")
		}

		switch {
		case colSel.computed != nil:
			var err error

			params, paramIndex, err = s.table.writeComputedScalar(
				b, colSel, cteName, childArgumentPath(s.argumentPath, colSel.field),
				variables, sessionVariables, params, paramIndex,
			)
			if err != nil {
				return nil, 0, fmt.Errorf("building computed mutation returning: %w", err)
			}
		case colSel.literal != "":
			b.WriteByte('\'')
			b.WriteString(colSel.alias)
			b.WriteString("', '")
			b.WriteString(colSel.literal)
			b.WriteByte('\'')
		default:
			b.WriteByte('\'')
			b.WriteString(colSel.alias)
			b.WriteString("', ")

			expr := cteName + "." + core.QuoteIdentifier(colSel.column.SQLName)
			b.WriteString(outputColumnExpression(s.dialect, expr, colSel.column))
		}

		first = false
	}

	for _, relSel := range s.relationships {
		if !first {
			b.WriteString(", ")
		}

		relAlias := sqlAlias(cteName, ".r.", relSel.alias)

		b.WriteByte('\'')
		b.WriteString(relSel.alias)
		b.WriteString("', (")

		var err error

		params, paramIndex, err = relSel.relationship.buildSelectionSQL(
			b, relSel.field, fragments, variables, role, sessionVariables,
			roots, params, paramIndex, cteName, relAlias, s.argumentPath,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("error building relationship %s: %w", relSel.alias, err)
		}

		b.WriteString(")")

		first = false
	}

	b.WriteString(")), ")
	b.WriteString(s.dialect.EmptyJSONArray())
	b.WriteString(") FROM ")
	b.WriteString(cteName)

	return params, paramIndex, nil
}

func (s selectionReturning) writeLateralJoinsWithCTE(
	cteName string,
	b *strings.Builder,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	for _, relSel := range s.relationships {
		relAlias := sqlAlias(cteName, ".r.", relSel.alias)

		b.WriteString(" LEFT OUTER JOIN LATERAL (")

		var err error

		params, paramIndex, err = relSel.relationship.buildSelectionSQL(
			b, relSel.field, fragments, variables, role, sessionVariables,
			roots, params, paramIndex, cteName, relAlias, s.argumentPath,
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

func (t *table) astToMutationSelection(
	field *ast.Field,
	fragments ast.FragmentDefinitionList,
	role string,
) (mutationSelection, error) {
	var (
		result        mutationSelection
		collectErr    error
		collectFields func(selectionSet ast.SelectionSet)
	)

	result.dialect = t.dialect

	// Error paths use field names, not response aliases.
	rootErrorPath := errorFieldName(field)

	collectFields = func(selectionSet ast.SelectionSet) {
		if collectErr != nil {
			return
		}

		for _, selection := range selectionSet {
			switch sel := selection.(type) {
			case *ast.Field:
				collectErr = t.processMutationField(sel, fragments, rootErrorPath, role, &result)
			case *ast.InlineFragment:
				collectFields(sel.SelectionSet)
			case *ast.FragmentSpread:
				fragment := findFragment(fragments, sel.Name)
				if fragment == nil {
					collectErr = fmt.Errorf("fragment %q is not defined", sel.Name) //nolint:err113
					return
				}

				collectFields(fragment.SelectionSet)
			}
		}
	}

	collectFields(field.SelectionSet)

	if collectErr != nil {
		return mutationSelection{}, collectErr
	}

	return result, nil
}

func (t *table) processMutationField(
	sel *ast.Field,
	fragments ast.FragmentDefinitionList,
	rootErrorPath string,
	role string,
	result *mutationSelection,
) error {
	switch sel.Name {
	case typenameField:
		result.typenames = appendTypename(
			result.typenames,
			sel,
			t.graphqlTypeName+"_mutation_response",
		)
	case "returning":
		columns, relationships, err := t.astToQuerySelectionWithPath(
			sel, fragments, rootErrorPath, role,
		)
		if err != nil {
			return fmt.Errorf("failed to build mutation returning selection: %w", err)
		}

		returningAlias := sel.Alias
		if returningAlias == "" {
			returningAlias = sel.Name
		}

		result.returning = selectionReturning{
			alias:         returningAlias,
			argumentPath:  childArgumentPath(rootErrorPath, sel),
			columns:       columns,
			relationships: relationships,
			table:         t,
			dialect:       t.dialect,
		}
	case "affected_rows":
		affectedRowsAlias := sel.Alias
		if affectedRowsAlias == "" {
			affectedRowsAlias = sel.Name
		}

		result.affectedRows = &selectionAffectedRows{
			alias:          affectedRowsAlias,
			extraCountCTEs: nil,
		}
	}

	return nil
}

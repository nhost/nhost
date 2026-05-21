package queries

import (
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
)

type mutationSelection struct {
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

// WriteSQLForDelete writes SQL for delete mutations with empty arrays for relationships.
func (s mutationSelection) WriteSQLForDelete(
	b *strings.Builder,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	b.WriteString("SELECT ")
	b.WriteString(s.dialect.JSONBuildObject())
	b.WriteByte('(')

	if s.affectedRows != nil {
		s.affectedRows.WriteSQLWithCTE("mutation_result", b)

		if len(s.returning.columns) > 0 || len(s.returning.relationships) > 0 {
			b.WriteString(", ")
		}
	}

	params, paramIndex, err := s.returning.writeSQLWithCTE(
		"mutation_result", b, nil, nil, "", nil, nil, params, paramIndex, true,
	)
	if err != nil {
		return nil, 0, err
	}

	if len(s.returning.relationships) > 0 || len(s.returning.columns) > 0 {
		b.WriteString(") AS \"_e\"))")
	} else {
		b.WriteString(")")
	}

	return params, paramIndex, nil
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

	if s.affectedRows != nil {
		s.affectedRows.WriteSQLWithCTE(cteName, b)

		if len(s.returning.columns) > 0 || len(s.returning.relationships) > 0 {
			b.WriteString(", ")
		}
	}

	params, paramIndex, err := s.returning.writeSQLWithCTE(
		cteName, b, fragments, variables, role, sessionVariables, roots, params, paramIndex, false,
	)
	if err != nil {
		return nil, 0, err
	}

	if len(s.returning.relationships) > 0 || len(s.returning.columns) > 0 {
		b.WriteString(") AS \"_e\"))")
	} else {
		b.WriteString(")")
	}

	return params, paramIndex, nil
}

type selectionAffectedRows struct {
	alias string
}

// WriteSQL writes the affected_rows JSON pair against the default
// "mutation_result" CTE.
func (s selectionAffectedRows) WriteSQL(b *strings.Builder) {
	s.WriteSQLWithCTE("mutation_result", b)
}

// WriteSQLWithCTE writes the affected_rows JSON pair as a COUNT(*) over the
// given CTE.
func (s selectionAffectedRows) WriteSQLWithCTE(cteName string, b *strings.Builder) {
	alias := s.alias
	if alias == "" {
		alias = "affected_rows"
	}

	b.WriteByte('\'')
	b.WriteString(alias)
	b.WriteString("', (SELECT COUNT(*) FROM ")
	b.WriteString(cteName)
	b.WriteByte(')')
}

type selectionReturning struct {
	alias         string
	columns       []columnSelection
	relationships []relationshipSelection
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
		b, fragments, variables, role, sessionVariables, roots, params, paramIndex, false,
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
	emptyRelationships bool,
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
			sessionVariables, roots, params, paramIndex, emptyRelationships,
		)
	}

	return s.writeReturningCorrelated(
		cteName, alias, b, fragments, variables, role,
		sessionVariables, roots, params, paramIndex, emptyRelationships,
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
	emptyRelationships bool,
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

		if colSel.literal != "" {
			b.WriteByte('\'')
			b.WriteString(colSel.literal)
			b.WriteString(`' AS "`)
			b.WriteString(colSel.alias)
			b.WriteByte('"')
		} else {
			b.WriteString(cteName)
			b.WriteByte('.')
			core.WriteQuotedIdentifier(b, colSel.column.SQLName)
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

		if emptyRelationships {
			b.WriteString(s.dialect.EmptyJSONArray())
			b.WriteString(` AS "`)
			b.WriteString(relSel.alias)
			b.WriteByte('"')
		} else {
			relAlias := cteName + ".r." + relSel.alias

			b.WriteByte('"')
			b.WriteString(relAlias)
			b.WriteString(`"."`)
			b.WriteString(relSel.alias)
			b.WriteString(`" AS "`)
			b.WriteString(relSel.alias)
			b.WriteByte('"')
		}
	}

	b.WriteString(" FROM ")
	b.WriteString(cteName)

	if emptyRelationships {
		return params, paramIndex, nil
	}

	return s.writeLateralJoinsWithCTE(
		cteName, b, fragments, variables, role, sessionVariables, roots, params, paramIndex,
	)
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
	emptyRelationships bool,
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

		if colSel.literal != "" {
			b.WriteByte('\'')
			b.WriteString(colSel.alias)
			b.WriteString("', '")
			b.WriteString(colSel.literal)
			b.WriteByte('\'')
		} else {
			b.WriteByte('\'')
			b.WriteString(colSel.alias)
			b.WriteString("', ")
			b.WriteString(cteName)
			b.WriteByte('.')
			core.WriteQuotedIdentifier(b, colSel.column.SQLName)
		}

		first = false
	}

	for _, relSel := range s.relationships {
		if !first {
			b.WriteString(", ")
		}

		if emptyRelationships {
			b.WriteByte('\'')
			b.WriteString(relSel.alias)
			b.WriteString("', ")
			b.WriteString(s.dialect.EmptyJSONArray())
		} else {
			relAlias := cteName + ".r." + relSel.alias

			b.WriteByte('\'')
			b.WriteString(relSel.alias)
			b.WriteString("', (")

			var err error

			params, paramIndex, err = relSel.relationship.buildSelectionSQL(
				b, relSel.field, fragments, variables, role, sessionVariables,
				roots, params, paramIndex, cteName, relAlias,
			)
			if err != nil {
				return nil, 0, fmt.Errorf("error building relationship %s: %w", relSel.alias, err)
			}

			b.WriteString(")")
		}

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
		relAlias := cteName + ".r." + relSel.alias

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
			cteName,
			relAlias,
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
) (mutationSelection, error) {
	var (
		result        mutationSelection
		collectErr    error
		collectFields func(selectionSet ast.SelectionSet)
	)

	result.dialect = t.dialect

	// Get root field alias for path building
	// For mutations, paths need to be like "insert_user_profiles.returning.user"
	rootAlias := field.Alias
	if rootAlias == "" {
		rootAlias = field.Name
	}

	collectFields = func(selectionSet ast.SelectionSet) {
		if collectErr != nil {
			return
		}

		for _, selection := range selectionSet {
			switch sel := selection.(type) {
			case *ast.Field:
				collectErr = t.processMutationField(sel, fragments, rootAlias, &result)
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
	rootAlias string,
	result *mutationSelection,
) error {
	switch sel.Name {
	case "returning":
		columns, relationships, err := t.astToQuerySelectionWithPath(
			sel, fragments, rootAlias,
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
			columns:       columns,
			relationships: relationships,
			dialect:       t.dialect,
		}
	case "affected_rows":
		affectedRowsAlias := sel.Alias
		if affectedRowsAlias == "" {
			affectedRowsAlias = sel.Name
		}

		result.affectedRows = &selectionAffectedRows{alias: affectedRowsAlias}
	}

	return nil
}

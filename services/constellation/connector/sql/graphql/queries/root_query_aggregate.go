package queries

import (
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

func (t *table) buildQueryAggregateSQL(
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

	params, _, err := t.writeQueryAggregateSQL(
		b,
		field,
		fragments,
		variables,
		role,
		sessionVariables,
		roots,
		[]any{},
		1,
		alias,
		t.tableFromClause(),
		t.tableSourceRef(),
	)
	if err != nil {
		putBuilder(b)

		return core.SQLOperation{}, fmt.Errorf("failed to build query_aggregate SQL: %w", err)
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

// writeQueryAggregateSQL emits the SQL for aggregate queries (CTE + outer
// json_build_object) into b. fromClause specifies the FROM source (table or
// function call); sourceRef specifies how to reference columns in WHERE clauses.
func (t *table) writeQueryAggregateSQL( //nolint:cyclop,funlen
	b *strings.Builder,
	field *ast.Field,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
	params []any,
	paramIndex int,
	outputAlias string,
	fromClause string,
	sourceRef string,
	queryModifiers ...queryModifierFunc,
) ([]any, int, error) {
	outerTypenames, aggregateSel, nodesField, err := t.astToAggregateSelection(field, fragments)
	if err != nil {
		return nil, 0, err
	}

	whereClause, modifiers, distinctOn, err := arguments.ParseQuery(
		t,
		field.Arguments,
		variables,
		role,
		sessionVariables,
	)
	if err != nil {
		return nil, 0, fmt.Errorf(
			"parsing query arguments for %s.%s: %w", t.schemaName, t.tableName, err,
		)
	}

	// Apply query modifiers (e.g., for relationship joins)
	for _, qm := range queryModifiers {
		whereClause, modifiers = qm(whereClause, modifiers)
	}

	baseAlias := "_root.base"

	// Build CTE for base table query
	b.WriteString(`WITH "`)
	b.WriteString(baseAlias)
	b.WriteString(`" `)
	b.WriteString(t.dialect.MaterializedCTE())
	b.WriteString(" (SELECT ")

	if distinctOn != nil {
		distinctOn.WriteSQL(b)
		b.WriteString(" ")
	}

	b.WriteString("* FROM ")
	b.WriteString(fromClause)

	if len(whereClause) > 0 {
		b.WriteString(" WHERE ")

		params, paramIndex, err = whereClause.WriteCondition(b, sourceRef, params, paramIndex)
		if err != nil {
			return nil, 0, fmt.Errorf("error building where clause: %w", err)
		}
	}

	if t.hasRowLevelPermissions(role) {
		if len(whereClause) > 0 {
			b.WriteString(" AND ")
		} else {
			b.WriteString(" WHERE ")
		}

		params, paramIndex, err = t.writeRowLevelPermissions(
			b, params, paramIndex, role, sessionVariables, sourceRef,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("error building row level permissions: %w", err)
		}
	}

	// Add modifiers (ORDER BY, LIMIT, OFFSET)
	for _, m := range modifiers {
		b.WriteString(" ")
		m.WriteSQL(b)
	}

	b.WriteString(") ")

	// Build the outer SELECT with json_build_object
	b.WriteString("SELECT ")
	b.WriteString(t.dialect.JSONBuildObject())
	b.WriteByte('(')

	firstOuter := true

	for i := range outerTypenames {
		if !firstOuter {
			b.WriteString(", ")
		}

		outerTypenames[i].Write(b)

		firstOuter = false
	}

	// Add aggregate functions if requested
	if len(aggregateSel) > 0 {
		if !firstOuter {
			b.WriteString(", ")
		}

		firstOuter = false

		b.WriteString("'aggregate', (SELECT ")
		b.WriteString(t.dialect.JSONBuildObject())
		b.WriteByte('(')

		for i, agg := range aggregateSel {
			if i > 0 {
				b.WriteString(", ")
			}

			agg.Write(b)
		}

		b.WriteString(`) FROM "`)
		b.WriteString(baseAlias)
		b.WriteString(`")`)
	}

	if nodesField != nil {
		params, paramIndex, err = t.writeAggregateNodes(
			b,
			fragments,
			variables,
			role,
			sessionVariables,
			roots,
			params,
			paramIndex,
			distinctOn,
			nodesField,
			baseAlias,
			!firstOuter,
		)
		if err != nil {
			return nil, 0, err
		}
	}

	b.WriteString(`) AS "`)
	b.WriteString(outputAlias)
	b.WriteByte('"')

	return params, paramIndex, nil
}

func (t *table) writeAggregateNodes(
	b *strings.Builder,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
	params []any,
	paramIndex int,
	distinctOn *arguments.DistinctOn,
	nodesField *ast.Field,
	baseAlias string,
	hasPrecedingFields bool,
) ([]any, int, error) {
	if hasPrecedingFields {
		b.WriteString(", ")
	}

	// Build the json_agg expression, optionally with ORDER BY for distinct_on
	var jsonAggExpr string
	if distinctOn != nil && len(distinctOn.Columns) > 0 {
		var aggB strings.Builder
		aggB.WriteString("\"_root\" ORDER BY ")

		for i, col := range distinctOn.Columns {
			if i > 0 {
				aggB.WriteString(", ")
			}

			aggB.WriteString(`"_root.pg.`)
			aggB.WriteString(col)
			aggB.WriteString(`" ASC NULLS LAST`)
		}

		jsonAggExpr = t.dialect.JSONAggRawExpr(aggB.String())
	} else {
		jsonAggExpr = t.dialect.JSONAggQuotedAlias("_root")
	}

	b.WriteString("'nodes', (SELECT coalesce(")
	b.WriteString(jsonAggExpr)
	b.WriteString(", '[]') FROM (")

	var err error

	// Build nodes selection using buildQuerySQL but referencing the CTE
	if distinctOn != nil && len(distinctOn.Columns) > 0 {
		// With distinct_on, we need to expose the distinct columns for ordering
		params, paramIndex, err = t.buildNodesWithDistinctOn(
			b, nodesField, fragments, variables, role, sessionVariables,
			roots, params, paramIndex, baseAlias, distinctOn,
		)
	} else {
		// Without distinct_on, just build normal nodes
		params, paramIndex, err = t.buildNodesFromCTE(
			b, nodesField, fragments, variables, role, sessionVariables,
			roots, params, paramIndex, baseAlias,
		)
	}

	if err != nil {
		return nil, 0, err
	}

	b.WriteString(") AS \"_root\")")

	return params, paramIndex, nil
}

// buildNodesFromCTE builds the nodes selection by querying from an existing CTE.
func (t *table) buildNodesFromCTE(
	b *strings.Builder,
	nodesField *ast.Field,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
	params []any,
	paramIndex int,
	cteAlias string,
) ([]any, int, error) {
	// Note: Remote relationships in aggregate nodes are not supported and are ignored
	columns, relationships, err := t.astToQuerySelection(nodesField, fragments)
	if err != nil {
		return nil, 0, err
	}

	// Build JSON row: SELECT row_to_json/json_object(...) AS "_root"
	b.WriteString("SELECT ")
	t.dialect.WriteJSONRowPrefix(b)

	first := t.writeNodeColumnSelections(b, columns, cteAlias)

	if t.dialect.SupportsLateral() {
		return t.buildNodesRelationshipsLateral(
			b, relationships, fragments, variables, role, sessionVariables,
			roots, params, paramIndex, cteAlias, first,
		)
	}

	return t.buildNodesRelationshipsSubquery(
		b, relationships, fragments, variables, role, sessionVariables,
		roots, params, paramIndex, cteAlias, first,
	)
}

// writeNodeColumnSelections writes column selections for node queries and returns
// whether the first column has been written (false means no columns were written).
func (t *table) writeNodeColumnSelections(
	b *strings.Builder,
	columns []columnSelection,
	cteAlias string,
) bool {
	first := true

	for _, colSel := range columns {
		if !first {
			b.WriteString(", ")
		}

		if colSel.literal != "" {
			t.dialect.WriteJSONRowColumn(b, colSel.alias, "'"+colSel.literal+"'")
		} else {
			t.dialect.WriteJSONRowColumn(b, colSel.alias,
				core.QuoteIdentifier(cteAlias)+"."+core.QuoteIdentifier(colSel.column.SQLName))
		}

		first = false
	}

	return !first
}

// buildNodesRelationshipsLateral builds relationships using PostgreSQL LATERAL joins.
func (t *table) buildNodesRelationshipsLateral(
	b *strings.Builder,
	relationships []relationshipSelection,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
	params []any,
	paramIndex int,
	cteAlias string,
	hasColumns bool,
) ([]any, int, error) {
	for _, relSel := range relationships {
		if hasColumns {
			b.WriteString(", ")
		}

		relAlias := "_root.r." + relSel.alias
		t.dialect.WriteJSONRowColumn(b, relSel.alias,
			`"`+relAlias+`"."`+relSel.alias+`"`)

		hasColumns = true
	}

	t.dialect.WriteJSONRowSuffix(b, "_root")

	b.WriteString(` FROM "`)
	b.WriteString(cteAlias)
	b.WriteByte('"')

	var err error

	for _, relSel := range relationships {
		relAlias := "_root.r." + relSel.alias

		b.WriteString(" LEFT OUTER JOIN LATERAL (")

		params, paramIndex, err = relSel.relationship.buildSelectionSQL(
			b, relSel.field, fragments, variables, role, sessionVariables,
			roots, params, paramIndex, cteAlias, relAlias,
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

// buildNodesRelationshipsSubquery builds relationships using SQLite correlated subqueries.
func (t *table) buildNodesRelationshipsSubquery(
	b *strings.Builder,
	relationships []relationshipSelection,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
	params []any,
	paramIndex int,
	cteAlias string,
	hasColumns bool,
) ([]any, int, error) {
	var err error

	for _, relSel := range relationships {
		if hasColumns {
			b.WriteString(", ")
		}

		relAlias := "_root.r." + relSel.alias

		b.WriteByte('\'')
		b.WriteString(relSel.alias)
		b.WriteString("', (")

		params, paramIndex, err = relSel.relationship.buildSelectionSQL(
			b, relSel.field, fragments, variables, role, sessionVariables,
			roots, params, paramIndex, cteAlias, relAlias,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("error building relationship %s: %w", relSel.alias, err)
		}

		b.WriteString(")")

		hasColumns = true
	}

	t.dialect.WriteJSONRowSuffix(b, "_root")

	b.WriteString(` FROM "`)
	b.WriteString(cteAlias)
	b.WriteByte('"')

	return params, paramIndex, nil
}

// buildNodesWithDistinctOn builds the nodes selection with distinct_on columns exposed.
func (t *table) buildNodesWithDistinctOn( //nolint:funlen
	b *strings.Builder,
	nodesField *ast.Field,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
	params []any,
	paramIndex int,
	cteAlias string,
	distinctOn *arguments.DistinctOn,
) ([]any, int, error) {
	columns, relationships, err := t.astToQuerySelection(nodesField, fragments)
	if err != nil {
		return nil, 0, err
	}

	// Build JSON row: SELECT row_to_json/json_object(...) AS "_root", distinct columns
	b.WriteString("SELECT ")
	t.dialect.WriteJSONRowPrefix(b)

	hasColumns := t.writeNodeColumnSelections(b, columns, cteAlias)

	// Relationships (DISTINCT ON is PostgreSQL-only, so always use LATERAL here)
	for _, relSel := range relationships {
		if hasColumns {
			b.WriteString(", ")
		}

		relAlias := "_root.r." + relSel.alias
		t.dialect.WriteJSONRowColumn(b, relSel.alias,
			`"`+relAlias+`"."`+relSel.alias+`"`)

		hasColumns = true
	}

	t.dialect.WriteJSONRowSuffix(b, "_root")

	// Expose distinct_on columns for ordering in json_agg
	for _, col := range distinctOn.Columns {
		b.WriteString(", ")
		core.WriteQualifiedColumn(b, core.QuoteIdentifier(cteAlias), col)
		b.WriteString(" AS ")
		core.WriteQuotedIdentifier(b, "_root.pg."+col)
	}

	// FROM clause - reference the CTE
	b.WriteString(` FROM "`)
	b.WriteString(cteAlias)
	b.WriteByte('"')

	// LEFT OUTER JOIN LATERAL for each nested relationship
	for _, relSel := range relationships {
		relAlias := "_root.r." + relSel.alias

		b.WriteString(" LEFT OUTER JOIN LATERAL (")

		params, paramIndex, err = relSel.relationship.buildSelectionSQL(
			b, relSel.field, fragments, variables, role, sessionVariables,
			roots, params, paramIndex, cteAlias, relAlias,
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

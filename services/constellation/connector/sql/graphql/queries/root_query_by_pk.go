package queries

import (
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
)

type queryModifierFunc func(
	whereClause where.Clause, modifiers []arguments.QueryModifier,
) (where.Clause, []arguments.QueryModifier)

func (t *table) buildQueryByPkSQL(
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

	pkConditions, err := arguments.ParseQueryByPk(t, field, variables)
	if err != nil {
		return core.SQLOperation{}, fmt.Errorf("failed to parse query_by_pk arguments: %w", err)
	}

	b := getBuilder()

	params, _, err := t.buildQuerySQL(
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
		t.tableFromClause(),
		t.tableSourceRef(),
		func(whereClause where.Clause, modifiers []arguments.QueryModifier) (where.Clause, []arguments.QueryModifier) {
			return append(whereClause, where.NewAndFilter(pkConditions)), modifiers
		},
		func(whereClause where.Clause, modifiers []arguments.QueryModifier) (where.Clause, []arguments.QueryModifier) {
			return whereClause, append(modifiers, &arguments.Limit{Value: 1})
		},
	)
	if err != nil {
		putBuilder(b)

		return core.SQLOperation{}, fmt.Errorf("failed to build query_by_pk SQL: %w", err)
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

// writeQueryByPkSQL emits the SQL for an object-relationship target — a
// single-row query at the relationship level — into b. Forces LIMIT 1 onto
// the query modifiers.
func (t *table) writeQueryByPkSQL(
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
	queryModifiers = append(
		queryModifiers,
		func(whereClause where.Clause, modifiers []arguments.QueryModifier) (where.Clause, []arguments.QueryModifier) {
			return whereClause, append(modifiers, &arguments.Limit{Value: 1})
		},
	)

	return t.buildQuerySQL(
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
		relName,
		t.tableFromClause(),
		t.tableSourceRef(),
		queryModifiers...,
	)
}

// buildQuerySQL is the core SQL generation logic shared by both collection and by_pk queries.
// The fromClause parameter specifies the FROM source (table or function call).
// The sourceRef parameter specifies how to reference columns in WHERE clauses.
func (t *table) buildQuerySQL(
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
	outputAlias string,
	fromClause string,
	sourceRef string,
	queryModifiers ...queryModifierFunc,
) ([]any, int, error) {
	columns, relationships, err := t.astToQuerySelection(field, fragments)
	if err != nil {
		return nil, 0, err
	}

	baseAlias := alias + ".base"

	params, paramIndex, err = t.buildQueryCTE(
		b, field, variables, role, sessionVariables, params, paramIndex,
		baseAlias, fromClause, sourceRef, queryModifiers...,
	)
	if err != nil {
		return nil, 0, err
	}

	b.WriteString("SELECT ")
	t.dialect.WriteJSONRowPrefix(b)

	hasColumns := t.writeNodeColumnSelections(b, columns, baseAlias)

	if t.dialect.SupportsLateral() {
		return t.buildQueryRelationshipsLateral(
			b, relationships, fragments, variables, role, sessionVariables,
			roots, params, paramIndex, baseAlias, alias, outputAlias, hasColumns,
		)
	}

	return t.buildQueryRelationshipsSubquery(
		b, relationships, fragments, variables, role, sessionVariables,
		roots, params, paramIndex, baseAlias, alias, outputAlias, hasColumns,
	)
}

// buildQueryCTE writes the WITH clause CTE that filters the base table with WHERE and permissions.
func (t *table) buildQueryCTE(
	b *strings.Builder,
	field *ast.Field,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
	baseAlias string,
	fromClause string,
	sourceRef string,
	queryModifiers ...queryModifierFunc,
) ([]any, int, error) {
	whereClause, modifiers, distinctOn, err := arguments.ParseQuery(
		t, field.Arguments, variables, role, sessionVariables, sourceRef,
	)
	if err != nil {
		return nil, 0, fmt.Errorf(
			"parsing query arguments for %s.%s: %w", t.schemaName, t.tableName, err,
		)
	}

	for _, qm := range queryModifiers {
		whereClause, modifiers = qm(whereClause, modifiers)
	}

	b.WriteString(`WITH "`)
	b.WriteString(baseAlias)
	b.WriteString(`" AS (SELECT `)

	if distinctOn != nil {
		distinctOn.WriteSQL(b)
		b.WriteString(" ")
	}

	b.WriteString("* FROM ")
	b.WriteString(fromClause)

	params, paramIndex, err = t.writeQuerywhereClause(
		b, whereClause, role, sessionVariables, params, paramIndex, sourceRef,
	)
	if err != nil {
		return nil, 0, err
	}

	for _, m := range modifiers {
		b.WriteString(" ")

		params, paramIndex, err = m.WriteSQL(b, params, paramIndex)
		if err != nil {
			return nil, 0, fmt.Errorf("error building query modifier: %w", err)
		}
	}

	b.WriteString(") ")

	return params, paramIndex, nil
}

// writeQuerywhereClause writes WHERE clause combining user conditions and row-level permissions.
func (t *table) writeQuerywhereClause(
	b *strings.Builder,
	whereClause where.Clause,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
	sourceRef string,
) ([]any, int, error) {
	var err error

	if len(whereClause) > 0 {
		b.WriteString(" WHERE ")

		params, paramIndex, err = whereClause.WriteCondition(b, sourceRef, params, paramIndex)
		if err != nil {
			return nil, 0, fmt.Errorf(
				"error building where clause for table %s: %w",
				t.tableName,
				err,
			)
		}
	}

	if t.hasRowLevelPermissions(role) {
		if len(whereClause) > 0 {
			b.WriteString(" AND ")
		} else {
			b.WriteString(" WHERE ")
		}

		params, paramIndex, err = t.writeRowLevelPermissions(
			b,
			params,
			paramIndex,
			role,
			sessionVariables,
			sourceRef,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("error building row level permissions: %w", err)
		}
	}

	return params, paramIndex, nil
}

// buildQueryRelationshipsLateral builds relationships using PostgreSQL LATERAL joins.
func (t *table) buildQueryRelationshipsLateral(
	b *strings.Builder,
	relationships []relationshipSelection,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
	params []any,
	paramIndex int,
	baseAlias string,
	alias string,
	outputAlias string,
	hasColumns bool,
) ([]any, int, error) {
	for _, relSel := range relationships {
		if hasColumns {
			b.WriteString(", ")
		}

		relAlias := alias + ".r." + relSel.alias
		t.dialect.WriteJSONRowColumn(b, relSel.alias,
			`"`+relAlias+`"."`+relSel.alias+`"`)

		hasColumns = true
	}

	t.dialect.WriteJSONRowSuffix(b, outputAlias)

	b.WriteString(` FROM "`)
	b.WriteString(baseAlias)
	b.WriteByte('"')

	for _, relSel := range relationships {
		relAlias := alias + ".r." + relSel.alias

		b.WriteString(" LEFT OUTER JOIN LATERAL (")

		var err error

		params, paramIndex, err = relSel.relationship.buildSelectionSQL(
			b, relSel.field, fragments, variables, role, sessionVariables,
			roots, params, paramIndex, baseAlias, relAlias,
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

// buildQueryRelationshipsSubquery builds relationships using SQLite correlated subqueries.
func (t *table) buildQueryRelationshipsSubquery(
	b *strings.Builder,
	relationships []relationshipSelection,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
	params []any,
	paramIndex int,
	baseAlias string,
	alias string,
	outputAlias string,
	hasColumns bool,
) ([]any, int, error) {
	for _, relSel := range relationships {
		if hasColumns {
			b.WriteString(", ")
		}

		relAlias := alias + ".r." + relSel.alias

		b.WriteByte('\'')
		b.WriteString(relSel.alias)
		b.WriteString("', (")

		var err error

		params, paramIndex, err = relSel.relationship.buildSelectionSQL(
			b, relSel.field, fragments, variables, role, sessionVariables,
			roots, params, paramIndex, baseAlias, relAlias,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("error building relationship %s: %w", relSel.alias, err)
		}

		b.WriteString(")")

		hasColumns = true
	}

	t.dialect.WriteJSONRowSuffix(b, outputAlias)

	b.WriteString(` FROM "`)
	b.WriteString(baseAlias)
	b.WriteByte('"')

	return params, paramIndex, nil
}

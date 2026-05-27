package queries

import (
	"errors"
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	groupedaggdispatch "github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/groupedaggregate"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
)

// Compile-time assertion that *table satisfies the Builder interface
// dispatched from the side-channel grouped-aggregate package.
var _ groupedaggdispatch.Builder = (*table)(nil)

const (
	groupedAggregateKeysAlias    = "__cs_grp_keys"
	groupedAggregateKeyCol       = "_join_key"
	groupedAggregateBaseAlias    = "_root.base"
	groupedAggregateJoinKeyAlias = "__cs_join_key"
)

// ErrGroupedAggregateLimitOffsetUnsupported is returned when a cross-database
// aggregate relationship is queried with limit or offset arguments. Those are
// ambiguous (per-group vs. global) and not yet supported.
var ErrGroupedAggregateLimitOffsetUnsupported = errors.New(
	"limit and offset are not supported on cross-database aggregate relationships",
)

// errGroupedAggregateNestedRelationships is returned when an aggregate's
// nodes selection includes a relationship field, which is not yet supported
// for cross-database aggregates.
var errGroupedAggregateNestedRelationships = errors.New(
	"nested relationships inside cross-database aggregate nodes are not supported",
)

// BuildGroupedAggregateSQL builds a grouped aggregate SQL statement that
// returns one aggregate row per parent join key. Used by cross-database
// array-aggregate relationship resolution to batch-fetch aggregates across
// many parent rows in a single round-trip.
//
// The returned SQL emits rows shaped:
//
//	{ "_join_key": <value>, "aggregate": {...}, "nodes": [...] }
//
// One row is emitted for every value in in.JoinValues, including those with
// no matching target rows (count is 0, nodes is []).
func (t *table) BuildGroupedAggregateSQL(
	in groupedaggdispatch.BuildInput,
) (core.SQLOperation, error) {
	joinCol := t.columnFromSQLName(in.JoinColumnSQLName)
	if joinCol == nil {
		return core.SQLOperation{}, fmt.Errorf(
			"%w: %q on table %s.%s",
			errUnknownJoinColumn,
			in.JoinColumnSQLName, t.schemaName, t.tableName,
		)
	}

	alias := in.Field.Alias
	if alias == "" {
		alias = in.Field.Name
	}

	outerTypenames, aggregateSel, nodesField, err := t.astToAggregateSelection(
		in.Field,
		in.Fragments,
	)
	if err != nil {
		return core.SQLOperation{}, err
	}

	whereClause, err := t.parseGroupedAggregateArguments(in)
	if err != nil {
		return core.SQLOperation{}, err
	}

	b := getBuilder()
	defer putBuilder(b)

	params := []any{}
	paramIndex := 1

	params, _, err = t.writeGroupedAggregateCTE(
		b, params, paramIndex,
		in.Role, in.SessionVariables, joinCol, in.JoinValues,
		whereClause,
	)
	if err != nil {
		return core.SQLOperation{}, err
	}

	if err = t.writeGroupedAggregateOuter(
		b, in.Fragments, outerTypenames, aggregateSel, nodesField, joinCol, alias,
	); err != nil {
		return core.SQLOperation{}, err
	}

	return core.SQLOperation{
		Name:          alias,
		SQL:           b.String(),
		Parameters:    params,
		StreamCursors: nil,
	}, nil
}

// parseGroupedAggregateArguments parses the GraphQL query arguments for a
// grouped-aggregate selection and rejects limit/offset modifiers, which are
// ambiguous (per-group vs. global) on cross-database aggregate relationships
// and not yet supported. Returns the WHERE clause for use in the base CTE;
// distinct_on and order_by modifiers are intentionally discarded — they are
// not meaningful at the grouped-aggregate level.
func (t *table) parseGroupedAggregateArguments(
	in groupedaggdispatch.BuildInput,
) (where.Clause, error) {
	whereClause, modifiers, _, err := arguments.ParseQuery(
		t, in.Field.Arguments, in.Variables, in.Role, in.SessionVariables,
	)
	if err != nil {
		return nil, fmt.Errorf(
			"parsing query arguments for %s.%s: %w", t.schemaName, t.tableName, err,
		)
	}

	for _, m := range modifiers {
		switch m.(type) {
		case *arguments.Limit, *arguments.Offset:
			return nil, ErrGroupedAggregateLimitOffsetUnsupported
		}
	}

	return whereClause, nil
}

// writeGroupedAggregateCTE writes the base CTE that LEFT JOINs the target
// table against an unnest of the parent join keys. User WHERE clause and
// row-level permissions are placed in the ON clause so that empty groups
// (parent keys with no matching target rows) are preserved.
func (t *table) writeGroupedAggregateCTE( //nolint:funlen
	b *strings.Builder,
	params []any, paramIndex int,
	role string, sessionVariables map[string]any,
	joinCol *core.Column, joinValues []any,
	whereClause where.Clause,
) ([]any, int, error) {
	tableRef := t.tableSourceRef()

	b.WriteString(`WITH "`)
	b.WriteString(groupedAggregateBaseAlias)
	b.WriteString(`" `)
	b.WriteString(t.dialect.MaterializedCTE())
	b.WriteString(` (SELECT `)
	b.WriteString(tableRef)
	b.WriteString(`.*, "`)
	b.WriteString(groupedAggregateKeysAlias)
	b.WriteString(`"."`)
	b.WriteString(groupedAggregateKeyCol)
	b.WriteString(`" AS "`)
	b.WriteString(groupedAggregateJoinKeyAlias)
	b.WriteString(`" FROM `)

	params, paramIndex = t.dialect.WriteGroupKeysFrom(
		b,
		groupedAggregateKeysAlias,
		groupedAggregateKeyCol,
		joinCol.SQLType,
		joinValues,
		params,
		paramIndex,
	)

	b.WriteString(` LEFT JOIN `)
	b.WriteString(tableRef)
	b.WriteString(` ON `)
	core.WriteQualifiedColumn(b, tableRef, joinCol.SQLName)
	b.WriteString(` = "`)
	b.WriteString(groupedAggregateKeysAlias)
	b.WriteString(`"."`)
	b.WriteString(groupedAggregateKeyCol)
	b.WriteString(`"`)

	var err error

	if len(whereClause) > 0 {
		b.WriteString(" AND ")

		params, paramIndex, err = whereClause.WriteCondition(b, tableRef, params, paramIndex)
		if err != nil {
			return nil, 0, fmt.Errorf("error building where clause: %w", err)
		}
	}

	if t.hasRowLevelPermissions(role) {
		b.WriteString(" AND ")

		params, paramIndex, err = t.writeRowLevelPermissions(
			b, params, paramIndex, role, sessionVariables, tableRef,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("error building row level permissions: %w", err)
		}
	}

	b.WriteString(") ")

	return params, paramIndex, nil
}

// writeGroupedAggregateOuter writes:
//
//	SELECT coalesce(<json_agg>(per_group), '[]') AS "<outputAlias>"
//	FROM (
//	    SELECT <per_group_json_build_object> AS per_group
//	    FROM "_root.base"
//	    GROUP BY "__cs_join_key"
//	) AS _groups
//
// The single-row, single-column result preserves the existing one-row-per-
// operation contract of Driver.ExecuteOperations: the value is a JSON array
// of group objects, each shaped { "_join_key": ..., "aggregate": ..., "nodes": ... }.
func (t *table) writeGroupedAggregateOuter(
	b *strings.Builder,
	fragments ast.FragmentDefinitionList,
	outerTypenames []typenameSelection,
	aggregateSel []aggregateQuerySelection,
	nodesField *ast.Field,
	joinCol *core.Column,
	outputAlias string,
) error {
	b.WriteString(`SELECT coalesce(`)
	b.WriteString(t.dialect.JSONAggQuotedAlias("per_group"))
	b.WriteString(", ")
	b.WriteString(t.dialect.EmptyJSONArray())
	b.WriteString(`) AS "`)
	b.WriteString(outputAlias)
	b.WriteString(`" FROM (SELECT `)
	b.WriteString(t.dialect.JSONBuildObject())
	b.WriteByte('(')
	b.WriteByte('\'')
	b.WriteString(groupedAggregateKeyCol)
	b.WriteString(`', "`)
	b.WriteString(groupedAggregateJoinKeyAlias)
	b.WriteByte('"')

	for i := range outerTypenames {
		b.WriteString(", ")
		outerTypenames[i].Write(b)
	}

	if len(aggregateSel) > 0 {
		b.WriteString(", 'aggregate', ")
		b.WriteString(t.dialect.JSONBuildObject())
		b.WriteByte('(')

		for i, agg := range aggregateSel {
			if i > 0 {
				b.WriteString(", ")
			}

			t.writeGroupedAggregateSelection(b, agg, joinCol)
		}

		b.WriteByte(')')
	}

	if nodesField != nil {
		if err := t.writeGroupedAggregateNodes(b, nodesField, fragments, joinCol); err != nil {
			return err
		}
	}

	b.WriteString(`) AS "per_group" FROM "`)
	b.WriteString(groupedAggregateBaseAlias)
	b.WriteString(`" GROUP BY "`)
	b.WriteString(groupedAggregateJoinKeyAlias)
	b.WriteString(`") AS "_groups"`)

	return nil
}

// writeGroupedAggregateSelection writes a single aggregate sub-selection,
// substituting COUNT(*) with COUNT(<join_col>) so empty groups (rows
// synthesized by the LEFT JOIN with no matching target) count as zero.
func (t *table) writeGroupedAggregateSelection(
	b *strings.Builder, agg aggregateQuerySelection, joinCol *core.Column,
) {
	if _, ok := agg.(*countSelection); ok {
		b.WriteString("'count', COUNT(")
		core.WriteQualifiedColumn(b, `"`+groupedAggregateBaseAlias+`"`, joinCol.SQLName)
		b.WriteByte(')')

		return
	}

	agg.Write(b)
}

// writeGroupedAggregateNodes writes the 'nodes' entry: a json_agg of an
// inline row-to-json expression, FILTERed by join_col IS NOT NULL so empty
// groups produce [] rather than an array containing a single all-null row.
//
// Nested same-database relationships inside cross-database aggregate nodes
// are not supported in this first cut — they would require LATERAL joins
// that don't compose with the GROUP BY here.
func (t *table) writeGroupedAggregateNodes(
	b *strings.Builder,
	nodesField *ast.Field,
	fragments ast.FragmentDefinitionList,
	joinCol *core.Column,
) error {
	columns, relationships, err := t.astToQuerySelection(nodesField, fragments)
	if err != nil {
		return err
	}

	if len(relationships) > 0 {
		return errGroupedAggregateNestedRelationships
	}

	b.WriteString(", 'nodes', coalesce(")

	var rowB strings.Builder

	t.dialect.WriteJSONRowPrefix(&rowB)
	t.writeNodeColumnSelections(&rowB, columns, groupedAggregateBaseAlias)
	t.dialect.WriteJSONRowSuffixNoAlias(&rowB)

	b.WriteString(t.dialect.JSONAggRawExpr(rowB.String()))
	b.WriteString(` FILTER (WHERE `)
	core.WriteQualifiedColumn(b, `"`+groupedAggregateBaseAlias+`"`, joinCol.SQLName)
	b.WriteString(" IS NOT NULL), ")
	b.WriteString(t.dialect.EmptyJSONArray())
	b.WriteByte(')')

	return nil
}

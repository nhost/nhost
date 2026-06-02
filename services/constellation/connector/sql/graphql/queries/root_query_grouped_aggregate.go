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
	groupedAggregateKeysAlias       = "__cs_grp_keys"
	groupedAggregateKeyCol          = groupedaggdispatch.ResultJoinKeyField
	groupedAggregateBaseAlias       = "_root.base"
	groupedAggregateWindowedAlias   = "_root.windowed"
	groupedAggregateWindowKeysAlias = "_root.keys"
	groupedAggregateJoinKeyAlias    = "__cs_join_key"
	groupedAggregateRowNumberCol    = "__cs_rn"
)

// ErrGroupedAggregateDistinctOnUnsupported is returned when a cross-database
// aggregate relationship is queried with distinct_on against a dialect that
// does not support DISTINCT ON (SQLite). The schema only advertises distinct_on
// on aggregate fields when the source supports it, so this is a defensive guard
// rather than a reachable path under normal schema generation.
var ErrGroupedAggregateDistinctOnUnsupported = errors.New(
	"distinct_on is not supported on cross-database aggregate relationships for this database",
)

// ErrGroupedAggregateRelationshipOrderBy is returned when an order_by on a
// cross-database aggregate relationship references a nested relationship (e.g.
// `order_by: { department: { name: asc } }`). Such terms render correlated
// subqueries against the target table ref, which cannot be threaded into both
// the grouped DISTINCT ON tiebreak and the per-group json_agg ordering used
// here. Scalar-column ordering (the common case) is fully supported.
var ErrGroupedAggregateRelationshipOrderBy = errors.New(
	"order_by on nested relationships is not supported on cross-database aggregate relationships",
)

// errGroupedAggregateNestedRelationships is returned when an aggregate's
// nodes selection includes a relationship field, which is not yet supported
// for cross-database aggregates.
var errGroupedAggregateNestedRelationships = errors.New(
	"nested relationships inside cross-database aggregate nodes are not supported",
)

// errGroupedAggregateReservedResponseName is returned when a grouped aggregate
// selection uses the internal join-key transport field as a GraphQL response
// name. The parser drops that field after keying the grouped result map, so the
// builder must reserve it to avoid silently discarding user-selected data.
var errGroupedAggregateReservedResponseName = errors.New(
	"grouped aggregate response name is reserved",
)

// groupedLimitOffset carries the per-group limit/offset parsed from the
// aggregate query arguments. hasLimit/hasOffset distinguish "absent" from an
// explicit value (limit: 0 is a valid request meaning "no rows", distinct from
// no limit at all). active reports whether either is present, which gates the
// per-group window CTE.
type groupedLimitOffset struct {
	limit     int
	offset    int
	hasLimit  bool
	hasOffset bool
}

// active reports whether a per-group window is required (limit or offset given).
func (lo groupedLimitOffset) active() bool {
	return lo.hasLimit || lo.hasOffset
}

// effectiveOffset returns the offset to skip per group (0 when none was given).
func (lo groupedLimitOffset) effectiveOffset() int {
	if lo.hasOffset {
		return lo.offset
	}

	return 0
}

// BuildGroupedAggregateSQL builds a grouped aggregate SQL statement that
// returns one aggregate row per parent join key. Used by cross-database
// array-aggregate relationship resolution to batch-fetch aggregates across
// many parent rows in a single round-trip.
//
// The returned SQL emits one JSON object per join key. Each object contains
// the reserved internal join key plus the requested aggregate/nodes response
// names (aliases when present, otherwise "aggregate" / "nodes"). One row is
// emitted for every value in in.JoinValues, including those with no matching
// target rows (count is 0, and nodes selections are []).
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

	outerTypenames, aggregateFields, nodesFields, err := t.astToAggregateSelection(
		in.Field,
		in.Fragments,
		in.Variables,
	)
	if err != nil {
		return core.SQLOperation{}, err
	}

	if err := validateGroupedAggregateResponseNames(
		outerTypenames, aggregateFields, nodesFields,
	); err != nil {
		return core.SQLOperation{}, err
	}

	whereClause, distinctOn, orderBy, limitOffset, err := t.parseGroupedAggregateArguments(in)
	if err != nil {
		return core.SQLOperation{}, err
	}

	sel := groupedAggregateSelection{
		outerTypenames:  outerTypenames,
		aggregateFields: aggregateFields,
		nodesFields:     nodesFields,
		whereClause:     whereClause,
		distinctOn:      distinctOn,
		orderBy:         orderBy,
		limitOffset:     limitOffset,
	}

	sql, params, err := t.writeGroupedAggregateStatement(in, joinCol, alias, sel)
	if err != nil {
		return core.SQLOperation{}, err
	}

	return core.SQLOperation{
		Name:          alias,
		SQL:           sql,
		Parameters:    params,
		StreamCursors: nil,
		Sequential:    nil,
	}, nil
}

// groupedAggregateSelection bundles the parsed selection and arguments of a
// grouped-aggregate query so they can be threaded through the SQL-assembly
// helper without an unwieldy parameter list.
type groupedAggregateSelection struct {
	outerTypenames  []typenameSelection
	aggregateFields []aggregateFieldSelection
	nodesFields     []aggregateNodesSelection
	whereClause     where.Clause
	distinctOn      *arguments.DistinctOn
	orderBy         *arguments.OrderBy
	limitOffset     groupedLimitOffset
}

func validateGroupedAggregateResponseNames(
	outerTypenames []typenameSelection,
	aggregateFields []aggregateFieldSelection,
	nodesFields []aggregateNodesSelection,
) error {
	for i := range outerTypenames {
		if err := validateGroupedAggregateResponseName(
			"__typename", outerTypenames[i].alias,
		); err != nil {
			return err
		}
	}

	for i := range aggregateFields {
		if err := validateGroupedAggregateResponseName(
			"aggregate", aggregateFields[i].responseName,
		); err != nil {
			return err
		}
	}

	for i := range nodesFields {
		if err := validateGroupedAggregateResponseName(
			"nodes", nodesFields[i].responseName,
		); err != nil {
			return err
		}
	}

	return nil
}

func validateGroupedAggregateResponseName(fieldName string, responseName string) error {
	if responseName != groupedaggdispatch.ResultJoinKeyField {
		return nil
	}

	return fmt.Errorf(
		"%w: %q is reserved for grouped aggregate join keys; alias %s differently",
		errGroupedAggregateReservedResponseName,
		responseName,
		fieldName,
	)
}

// writeGroupedAggregateStatement assembles the full grouped-aggregate SQL: the
// base CTE, an optional per-group window CTE (when limit/offset is requested),
// and the outer aggregate/nodes SELECT. It returns the rendered SQL and its
// bound parameters.
func (t *table) writeGroupedAggregateStatement(
	in groupedaggdispatch.BuildInput,
	joinCol *core.Column,
	alias string,
	sel groupedAggregateSelection,
) (string, []any, error) {
	b := getBuilder()
	defer putBuilder(b)

	params := []any{}
	paramIndex := 1

	params, paramIndex, err := t.writeGroupedAggregateCTE(
		b, params, paramIndex,
		in.Role, in.SessionVariables, joinCol, in.JoinValues,
		sel.whereClause, sel.distinctOn, sel.orderBy,
	)
	if err != nil {
		return "", nil, err
	}

	// The outer aggregate/nodes read from the windowed CTE when a per-group
	// limit/offset is requested (so the same limited row set feeds both the
	// aggregate functions and the nodes array, matching Hasura), and from the
	// base CTE otherwise (no window, no SQL churn for the common case).
	sourceAlias := groupedAggregateBaseAlias
	if sel.limitOffset.active() {
		t.writeGroupedAggregateWindowCTE(b, sel.orderBy)

		sourceAlias = groupedAggregateWindowedAlias
	}

	params, err = t.writeGroupedAggregateOuter(
		b, params, paramIndex,
		in.Fragments, sel.outerTypenames, sel.aggregateFields, sel.nodesFields, joinCol, alias,
		sel.distinctOn, sel.orderBy, sourceAlias, sel.limitOffset,
	)
	if err != nil {
		return "", nil, err
	}

	return b.String(), params, nil
}

// parseGroupedAggregateArguments parses the GraphQL query arguments for a
// grouped-aggregate selection. where, distinct_on, scalar-column order_by, and
// limit/offset are all applied per group (partitioned by the parent join key)
// so the result matches the root aggregate path for the same arguments.
// limit/offset are returned as a groupedLimitOffset and rendered as a per-group
// window by writeGroupedAggregateWindowCTE. Relationship-term order_by and
// distinct_on on a non-DISTINCT-ON dialect are rejected (see the sentinels
// above).
func (t *table) parseGroupedAggregateArguments(
	in groupedaggdispatch.BuildInput,
) (where.Clause, *arguments.DistinctOn, *arguments.OrderBy, groupedLimitOffset, error) {
	var limitOffset groupedLimitOffset

	whereClause, modifiers, distinctOn, err := arguments.ParseQuery(
		t, in.Field.Arguments, in.Variables, in.Role, in.SessionVariables, t.tableSourceRef(),
	)
	if err != nil {
		err = annotateQueryValidationError(err, groupedAggregateArgumentPath(in))

		return nil, nil, nil, limitOffset, fmt.Errorf(
			"parsing query arguments for %s.%s: %w", t.schemaName, t.tableName, err,
		)
	}

	if distinctOn != nil && !t.dialect.SupportsDistinctOn() {
		return nil, nil, nil, limitOffset, ErrGroupedAggregateDistinctOnUnsupported
	}

	var orderBy *arguments.OrderBy

	for _, m := range modifiers {
		switch mod := m.(type) {
		case *arguments.Limit:
			limitOffset.limit = mod.Value
			limitOffset.hasLimit = true
		case *arguments.Offset:
			limitOffset.offset = mod.Value
			limitOffset.hasOffset = true
		case *arguments.OrderBy:
			// Relationship/aggregate ordering terms (Column == "") render
			// correlated subqueries against the target table ref that cannot be
			// threaded into the DISTINCT ON tiebreak or the per-group json_agg
			// ordering; reject them. Scalar-column ordering is applied.
			for i := range mod.Items {
				if mod.Items[i].Column == "" {
					return nil, nil, nil, limitOffset, ErrGroupedAggregateRelationshipOrderBy
				}
			}

			if len(mod.Items) > 0 {
				orderBy = mod
			}
		}
	}

	return whereClause, distinctOn, orderBy, limitOffset, nil
}

func groupedAggregateArgumentPath(in groupedaggdispatch.BuildInput) string {
	if in.ArgumentPath != "" {
		return in.ArgumentPath
	}

	return rootFieldName(in.Field)
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
	distinctOn *arguments.DistinctOn,
	orderBy *arguments.OrderBy,
) ([]any, int, error) {
	tableRef := t.tableSourceRef()

	b.WriteString(`WITH "`)
	b.WriteString(groupedAggregateBaseAlias)
	b.WriteString(`" `)
	b.WriteString(t.dialect.MaterializedCTE())
	b.WriteString(` (SELECT `)

	if distinctOn != nil {
		t.writeGroupedDistinctOn(b, distinctOn)
		b.WriteByte(' ')
	}

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

	// A CTE ORDER BY is only meaningful when distinct_on is present: it selects
	// which row each (join_key, distinct_on) group keeps. The GROUP BY in the
	// outer query discards the CTE row order otherwise, so order_by-only node
	// ordering is applied in the json_agg of writeGroupedAggregateNodes instead.
	if distinctOn != nil {
		writeGroupedDistinctOrderBy(b, orderBy)
	}

	b.WriteString(") ")

	return params, paramIndex, nil
}

// writeGroupedAggregateWindowCTE appends a second CTE that numbers each base-CTE
// row within its parent group:
//
//	, "_root.windowed" AS [MATERIALIZED] (
//	    SELECT *, row_number() OVER (
//	        PARTITION BY "__cs_join_key" ORDER BY <effective order_by, fallback join key>
//	    ) AS "__cs_rn"
//	    FROM "_root.base"
//	)
//
// The window numbering must run over the post-DISTINCT-ON rows (PostgreSQL
// computes DISTINCT ON in the base CTE, then this CTE numbers what survives), so
// the windowing lives in a separate CTE rather than the base SELECT. The actual
// per-group window predicate (on "__cs_rn") is applied by the outer query's
// LEFT JOIN ON clause, because a window-function output column cannot be
// referenced in the same SELECT that computes it. The outer aggregate/nodes then
// read the windowed rows so the SAME limited row set feeds both the aggregate
// functions and the nodes array — matching Hasura, which limits count and nodes
// consistently.
//
// This CTE itself appends no parameters; the parameterised limit/offset bounds
// are written by writeGroupedWindowedFrom in the outer query.
func (t *table) writeGroupedAggregateWindowCTE(
	b *strings.Builder,
	orderBy *arguments.OrderBy,
) {
	b.WriteString(`, "`)
	b.WriteString(groupedAggregateWindowedAlias)
	b.WriteString(`" `)
	b.WriteString(t.dialect.MaterializedCTE())
	// "_root.base".* (qualified) re-exposes every base-CTE column to the outer
	// query alongside the row number; the alias qualifier keeps it unambiguous.
	b.WriteString(` (SELECT "`)
	b.WriteString(groupedAggregateBaseAlias)
	b.WriteString(`".*, row_number() OVER (PARTITION BY `)
	core.WriteQuotedIdentifier(b, groupedAggregateJoinKeyAlias)
	b.WriteString(" ORDER BY ")
	writeGroupedWindowOrderBy(b, orderBy)
	b.WriteString(`) AS "`)
	b.WriteString(groupedAggregateRowNumberCol)
	b.WriteString(`" FROM "`)
	b.WriteString(groupedAggregateBaseAlias)
	b.WriteString(`") `)
}

// writeGroupedWindowOrderBy writes the ORDER BY inside the row_number() window.
// It uses the user's order_by columns (qualified to the base CTE alias) when
// present, otherwise falls back to the join key so row_number() is deterministic
// SQL. Like Hasura, the intra-group order without an explicit order_by is not
// guaranteed; the fallback only guarantees a stable, valid window expression.
func writeGroupedWindowOrderBy(b *strings.Builder, orderBy *arguments.OrderBy) {
	baseRef := `"` + groupedAggregateBaseAlias + `"`

	if orderBy == nil {
		core.WriteQualifiedColumn(b, baseRef, groupedAggregateJoinKeyAlias)

		return
	}

	for i := range orderBy.Items {
		if i > 0 {
			b.WriteString(", ")
		}

		core.WriteQualifiedColumn(b, baseRef, orderBy.Items[i].Column)
		b.WriteByte(' ')
		b.WriteString(orderBy.Items[i].Direction.SQL())
	}
}

// writeGroupedWindowedFrom writes the FROM clause used when a per-group
// limit/offset is active. The requested join-key set must survive the window
// even when it removes every row of a group (limit: 0, or an offset past the
// group size), because Hasura still emits that group with count 0 / nodes []
// — verified against the live cross-database aggregate relationship. So instead
// of filtering rows out of the GROUP BY input (which would drop whole groups),
// the windowed rows are LEFT JOINed back onto the distinct key set and the
// window predicate lives in the JOIN's ON clause:
//
//	FROM (SELECT DISTINCT "__cs_join_key" FROM "_root.windowed") AS "_root.keys"
//	LEFT JOIN "_root.windowed"
//	  ON "_root.keys"."__cs_join_key" = "_root.windowed"."__cs_join_key"
//	  AND "_root.windowed"."<join_col>" IS NOT NULL
//	  AND "__cs_rn" > <offset> [AND "__cs_rn" <= <offset>+<limit>]
//
// "_root.windowed" never drops rows (it only numbers them), so its distinct
// "__cs_join_key" set is exactly the requested join keys — including the
// synthesized empty-group rows, whose join key column carries the real key and
// whose target columns are NULL. Out-of-window rows simply fail the ON clause,
// so their target columns read NULL in the outer SELECT: COUNT(<join_col>) and
// the nodes FILTER (WHERE <join_col> IS NOT NULL) then yield 0 / [] for that
// group while the group itself is preserved. Offset-only requests omit the
// upper bound (no limit); limit-only requests use offset 0. limit/offset are
// bound via dialect.Placeholder so user values never enter the SQL string.
func (t *table) writeGroupedWindowedFrom(
	b *strings.Builder,
	params []any, paramIndex int,
	joinCol *core.Column,
	limitOffset groupedLimitOffset,
) ([]any, int) {
	offset := limitOffset.effectiveOffset()

	keysRef := `"` + groupedAggregateWindowKeysAlias + `"`
	windowedRef := `"` + groupedAggregateWindowedAlias + `"`

	b.WriteString(`(SELECT DISTINCT `)
	core.WriteQuotedIdentifier(b, groupedAggregateJoinKeyAlias)
	b.WriteString(` FROM `)
	b.WriteString(windowedRef)
	b.WriteString(`) AS `)
	b.WriteString(keysRef)
	b.WriteString(` LEFT JOIN `)
	b.WriteString(windowedRef)
	b.WriteString(` ON `)
	core.WriteQualifiedColumn(b, keysRef, groupedAggregateJoinKeyAlias)
	b.WriteString(` = `)
	core.WriteQualifiedColumn(b, windowedRef, groupedAggregateJoinKeyAlias)
	b.WriteString(` AND `)
	core.WriteQualifiedColumn(b, windowedRef, joinCol.SQLName)
	b.WriteString(` IS NOT NULL AND `)
	core.WriteQuotedIdentifier(b, groupedAggregateRowNumberCol)
	b.WriteString(" > ")
	b.WriteString(t.dialect.Placeholder(paramIndex))

	params = append(params, offset)
	paramIndex++

	if limitOffset.hasLimit {
		b.WriteString(` AND `)
		core.WriteQuotedIdentifier(b, groupedAggregateRowNumberCol)
		b.WriteString(" <= ")
		b.WriteString(t.dialect.Placeholder(paramIndex))

		params = append(params, offset+limitOffset.limit)
		paramIndex++
	}

	return params, paramIndex
}

// writeGroupedDistinctOn writes a DISTINCT ON clause partitioned by the parent
// join key: DISTINCT ON ("__cs_join_key", <distinct cols>). Prefixing the join
// key makes the distinct apply per group, so each parent row's aggregate sees
// only the rows distinct on the requested columns within that group — matching
// the root aggregate path, which distincts the whole (ungrouped) table.
func (t *table) writeGroupedDistinctOn(b *strings.Builder, distinctOn *arguments.DistinctOn) {
	b.WriteString("DISTINCT ON (")
	core.WriteQuotedIdentifier(b, groupedAggregateJoinKeyAlias)

	for _, col := range distinctOn.Columns {
		b.WriteString(", ")
		core.WriteQuotedIdentifier(b, col)
	}

	b.WriteByte(')')
}

// writeGroupedDistinctOrderBy writes the CTE ORDER BY used to resolve the
// DISTINCT ON tiebreak: ORDER BY "__cs_join_key"[, <order_by terms>]. The join
// key leads so DISTINCT ON groups per parent row; the user's order_by terms
// follow verbatim. PostgreSQL requires the DISTINCT ON columns to be a prefix
// of the ORDER BY, so a user order_by whose leading columns differ from
// distinct_on raises the same "DISTINCT ON expressions must match initial
// ORDER BY expressions" error the root aggregate path raises for that input.
//
// No params are threaded: parseGroupedAggregateArguments rejects relationship
// order_by terms, so only scalar columns (which append no parameters) reach
// here.
func writeGroupedDistinctOrderBy(b *strings.Builder, orderBy *arguments.OrderBy) {
	b.WriteString(` ORDER BY `)
	core.WriteQuotedIdentifier(b, groupedAggregateJoinKeyAlias)

	if orderBy == nil {
		return
	}

	for i := range orderBy.Items {
		b.WriteString(", ")
		core.WriteQuotedIdentifier(b, orderBy.Items[i].Column)
		b.WriteByte(' ')
		b.WriteString(orderBy.Items[i].Direction.SQL())
	}
}

// writeGroupedAggregateOuter writes:
//
//	SELECT coalesce(<json_agg>(per_group), '[]') AS "<outputAlias>"
//	FROM (
//	    SELECT <per_group_json_build_object> AS per_group
//	    FROM <source>
//	    GROUP BY <join key>
//	) AS _groups
//
// sourceAlias is the base CTE ("_root.base") for the common case, or the
// windowed CTE ("_root.windowed") when a per-group limit/offset reshapes the
// rows feeding both the aggregate functions and the nodes array. In the common
// case <source> is just "_root.base" and the join key is the bare
// "__cs_join_key". When limitOffset is active <source> becomes the windowed rows
// LEFT JOINed back onto the distinct join-key set (see writeGroupedWindowedFrom)
// so every requested group survives even when its window is empty; the join key
// is then qualified to the key-set alias because it is exposed on both sides of
// that join.
//
// The single-row, single-column result preserves the existing one-row-per-
// operation contract of Driver.ExecuteOperations: the value is a JSON array
// of group objects, each shaped with the reserved internal join key plus the
// requested GraphQL response names.
func (t *table) writeGroupedAggregateOuter( //nolint:funlen
	b *strings.Builder,
	params []any, paramIndex int,
	fragments ast.FragmentDefinitionList,
	outerTypenames []typenameSelection,
	aggregateFields []aggregateFieldSelection,
	nodesFields []aggregateNodesSelection,
	joinCol *core.Column,
	outputAlias string,
	distinctOn *arguments.DistinctOn,
	orderBy *arguments.OrderBy,
	sourceAlias string,
	limitOffset groupedLimitOffset,
) ([]any, error) {
	// The join key is unambiguous (single source) in the common case but exposed
	// on both sides of the windowed LEFT JOIN, so qualify it to the key-set alias
	// there to keep the json output and GROUP BY referencing one column.
	joinKeyRef := ""
	if limitOffset.active() {
		joinKeyRef = `"` + groupedAggregateWindowKeysAlias + `"`
	}

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
	b.WriteString(`', `)
	core.WriteQualifiedColumn(b, joinKeyRef, groupedAggregateJoinKeyAlias)

	for i := range outerTypenames {
		b.WriteString(", ")
		outerTypenames[i].Write(b)
	}

	for i := range aggregateFields {
		if len(aggregateFields[i].selections) == 0 {
			continue
		}

		b.WriteString(", '")
		b.WriteString(aggregateFields[i].responseName)
		b.WriteString("', ")
		b.WriteString(t.dialect.JSONBuildObject())
		b.WriteByte('(')

		for j, agg := range aggregateFields[i].selections {
			if j > 0 {
				b.WriteString(", ")
			}

			t.writeGroupedAggregateSelection(b, agg, joinCol, sourceAlias)
		}

		b.WriteByte(')')
	}

	for i := range nodesFields {
		if err := t.writeGroupedAggregateNodes(
			b, nodesFields[i].responseName, nodesFields[i].field,
			fragments, joinCol, distinctOn, orderBy, sourceAlias,
		); err != nil {
			return nil, err
		}
	}

	b.WriteString(`) AS "per_group" FROM `)

	// When a per-group limit/offset is active, LEFT JOIN the row-number-windowed
	// rows back onto the distinct join-key set so groups whose entire window is
	// filtered out (limit: 0, or an offset past the group size) still emit count
	// 0 / nodes []. Otherwise read the base CTE directly (no window, no churn).
	if limitOffset.active() {
		params, _ = t.writeGroupedWindowedFrom(b, params, paramIndex, joinCol, limitOffset)
	} else {
		b.WriteByte('"')
		b.WriteString(sourceAlias)
		b.WriteByte('"')
	}

	b.WriteString(` GROUP BY `)
	core.WriteQualifiedColumn(b, joinKeyRef, groupedAggregateJoinKeyAlias)
	b.WriteString(`) AS "_groups"`)

	return params, nil
}

// writeGroupedAggregateSelection writes a single aggregate sub-selection. A
// bare count(*) is substituted with COUNT(<join_col>) so empty groups (rows
// synthesized by the LEFT JOIN with no matching target) count as zero. A
// column-scoped or distinct count is rendered against the source CTE alias:
// COUNT(col) already ignores the NULL columns of a synthesized empty-group row,
// so it naturally yields 0 there. Function aggregates are qualified to the same
// source CTE so the windowed limit/offset path cannot resolve columns from the
// wrong side of its LEFT JOIN. sourceAlias is the base CTE, or the windowed CTE
// when a per-group limit/offset applies.
func (t *table) writeGroupedAggregateSelection(
	b *strings.Builder, agg aggregateQuerySelection, joinCol *core.Column, sourceAlias string,
) {
	if cs, ok := agg.(*countSelection); ok {
		if len(cs.columns) == 0 {
			b.WriteByte('\'')
			b.WriteString(cs.responseName)
			b.WriteString("', COUNT(")
			core.WriteQualifiedColumn(b, `"`+sourceAlias+`"`, joinCol.SQLName)
			b.WriteByte(')')

			return
		}

		cs.writeFiltered(b, `"`+sourceAlias+`"`, joinCol)

		return
	}

	if fs, ok := agg.(*aggregateFunctionSelection); ok {
		fs.write(b, `"`+sourceAlias+`"`)

		return
	}

	agg.Write(b)
}

// writeGroupedAggregateNodes writes the nodes response entry: a json_agg of an
// inline row-to-json expression, FILTERed by join_col IS NOT NULL so empty
// groups produce [] rather than an array containing a single all-null row.
// sourceAlias is the base CTE, or the windowed CTE when a per-group limit/offset
// applies, so the nodes array reflects the same limited rows as the aggregate.
//
// Node ordering is applied inside the json_agg (the GROUP BY discards the source
// CTE row order): by the user's order_by columns when present, otherwise by the
// distinct_on columns when distinct_on is present (matching the root aggregate
// path, which orders distinct_on nodes by the distinct columns).
//
// Nested same-database relationships inside cross-database aggregate nodes
// are not supported in this first cut — they would require LATERAL joins
// that don't compose with the GROUP BY here.
func (t *table) writeGroupedAggregateNodes(
	b *strings.Builder,
	responseName string,
	nodesField *ast.Field,
	fragments ast.FragmentDefinitionList,
	joinCol *core.Column,
	distinctOn *arguments.DistinctOn,
	orderBy *arguments.OrderBy,
	sourceAlias string,
) error {
	columns, relationships, err := t.astToQuerySelection(nodesField, fragments)
	if err != nil {
		return err
	}

	if len(relationships) > 0 {
		return errGroupedAggregateNestedRelationships
	}

	b.WriteString(", '")
	b.WriteString(responseName)
	b.WriteString("', coalesce(")

	var rowB strings.Builder

	t.dialect.WriteJSONRowPrefix(&rowB)
	t.writeNodeColumnSelections(&rowB, columns, sourceAlias)
	t.dialect.WriteJSONRowSuffixNoAlias(&rowB)
	t.writeGroupedNodesOrderBy(&rowB, distinctOn, orderBy, sourceAlias)

	b.WriteString(t.dialect.JSONAggRawExpr(rowB.String()))
	b.WriteString(` FILTER (WHERE `)
	core.WriteQualifiedColumn(b, `"`+sourceAlias+`"`, joinCol.SQLName)
	b.WriteString(" IS NOT NULL), ")
	b.WriteString(t.dialect.EmptyJSONArray())
	b.WriteByte(')')

	return nil
}

// writeGroupedNodesOrderBy appends an ORDER BY for the per-group nodes json_agg,
// referencing the source CTE alias. The user's order_by columns take precedence;
// when only distinct_on is present the nodes are ordered by the distinct columns
// (ASC NULLS LAST), mirroring the root aggregate path's distinct_on node order.
// Both reference "<sourceAlias>".<col> because the json_agg runs over that CTE.
func (t *table) writeGroupedNodesOrderBy(
	b *strings.Builder,
	distinctOn *arguments.DistinctOn,
	orderBy *arguments.OrderBy,
	sourceAlias string,
) {
	baseRef := `"` + sourceAlias + `"`

	switch {
	case orderBy != nil:
		b.WriteString(" ORDER BY ")

		for i := range orderBy.Items {
			if i > 0 {
				b.WriteString(", ")
			}

			core.WriteQualifiedColumn(b, baseRef, orderBy.Items[i].Column)
			b.WriteByte(' ')
			b.WriteString(orderBy.Items[i].Direction.SQL())
		}
	case distinctOn != nil:
		b.WriteString(" ORDER BY ")

		for i, col := range distinctOn.Columns {
			if i > 0 {
				b.WriteString(", ")
			}

			core.WriteQualifiedColumn(b, baseRef, col)
			b.WriteString(" ASC NULLS LAST")
		}
	}
}

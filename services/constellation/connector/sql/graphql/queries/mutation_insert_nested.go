package queries

import (
	"fmt"
	"maps"
	"strconv"
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
)

// extendSubsForArrayChild returns the table-substitution map a nested-insert
// child should use for its own insert-permission check. For array
// relationships the FK lives on the child and points at the parent; a
// permission predicate that reaches the parent via a relationship would
// otherwise EXISTS-query the parent's underlying table and miss the in-flight
// INSERT (Postgres WITH snapshot semantics). Mapping the parent's
// TableFromClause to the parent CTE name redirects those EXISTS subqueries to
// the CTE instead. Object relationships and top-level callers pass through
// the parent's tableSubs unchanged.
func extendSubsForArrayChild(
	parentSubs where.TableSubstitutions,
	parentTableFromClause string,
	parentCTEName string,
	ni *arguments.NestedInsert,
) where.TableSubstitutions {
	if !ni.IsArrayRelationship || parentTableFromClause == "" {
		return parentSubs
	}

	childSubs := make(where.TableSubstitutions, len(parentSubs)+1)
	maps.Copy(childSubs, parentSubs)
	childSubs[parentTableFromClause] = parentCTEName

	return childSubs
}

// buildNestedInsertCTE renders the CTE for a single nested insert, recursing
// into deeper nested inserts. It replaces the (*nestedInsert).buildCTE method
// from before the arguments extraction: arguments.NestedInsert is pure data,
// so the CTE-building logic that calls back into queries-internal table
// methods (buildSingleInsertCTE) lives here.
//
// Object relationships and single-row array relationships use the single-row
// path (one row INSERT per CTE). Array relationships with multiple rows use
// the multi-row path (UNION-ALL fed INSERT) — matching how top-level
// multi-row inserts are emitted.
func buildNestedInsertCTE(
	b *strings.Builder,
	ni *arguments.NestedInsert,
	parentCTEName string,
	parentTableFromClause string,
	tableSubs where.TableSubstitutions,
	params []any,
	paramIndex int,
	role string,
	sessionVariables map[string]any,
) ([]any, int, error) {
	cteName := "nested_" + ni.RelationshipName

	if b.Len() > 0 {
		b.WriteString(", ")
	}

	nestedFKIndex := ni.ApplyArrayFKColumn(parentCTEName)
	childSubs := extendSubsForArrayChild(tableSubs, parentTableFromClause, parentCTEName, ni)

	// ni.TargetTable always arrives as a *table — that's the only thing the
	// parser stores there (see arguments_adapter.go's TargetTable method on
	// *relationship). Use a checked assertion so a future parser change fails
	// loudly instead of panicking.
	target, ok := ni.TargetTable.(*table)
	if !ok {
		return nil, 0, fmt.Errorf(
			"%w: nested insert %s: target table is %T, expected *table",
			errNestedInsertTargetTableType,
			ni.RelationshipName, ni.TargetTable,
		)
	}

	var err error
	if len(ni.NestedObjects) == 1 {
		params, paramIndex, err = buildSingleNestedInsertCTE(
			b, target, cteName, ni, nestedFKIndex, childSubs,
			params, paramIndex, role, sessionVariables,
		)
	} else {
		params, paramIndex, err = target.buildMultiNestedInsertCTE(
			b, cteName, ni.NestedObjects, ni.OnConflict, nestedFKIndex, childSubs,
			params, paramIndex, role, sessionVariables,
		)
	}

	if err != nil {
		return nil, 0, fmt.Errorf("failed to build CTE for %s: %w", ni.RelationshipName, err)
	}

	// Recurse into deeper nested inserts on the first row (top-level inserts
	// have the same constraint — deeper nesting is only walked from the first
	// row of a multi-row insert). The cteName/target.tableFromClause() becomes
	// the next level's parent.
	for i := range ni.NestedObjects[0].NestedInserts {
		nested := &ni.NestedObjects[0].NestedInserts[i]

		params, paramIndex, err = buildNestedInsertCTE(
			b, nested, cteName, target.tableFromClause(), childSubs,
			params, paramIndex, role, sessionVariables,
		)
		if err != nil {
			return nil, 0, fmt.Errorf(
				"failed to build nested CTE for %s: %w", nested.RelationshipName, err,
			)
		}
	}

	return params, paramIndex, nil
}

// buildSingleNestedInsertCTE emits the single-row nested INSERT path, used for
// object relationships and array relationships with exactly one row.
func buildSingleNestedInsertCTE(
	b *strings.Builder,
	target *table,
	cteName string,
	ni *arguments.NestedInsert,
	nestedFKIndex map[string]string,
	tableSubs where.TableSubstitutions,
	params []any,
	paramIndex int,
	role string,
	sessionVariables map[string]any,
) ([]any, int, error) {
	for _, col := range ni.NestedObjects[0].Columns {
		if _, isFK := nestedFKIndex[col.Column.SQLName]; !isFK {
			params = append(params, col.Value)
		}
	}

	return target.buildSingleInsertCTE(
		b, cteName, ni.NestedObjects[0], ni.OnConflict, nestedFKIndex, tableSubs,
		params, paramIndex, role, sessionVariables,
	)
}

// buildMultiNestedInsertCTE renders the multi-row INSERT path for an array
// relationship with more than one nested row. It mirrors the top-level
// buildInsertMutationCTE shape but emits CTEs named `check_<cteName>` and
// `<cteName>` (with `<cteName>_check_count` when permissions apply) so the
// names line up with the single-row nested path and with downstream consumers
// that key off `nested_<rel>`.
func (t *table) buildMultiNestedInsertCTE(
	b *strings.Builder,
	cteName string,
	insertObjs []arguments.InsertObject,
	onConflict *arguments.OnConflict,
	nestedFKIndex map[string]string,
	tableSubs where.TableSubstitutions,
	params []any,
	paramIndex int,
	role string,
	sessionVariables map[string]any,
) ([]any, int, error) {
	nestedFKColumns := make(map[string]struct{}, len(nestedFKIndex))
	for col := range nestedFKIndex {
		nestedFKColumns[col] = struct{}{}
	}

	allColumns, columnToValue := t.collectAllColumns(insertObjs, nestedFKColumns)

	presentCols := insertPresentColumns(insertObjs, nestedFKIndex)
	if t.requiresPostInsertCheck(role, presentCols) {
		return t.buildMultiNestedInsertCTEPostCheck(
			b, cteName, insertObjs, allColumns, columnToValue,
			nestedFKIndex, tableSubs, onConflict, role, sessionVariables,
			params, paramIndex,
		)
	}

	return t.buildMultiNestedInsertCTEPreCheck(
		b, cteName, insertObjs, allColumns, columnToValue,
		nestedFKIndex, tableSubs, onConflict, role, sessionVariables,
		params, paramIndex,
	)
}

func (t *table) buildMultiNestedInsertCTEPreCheck(
	b *strings.Builder,
	cteName string,
	insertObjs []arguments.InsertObject,
	allColumns []string,
	columnToValue []map[string]any,
	nestedFKIndex map[string]string,
	tableSubs where.TableSubstitutions,
	onConflict *arguments.OnConflict,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	checkCTEName := "check_" + cteName

	dataColumns := t.extendWithPermissionColumns(allColumns, role)

	b.WriteString(checkCTEName)
	b.WriteString(" AS (SELECT * FROM (") //nolint:unqueryvet

	params, paramIndex = t.buildUnionAllSelect(
		b, insertObjs, dataColumns, columnToValue, nestedFKIndex, params, paramIndex,
	)

	b.WriteString(") AS data WHERE ")

	params, paramIndex, hasCheckPermissions, err := t.buildCheckConstraintWhereClause(
		b, role, sessionVariables, tableSubs, params, paramIndex,
	)
	if err != nil {
		return nil, 0, err
	}

	b.WriteString("), ")

	if hasCheckPermissions {
		t.buildCheckCountCTE(b, cteName, checkCTEName, len(insertObjs))
	}

	finalColumns := append([]string{}, allColumns...)
	for col := range nestedFKIndex {
		finalColumns = append(finalColumns, col)
	}

	b.WriteString(cteName)
	b.WriteString(" AS (INSERT INTO ")
	b.WriteString(t.tableFromClause())

	t.buildInsertColumnsClause(b, finalColumns)
	t.buildInsertSelectClause(b, finalColumns, checkCTEName, nestedFKIndex)
	t.buildInsertFromClause(b, checkCTEName, nestedFKIndex)
	t.buildInsertWhereClause(b, cteName, hasCheckPermissions)

	if onConflict != nil {
		params, paramIndex, err = onConflict.ToSQL(b, params, paramIndex)
		if err != nil {
			return nil, 0, err //nolint:wrapcheck
		}
	}

	b.WriteString(" RETURNING *)")

	return params, paramIndex, nil
}

// buildMultiNestedInsertCTEPostCheck emits the multi-row nested-insert path
// when the role's insert check must run against RETURNING * (generated
// columns or DB-defaulted columns absent from the payload). tableSubs mirrors
// the pre-check sibling: it redirects relationship-EXISTS subqueries that
// target a sibling in-flight CTE (typically the parent's mutation_result) so
// they read the just-inserted rows instead of the underlying empty table.
func (t *table) buildMultiNestedInsertCTEPostCheck(
	b *strings.Builder,
	cteName string,
	insertObjs []arguments.InsertObject,
	allColumns []string,
	columnToValue []map[string]any,
	nestedFKIndex map[string]string,
	tableSubs where.TableSubstitutions,
	onConflict *arguments.OnConflict,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	dataCTEName := cteName + "_data"
	rawCTEName := "_" + cteName
	postCheckName := cteName + "_post_check"

	b.WriteString(dataCTEName)
	b.WriteString(" AS (SELECT * FROM (") //nolint:unqueryvet

	params, paramIndex = t.buildUnionAllSelect(
		b, insertObjs, allColumns, columnToValue, nestedFKIndex, params, paramIndex,
	)

	b.WriteString(") AS data), ")

	finalColumns := append([]string{}, allColumns...)
	for col := range nestedFKIndex {
		finalColumns = append(finalColumns, col)
	}

	b.WriteString(rawCTEName)
	b.WriteString(" AS (INSERT INTO ")
	b.WriteString(t.tableFromClause())

	t.buildInsertColumnsClause(b, finalColumns)
	t.buildInsertSelectClause(b, finalColumns, dataCTEName, nestedFKIndex)
	t.buildInsertFromClause(b, dataCTEName, nestedFKIndex)

	if onConflict != nil {
		var err error

		params, paramIndex, err = onConflict.ToSQL(b, params, paramIndex)
		if err != nil {
			return nil, 0, err //nolint:wrapcheck
		}
	}

	b.WriteString(" RETURNING *), ")

	params, paramIndex, err := t.buildPostCheckCTEWithName(
		b, postCheckName, rawCTEName, tableSubs, role, sessionVariables, params, paramIndex,
	)
	if err != nil {
		return nil, 0, err
	}

	b.WriteString(cteName)
	b.WriteString(" AS (SELECT * FROM ") //nolint:unqueryvet
	b.WriteString(rawCTEName)
	b.WriteString(" WHERE (SELECT status FROM ")
	b.WriteString(postCheckName)
	b.WriteString(") = 1)")

	return params, paramIndex, nil
}

// buildNestedInsertCTEs builds CTEs for object-relationship nested inserts.
// Object-rel nested inserts must run BEFORE the parent INSERT because the
// parent uses their generated values as foreign-key column values
// (e.g. `INSERT INTO posts (author_id) SELECT nested_author.id …`).
//
// Array-relationship nested inserts go through buildArrayNestedInsertCTEs and
// run AFTER the parent, since the FK lives on the child and references the
// parent's PK.
func (t *table) buildNestedInsertCTEs(
	insertObjs []arguments.InsertObject,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) (string, []any, int, error) {
	if len(insertObjs) == 0 || len(insertObjs[0].NestedInserts) == 0 {
		return "", params, paramIndex, nil
	}

	var cteSQL strings.Builder
	for i := range insertObjs[0].NestedInserts {
		nested := &insertObjs[0].NestedInserts[i]
		if nested.IsArrayRelationship {
			continue
		}

		var err error

		params, paramIndex, err = buildNestedInsertCTE(
			&cteSQL, nested, "mutation_result", t.tableFromClause(), nil,
			params, paramIndex, role, sessionVariables,
		)
		if err != nil {
			return "", nil, 0, fmt.Errorf(
				"failed to build CTE for %s: %w",
				nested.RelationshipName,
				err,
			)
		}
	}

	return cteSQL.String(), params, paramIndex, nil
}

// buildArrayNestedInsertCTEs builds CTEs for array-relationship nested
// inserts, which must run AFTER the parent CTE (mutation_result) since the FK
// column lives on the child and references the parent's PK.
//
// Two emission shapes:
//
//  1. Single-parent (len(insertObjs) == 1): each parent's children cross-join
//     `mutation_result` (one row) and so attach correctly. The single/multi
//     row distinction inside ni.NestedObjects is kept (single-row path emits a
//     single INSERT, multi-row path emits a UNION-ALL data CTE) for historical
//     SQL shape stability.
//  2. Multi-parent (len(insertObjs) > 1): a cross-join would attach every
//     child to every parent (and silently drop children belonging to
//     parents other than the first). Children from every parent's
//     NestedInserts are merged into one data CTE per relationship, tagged
//     with a `_parent_idx` column, and joined to a row-numbered view of
//     `mutation_result` so each child lands on its rightful parent.
func (t *table) buildArrayNestedInsertCTEs(
	insertObjs []arguments.InsertObject,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) (string, []any, int, error) {
	if len(insertObjs) == 0 {
		return "", params, paramIndex, nil
	}

	if len(insertObjs) > 1 {
		return t.buildPartitionedArrayNestedInsertCTEs(
			insertObjs, role, sessionVariables, params, paramIndex,
		)
	}

	if len(insertObjs[0].NestedInserts) == 0 {
		return "", params, paramIndex, nil
	}

	var cteSQL strings.Builder
	for i := range insertObjs[0].NestedInserts {
		nested := &insertObjs[0].NestedInserts[i]
		if !nested.IsArrayRelationship {
			continue
		}

		var err error

		params, paramIndex, err = buildNestedInsertCTE(
			&cteSQL, nested, "mutation_result", t.tableFromClause(), nil,
			params, paramIndex, role, sessionVariables,
		)
		if err != nil {
			return "", nil, 0, fmt.Errorf(
				"failed to build CTE for %s: %w",
				nested.RelationshipName,
				err,
			)
		}
	}

	return cteSQL.String(), params, paramIndex, nil
}

// parentIdxColumn is the synthetic column name used to tag each nested-child
// row with its parent's row index in multi-parent array-rel inserts. It
// matches the partitioned join column and never collides with a real table
// column because the leading underscore is reserved by writeQuotedIdentifier
// callers throughout this package.
const parentIdxColumn = "_parent_idx"

// partitionedNestedGroup gathers, per array-relationship, every child row
// across all parents in a multi-parent insert. parentIdxs is the row-aligned
// parent index that's threaded into the data CTE as `_parent_idx` and joined
// against the row-numbered view of mutation_result.
type partitionedNestedGroup struct {
	template   *arguments.NestedInsert
	objs       []arguments.InsertObject
	parentIdxs []int
}

// groupPartitionedArrayNestedInserts walks every parent's NestedInserts and
// merges array-rel children into per-relationship groups, recording each
// row's parent index. Order is first-encounter for both relationships and
// rows so the resulting SQL is deterministic.
func groupPartitionedArrayNestedInserts(
	insertObjs []arguments.InsertObject,
) []*partitionedNestedGroup {
	var groups []*partitionedNestedGroup

	byName := make(map[string]*partitionedNestedGroup)

	for parentIdx := range insertObjs {
		for i := range insertObjs[parentIdx].NestedInserts {
			nested := &insertObjs[parentIdx].NestedInserts[i]
			if !nested.IsArrayRelationship {
				continue
			}

			g, ok := byName[nested.RelationshipName]
			if !ok {
				g = &partitionedNestedGroup{
					template: nested, objs: nil, parentIdxs: nil,
				}
				byName[nested.RelationshipName] = g
				groups = append(groups, g)
			}

			for _, obj := range nested.NestedObjects {
				g.objs = append(g.objs, obj)
				g.parentIdxs = append(g.parentIdxs, parentIdx)
			}
		}
	}

	return groups
}

// buildPartitionedArrayNestedInsertCTEs handles the multi-parent array-rel
// case: children from every parent are merged into one data CTE per
// relationship, each row tagged with its parent's index, and the INSERT joins
// against a row-numbered view of mutation_result so each child lands on its
// rightful parent. This is the fix for the silent-drop + cross-join bug
// documented at the top of this file.
func (t *table) buildPartitionedArrayNestedInsertCTEs(
	insertObjs []arguments.InsertObject,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) (string, []any, int, error) {
	groups := groupPartitionedArrayNestedInserts(insertObjs)
	if len(groups) == 0 {
		return "", params, paramIndex, nil
	}

	var cteSQL strings.Builder

	for _, g := range groups {
		target, ok := g.template.TargetTable.(*table)
		if !ok {
			return "", nil, 0, fmt.Errorf(
				"%w: nested insert %s: target table is %T, expected *table",
				errNestedInsertTargetTableType,
				g.template.RelationshipName, g.template.TargetTable,
			)
		}

		if cteSQL.Len() > 0 {
			cteSQL.WriteString(", ")
		}

		// nestedFKIndex maps each FK column on the child to the row-numbered
		// alias `mr` (a SELECT over mutation_result that exposes
		// `_parent_idx`). Threading "mr" through buildInsertSelectClause is
		// what makes the emitted SELECT reference the joined parent row
		// instead of cross-joining the whole CTE.
		nestedFKIndex := g.template.ApplyArrayFKColumn("mr")
		childSubs := extendSubsForArrayChild(
			nil, t.tableFromClause(), "mutation_result", g.template,
		)

		cteName := "nested_" + g.template.RelationshipName

		var err error

		params, paramIndex, err = target.buildPartitionedNestedArrayCTE(
			&cteSQL, cteName, g.objs, g.parentIdxs, g.template.OnConflict,
			nestedFKIndex, childSubs, role, sessionVariables, params, paramIndex,
		)
		if err != nil {
			return "", nil, 0, fmt.Errorf(
				"failed to build CTE for %s: %w", g.template.RelationshipName, err,
			)
		}
	}

	return cteSQL.String(), params, paramIndex, nil
}

// buildPartitionedNestedArrayCTE dispatches the partitioned shape to the
// pre-check or post-check sibling, mirroring buildMultiNestedInsertCTE.
func (t *table) buildPartitionedNestedArrayCTE(
	b *strings.Builder,
	cteName string,
	insertObjs []arguments.InsertObject,
	parentIdxs []int,
	onConflict *arguments.OnConflict,
	nestedFKIndex map[string]string,
	tableSubs where.TableSubstitutions,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	nestedFKColumns := make(map[string]struct{}, len(nestedFKIndex))
	for col := range nestedFKIndex {
		nestedFKColumns[col] = struct{}{}
	}

	allColumns, columnToValue := t.collectAllColumns(insertObjs, nestedFKColumns)

	presentCols := insertPresentColumns(insertObjs, nestedFKIndex)
	if t.requiresPostInsertCheck(role, presentCols) {
		return t.buildPartitionedNestedArrayCTEPostCheck(
			b, cteName, insertObjs, parentIdxs, allColumns, columnToValue,
			nestedFKIndex, tableSubs, onConflict, role, sessionVariables,
			params, paramIndex,
		)
	}

	return t.buildPartitionedNestedArrayCTEPreCheck(
		b, cteName, insertObjs, parentIdxs, allColumns, columnToValue,
		nestedFKIndex, tableSubs, onConflict, role, sessionVariables,
		params, paramIndex,
	)
}

// buildPartitionedNestedArrayCTEPreCheck emits the pre-check variant of the
// multi-parent array-rel CTE. Shape mirrors buildMultiNestedInsertCTEPreCheck
// but the data CTE carries a `_parent_idx` column and the INSERT joins
// against a row-numbered view of mutation_result on that column instead of
// cross-joining.
func (t *table) buildPartitionedNestedArrayCTEPreCheck(
	b *strings.Builder,
	cteName string,
	insertObjs []arguments.InsertObject,
	parentIdxs []int,
	allColumns []string,
	columnToValue []map[string]any,
	nestedFKIndex map[string]string,
	tableSubs where.TableSubstitutions,
	onConflict *arguments.OnConflict,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	checkCTEName := "check_" + cteName

	dataColumns := t.extendWithPermissionColumns(allColumns, role)

	b.WriteString(checkCTEName)
	b.WriteString(" AS (SELECT * FROM (") //nolint:unqueryvet

	params, paramIndex = t.buildPartitionedUnionAllSelect(
		b, insertObjs, parentIdxs, dataColumns, columnToValue,
		nestedFKIndex, params, paramIndex,
	)

	b.WriteString(") AS data WHERE ")

	params, paramIndex, hasCheckPermissions, err := t.buildCheckConstraintWhereClause(
		b, role, sessionVariables, tableSubs, params, paramIndex,
	)
	if err != nil {
		return nil, 0, err
	}

	b.WriteString("), ")

	if hasCheckPermissions {
		t.buildCheckCountCTE(b, cteName, checkCTEName, len(insertObjs))
	}

	finalColumns := append([]string{}, allColumns...)
	for col := range nestedFKIndex {
		finalColumns = append(finalColumns, col)
	}

	b.WriteString(cteName)
	b.WriteString(" AS (INSERT INTO ")
	b.WriteString(t.tableFromClause())

	t.buildInsertColumnsClause(b, finalColumns)
	t.buildInsertSelectClause(b, finalColumns, checkCTEName, nestedFKIndex)
	writePartitionedInsertFromClause(b, checkCTEName)
	t.buildInsertWhereClause(b, cteName, hasCheckPermissions)

	if onConflict != nil {
		params, paramIndex, err = onConflict.ToSQL(b, params, paramIndex)
		if err != nil {
			return nil, 0, err //nolint:wrapcheck
		}
	}

	b.WriteString(" RETURNING *)")

	return params, paramIndex, nil
}

// buildPartitionedNestedArrayCTEPostCheck emits the post-check variant of the
// multi-parent array-rel CTE. Shape mirrors
// buildMultiNestedInsertCTEPostCheck but with the same partitioning treatment
// as the pre-check sibling.
func (t *table) buildPartitionedNestedArrayCTEPostCheck(
	b *strings.Builder,
	cteName string,
	insertObjs []arguments.InsertObject,
	parentIdxs []int,
	allColumns []string,
	columnToValue []map[string]any,
	nestedFKIndex map[string]string,
	tableSubs where.TableSubstitutions,
	onConflict *arguments.OnConflict,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	dataCTEName := cteName + "_data"
	rawCTEName := "_" + cteName
	postCheckName := cteName + "_post_check"

	b.WriteString(dataCTEName)
	b.WriteString(" AS (SELECT * FROM (") //nolint:unqueryvet

	params, paramIndex = t.buildPartitionedUnionAllSelect(
		b, insertObjs, parentIdxs, allColumns, columnToValue,
		nestedFKIndex, params, paramIndex,
	)

	b.WriteString(") AS data), ")

	finalColumns := append([]string{}, allColumns...)
	for col := range nestedFKIndex {
		finalColumns = append(finalColumns, col)
	}

	b.WriteString(rawCTEName)
	b.WriteString(" AS (INSERT INTO ")
	b.WriteString(t.tableFromClause())

	t.buildInsertColumnsClause(b, finalColumns)
	t.buildInsertSelectClause(b, finalColumns, dataCTEName, nestedFKIndex)
	writePartitionedInsertFromClause(b, dataCTEName)

	if onConflict != nil {
		var err error

		params, paramIndex, err = onConflict.ToSQL(b, params, paramIndex)
		if err != nil {
			return nil, 0, err //nolint:wrapcheck
		}
	}

	b.WriteString(" RETURNING *), ")

	params, paramIndex, err := t.buildPostCheckCTEWithName(
		b, postCheckName, rawCTEName, tableSubs, role, sessionVariables, params, paramIndex,
	)
	if err != nil {
		return nil, 0, err
	}

	b.WriteString(cteName)
	b.WriteString(" AS (SELECT * FROM ") //nolint:unqueryvet
	b.WriteString(rawCTEName)
	b.WriteString(" WHERE (SELECT status FROM ")
	b.WriteString(postCheckName)
	b.WriteString(") = 1)")

	return params, paramIndex, nil
}

// buildPartitionedUnionAllSelect emits the UNION ALL data subquery for a
// partitioned nested-array insert. Like buildUnionAllSelect but each branch
// also emits a `_parent_idx` literal for the row's parent index, and FK
// columns reference the row-numbered parent alias `mr` instead of being
// inlined cross-join references.
func (t *table) buildPartitionedUnionAllSelect(
	b *strings.Builder,
	insertObjs []arguments.InsertObject,
	parentIdxs []int,
	allColumns []string,
	columnToValue []map[string]any,
	nestedFKIndex map[string]string,
	params []any,
	paramIndex int,
) ([]any, int) {
	for i := range insertObjs {
		if i > 0 {
			b.WriteString(" UNION ALL ")
		}

		b.WriteString("SELECT ")
		b.WriteString(strconv.Itoa(parentIdxs[i]))
		b.WriteString("::int AS ")
		core.WriteQuotedIdentifier(b, parentIdxColumn)

		for _, col := range allColumns {
			b.WriteString(", ")

			if _, isFK := nestedFKIndex[col]; isFK {
				// FK columns are sourced from the joined parent row at INSERT
				// time, so the data subquery emits a typed NULL placeholder
				// keyed by the column name. This keeps the data CTE's column
				// list aligned across UNION-ALL branches and lets the
				// permission predicate continue to see the FK column.
				t.writeTypedNull(b, col, t.columnSQLType(col))

				continue
			}

			colType := t.columnSQLType(col)

			value, hasValue := columnToValue[i][col]
			if hasValue {
				params, paramIndex = t.writeTypedPlaceholder(
					b, col, colType, value, params, paramIndex,
				)
			} else {
				t.writeTypedNull(b, col, colType)
			}
		}
	}

	return params, paramIndex
}

// writePartitionedInsertFromClause emits the FROM clause for a multi-parent
// nested-array INSERT. The clause joins the data CTE to a row-numbered view
// of mutation_result on `_parent_idx` so each child row lands on its
// rightful parent. The "mr" alias matches the value installed in
// nestedFKIndex by buildPartitionedArrayNestedInsertCTEs.
func writePartitionedInsertFromClause(b *strings.Builder, dataCTEName string) {
	b.WriteString(" FROM ")
	b.WriteString(dataCTEName)
	b.WriteString(" JOIN (SELECT *, (ROW_NUMBER() OVER ())::int - 1 AS ") //nolint:unqueryvet
	core.WriteQuotedIdentifier(b, parentIdxColumn)
	b.WriteString(" FROM mutation_result) AS mr ON mr.")
	core.WriteQuotedIdentifier(b, parentIdxColumn)
	b.WriteByte('=')
	b.WriteString(dataCTEName)
	b.WriteByte('.')
	core.WriteQuotedIdentifier(b, parentIdxColumn)
}

// buildNestedFKIndex maps foreign-key columns to their nested CTE names for
// object-relationship nested inserts only. For object relationships the FK
// lives on the parent row, so we record the CTE that supplies each FK column's
// value and append a placeholder column to every parent insert object.
//
// Array-relationship nested inserts put the FK on the child; the parent INSERT
// must not include those columns, so they are intentionally excluded from this
// index (which drives the parent's INSERT column list).
func (t *table) buildNestedFKIndex(
	insertObjs []arguments.InsertObject,
) map[string]string {
	nestedFKIndex := make(map[string]string) // column -> CTE name
	if len(insertObjs) == 0 {
		return nestedFKIndex
	}

	for _, nested := range insertObjs[0].NestedInserts {
		if nested.IsArrayRelationship {
			continue
		}

		cteName := "nested_" + nested.RelationshipName

		for _, fkName := range nested.ForeignKeyColumns {
			nestedFKIndex[fkName] = cteName

			fkColumn := t.columnFromSQLName(fkName)
			if fkColumn == nil {
				continue
			}

			for i := range insertObjs {
				insertObjs[i].Columns = append(insertObjs[i].Columns, arguments.InsertColumn{
					Column: fkColumn,
					Value:  nil,
				})
			}
		}
	}

	return nestedFKIndex
}

// buildNestedCTEsMap builds a map of relationship names to CTE names for
// response building. Names from every parent's NestedInserts are collected:
// a relationship that only appears under parent[i>0]'s NestedInserts must
// still surface in the returning subquery, otherwise its rows would be
// inserted but never referenced in the GraphQL response.
func (t *table) buildNestedCTEsMap(insertObjs []arguments.InsertObject) map[string]string {
	nestedCTEs := make(map[string]string)

	for _, obj := range insertObjs {
		for _, nested := range obj.NestedInserts {
			if _, ok := nestedCTEs[nested.RelationshipName]; ok {
				continue
			}

			nestedCTEs[nested.RelationshipName] = "nested_" + nested.RelationshipName
		}
	}

	return nestedCTEs
}

package queries

import (
	"fmt"
	"maps"
	"reflect"
	"sort"
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

// nestedCTENamer maps a nested-insert relationship name to the CTE alias used
// for its insert. The single-parent path uses bareNestedCTEName (`nested_<rel>`)
// so existing goldens are unchanged; the multi-parent object-rel path passes a
// parent-indexed namer so each parent's object-rel CTE (and its deeper nested
// chain) stays distinct.
type nestedCTENamer func(relationshipName string) string

func bareNestedCTEName(relationshipName string) string {
	return "nested_" + relationshipName
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
//
// cteName is the alias for this nested insert's CTE; childNamer derives the
// alias for any deeper nested insert reached by the recursion. Callers that
// want the historical `nested_<rel>` naming pass bareNestedCTEName for both.
func buildNestedInsertCTE(
	b *strings.Builder,
	ni *arguments.NestedInsert,
	cteName string,
	childNamer nestedCTENamer,
	parentCTEName string,
	parentTableFromClause string,
	tableSubs where.TableSubstitutions,
	params []any,
	paramIndex int,
	role string,
	sessionVariables map[string]any,
) ([]any, int, error) {
	if b.Len() > 0 {
		b.WriteString(", ")
	}

	nestedFKIndex, err := ni.ApplyArrayFKColumn(parentCTEName)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to apply array FK columns: %w", err)
	}

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
			b, nested, childNamer(nested.RelationshipName), childNamer,
			cteName, target.tableFromClause(), childSubs,
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
	nestedFKIndex arguments.NestedFKSources,
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
	nestedFKIndex arguments.NestedFKSources,
	tableSubs where.TableSubstitutions,
	params []any,
	paramIndex int,
	role string,
	sessionVariables map[string]any,
) ([]any, int, error) {
	nestedFKColumns := nestedFKColumnSet(nestedFKIndex)

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
	nestedFKIndex arguments.NestedFKSources,
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

	finalColumns := insertColumnsWithNestedFK(allColumns, nestedFKIndex)

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
	nestedFKIndex arguments.NestedFKSources,
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

	finalColumns := insertColumnsWithNestedFK(allColumns, nestedFKIndex)

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
//
// Single-parent inserts emit one CTE per object-rel named `nested_<rel>`.
// Multi-parent inserts emit one CTE per parent per object-rel named
// `nested_<rel>_<parentIdx>`, so parent N's FK column can source from its own
// object instead of every parent cross-joining the first row's nested CTE
// (which silently dropped the other parents' objects and misrouted their FKs).
func (t *table) buildNestedInsertCTEs(
	insertObjs []arguments.InsertObject,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) (string, []any, int, error) {
	if len(insertObjs) == 0 || !hasObjectNestedInserts(insertObjs) {
		return "", params, paramIndex, nil
	}

	multiParent := len(insertObjs) > 1

	var cteSQL strings.Builder

	// Single-parent inserts have exactly one element, so this loop emits parent
	// 0's object rels only; multi-parent inserts emit each parent's own object
	// rels under a parent-indexed CTE name.
	for parentIdx := range insertObjs {
		for i := range insertObjs[parentIdx].NestedInserts {
			nested := &insertObjs[parentIdx].NestedInserts[i]
			if nested.IsArrayRelationship {
				continue
			}

			cteName := bareNestedCTEName(nested.RelationshipName)
			childNamer := bareNestedCTEName
			parentCTEName := "mutation_result"

			if multiParent {
				idx := parentIdx
				cteName = partitionedNestedObjectCTEName(nested.RelationshipName, idx)
				childNamer = func(rel string) string {
					return partitionedNestedObjectCTEName(rel, idx)
				}
				parentCTEName = partitionedParentCTEName(idx)
			}

			var err error

			params, paramIndex, err = buildNestedInsertCTE(
				&cteSQL, nested, cteName, childNamer,
				parentCTEName, t.tableFromClause(), nil,
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
//     parents other than the first). The parent INSERT is split into one CTE
//     per input row, then children from every parent's NestedInserts are
//     merged into one data CTE per relationship. Each child row sources FK
//     values from the exact parent CTE that owns it, so the mapping is stable
//     and does not depend on RETURNING row order.
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
			&cteSQL, nested, bareNestedCTEName(nested.RelationshipName), bareNestedCTEName,
			"mutation_result", t.tableFromClause(), nil,
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

func hasArrayNestedInserts(insertObjs []arguments.InsertObject) bool {
	for i := range insertObjs {
		for j := range insertObjs[i].NestedInserts {
			if insertObjs[i].NestedInserts[j].IsArrayRelationship {
				return true
			}
		}
	}

	return false
}

func hasObjectNestedInserts(insertObjs []arguments.InsertObject) bool {
	for i := range insertObjs {
		for j := range insertObjs[i].NestedInserts {
			if !insertObjs[i].NestedInserts[j].IsArrayRelationship {
				return true
			}
		}
	}

	return false
}

// partitionedNestedObjectCTEName is the per-parent CTE name for an
// object-relationship nested insert in a multi-parent insert. The parent index
// suffix keeps each parent's object-rel CTE distinct so parent N can source its
// FK column from its own nested object (nested_<rel>_<parentIdx>) rather than
// every parent cross-joining the single first-row CTE. The conflict-index
// suffix used by array-rel split CTEs starts at 1 and the per-row suffix is
// `_row_N`, so this `_<parentIdx>` scheme (relationship name is unique per
// parent table) cannot collide with an array-rel CTE name.
func partitionedNestedObjectCTEName(relationshipName string, parentIdx int) string {
	return "nested_" + relationshipName + "_" + strconv.Itoa(parentIdx)
}

func partitionedParentCTEName(parentIdx int) string {
	return "mutation_result_" + strconv.Itoa(parentIdx)
}

func partitionedParentCTENames(count int) []string {
	cteNames := make([]string, count)
	for i := range cteNames {
		cteNames[i] = partitionedParentCTEName(i)
	}

	return cteNames
}

// buildPartitionedParentInsertMutationCTEBody emits one parent INSERT CTE per
// input row for multi-parent nested inserts. Each array-rel child row can then
// source its FK from the exact parent CTE that owns it, avoiding any dependence
// on RETURNING row order; each object-rel parent sources its FK column from its
// own nested object CTE via nestedFKIndexes[i].
//
// nestedFKIndexes is the per-parent object-relationship FK index built by
// buildPartitionedNestedFKIndexes — index i applies to parent CTE i. It is
// empty for array-only inserts (array-rel FKs live on the child, not the
// parent).
func (t *table) buildPartitionedParentInsertMutationCTEBody(
	b *strings.Builder,
	insertObjs []arguments.InsertObject,
	nestedFKIndexes []arguments.NestedFKSources,
	onConflict *arguments.OnConflict,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	for i := range insertObjs {
		if i > 0 {
			b.WriteString(", ")
		}

		nestedFKIndex := nestedFKIndexes[i]

		for _, col := range insertObjs[i].Columns {
			if _, isFK := nestedFKIndex[col.Column.SQLName]; !isFK {
				params = append(params, col.Value)
			}
		}

		var err error

		params, paramIndex, err = t.buildSingleInsertCTE(
			b, partitionedParentCTEName(i), insertObjs[i], onConflict, nestedFKIndex, nil,
			params, paramIndex, role, sessionVariables,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to build parent CTE %d: %w", i, err)
		}
	}

	b.WriteString(", mutation_result AS (")

	for i := range insertObjs {
		if i > 0 {
			b.WriteString(" UNION ALL ")
		}

		t.writePartitionedParentProjection(b, partitionedParentCTEName(i))
	}

	b.WriteByte(')')

	return params, paramIndex, nil
}

func (t *table) writePartitionedParentProjection(b *strings.Builder, cteName string) {
	b.WriteString("SELECT ")

	for i, col := range t.columns {
		if i > 0 {
			b.WriteString(", ")
		}

		b.WriteString(cteName)
		b.WriteByte('.')
		core.WriteQuotedIdentifier(b, col.SQLName)
	}

	b.WriteString(" FROM ")
	b.WriteString(cteName)
}

// partitionedOnConflictKey is the canonical representation used to decide
// whether two partitioned nested-array inserts can share one CTE. The SQL is
// rendered with a fixed placeholder base and params are kept separately so
// equal where clauses with equal values group together without stringifying
// user values.
type partitionedOnConflictKey struct {
	sql    string
	params []any
}

func newPartitionedOnConflictKey(
	onConflict *arguments.OnConflict,
) (partitionedOnConflictKey, error) {
	var b strings.Builder

	params, _, err := onConflict.ToSQL(&b, nil, 1)
	if err != nil {
		return partitionedOnConflictKey{}, fmt.Errorf("failed to render on_conflict: %w", err)
	}

	return partitionedOnConflictKey{sql: b.String(), params: params}, nil
}

func (k partitionedOnConflictKey) equal(other partitionedOnConflictKey) bool {
	return k.sql == other.sql && reflect.DeepEqual(k.params, other.params)
}

// partitionedNestedGroup gathers, per array-relationship and compatible
// on_conflict clause, every child row across all parents in a multi-parent
// insert. parentCTENames is the row-aligned CTE used to source FK values;
// parentIdxs keeps the original parent index for diagnostics and tests.
type partitionedNestedGroup struct {
	cteName        string
	template       *arguments.NestedInsert
	onConflictKey  partitionedOnConflictKey
	objs           []arguments.InsertObject
	parentIdxs     []int
	parentCTENames []string
}

func reservedNestedCTENames(
	insertObjs []arguments.InsertObject,
	ctePrefix string,
) map[string]struct{} {
	reserved := make(map[string]struct{})

	for i := range insertObjs {
		for _, nested := range insertObjs[i].NestedInserts {
			reserved[ctePrefix+"nested_"+nested.RelationshipName] = struct{}{}
		}
	}

	return reserved
}

func uniquePartitionedNestedCTEName(
	ctePrefix string,
	relationshipName string,
	conflictIdx int,
	used map[string]struct{},
	reserved map[string]struct{},
) string {
	base := ctePrefix + "nested_" + relationshipName

	candidate := base
	if conflictIdx > 0 {
		candidate = base + "_" + strconv.Itoa(conflictIdx)
	}

	for suffix := conflictIdx + 1; ; suffix++ {
		_, isUsed := used[candidate]

		_, isReserved := reserved[candidate]
		if !isUsed && (!isReserved || candidate == base) {
			used[candidate] = struct{}{}

			return candidate
		}

		candidate = base + "_" + strconv.Itoa(suffix)
	}
}

func matchingPartitionedNestedGroup(
	groups []*partitionedNestedGroup,
	onConflictKey partitionedOnConflictKey,
) *partitionedNestedGroup {
	for _, g := range groups {
		if g.onConflictKey.equal(onConflictKey) {
			return g
		}
	}

	return nil
}

// groupPartitionedArrayNestedInserts walks every parent's NestedInserts and
// merges array-rel children into per-relationship/per-on_conflict groups,
// recording each row's parent index. Order is first-encounter for both
// relationships and rows so the resulting SQL is deterministic.
func groupPartitionedArrayNestedInserts(
	insertObjs []arguments.InsertObject,
) ([]*partitionedNestedGroup, error) {
	return groupPartitionedArrayNestedInsertsWithParents(
		insertObjs, partitionedParentCTENames(len(insertObjs)), "",
	)
}

func validateParentCTENameCount(
	insertObjs []arguments.InsertObject,
	parentCTENames []string,
) error {
	if len(insertObjs) == len(parentCTENames) {
		return nil
	}

	return fmt.Errorf(
		"%w: got %d parent CTE names for %d insert objects",
		errPartitionedParentCTECountMismatch,
		len(parentCTENames),
		len(insertObjs),
	)
}

func groupPartitionedArrayNestedInsertsWithParents(
	insertObjs []arguments.InsertObject,
	parentCTENames []string,
	ctePrefix string,
) ([]*partitionedNestedGroup, error) {
	if err := validateParentCTENameCount(insertObjs, parentCTENames); err != nil {
		return nil, err
	}

	var groups []*partitionedNestedGroup

	byName := make(map[string][]*partitionedNestedGroup)
	usedCTENames := make(map[string]struct{})
	reservedCTENames := reservedNestedCTENames(insertObjs, ctePrefix)

	for parentIdx := range insertObjs {
		for i := range insertObjs[parentIdx].NestedInserts {
			nested := &insertObjs[parentIdx].NestedInserts[i]
			if !nested.IsArrayRelationship {
				continue
			}

			onConflictKey, err := newPartitionedOnConflictKey(nested.OnConflict)
			if err != nil {
				return nil, fmt.Errorf(
					"failed to group nested insert %s: %w", nested.RelationshipName, err,
				)
			}

			relationshipGroups := byName[nested.RelationshipName]

			g := matchingPartitionedNestedGroup(relationshipGroups, onConflictKey)
			if g == nil {
				g = &partitionedNestedGroup{
					cteName: uniquePartitionedNestedCTEName(
						ctePrefix,
						nested.RelationshipName,
						len(relationshipGroups),
						usedCTENames,
						reservedCTENames,
					),
					template:       nested,
					onConflictKey:  onConflictKey,
					objs:           nil,
					parentIdxs:     nil,
					parentCTENames: nil,
				}
				byName[nested.RelationshipName] = append(relationshipGroups, g)
				groups = append(groups, g)
			}

			for _, obj := range nested.NestedObjects {
				g.objs = append(g.objs, obj)
				g.parentIdxs = append(g.parentIdxs, parentIdx)
				g.parentCTENames = append(g.parentCTENames, parentCTENames[parentIdx])
			}
		}
	}

	return groups, nil
}

// buildPartitionedArrayNestedInsertCTEs handles the multi-parent array-rel
// case: children from every parent are merged into one data CTE per
// relationship, with each row carrying the CTE name it should source FK
// values from. This is the fix for the silent-drop + cross-join bug
// documented at the top of this file.
func (t *table) buildPartitionedArrayNestedInsertCTEs(
	insertObjs []arguments.InsertObject,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) (string, []any, int, error) {
	var cteSQL strings.Builder

	params, paramIndex, err := t.buildPartitionedArrayNestedInsertCTEsWithParents(
		&cteSQL,
		insertObjs,
		partitionedParentCTENames(len(insertObjs)),
		"mutation_result",
		nil,
		"",
		role,
		sessionVariables,
		params,
		paramIndex,
	)
	if err != nil {
		return "", nil, 0, err
	}

	return cteSQL.String(), params, paramIndex, nil
}

func (t *table) buildPartitionedArrayNestedInsertCTEsWithParents(
	b *strings.Builder,
	insertObjs []arguments.InsertObject,
	parentCTENames []string,
	parentUnionCTEName string,
	tableSubs where.TableSubstitutions,
	ctePrefix string,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	groups, err := groupPartitionedArrayNestedInsertsWithParents(
		insertObjs, parentCTENames, ctePrefix,
	)
	if err != nil {
		return nil, 0, err
	}

	for _, g := range groups {
		params, paramIndex, err = t.buildPartitionedArrayNestedInsertGroup(
			b, g, parentUnionCTEName, tableSubs, role, sessionVariables, params, paramIndex,
		)
		if err != nil {
			return nil, 0, err
		}
	}

	return params, paramIndex, nil
}

func nestedInsertTargetTable(ni *arguments.NestedInsert) (*table, error) {
	target, ok := ni.TargetTable.(*table)
	if !ok {
		return nil, fmt.Errorf(
			"%w: nested insert %s: target table is %T, expected *table",
			errNestedInsertTargetTableType,
			ni.RelationshipName,
			ni.TargetTable,
		)
	}

	return target, nil
}

func (t *table) buildPartitionedArrayNestedInsertGroup(
	b *strings.Builder,
	g *partitionedNestedGroup,
	parentUnionCTEName string,
	tableSubs where.TableSubstitutions,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	target, err := nestedInsertTargetTable(g.template)
	if err != nil {
		return nil, 0, err
	}

	if b.Len() > 0 {
		b.WriteString(", ")
	}

	childSubs := extendSubsForArrayChild(
		tableSubs, t.tableFromClause(), parentUnionCTEName, g.template,
	)

	if hasArrayNestedInserts(g.objs) {
		return target.buildPartitionedNestedArrayGroupWithNestedInserts(
			b, g, childSubs, role, sessionVariables, params, paramIndex,
		)
	}

	return target.buildFlatPartitionedNestedArrayGroup(
		b, g, childSubs, role, sessionVariables, params, paramIndex,
	)
}

func (t *table) buildPartitionedNestedArrayGroupWithNestedInserts(
	b *strings.Builder,
	g *partitionedNestedGroup,
	childSubs where.TableSubstitutions,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	rowCTENames, params, paramIndex, err := t.buildPartitionedNestedArrayRowsCTE(
		b, g.cteName, g.template, g.objs, g.parentCTENames, childSubs,
		role, sessionVariables, params, paramIndex,
	)
	if err != nil {
		return nil, 0, fmt.Errorf(
			"failed to build CTE for %s: %w", g.template.RelationshipName, err,
		)
	}

	params, paramIndex, err = t.buildPartitionedArrayNestedInsertCTEsWithParents(
		b,
		g.objs,
		rowCTENames,
		g.cteName,
		childSubs,
		g.cteName+"_",
		role,
		sessionVariables,
		params,
		paramIndex,
	)
	if err != nil {
		return nil, 0, fmt.Errorf(
			"failed to build nested CTEs for %s: %w",
			g.template.RelationshipName,
			err,
		)
	}

	return params, paramIndex, nil
}

func (t *table) buildFlatPartitionedNestedArrayGroup(
	b *strings.Builder,
	g *partitionedNestedGroup,
	childSubs where.TableSubstitutions,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	// nestedFKIndex records which child columns are sourced from a parent
	// CTE. The per-row source CTE is selected from g.parentCTENames when the
	// partitioned data SELECT is written.
	nestedFKIndex, err := g.template.ApplyArrayFKColumn("")
	if err != nil {
		return nil, 0, fmt.Errorf("failed to apply array FK columns: %w", err)
	}

	params, paramIndex, err = t.buildPartitionedNestedArrayCTE(
		b, g.cteName, g.objs, g.parentCTENames, g.template.OnConflict,
		nestedFKIndex, childSubs, role, sessionVariables, params, paramIndex,
	)
	if err != nil {
		return nil, 0, fmt.Errorf(
			"failed to build CTE for %s: %w", g.template.RelationshipName, err,
		)
	}

	return params, paramIndex, nil
}

func partitionedNestedRowCTEName(cteName string, rowIdx int) string {
	return cteName + "_row_" + strconv.Itoa(rowIdx)
}

func (t *table) buildPartitionedNestedArrayRowsCTE(
	b *strings.Builder,
	cteName string,
	template *arguments.NestedInsert,
	insertObjs []arguments.InsertObject,
	parentCTENames []string,
	tableSubs where.TableSubstitutions,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]string, []any, int, error) {
	if err := validateParentCTENameCount(insertObjs, parentCTENames); err != nil {
		return nil, nil, 0, err
	}

	rowCTENames := make([]string, len(insertObjs))
	for i := range insertObjs {
		if i > 0 {
			b.WriteString(", ")
		}

		rowCTEName := partitionedNestedRowCTEName(cteName, i)
		rowCTENames[i] = rowCTEName

		rowNested := *template
		rowNested.NestedObjects = []arguments.InsertObject{insertObjs[i]}

		nestedFKIndex, err := rowNested.ApplyArrayFKColumn(parentCTENames[i])
		if err != nil {
			return nil, nil, 0, fmt.Errorf("failed to apply array FK columns: %w", err)
		}

		rowObj := rowNested.NestedObjects[0]
		for _, col := range rowObj.Columns {
			if _, isFK := nestedFKIndex[col.Column.SQLName]; !isFK {
				params = append(params, col.Value)
			}
		}

		params, paramIndex, err = t.buildSingleInsertCTE(
			b, rowCTEName, rowObj, rowNested.OnConflict, nestedFKIndex, tableSubs,
			params, paramIndex, role, sessionVariables,
		)
		if err != nil {
			return nil, nil, 0, fmt.Errorf("failed to build nested row CTE %d: %w", i, err)
		}
	}

	b.WriteString(", ")
	b.WriteString(cteName)
	b.WriteString(" AS (")

	for i, rowCTEName := range rowCTENames {
		if i > 0 {
			b.WriteString(" UNION ALL ")
		}

		t.writePartitionedParentProjection(b, rowCTEName)
	}

	b.WriteByte(')')

	return rowCTENames, params, paramIndex, nil
}

// buildPartitionedNestedArrayCTE dispatches the partitioned shape to the
// pre-check or post-check sibling, mirroring buildMultiNestedInsertCTE.
func (t *table) buildPartitionedNestedArrayCTE(
	b *strings.Builder,
	cteName string,
	insertObjs []arguments.InsertObject,
	parentCTENames []string,
	onConflict *arguments.OnConflict,
	nestedFKIndex arguments.NestedFKSources,
	tableSubs where.TableSubstitutions,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	if err := validateParentCTENameCount(insertObjs, parentCTENames); err != nil {
		return nil, 0, err
	}

	nestedFKColumns := nestedFKColumnSet(nestedFKIndex)

	allColumns, columnToValue := t.collectAllColumns(insertObjs, nestedFKColumns)

	presentCols := insertPresentColumns(insertObjs, nestedFKIndex)
	if t.requiresPostInsertCheck(role, presentCols) {
		return t.buildPartitionedNestedArrayCTEPostCheck(
			b, cteName, insertObjs, parentCTENames, allColumns, columnToValue,
			nestedFKIndex, tableSubs, onConflict, role, sessionVariables,
			params, paramIndex,
		)
	}

	return t.buildPartitionedNestedArrayCTEPreCheck(
		b, cteName, insertObjs, parentCTENames, allColumns, columnToValue,
		nestedFKIndex, tableSubs, onConflict, role, sessionVariables,
		params, paramIndex,
	)
}

func nestedFKColumnSet(nestedFKIndex arguments.NestedFKSources) map[string]struct{} {
	nestedFKColumns := make(map[string]struct{}, len(nestedFKIndex))
	for col := range nestedFKIndex {
		nestedFKColumns[col] = struct{}{}
	}

	return nestedFKColumns
}

func insertColumnsWithNestedFK(
	allColumns []string,
	nestedFKIndex arguments.NestedFKSources,
) []string {
	finalColumns := append([]string{}, allColumns...)
	if len(nestedFKIndex) == 0 {
		return finalColumns
	}

	seen := make(map[string]struct{}, len(finalColumns)+len(nestedFKIndex))
	for _, col := range finalColumns {
		seen[col] = struct{}{}
	}

	fkColumns := make([]string, 0, len(nestedFKIndex))
	for col := range nestedFKIndex {
		if _, ok := seen[col]; ok {
			continue
		}

		fkColumns = append(fkColumns, col)
	}

	sort.Strings(fkColumns)

	return append(finalColumns, fkColumns...)
}

// buildPartitionedNestedArrayCTEPreCheck emits the pre-check variant of the
// multi-parent array-rel CTE. Shape mirrors buildMultiNestedInsertCTEPreCheck
// but each UNION branch sources FK columns from its matching parent CTE
// instead of cross-joining the whole mutation_result CTE.
func (t *table) buildPartitionedNestedArrayCTEPreCheck(
	b *strings.Builder,
	cteName string,
	insertObjs []arguments.InsertObject,
	parentCTENames []string,
	allColumns []string,
	columnToValue []map[string]any,
	nestedFKIndex arguments.NestedFKSources,
	tableSubs where.TableSubstitutions,
	onConflict *arguments.OnConflict,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	checkCTEName := "check_" + cteName

	finalColumns := insertColumnsWithNestedFK(allColumns, nestedFKIndex)
	dataColumns := t.extendWithPermissionColumns(finalColumns, role)

	b.WriteString(checkCTEName)
	b.WriteString(" AS (SELECT * FROM (") //nolint:unqueryvet

	params, paramIndex = t.buildPartitionedUnionAllSelect(
		b, insertObjs, parentCTENames, dataColumns, columnToValue,
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

	b.WriteString(cteName)
	b.WriteString(" AS (INSERT INTO ")
	b.WriteString(t.tableFromClause())

	t.buildInsertColumnsClause(b, finalColumns)
	t.buildInsertSelectClause(b, finalColumns, checkCTEName, nil)
	t.buildInsertFromClause(b, checkCTEName, nil)
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
	parentCTENames []string,
	allColumns []string,
	columnToValue []map[string]any,
	nestedFKIndex arguments.NestedFKSources,
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

	finalColumns := insertColumnsWithNestedFK(allColumns, nestedFKIndex)

	b.WriteString(dataCTEName)
	b.WriteString(" AS (SELECT * FROM (") //nolint:unqueryvet

	params, paramIndex = t.buildPartitionedUnionAllSelect(
		b, insertObjs, parentCTENames, finalColumns, columnToValue,
		nestedFKIndex, params, paramIndex,
	)

	b.WriteString(") AS data), ")

	b.WriteString(rawCTEName)
	b.WriteString(" AS (INSERT INTO ")
	b.WriteString(t.tableFromClause())

	t.buildInsertColumnsClause(b, finalColumns)
	t.buildInsertSelectClause(b, finalColumns, dataCTEName, nil)
	t.buildInsertFromClause(b, dataCTEName, nil)

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
// sources FK columns from that row's dedicated parent CTE (mutation_result_N
// at the top level, nested_<rel>_row_N for array grandchildren), so permission
// checks see the real parent FK value and final INSERTs do not depend on
// unordered RETURNING rows. Columns a given row omits emit the column's DB
// default expression when one is registered (via writeAbsentColumn), otherwise
// a typed NULL — matching writeUnionAllRow so a NOT NULL DEFAULT column
// supplied by some rows but omitted by others does not trip 23502 where Hasura
// lets the default apply per row.
func (t *table) buildPartitionedUnionAllSelect(
	b *strings.Builder,
	insertObjs []arguments.InsertObject,
	parentCTENames []string,
	allColumns []string,
	columnToValue []map[string]any,
	nestedFKIndex arguments.NestedFKSources,
	params []any,
	paramIndex int,
) ([]any, int) {
	for i := range insertObjs {
		if i > 0 {
			b.WriteString(" UNION ALL ")
		}

		parentCTEName := parentCTENames[i]
		usesParentCTE := false

		b.WriteString("SELECT ")

		for j, col := range allColumns {
			if j > 0 {
				b.WriteString(", ")
			}

			if source, isFK := nestedFKIndex[col]; isFK {
				writeFKSourceColumn(b, parentCTEName, source.ColumnName)
				b.WriteString(" AS ")
				core.WriteQuotedIdentifier(b, col)

				usesParentCTE = true

				continue
			}

			var (
				colType     string
				defaultExpr string
			)

			if tableCol := t.tableColumn(col); tableCol != nil {
				colType = tableCol.SQLType
				defaultExpr = tableCol.DefaultExpr
			}

			value, hasValue := columnToValue[i][col]
			if hasValue {
				params, paramIndex = t.writeTypedPlaceholder(
					b, col, colType, value, params, paramIndex,
				)
			} else {
				t.writeAbsentColumn(b, col, colType, defaultExpr)
			}
		}

		if usesParentCTE {
			b.WriteString(" FROM ")
			b.WriteString(parentCTEName)
		}
	}

	return params, paramIndex
}

func nestedForeignKeyColumns(nested *arguments.NestedInsert) []string {
	if len(nested.ForeignKeySourceColumns) == 0 {
		return append([]string{}, nested.ForeignKeyColumns...)
	}

	columns := make([]string, 0, len(nested.ForeignKeySourceColumns))
	seen := make(map[string]struct{}, len(nested.ForeignKeySourceColumns))

	for _, fkName := range nested.ForeignKeyColumns {
		if _, ok := nested.ForeignKeySourceColumns[fkName]; !ok {
			continue
		}

		columns = append(columns, fkName)
		seen[fkName] = struct{}{}
	}

	extraColumns := make([]string, 0, len(nested.ForeignKeySourceColumns)-len(columns))
	for fkName := range nested.ForeignKeySourceColumns {
		if _, ok := seen[fkName]; ok {
			continue
		}

		extraColumns = append(extraColumns, fkName)
	}

	sort.Strings(extraColumns)

	return append(columns, extraColumns...)
}

// buildNestedFKIndex maps foreign-key columns to their nested CTE source
// columns for object-relationship nested inserts only, for the single-parent
// (and single-row) path. For object relationships the FK lives on the parent
// row, so we record the CTE column (`nested_<rel>`) that supplies each FK
// column's value and append a placeholder column to the parent insert object.
//
// Array-relationship nested inserts put the FK on the child; the parent INSERT
// must not include those columns, so they are intentionally excluded from this
// index (which drives the parent's INSERT column list).
//
// Multi-parent inserts use buildPartitionedNestedFKIndexes instead, so each
// parent sources its FK from its own object CTE.
func (t *table) buildNestedFKIndex(
	insertObjs []arguments.InsertObject,
) (arguments.NestedFKSources, error) {
	nestedFKIndex := make(arguments.NestedFKSources) // column -> source CTE column
	if len(insertObjs) == 0 {
		return nestedFKIndex, nil
	}

	for i := range insertObjs[0].NestedInserts {
		nested := &insertObjs[0].NestedInserts[i]
		if nested.IsArrayRelationship {
			continue
		}

		cteName := bareNestedCTEName(nested.RelationshipName)
		if err := t.applyNestedObjectFKColumns(
			nested, cteName, nestedFKIndex, insertObjs, 0,
		); err != nil {
			return nil, err
		}
	}

	return nestedFKIndex, nil
}

// buildPartitionedNestedFKIndexes returns a per-parent object-relationship FK
// index for a multi-parent insert: parent N's index sources each object-rel FK
// column from that parent's own object CTE (`nested_<rel>_<N>`), and the FK
// placeholder column is appended only to that parent's columns. This is the
// per-parent counterpart of buildNestedFKIndex and the structural fix for
// dropping rows 1..n / misrouting every parent's FK to the first row's object.
func (t *table) buildPartitionedNestedFKIndexes(
	insertObjs []arguments.InsertObject,
) ([]arguments.NestedFKSources, error) {
	indexes := make([]arguments.NestedFKSources, len(insertObjs))
	for i := range indexes {
		indexes[i] = make(arguments.NestedFKSources)
	}

	for parentIdx := range insertObjs {
		for i := range insertObjs[parentIdx].NestedInserts {
			nested := &insertObjs[parentIdx].NestedInserts[i]
			if nested.IsArrayRelationship {
				continue
			}

			cteName := partitionedNestedObjectCTEName(nested.RelationshipName, parentIdx)
			if err := t.applyNestedObjectFKColumns(
				nested, cteName, indexes[parentIdx], insertObjs, parentIdx,
			); err != nil {
				return nil, err
			}
		}
	}

	return indexes, nil
}

// applyNestedObjectFKColumns records every FK column of an object-relationship
// nested insert against cteName in nestedFKIndex and appends the FK placeholder
// column to the owning parent's insert object (insertObjs[parentIdx]).
func (t *table) applyNestedObjectFKColumns(
	nested *arguments.NestedInsert,
	cteName string,
	nestedFKIndex arguments.NestedFKSources,
	insertObjs []arguments.InsertObject,
	parentIdx int,
) error {
	for _, fkName := range nestedForeignKeyColumns(nested) {
		sourceColumn, ok := nested.ForeignKeySourceColumns[fkName]
		if !ok || sourceColumn == "" {
			return fmt.Errorf(
				"%w: nested insert %s: missing source column for FK %s",
				arguments.ErrInvalidArgument,
				nested.RelationshipName,
				fkName,
			)
		}

		nestedFKIndex[fkName] = arguments.NestedFKSource{
			CTEName:    cteName,
			ColumnName: sourceColumn,
		}

		fkColumn := t.columnFromSQLName(fkName)
		if fkColumn == nil {
			continue
		}

		insertObjs[parentIdx].Columns = append(
			insertObjs[parentIdx].Columns,
			arguments.InsertColumn{
				Column: fkColumn,
				Value:  nil,
			},
		)
	}

	return nil
}

func nestedCTEMapKey(nestedCTEs map[string]string, relationshipName string) string {
	if _, ok := nestedCTEs[relationshipName]; !ok {
		return relationshipName
	}

	for i := 1; ; i++ {
		key := relationshipName + "#" + strconv.Itoa(i)
		if _, ok := nestedCTEs[key]; !ok {
			return key
		}
	}
}

func addPartitionedArrayNestedCTEsMap(
	nestedCTEs map[string]string,
	insertObjs []arguments.InsertObject,
	ctePrefix string,
) error {
	groups, err := groupPartitionedArrayNestedInsertsWithParents(
		insertObjs, partitionedParentCTENames(len(insertObjs)), ctePrefix,
	)
	if err != nil {
		return err
	}

	for _, g := range groups {
		key := nestedCTEMapKey(nestedCTEs, g.template.RelationshipName)
		nestedCTEs[key] = g.cteName

		if !hasArrayNestedInserts(g.objs) {
			continue
		}

		if err := addPartitionedArrayNestedCTEsMap(
			nestedCTEs, g.objs, g.cteName+"_",
		); err != nil {
			return fmt.Errorf(
				"failed to map nested CTEs for %s: %w", g.template.RelationshipName, err,
			)
		}
	}

	return nil
}

// buildNestedCTEsMap builds a map of response relationship keys to CTE names.
// It must mirror the CTEs the insert builder actually emits so affected_rows
// and force-ref tracking include every emitted CTE:
//
//   - Single-parent inserts emit one CTE per nested rel named `nested_<rel>`.
//   - Multi-parent inserts emit array-relationship children through the
//     partitioned path (addPartitionedArrayNestedCTEsMap, which can split a rel
//     into multiple CTEs for incompatible on_conflict clauses) and object-rel
//     children one CTE per parent named `nested_<rel>_<parentIdx>`.
//
// Synthetic map keys (`<rel>#N`) are used when one relationship maps to more
// than one emitted CTE so single-CTE relationship lookups keep their plain key.
func (t *table) buildNestedCTEsMap(
	insertObjs []arguments.InsertObject,
) (map[string]string, error) {
	nestedCTEs := make(map[string]string)
	multiParent := len(insertObjs) > 1

	for parentIdx := range insertObjs {
		for i := range insertObjs[parentIdx].NestedInserts {
			nested := &insertObjs[parentIdx].NestedInserts[i]

			// Array-rel CTEs are mapped below by the partitioned helper when
			// multi-parent; single-parent keeps them here.
			if nested.IsArrayRelationship && multiParent {
				continue
			}

			// Object-rel CTEs are emitted per parent when multi-parent, so map
			// every parent (each to its own nested_<rel>_<parentIdx>); when
			// single-parent only the first parent's object rels are emitted.
			if !nested.IsArrayRelationship && !multiParent && parentIdx > 0 {
				continue
			}

			key := nestedCTEMapKey(nestedCTEs, nested.RelationshipName)
			if !nested.IsArrayRelationship && multiParent {
				nestedCTEs[key] = partitionedNestedObjectCTEName(
					nested.RelationshipName, parentIdx,
				)
			} else {
				nestedCTEs[key] = bareNestedCTEName(nested.RelationshipName)
			}
		}
	}

	if multiParent && hasArrayNestedInserts(insertObjs) {
		if err := addPartitionedArrayNestedCTEsMap(nestedCTEs, insertObjs, ""); err != nil {
			return nil, err
		}
	}

	return nestedCTEs, nil
}

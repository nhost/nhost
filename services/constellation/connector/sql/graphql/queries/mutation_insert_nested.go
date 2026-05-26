package queries

import (
	"fmt"
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
)

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
			b, target, cteName, ni, nestedFKIndex, params, paramIndex, role, sessionVariables,
		)
	} else {
		params, paramIndex, err = target.buildMultiNestedInsertCTE(
			b, cteName, ni.NestedObjects, ni.OnConflict, nestedFKIndex,
			params, paramIndex, role, sessionVariables,
		)
	}

	if err != nil {
		return nil, 0, fmt.Errorf("failed to build CTE for %s: %w", ni.RelationshipName, err)
	}

	// Recurse into deeper nested inserts on the first row (top-level inserts
	// have the same constraint — deeper nesting is only walked from the first
	// row of a multi-row insert).
	for i := range ni.NestedObjects[0].NestedInserts {
		nested := &ni.NestedObjects[0].NestedInserts[i]

		params, paramIndex, err = buildNestedInsertCTE(
			b, nested, cteName, params, paramIndex, role, sessionVariables,
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
		b, cteName, ni.NestedObjects[0], ni.OnConflict, nestedFKIndex,
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

	if t.permissionReferencesGeneratedColumns(role) {
		return t.buildMultiNestedInsertCTEPostCheck(
			b, cteName, insertObjs, allColumns, columnToValue,
			nestedFKIndex, onConflict, role, sessionVariables,
			params, paramIndex,
		)
	}

	return t.buildMultiNestedInsertCTEPreCheck(
		b, cteName, insertObjs, allColumns, columnToValue,
		nestedFKIndex, onConflict, role, sessionVariables,
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
		b, insertObjs, dataColumns, columnToValue, params, paramIndex,
	)

	b.WriteString(") AS data WHERE ")

	params, paramIndex, hasCheckPermissions, err := t.buildCheckConstraintWhereClause(
		b, role, sessionVariables, params, paramIndex,
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

func (t *table) buildMultiNestedInsertCTEPostCheck(
	b *strings.Builder,
	cteName string,
	insertObjs []arguments.InsertObject,
	allColumns []string,
	columnToValue []map[string]any,
	nestedFKIndex map[string]string,
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
		b, insertObjs, allColumns, columnToValue, params, paramIndex,
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
		b, postCheckName, rawCTEName, role, sessionVariables, params, paramIndex,
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
			&cteSQL, nested, "mutation_result", params, paramIndex, role, sessionVariables,
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
func (t *table) buildArrayNestedInsertCTEs(
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
		if !nested.IsArrayRelationship {
			continue
		}

		var err error

		params, paramIndex, err = buildNestedInsertCTE(
			&cteSQL, nested, "mutation_result", params, paramIndex, role, sessionVariables,
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

// buildNestedCTEsMap builds a map of relationship names to CTE names for response building.
func (t *table) buildNestedCTEsMap(insertObjs []arguments.InsertObject) map[string]string {
	nestedCTEs := make(map[string]string)
	if len(insertObjs) == 0 {
		return nestedCTEs
	}

	for _, nested := range insertObjs[0].NestedInserts {
		cteName := "nested_" + nested.RelationshipName
		nestedCTEs[nested.RelationshipName] = cteName
	}

	return nestedCTEs
}

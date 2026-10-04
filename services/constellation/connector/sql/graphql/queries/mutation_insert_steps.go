package queries

import (
	"fmt"
	"maps"
	"slices"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

const (
	firstDependentSelectionParam = 2 // $1 holds the captured root-row array.
	// A GraphQL relationship name cannot contain '$'. Keep inherited parent
	// rows out of the before-parent relationship-name namespace.
	inheritedInsertParent = "$parent"
)

func newInsertOperation(alias string, plan *core.InsertPlan) core.SQLOperation {
	return core.SQLOperation{
		Name: alias, SQL: "", Parameters: nil, StreamCursors: nil,
		Sequential: nil, Insert: plan,
	}
}

func unsupportedInsertPlan() *core.InsertPlan {
	return &core.InsertPlan{
		Root: core.InsertLevel{Batch: nil, Objects: nil}, FinalSQL: "",
		FinalParameters: nil, Collection: false,
	}
}

// insertFKExpression binds text captured from a prior physical RETURNING row
// and casts it to this column's actual catalog type (not its GraphQL/base
// type). Identifier-bearing types come only from PostgreSQL introspection.
func (t *table) insertFKExpression(col *core.Column, index int) string {
	if col == nil {
		return t.dialect.Placeholder(index)
	}

	physical := t.physicalColumnTypes[col.SQLName]
	if physical == "" {
		physical = col.SQLType
	} // white-box fixture without a catalog

	return t.dialect.TypeCast(t.dialect.TypeCast(t.dialect.Placeholder(index), "text"), physical)
}

func hasArrayNestedInserts(objects []arguments.InsertObject) bool {
	for _, obj := range objects {
		for _, rel := range obj.NestedInserts {
			if rel.IsArrayRelationship {
				return true
			}
		}
	}

	return false
}

func hasObjectNestedInserts(objects []arguments.InsertObject) bool {
	for _, obj := range objects {
		for _, rel := range obj.NestedInserts {
			if !rel.IsArrayRelationship {
				return true
			}
		}
	}

	return false
}

// buildInsertLevel selects the multirow statement only when *every* object at
// this level has no relationships. Otherwise every object is processed in input
// order, including the plain objects preceding or following a related object.
func (t *table) buildInsertLevel(
	objects []arguments.InsertObject, onConflict *arguments.OnConflict,
	role string, session map[string]any, fks map[string]core.InsertFKValue,
	path string, objectInput bool,
) (core.InsertLevel, error) {
	if !hasObjectNestedInserts(objects) && !hasArrayNestedInserts(objects) {
		stmt, err := t.buildInsertStatement(
			objects,
			onConflict,
			role,
			session,
			fks,
			path,
			objectInput,
		)
		if err != nil {
			return core.InsertLevel{}, err
		}

		return core.InsertLevel{Batch: &stmt, Objects: nil}, nil
	}

	nodes := make([]core.InsertNode, 0, len(objects))
	for i, obj := range objects {
		node, err := t.buildInsertNode(obj, onConflict, role, session, fks,
			insertObjectPath(path, objectInput, i))
		if err != nil {
			return core.InsertLevel{}, err
		}

		nodes = append(nodes, node)
	}

	return core.InsertLevel{Batch: nil, Objects: nodes}, nil
}

func (t *table) buildInsertNode( //nolint:funlen // The before/row/after traversal is deliberately visible together.
	obj arguments.InsertObject,
	onConflict *arguments.OnConflict,
	role string,
	session map[string]any,
	fks map[string]core.InsertFKValue,
	path string,
) (core.InsertNode, error) {
	before, arrays, after := partitionInsertRelationships(obj.NestedInserts)
	if err := validateDependentInsertRow(obj, fks, before, path); err != nil {
		return core.InsertNode{}, err
	}

	rowFKs := make(map[string]core.InsertFKValue, len(fks)+len(before))
	maps.Copy(rowFKs, fks)

	beforeSources := make(map[string]bool)

	node := core.InsertNode{
		Row:    core.InsertStatement{SQL: "", Parameters: nil, TableRef: ""},
		Before: nil, Arrays: nil, AfterObjects: nil,
	}
	for _, rel := range before {
		child, ok := rel.TargetTable.(*table)
		if !ok {
			return core.InsertNode{}, fmt.Errorf(
				"%w: nested object %s has invalid target table",
				errInvalidDependentInsert, rel.RelationshipName,
			)
		}

		level, err := child.buildInsertLevel(rel.NestedObjects, rel.OnConflict, role, session, nil,
			path+"."+rel.RelationshipName+".data", true)
		if err != nil {
			return core.InsertNode{}, fmt.Errorf(
				"planning object %s: %w",
				rel.RelationshipName,
				err,
			)
		}

		node.Before = append(
			node.Before,
			core.InsertBranch{Name: rel.RelationshipName, Level: level},
		)
		for parentCol, childCol := range rel.ForeignKeySourceColumns {
			if _, inherited := fks[parentCol]; inherited || beforeSources[parentCol] {
				return core.InsertNode{}, fmt.Errorf(
					"%w: column %q is determined by multiple parent relationships",
					errInvalidDependentInsert, parentCol,
				)
			}

			beforeSources[parentCol] = true
			if hasInsertPreset(obj, parentCol) {
				continue // Hasura inserts the before object but the preset wins its FK.
			}

			rowFKs[parentCol] = core.InsertFKValue{
				Source: rel.RelationshipName, TableRef: child.tableFromClause(), Column: childCol,
			}
		}
	}

	// The parent row is a separate statement so its check and any STABLE
	// function it calls see the before-parent objects but not its own arrays.
	row, err := t.buildInsertStatement(
		[]arguments.InsertObject{obj},
		onConflict,
		role,
		session,
		rowFKs,
		path, true,
	)
	if err != nil {
		return core.InsertNode{}, err
	}

	node.Row = row

	for _, group := range []struct {
		rels []arguments.NestedInsert
		dest *[]core.InsertBranch
	}{
		{arrays, &node.Arrays},
		{after, &node.AfterObjects},
	} {
		for _, rel := range group.rels {
			child, ok := rel.TargetTable.(*table)
			if !ok {
				return core.InsertNode{}, fmt.Errorf(
					"%w: nested relation %s has invalid target table",
					errInvalidDependentInsert, rel.RelationshipName,
				)
			}

			childFKs := make(map[string]core.InsertFKValue, len(rel.ForeignKeySourceColumns))
			for childCol, parentCol := range rel.ForeignKeySourceColumns {
				childFKs[childCol] = core.InsertFKValue{
					Source: inheritedInsertParent, TableRef: t.tableFromClause(), Column: parentCol,
				}
			}

			level, err := child.buildInsertLevel(
				rel.NestedObjects,
				rel.OnConflict,
				role,
				session,
				childFKs,
				path+"."+rel.RelationshipName+".data", false,
			)
			if err != nil {
				return core.InsertNode{}, fmt.Errorf(
					"planning relation %s: %w",
					rel.RelationshipName,
					err,
				)
			}

			*group.dest = append(
				*group.dest,
				core.InsertBranch{Name: rel.RelationshipName, Level: level},
			)
		}
	}

	return node, nil
}

// Hasura validates the row before planning its before-parent objects: first
// client columns supplied for inherited FKs, then each object relationship in
// hash order against both inherited FKs and client columns. Presets are not
// client columns, even when the same column also occurs in the parsed input.
func validateDependentInsertRow(
	obj arguments.InsertObject, fks map[string]core.InsertFKValue,
	before []arguments.NestedInsert, path string,
) error {
	columns := make(map[string]bool, len(obj.Columns))
	for _, col := range obj.Columns {
		if !col.Preset {
			columns[col.Column.SQLName] = true
		}
	}

	parentOverlap := make([]string, 0)
	for _, name := range slices.Sorted(maps.Keys(fks)) {
		if columns[name] {
			parentOverlap = append(parentOverlap, name)
		}
	}

	if len(parentOverlap) > 0 {
		return arguments.NewDeterminedInsertColumnError(parentOverlap, "", path)
	}

	for _, rel := range before {
		overlap := make([]string, 0)
		for _, name := range slices.Sorted(maps.Keys(rel.ForeignKeySourceColumns)) {
			if columns[name] {
				overlap = append(overlap, name)
			} else if _, inherited := fks[name]; inherited {
				overlap = append(overlap, name)
			}
		}

		if len(overlap) > 0 {
			return arguments.NewDeterminedInsertColumnError(
				overlap, rel.RelationshipName, path+"."+rel.RelationshipName)
		}
	}

	return nil
}

func hasInsertPreset(obj arguments.InsertObject, name string) bool {
	for _, col := range obj.Columns {
		if col.Preset && col.Column.SQLName == name {
			return true
		}
	}

	return false
}

func partitionInsertRelationships(in []arguments.NestedInsert) (
	[]arguments.NestedInsert, []arguments.NestedInsert, []arguments.NestedInsert,
) {
	var before, arrays, after []arguments.NestedInsert
	for _, rel := range in {
		switch {
		case rel.IsArrayRelationship:
			arrays = append(arrays, rel)
		case rel.InsertAfterParent:
			after = append(after, rel)
		default:
			before = append(before, rel)
		}
	}

	return sortedInsertRelationships(before), sortedInsertRelationships(arrays),
		sortedInsertRelationships(after)
}

func (t *table) buildInsertStatement(
	objects []arguments.InsertObject, onConflict *arguments.OnConflict,
	role string, session map[string]any, fks map[string]core.InsertFKValue,
	path string, objectInput bool,
) (core.InsertStatement, error) {
	clean := make([]arguments.InsertObject, len(objects))
	for i, obj := range objects {
		clean[i] = arguments.InsertObject{
			Columns:       append([]arguments.InsertColumn(nil), obj.Columns...),
			NestedInserts: nil,
		}

		if err := t.addDependentFKColumns(
			&clean[i],
			fks,
			insertObjectPath(path, objectInput, i),
		); err != nil {
			return core.InsertStatement{}, err
		}
	}

	cte, params, _, err := t.buildInsertMutationCTE(clean, onConflict, role, session, nil)
	if err != nil {
		return core.InsertStatement{}, fmt.Errorf("building dependent insert statement: %w", err)
	}

	var b strings.Builder
	b.WriteString(cte)
	b.WriteString(" SELECT ")
	b.WriteString(t.dialect.DependentInsertCapture())
	b.WriteString(" FROM (SELECT ")

	for i, col := range t.columns {
		if i > 0 {
			b.WriteString(", ")
		}

		b.WriteString(t.dialect.TypeCast(core.QuoteIdentifier(col.SQLName), "text"))
		b.WriteString(" AS ")
		core.WriteQuotedIdentifier(&b, col.SQLName)
	}

	b.WriteString(` FROM mutation_result) AS "_physical"`)

	return core.InsertStatement{
		SQL:        b.String(),
		Parameters: params,
		TableRef:   t.tableFromClause(),
	}, nil
}

func (t *table) addDependentFKColumns(
	obj *arguments.InsertObject, fks map[string]core.InsertFKValue, path string,
) error {
	parentOverlap := make([]string, 0)
	for _, colName := range slices.Sorted(maps.Keys(fks)) {
		source := fks[colName]
		for _, col := range obj.Columns {
			if col.Column.SQLName == colName && !col.Preset &&
				source.Source == inheritedInsertParent {
				parentOverlap = append(parentOverlap, colName)
			}
		}

		if hasInsertPreset(*obj, colName) {
			continue // The server preset wins the inherited or before-object FK.
		}

		col := t.columnFromSQLName(colName)
		if col == nil {
			return fmt.Errorf(
				"%w: unknown dependent foreign key column %q",
				errInvalidDependentInsert,
				colName,
			)
		}

		obj.Columns = append(
			obj.Columns,
			arguments.InsertColumn{Column: col, Value: source, Preset: false},
		)
	}

	if len(parentOverlap) > 0 {
		return arguments.NewDeterminedInsertColumnError(parentOverlap, "", path)
	}

	return nil
}

func (t *table) buildInsertOnePlan(
	obj arguments.InsertObject, onConflict *arguments.OnConflict,
	columns []columnSelection, relationships []relationshipSelection,
	fragments ast.FragmentDefinitionList, variables map[string]any,
	role string, session map[string]any, roots map[string]core.Operation,
	argumentPath string,
) (core.InsertPlan, error) {
	level, err := t.buildInsertLevel([]arguments.InsertObject{obj}, onConflict, role, session, nil,
		"object", false)
	if err != nil {
		return core.InsertPlan{}, err
	}

	var b strings.Builder
	t.writeInsertResultSource(&b, false)

	params, err := t.buildFinalSelect(
		&b,
		columns,
		relationships,
		fragments,
		variables,
		role,
		session,
		roots,
		[]any{nil},
		firstDependentSelectionParam,
		argumentPath,
	)
	if err != nil {
		return core.InsertPlan{}, fmt.Errorf("building dependent insert_one returning: %w", err)
	}

	return core.InsertPlan{
		Root: level, FinalSQL: b.String(), FinalParameters: params,
		Collection: false,
	}, nil
}

func insertObjectPath(path string, objectInput bool, i int) string {
	if objectInput {
		return path
	}

	return fmt.Sprintf("%s[%d]", path, i)
}

func (t *table) buildInsertFinalSQL(
	level core.InsertLevel, selection mutationSelection,
	fragments ast.FragmentDefinitionList, variables map[string]any,
	role string, session map[string]any, roots map[string]core.Operation,
) (core.InsertPlan, error) {
	var b strings.Builder
	t.writeInsertResultSource(&b, selection.affectedRows != nil)

	params := []any{nil} // $1 is the complete physical root-row array at execution time.

	index := firstDependentSelectionParam
	if selection.affectedRows != nil {
		selection.affectedRows.extraCountCTEs = []string{"nested_affected_rows"}

		params = append(params, nil) // $2 is the count of non-root rows.
		index++
	}

	var err error

	params, _, err = selection.WriteSQL(
		&b,
		fragments,
		variables,
		role,
		session,
		roots,
		params,
		index,
	)
	if err != nil {
		return core.InsertPlan{}, fmt.Errorf("building dependent insert returning: %w", err)
	}

	return core.InsertPlan{
		Root: level, FinalSQL: b.String(), FinalParameters: params,
		Collection: selection.affectedRows != nil,
	}, nil
}

func (t *table) writeInsertResultSource(b *strings.Builder, collection bool) {
	b.WriteString("WITH mutation_result AS (SELECT ")

	for i, col := range t.columns {
		if i > 0 {
			b.WriteString(", ")
		}
		// The name is an introspected identifier, quoted as a SQL string key;
		// the value is extracted from the bound captured-row JSON array.
		b.WriteString(t.dialect.DependentInsertRowValue(col.SQLName))

		physical := t.physicalColumnTypes[col.SQLName]
		if physical == "" {
			physical = col.SQLType
		} // white-box fixture

		b.WriteString(t.dialect.TypeCast(t.dialect.TypeCast("", "text"), physical))
		b.WriteString(" AS ")
		core.WriteQuotedIdentifier(b, col.SQLName)
	}

	b.WriteString(" FROM ")
	b.WriteString(t.dialect.DependentInsertRowsSource(1))
	b.WriteByte(')')

	if collection {
		b.WriteString(", nested_affected_rows AS (SELECT ")
		b.WriteString(t.dialect.DependentInsertAffectedRows(firstDependentSelectionParam))
		b.WriteString(")")
	}

	b.WriteByte(' ')
}

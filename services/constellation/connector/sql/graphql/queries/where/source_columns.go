package where

import "slices"

// sourceColumnRef is implemented by filters that reference a single column from the source.
type sourceColumnRef interface {
	sourceColumn() string
}

// sourceColumnsRef is implemented by filters that may reference multiple
// source columns (e.g. multi-column relationships).
type sourceColumnsRef interface {
	sourceColumns() []string
}

// compositeFilter is implemented by Statements that wrap child Statements
// (logical connectives and clauses). CollectSourceColumns recurses through
// children() to discover source-column references in the subtree.
type compositeFilter interface {
	children() []Statement
}

func (f *equalsFilter) sourceColumn() string {
	return sourceColumnForTarget(f.column, f.target)
}

func (f *notEqualsFilter) sourceColumn() string {
	return sourceColumnForTarget(f.column, f.target)
}

func (f *inFilter) sourceColumn() string {
	return sourceColumnForTarget(f.column, f.target)
}

func (f *notInFilter) sourceColumn() string {
	return sourceColumnForTarget(f.column, f.target)
}

func (f *greaterThanFilter) sourceColumn() string {
	return sourceColumnForTarget(f.column, f.target)
}

func (f *greaterThanOrEqualFilter) sourceColumn() string {
	return sourceColumnForTarget(f.column, f.target)
}

func (f *lessThanFilter) sourceColumn() string {
	return sourceColumnForTarget(f.column, f.target)
}

func (f *lessThanOrEqualFilter) sourceColumn() string {
	return sourceColumnForTarget(f.column, f.target)
}

func (f *columnComparisonFilter) sourceColumns() []string {
	columns := []string{sourceColumnForTarget(f.column, f.target)}
	if !f.root {
		return append(columns, f.rhs.SQLName)
	}

	return columns
}

func (f *ltreeFilter) sourceColumn() string    { return sourceColumnForTarget(f.column, f.target) }
func (f *similarFilter) sourceColumn() string  { return sourceColumnForTarget(f.column, f.target) }
func (f *likeFilter) sourceColumn() string     { return f.column }
func (f *notLikeFilter) sourceColumn() string  { return f.column }
func (f *regexFilter) sourceColumn() string    { return f.column }
func (f *notRegexFilter) sourceColumn() string { return f.column }
func (f *isNullFilter) sourceColumn() string {
	if f.target != nil {
		return f.target.sourceColumn
	}

	return f.column
}

func (f *spatialPredicateFilter) sourceColumn() string {
	return sourceColumnForTarget(f.column, f.target)
}

func (f *spatialDWithinFilter) sourceColumn() string {
	return sourceColumnForTarget(f.column, f.target)
}
func (r *relationshipFilter) sourceColumns() []string  { return r.relationship.ParentColumns() }
func (f *jsonbContainsFilter) sourceColumn() string    { return f.column }
func (f *jsonbContainedInFilter) sourceColumn() string { return f.column }
func (f *jsonbHasKeyFilter) sourceColumn() string      { return f.column }
func (f *jsonbHasKeysAllFilter) sourceColumn() string  { return f.column }
func (f *jsonbHasKeysAnyFilter) sourceColumn() string  { return f.column }

// sourceColumns on aggregateRelationshipFilter mirrors relationshipFilter: the
// correlated subquery joins the target back to the parent on the relationship's
// parent columns, so an insert-permission check referencing this filter must
// project those parent columns in its data subquery, exactly as for a plain
// relationship filter.
func (f *aggregateRelationshipFilter) sourceColumns() []string {
	return f.relationship.ParentColumns()
}

func (c Clause) children() []Statement     { return c }
func (f *andFilter) children() []Statement { return f.conditions }
func (f *orFilter) children() []Statement  { return f.conditions }
func (f *notFilter) children() []Statement { return []Statement{f.condition} }

// ContainsComputed reports whether a clause reads a complete physical row
// through a computed function. Insert checks containing one must run on the
// post-INSERT RETURNING row, never on a partial input projection.
func ContainsComputed(ws Statement) bool {
	if ws == nil {
		return false
	}

	if _, ok := ws.(*computedComparison); ok {
		return true
	}

	if _, ok := ws.(*computedTableFilter); ok {
		return true
	}

	switch child := ws.(type) {
	case *relationshipFilter:
		return ContainsComputed(child.conditions)
	case *existsFilter:
		return ContainsComputed(child.conditions)
	case *aggregateRelationshipFilter:
		return ContainsComputed(child.filter)
	}

	composite, ok := ws.(compositeFilter)
	if !ok {
		return false
	}

	return slices.ContainsFunc(composite.children(), ContainsComputed)
}

// ContainsRootColumn reports whether a column comparison reaches the root
// row through any nested relationship or _exists. An insert's input projection
// may omit that column, so the check must use the physical RETURNING row.
func ContainsRootColumn(ws Statement) bool {
	return containsRootColumn(ws)
}

func containsRootColumn(ws Statement) bool {
	if ws == nil {
		return false
	}

	switch condition := ws.(type) {
	case *columnComparisonFilter:
		return condition.root
	case *computedComparison:
		return condition.rootColumn
	case *computedTableFilter:
		return containsRootColumn(condition.conditions)
	case *relationshipFilter:
		return containsRootColumn(condition.conditions)
	case *existsFilter:
		return containsRootColumn(condition.conditions)
	case *aggregateRelationshipFilter:
		return containsRootColumn(condition.filter)
	case compositeFilter:
		return slices.ContainsFunc(condition.children(), containsRootColumn)
	default:
		return false
	}
}

// CollectSourceColumns extracts all column SQL names that a Statement
// references from its source. This is used to ensure the data subquery in
// insert permission checks includes all columns needed by the permission
// WHERE clause, even if those columns aren't in the insert data.
func CollectSourceColumns(ws Statement) []string {
	if ws == nil {
		return nil
	}

	if ref, ok := ws.(sourceColumnsRef); ok {
		return ref.sourceColumns()
	}

	// Leaf filters that reference a single source column.
	if ref, ok := ws.(sourceColumnRef); ok {
		return []string{ref.sourceColumn()}
	}

	// Composite filters — recurse into children.
	// existsFilter and RawFilter have no source column references and don't
	// implement compositeFilter, so they return no columns.
	composite, ok := ws.(compositeFilter)
	if !ok {
		return nil
	}

	var columns []string
	for _, child := range composite.children() {
		columns = append(columns, CollectSourceColumns(child)...)
	}

	return columns
}

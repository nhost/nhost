package where

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

// CollectSourceColumns extracts all column SQL names that a Statement
// references from its source. This is used to ensure the data subquery in
// insert permission checks includes all columns needed by the permission
// WHERE clause, even if those columns aren't in the insert data.
//
// ws is treated as the outermost statement, so column-comparison operands
// that refer to the root table ("$") are included wherever they are nested.
func CollectSourceColumns(ws Statement) []string {
	return append(collectSourceColumns(ws), collectRootColumns(ws)...)
}

func collectSourceColumns(ws Statement) []string {
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
		columns = append(columns, collectSourceColumns(child)...)
	}

	return columns
}

// collectRootColumns returns the columns that column-comparison operands of
// the form ["$", column] read from the root source. Unlike
// collectSourceColumns it descends into relationship, aggregate and _exists
// subqueries: the root alias stays the same however deep the operand sits.
func collectRootColumns(ws Statement) []string {
	if ws == nil {
		return nil
	}

	switch f := ws.(type) {
	case *columnComparisonFilter:
		if f.ref.fromRoot {
			return []string{f.ref.column}
		}

		return nil
	case *relationshipFilter:
		return collectRootColumns(f.conditions)
	case *aggregateRelationshipFilter:
		return collectRootColumns(f.filter)
	case *existsFilter:
		return collectRootColumns(f.conditions)
	case compositeFilter:
		var columns []string
		for _, child := range f.children() {
			columns = append(columns, collectRootColumns(child)...)
		}

		return columns
	}

	return nil
}

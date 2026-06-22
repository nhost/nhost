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

func (f *equalsFilter) sourceColumn() string             { return f.column.SQLName }
func (f *notEqualsFilter) sourceColumn() string          { return f.column.SQLName }
func (f *inFilter) sourceColumn() string                 { return f.column.SQLName }
func (f *notInFilter) sourceColumn() string              { return f.column.SQLName }
func (f *greaterThanFilter) sourceColumn() string        { return f.column.SQLName }
func (f *greaterThanOrEqualFilter) sourceColumn() string { return f.column.SQLName }
func (f *lessThanFilter) sourceColumn() string           { return f.column.SQLName }
func (f *lessThanOrEqualFilter) sourceColumn() string    { return f.column.SQLName }
func (f *likeFilter) sourceColumn() string               { return f.column }
func (f *notLikeFilter) sourceColumn() string            { return f.column }
func (f *regexFilter) sourceColumn() string              { return f.column }
func (f *notRegexFilter) sourceColumn() string           { return f.column }
func (f *isNullFilter) sourceColumn() string             { return f.column }
func (r *relationshipFilter) sourceColumns() []string    { return r.relationship.ParentColumns() }
func (f *jsonbContainsFilter) sourceColumn() string      { return f.column }
func (f *jsonbContainedInFilter) sourceColumn() string   { return f.column }
func (f *jsonbHasKeyFilter) sourceColumn() string        { return f.column }
func (f *jsonbHasKeysAllFilter) sourceColumn() string    { return f.column }
func (f *jsonbHasKeysAnyFilter) sourceColumn() string    { return f.column }

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

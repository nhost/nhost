package where

import (
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
)

// arrayContainsFilter implements the _contains operator for array columns.
// Dispatched from containmentParser when column.IsArray is true; the JSONB
// branch produces jsonbContainsFilter instead.
type arrayContainsFilter struct {
	column  string
	sqlType string
	value   any
	dialect dialect.Dialect
}

func (f *arrayContainsFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	var col strings.Builder

	core.WriteQualifiedColumn(&col, source, f.column)

	f.dialect.WriteArrayContains(
		b,
		col.String(),
		f.dialect.TypeCast(f.dialect.Placeholder(paramIndex), f.sqlType),
	)

	params = append(params, f.value)

	return params, paramIndex + 1, nil
}

func (f *arrayContainsFilter) sourceColumn() string { return f.column }

// arrayContainedInFilter implements the _contained_in operator for array columns.
// Dispatched from containmentParser when column.IsArray is true; the JSONB
// branch produces jsonbContainedInFilter instead.
type arrayContainedInFilter struct {
	column  string
	sqlType string
	value   any
	dialect dialect.Dialect
}

func (f *arrayContainedInFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	var col strings.Builder

	core.WriteQualifiedColumn(&col, source, f.column)

	f.dialect.WriteArrayContainedIn(
		b,
		col.String(),
		f.dialect.TypeCast(f.dialect.Placeholder(paramIndex), f.sqlType),
	)

	params = append(params, f.value)

	return params, paramIndex + 1, nil
}

func (f *arrayContainedInFilter) sourceColumn() string { return f.column }

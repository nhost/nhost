package where

import (
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
)

// writeArrayColumnMembership compares whole arrays, not their scalar elements.
// Binding each candidate separately also permits arrays of different lengths.
func writeArrayColumnMembership(
	b *strings.Builder,
	source string,
	target comparisonTarget,
	vals []any,
	d dialect.Dialect,
	params []any,
	paramIndex int,
	negated bool,
) ([]any, int) {
	b.WriteByte('(')

	if len(vals) == 0 {
		// Retain the target expression: computed calls may have already bound
		// parameters. The identity must also hold when the target is NULL.
		target.writeSQL(b, source)

		if negated {
			b.WriteString(" IS NULL OR TRUE)")
		} else {
			b.WriteString(" IS NULL AND FALSE)")
		}

		return params, paramIndex
	}

	operator, separator := " = ", " OR "
	if negated {
		operator, separator = " != ", " AND "
	}

	for i := range vals {
		if i > 0 {
			b.WriteString(separator)
		}

		target.writeSQL(b, source)
		b.WriteString(operator)
		b.WriteString(d.TypeCast(d.Placeholder(paramIndex+i), target.sqlType))
	}

	b.WriteByte(')')

	return append(params, vals...), paramIndex + len(vals)
}

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

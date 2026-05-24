package where

import (
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
)

type equalsFilter struct {
	column  *core.Column
	value   any
	dialect dialect.Dialect
}

func (f *equalsFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	core.WriteQualifiedColumn(b, source, f.column.SQLName)
	b.WriteString(` = `)
	b.WriteString(f.dialect.TypeCast(f.dialect.Placeholder(paramIndex), f.column.SQLType))

	params = append(params, f.value)

	return params, paramIndex + 1, nil
}

type inFilter struct {
	column  *core.Column
	values  []any
	dialect dialect.Dialect
}

func (f *inFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	params, paramIndex = f.dialect.WriteArrayIn(
		b, source, f.column.SQLName, f.column.SQLType, f.values, params, paramIndex,
	)

	return params, paramIndex, nil
}

type notEqualsFilter struct {
	column  *core.Column
	value   any
	dialect dialect.Dialect
}

func (f *notEqualsFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	core.WriteQualifiedColumn(b, source, f.column.SQLName)
	b.WriteString(` != `)
	b.WriteString(f.dialect.TypeCast(f.dialect.Placeholder(paramIndex), f.column.SQLType))

	params = append(params, f.value)

	return params, paramIndex + 1, nil
}

type greaterThanFilter struct {
	column  *core.Column
	value   any
	dialect dialect.Dialect
}

func (f *greaterThanFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	core.WriteQualifiedColumn(b, source, f.column.SQLName)
	b.WriteString(` > `)
	b.WriteString(f.dialect.TypeCast(f.dialect.Placeholder(paramIndex), f.column.SQLType))

	params = append(params, f.value)

	return params, paramIndex + 1, nil
}

type greaterThanOrEqualFilter struct {
	column  *core.Column
	value   any
	dialect dialect.Dialect
}

func (f *greaterThanOrEqualFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	core.WriteQualifiedColumn(b, source, f.column.SQLName)
	b.WriteString(` >= `)
	b.WriteString(f.dialect.TypeCast(f.dialect.Placeholder(paramIndex), f.column.SQLType))

	params = append(params, f.value)

	return params, paramIndex + 1, nil
}

type lessThanFilter struct {
	column  *core.Column
	value   any
	dialect dialect.Dialect
}

func (f *lessThanFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	core.WriteQualifiedColumn(b, source, f.column.SQLName)
	b.WriteString(` < `)
	b.WriteString(f.dialect.TypeCast(f.dialect.Placeholder(paramIndex), f.column.SQLType))

	params = append(params, f.value)

	return params, paramIndex + 1, nil
}

type lessThanOrEqualFilter struct {
	column  *core.Column
	value   any
	dialect dialect.Dialect
}

func (f *lessThanOrEqualFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	core.WriteQualifiedColumn(b, source, f.column.SQLName)
	b.WriteString(` <= `)
	b.WriteString(f.dialect.TypeCast(f.dialect.Placeholder(paramIndex), f.column.SQLType))

	params = append(params, f.value)

	return params, paramIndex + 1, nil
}

type notInFilter struct {
	column  *core.Column
	values  []any
	dialect dialect.Dialect
}

func (f *notInFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	params, paramIndex = f.dialect.WriteArrayNotIn(
		b,
		source,
		f.column.SQLName,
		f.column.SQLType,
		f.values,
		params,
		paramIndex,
	)

	return params, paramIndex, nil
}

type likeFilter struct {
	column        string
	pattern       string
	caseSensitive bool
	dialect       dialect.Dialect
}

func (f *likeFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	core.WriteQualifiedColumn(b, source, f.column)

	if f.caseSensitive {
		b.WriteString(" LIKE ")
	} else {
		b.WriteByte(' ')
		b.WriteString(f.dialect.ILike())
		b.WriteByte(' ')
	}

	b.WriteString(f.dialect.Placeholder(paramIndex))

	params = append(params, f.pattern)

	return params, paramIndex + 1, nil
}

type notLikeFilter struct {
	column        string
	pattern       string
	caseSensitive bool
	dialect       dialect.Dialect
}

func (f *notLikeFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	core.WriteQualifiedColumn(b, source, f.column)

	if f.caseSensitive {
		b.WriteString(" NOT LIKE ")
	} else {
		b.WriteByte(' ')
		b.WriteString(f.dialect.NotILike())
		b.WriteByte(' ')
	}

	b.WriteString(f.dialect.Placeholder(paramIndex))

	params = append(params, f.pattern)

	return params, paramIndex + 1, nil
}

type regexFilter struct {
	column        string
	pattern       string
	caseSensitive bool
	dialect       dialect.Dialect
}

func (f *regexFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	core.WriteQualifiedColumn(b, source, f.column)

	if f.caseSensitive {
		b.WriteString(" ~ ")
	} else {
		b.WriteString(" ~* ")
	}

	b.WriteString(f.dialect.Placeholder(paramIndex))

	params = append(params, f.pattern)

	return params, paramIndex + 1, nil
}

type notRegexFilter struct {
	column        string
	pattern       string
	caseSensitive bool
	dialect       dialect.Dialect
}

func (f *notRegexFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	core.WriteQualifiedColumn(b, source, f.column)

	if f.caseSensitive {
		b.WriteString(" !~ ")
	} else {
		b.WriteString(" !~* ")
	}

	b.WriteString(f.dialect.Placeholder(paramIndex))

	params = append(params, f.pattern)

	return params, paramIndex + 1, nil
}

type isNullFilter struct {
	column string
	isNull bool
}

func (f *isNullFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	core.WriteQualifiedColumn(b, source, f.column)
	b.WriteString(` IS `)

	if !f.isNull {
		b.WriteString("NOT ")
	}

	b.WriteString("NULL")

	return params, paramIndex, nil
}

// rawFilter is a pre-formatted SQL fragment, used to splice fixed predicates
// (e.g. relationship join conditions) into a where clause.
type rawFilter struct {
	condition string
}

func (f *rawFilter) WriteCondition(
	b *strings.Builder,
	_ string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	b.WriteString(f.condition)
	return params, paramIndex, nil
}

// NewRawFilter builds a Statement that emits a fixed SQL fragment.
// Used by callers that splice a relationship join condition into a where clause.
// Returning the Statement interface (rather than *rawFilter) keeps the
// concrete filter type unexported while still letting callers compose it
// alongside other Statements.
func NewRawFilter(
	condition string,
) Statement {
	return &rawFilter{condition: condition}
}

// NewEqualsFilter builds a Statement that emits `col = $N::sqltype`.
// Used by callers that build primary-key equality predicates outside the
// parser (e.g. update_by_pk / delete_by_pk). Returning the Statement
// interface keeps the concrete filter type unexported.
func NewEqualsFilter(
	column *core.Column, value any, d dialect.Dialect,
) Statement {
	return &equalsFilter{column: column, value: value, dialect: d}
}

// NewAndFilter builds a Statement that ANDs all of conditions together.
// Used by callers (e.g. query_by_pk) that need to combine PK conditions
// into a single statement. Returning the Statement interface keeps the
// concrete filter type unexported.
func NewAndFilter(
	conditions []Statement,
) Statement {
	return &andFilter{conditions: conditions}
}

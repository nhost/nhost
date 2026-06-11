package where

import (
	"fmt"
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
	"github.com/nhost/nhost/services/constellation/connector/sql/pgtypes"
)

func writeBinaryTargetComparison(
	b *strings.Builder,
	source string,
	target comparisonTarget,
	operator string,
	value any,
	d dialect.Dialect,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	coerced, err := values.CoerceSQLValue(target.sqlType, value)
	if err != nil {
		return nil, 0, fmt.Errorf("coercing comparison value: %w", err)
	}

	target.writeSQL(b, source)
	b.WriteString(operator)
	b.WriteString(sqlTypeValueExpression(d, target.sqlType, paramIndex))

	params = append(params, coerced)

	return params, paramIndex + 1, nil
}

func sqlTypeValueExpression(d dialect.Dialect, sqlType string, paramIndex int) string {
	placeholder := d.Placeholder(paramIndex)
	if pgtypes.IsSpatial(sqlType) && d.SupportsSpatialTypes() {
		return d.SpatialValueExpression(placeholder, sqlType)
	}

	return d.TypeCast(placeholder, sqlType)
}

type equalsFilter struct {
	column  *core.Column
	target  *comparisonTarget
	value   any
	dialect dialect.Dialect
}

func (f *equalsFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	return writeBinaryTargetComparison(
		b,
		source,
		comparisonTargetFor(f.column, f.target),
		" = ",
		f.value,
		f.dialect,
		params,
		paramIndex,
	)
}

type inFilter struct {
	column  *core.Column
	target  *comparisonTarget
	values  []any
	dialect dialect.Dialect
}

func (f *inFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	return writeArrayTargetComparison(
		b,
		source,
		f.column,
		f.target,
		f.values,
		f.dialect,
		params,
		paramIndex,
		false,
	)
}

type notEqualsFilter struct {
	column  *core.Column
	target  *comparisonTarget
	value   any
	dialect dialect.Dialect
}

func (f *notEqualsFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	return writeBinaryTargetComparison(
		b,
		source,
		comparisonTargetFor(f.column, f.target),
		" != ",
		f.value,
		f.dialect,
		params,
		paramIndex,
	)
}

type greaterThanFilter struct {
	column  *core.Column
	target  *comparisonTarget
	value   any
	dialect dialect.Dialect
}

func (f *greaterThanFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	return writeBinaryTargetComparison(
		b,
		source,
		comparisonTargetFor(f.column, f.target),
		" > ",
		f.value,
		f.dialect,
		params,
		paramIndex,
	)
}

type greaterThanOrEqualFilter struct {
	column  *core.Column
	target  *comparisonTarget
	value   any
	dialect dialect.Dialect
}

func (f *greaterThanOrEqualFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	return writeBinaryTargetComparison(
		b,
		source,
		comparisonTargetFor(f.column, f.target),
		" >= ",
		f.value,
		f.dialect,
		params,
		paramIndex,
	)
}

type lessThanFilter struct {
	column  *core.Column
	target  *comparisonTarget
	value   any
	dialect dialect.Dialect
}

func (f *lessThanFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	return writeBinaryTargetComparison(
		b,
		source,
		comparisonTargetFor(f.column, f.target),
		" < ",
		f.value,
		f.dialect,
		params,
		paramIndex,
	)
}

type lessThanOrEqualFilter struct {
	column  *core.Column
	target  *comparisonTarget
	value   any
	dialect dialect.Dialect
}

func (f *lessThanOrEqualFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	return writeBinaryTargetComparison(
		b,
		source,
		comparisonTargetFor(f.column, f.target),
		" <= ",
		f.value,
		f.dialect,
		params,
		paramIndex,
	)
}

type notInFilter struct {
	column  *core.Column
	target  *comparisonTarget
	values  []any
	dialect dialect.Dialect
}

func (f *notInFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	return writeArrayTargetComparison(
		b,
		source,
		f.column,
		f.target,
		f.values,
		f.dialect,
		params,
		paramIndex,
		true,
	)
}

func writeArrayTargetComparison(
	b *strings.Builder,
	source string,
	column *core.Column,
	targetOverride *comparisonTarget,
	rawValues []any,
	d dialect.Dialect,
	params []any,
	paramIndex int,
	negated bool,
) ([]any, int, error) {
	target := comparisonTargetFor(column, targetOverride)

	vals, err := values.CoerceSQLValues(target.sqlType, rawValues)
	if err != nil {
		return nil, 0, fmt.Errorf("coercing %s values: %w", arrayOperatorName(negated), err)
	}

	if pgtypes.IsSpatial(target.sqlType) && d.SupportsSpatialTypes() {
		params, paramIndex = writeSpatialArrayTargetComparison(
			b, source, column, targetOverride, target, vals, d, params, paramIndex, negated,
		)

		return params, paramIndex, nil
	}

	if negated {
		params, paramIndex = d.WriteArrayNotIn(
			b, source, column.SQLName, target.sqlType, vals, params, paramIndex,
		)
	} else {
		params, paramIndex = d.WriteArrayIn(
			b, source, column.SQLName, target.sqlType, vals, params, paramIndex,
		)
	}

	return params, paramIndex, nil
}

func writeSpatialArrayTargetComparison(
	b *strings.Builder,
	source string,
	column *core.Column,
	targetOverride *comparisonTarget,
	target comparisonTarget,
	vals []any,
	d dialect.Dialect,
	params []any,
	paramIndex int,
	negated bool,
) ([]any, int) {
	if targetOverride != nil {
		if negated {
			return d.WriteSpatialArrayNotInExpression(
				b, target.sqlExpression(source), target.sqlType, vals, params, paramIndex,
			)
		}

		return d.WriteSpatialArrayInExpression(
			b, target.sqlExpression(source), target.sqlType, vals, params, paramIndex,
		)
	}

	if negated {
		return d.WriteSpatialArrayNotIn(
			b, source, column.SQLName, target.sqlType, vals, params, paramIndex,
		)
	}

	return d.WriteSpatialArrayIn(
		b, source, column.SQLName, target.sqlType, vals, params, paramIndex,
	)
}

func arrayOperatorName(negated bool) string {
	if negated {
		return "_nin"
	}

	return "_in"
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
	placeholder := f.dialect.Placeholder(paramIndex)

	if f.caseSensitive {
		core.WriteQualifiedColumn(b, source, f.column)
		b.WriteByte(' ')
		b.WriteString(f.dialect.Like())
		b.WriteByte(' ')
		b.WriteString(placeholder)
	} else {
		f.dialect.WriteILikeCondition(b, source, f.column, placeholder)
	}

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
	placeholder := f.dialect.Placeholder(paramIndex)

	if f.caseSensitive {
		core.WriteQualifiedColumn(b, source, f.column)
		b.WriteByte(' ')
		b.WriteString(f.dialect.NotLike())
		b.WriteByte(' ')
		b.WriteString(placeholder)
	} else {
		f.dialect.WriteNotILikeCondition(b, source, f.column, placeholder)
	}

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
	target *comparisonTarget
	isNull bool
}

func (f *isNullFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	if f.target != nil {
		f.target.writeSQL(b, source)
	} else {
		core.WriteQualifiedColumn(b, source, f.column)
	}

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
// The returned unexported type implements Statement and composes alongside
// other where conditions.
func NewRawFilter(condition string) Statement { //nolint:ireturn,nolintlint
	return &rawFilter{condition: condition}
}

// NewEqualsFilter builds a Statement that emits `col = $N::sqltype`.
// Used by callers that build primary-key equality predicates outside the
// parser (e.g. update_by_pk / delete_by_pk). The returned unexported type
// implements Statement.
func NewEqualsFilter( //nolint:ireturn,nolintlint
	column *core.Column, value any, d dialect.Dialect,
) Statement {
	return &equalsFilter{column: column, target: nil, value: value, dialect: d}
}

// NewAndFilter builds a Statement that ANDs all of conditions together.
// Used by callers (e.g. query_by_pk) that need to combine PK conditions
// into a single statement. The returned unexported type implements Statement.
func NewAndFilter(conditions []Statement) Statement { //nolint:ireturn,nolintlint
	return &andFilter{conditions: conditions}
}

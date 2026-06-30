package where

import (
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
)

type comparisonTarget struct {
	sourceColumn string
	sqlType      string
	render       func(*strings.Builder, string)
}

func newColumnComparisonTarget(column *core.Column) comparisonTarget {
	return comparisonTarget{
		sourceColumn: column.SQLName,
		sqlType:      column.SQLType,
		render: func(b *strings.Builder, source string) {
			core.WriteQualifiedColumn(b, source, column.SQLName)
		},
	}
}

func newSpatialCastComparisonTarget(
	base comparisonTarget,
	toSQLType string,
	d dialect.Dialect,
) comparisonTarget {
	return comparisonTarget{
		sourceColumn: base.sourceColumn,
		sqlType:      toSQLType,
		render: func(b *strings.Builder, source string) {
			b.WriteString(
				d.SpatialCastExpression(base.sqlExpression(source), base.sqlType, toSQLType),
			)
		},
	}
}

func comparisonTargetFor(column *core.Column, override *comparisonTarget) comparisonTarget {
	if override != nil {
		return *override
	}

	return newColumnComparisonTarget(column)
}

func (t comparisonTarget) writeSQL(b *strings.Builder, source string) {
	t.render(b, source)
}

func (t comparisonTarget) sqlExpression(source string) string {
	var b strings.Builder
	t.writeSQL(&b, source)

	return b.String()
}

func sourceColumnForTarget(column *core.Column, target *comparisonTarget) string {
	if target != nil {
		return target.sourceColumn
	}

	if column == nil {
		return ""
	}

	return column.SQLName
}

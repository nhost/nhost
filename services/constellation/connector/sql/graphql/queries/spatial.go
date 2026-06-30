package queries

import (
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/pgtypes"
)

func outputColumnExpression(d dialect.Dialect, expr string, column *core.Column) string {
	if pgtypes.IsSpatial(column.SQLType) && d.SupportsSpatialTypes() {
		return d.SpatialOutputExpression(expr, column.SQLType)
	}

	return expr
}

func (t *table) outputColumnExpression(expr string, column *core.Column) string {
	return outputColumnExpression(t.dialect, expr, column)
}

func valueExpression(d dialect.Dialect, column *core.Column, paramIndex int) string {
	placeholder := d.Placeholder(paramIndex)
	if pgtypes.IsSpatial(column.SQLType) && d.SupportsSpatialTypes() {
		return d.SpatialValueExpression(placeholder, column.SQLType)
	}

	return d.TypeCast(placeholder, column.SQLType)
}

func (t *table) valueExpression(column *core.Column, paramIndex int) string {
	return valueExpression(t.dialect, column, paramIndex)
}

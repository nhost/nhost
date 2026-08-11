package arguments

import (
	"strconv"
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

// QueryModifier writes a fragment of the post-WHERE query suffix
// (ORDER BY / LIMIT / OFFSET). Each modifier renders its own clause; callers
// emit a separator between modifiers. WriteSQL threads the params slice and
// placeholder index because relationship order_by terms render correlated
// subqueries that may inject row-level-permission parameters.
type QueryModifier interface {
	WriteSQL(b *strings.Builder, params []any, paramIndex int) ([]any, int, error)
}

// orderByTerm renders one ORDER BY expression (everything before the direction
// keyword). A scalar column is rendered inline by OrderBy.WriteSQL; a
// relationship/aggregate ordering is rendered by an implementation here that
// emits a correlated subquery and may append permission params.
type orderByTerm interface {
	writeExpr(b *strings.Builder, params []any, paramIndex int) ([]any, int, error)
}

// OrderByItem represents a single ordering specification. Either Column (a
// scalar column SQL name) or term (a relationship/aggregate ordering
// expression) is set. Direction is typed (core.OrderDirection) so the SQL
// fragment is never user-controlled — see core.OrderDirection.SQL.
type OrderByItem struct {
	Column    string // scalar column SQL name (when term is nil)
	term      orderByTerm
	Direction core.OrderDirection
}

// OrderBy represents an ORDER BY clause.
type OrderBy struct {
	Items []OrderByItem
}

// WriteSQL writes the ORDER BY clause to the SQL builder, threading params for
// relationship order_by terms whose correlated subqueries inject permission
// parameters. Scalar columns append no params.
func (o *OrderBy) WriteSQL(
	b *strings.Builder, params []any, paramIndex int,
) ([]any, int, error) {
	if len(o.Items) == 0 {
		return params, paramIndex, nil
	}

	b.WriteString("ORDER BY ")

	for i := range o.Items {
		if i > 0 {
			b.WriteString(", ")
		}

		var err error

		params, paramIndex, err = o.Items[i].writeExpr(b, params, paramIndex)
		if err != nil {
			return nil, 0, err
		}

		b.WriteByte(' ')
		b.WriteString(o.Items[i].Direction.SQL())
	}

	return params, paramIndex, nil
}

// writeExpr writes a single ORDER BY expression (column or relationship term).
func (item OrderByItem) writeExpr(
	b *strings.Builder, params []any, paramIndex int,
) ([]any, int, error) {
	if item.term != nil {
		return item.term.writeExpr(b, params, paramIndex)
	}

	core.WriteQuotedIdentifier(b, item.Column)

	return params, paramIndex, nil
}

// Limit represents a LIMIT clause.
type Limit struct {
	Value int
}

// WriteSQL writes the LIMIT clause to the SQL builder.
func (l *Limit) WriteSQL(
	b *strings.Builder, params []any, paramIndex int,
) ([]any, int, error) {
	b.WriteString("LIMIT ")
	b.WriteString(strconv.Itoa(l.Value))

	return params, paramIndex, nil
}

// Offset represents an OFFSET clause.
type Offset struct {
	Value int
}

// WriteSQL writes the OFFSET clause to the SQL builder.
func (o *Offset) WriteSQL(
	b *strings.Builder, params []any, paramIndex int,
) ([]any, int, error) {
	b.WriteString("OFFSET ")
	b.WriteString(strconv.Itoa(o.Value))

	return params, paramIndex, nil
}

// DistinctOn represents a DISTINCT ON clause.
// Note: This goes in the SELECT clause, before the column list.
type DistinctOn struct {
	Columns []string
}

// WriteSQL writes the DISTINCT ON clause to the SQL builder.
func (d *DistinctOn) WriteSQL(b *strings.Builder) {
	if len(d.Columns) == 0 {
		return
	}

	b.WriteString("DISTINCT ON (")

	for i, col := range d.Columns {
		if i > 0 {
			b.WriteString(", ")
		}

		core.WriteQuotedIdentifier(b, col)
	}

	b.WriteString(")")
}

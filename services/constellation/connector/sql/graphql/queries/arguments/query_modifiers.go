package arguments

import (
	"strconv"
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

// QueryModifier writes a fragment of the post-WHERE query suffix
// (ORDER BY / LIMIT / OFFSET). Each modifier renders its own clause; callers
// emit a separator between modifiers.
type QueryModifier interface {
	WriteSQL(b *strings.Builder)
}

// OrderByItem represents a single column ordering specification. Direction is
// typed (core.OrderDirection) so the SQL fragment is never user-controlled —
// see core.OrderDirection.SQL for the closed set of legal renderings.
type OrderByItem struct {
	Column    string // Real column name (after mapping)
	Direction core.OrderDirection
}

// OrderBy represents an ORDER BY clause.
type OrderBy struct {
	Items []OrderByItem
}

// WriteSQL writes the ORDER BY clause to the SQL builder.
func (o *OrderBy) WriteSQL(b *strings.Builder) {
	if len(o.Items) == 0 {
		return
	}

	b.WriteString("ORDER BY ")

	for i, item := range o.Items {
		if i > 0 {
			b.WriteString(", ")
		}

		core.WriteQuotedIdentifier(b, item.Column)
		b.WriteByte(' ')
		b.WriteString(item.Direction.SQL())
	}
}

// Limit represents a LIMIT clause.
type Limit struct {
	Value int
}

// WriteSQL writes the LIMIT clause to the SQL builder.
func (l *Limit) WriteSQL(b *strings.Builder) {
	b.WriteString("LIMIT ")
	b.WriteString(strconv.Itoa(l.Value))
}

// Offset represents an OFFSET clause.
type Offset struct {
	Value int
}

// WriteSQL writes the OFFSET clause to the SQL builder.
func (o *Offset) WriteSQL(b *strings.Builder) {
	b.WriteString("OFFSET ")
	b.WriteString(strconv.Itoa(o.Value))
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

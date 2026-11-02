package dialect

import (
	"strconv"
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

// WriteCollectionKeysFrom emits a typed, zipped PostgreSQL unnest or a SQLite
// derived table of bound tuples. The caller has already deduplicated keys and
// excluded tuples with null components. Only introspected types become casts.
//
//nolint:funlen // Both dialect branches write one key source and bound parameters.
func WriteCollectionKeysFrom(
	d Dialect, b *strings.Builder, alias string, columns, sqlTypes []string,
	tuples [][]any, params []any, paramIndex int,
) ([]any, int) {
	if d.SupportsLateral() {
		b.WriteString("unnest(")

		for col := range columns {
			if col > 0 {
				b.WriteString(", ")
			}

			b.WriteString(d.TypeCast(d.Placeholder(paramIndex), sqlTypes[col]+"[]"))

			values := make([]any, len(tuples))
			for row, tuple := range tuples {
				values[row] = tuple[col]
			}

			params = append(params, values)
			paramIndex++
		}

		b.WriteString(") AS ")
		core.WriteQuotedIdentifier(b, alias)
		b.WriteByte('(')

		for i, col := range columns {
			if i > 0 {
				b.WriteString(", ")
			}

			core.WriteQuotedIdentifier(b, col)
		}

		b.WriteByte(')')

		return params, paramIndex
	}

	// SQLite cannot alias columns of a VALUES table. SELECT/UNION ALL names
	// the first tuple's columns; bounded chunks keep its compound-select count
	// within SQLite's default 500-term limit.
	b.WriteString("(SELECT ")

	for row, tuple := range tuples {
		if row > 0 {
			b.WriteString(" UNION ALL SELECT ")
		}

		for col, value := range tuple {
			if col > 0 {
				b.WriteString(", ")
			}

			b.WriteString(d.Placeholder(paramIndex))

			if row == 0 {
				b.WriteString(" AS ")
				core.WriteQuotedIdentifier(b, columns[col])
			}

			params = append(params, value)
			paramIndex++
		}
	}

	b.WriteString(") AS ")
	core.WriteQuotedIdentifier(b, alias)

	return params, paramIndex
}

// CollectionKeyJSON renders a JSON array of typed key columns without
// exposing any extra column in the target collection's SELECT * projection.
func CollectionKeyJSON(d Dialect, alias string, columns []string) string {
	var b strings.Builder
	if d.SupportsLateral() {
		b.WriteString("json_build_array(")
	} else {
		b.WriteString("json_array(")
	}

	for i, col := range columns {
		if i > 0 {
			b.WriteString(", ")
		}

		core.WriteQualifiedColumn(&b, core.QuoteIdentifier(alias), col)
	}

	b.WriteByte(')')

	return b.String()
}

// CollectionKeyName is stable within a grouped-collection statement; the
// internal alias never enters a caller's table projection.
func CollectionKeyName(i int) string { return "__cs_array_key_" + strconv.Itoa(i) }

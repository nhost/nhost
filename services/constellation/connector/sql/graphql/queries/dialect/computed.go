package dialect

import (
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

// WritePostgresComputedRow reconstructs the complete base-table composite from
// a CTE/function alias, which is an anonymous record even when its columns
// match the table type. Columns must be in the catalog's physical order, not
// the role's projected-column order.
func WritePostgresComputedRow(b *strings.Builder, alias, schema, table string, columns []string) {
	b.WriteString("ROW(")

	for i, column := range columns {
		if i > 0 {
			b.WriteString(", ")
		}

		core.WriteQualifiedColumn(b, core.QuoteIdentifier(alias), column)
	}

	b.WriteString(")::")
	core.WriteQuotedIdentifier(b, schema)
	b.WriteByte('.')
	core.WriteQuotedIdentifier(b, table)
}

// PostgresComputedOutput applies a bound text[] path to json or jsonb without
// converting json to jsonb (which would reorder its object keys).
func PostgresComputedOutput(expression, pathPlaceholder string) string {
	if pathPlaceholder == "" {
		return expression
	}

	return "(" + expression + " #> " + pathPlaceholder + "::text[])"
}

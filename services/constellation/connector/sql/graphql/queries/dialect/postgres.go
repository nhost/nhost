package dialect

import (
	"strconv"
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

// PostgresDialect implements Dialect for PostgreSQL.
type PostgresDialect struct{}

// Compile-time assertion that PostgresDialect satisfies Dialect; a missing
// method becomes a build error instead of a runtime "method not found" panic.
var _ Dialect = (*PostgresDialect)(nil)

// NewPostgresDialect returns a PostgresDialect ready for use. Prefer the
// constructor over literal initialisation so future configuration fields can
// be added without breaking call sites.
func NewPostgresDialect() *PostgresDialect {
	return &PostgresDialect{}
}

func (d *PostgresDialect) Placeholder(paramIndex int) string {
	return "$" + strconv.Itoa(paramIndex)
}

func (d *PostgresDialect) TypeCast(placeholder string, sqlType string) string {
	return placeholder + "::" + sqlType
}

func (d *PostgresDialect) WriteArrayIn(
	b *strings.Builder, source, sqlName, sqlType string,
	values []any, params []any, paramIndex int,
) ([]any, int) {
	core.WriteQualifiedColumn(b, source, sqlName)
	b.WriteString(` = ANY($`)
	b.WriteString(strconv.Itoa(paramIndex))
	b.WriteString("::")
	b.WriteString(sqlType)
	b.WriteString("[])")

	params = append(params, values)

	return params, paramIndex + 1
}

func (d *PostgresDialect) WriteArrayNotIn(
	b *strings.Builder, source, sqlName, sqlType string,
	values []any, params []any, paramIndex int,
) ([]any, int) {
	core.WriteQualifiedColumn(b, source, sqlName)
	b.WriteString(` != ALL($`)
	b.WriteString(strconv.Itoa(paramIndex))
	b.WriteString("::")
	b.WriteString(sqlType)
	b.WriteString("[])")

	params = append(params, values)

	return params, paramIndex + 1
}

// JSONAggQuotedAlias wraps the supplied identifier in double quotes before
// passing it to json_agg, so callers cannot accidentally splice raw SQL into
// the aggregate.
func (d *PostgresDialect) JSONAggQuotedAlias(alias string) string {
	return "json_agg(" + core.QuoteIdentifier(alias) + ")"
}

// JSONAggRawExpr emits json_agg(expr) with the expression verbatim. The
// caller is responsible for quoting any identifiers inside the expression.
func (d *PostgresDialect) JSONAggRawExpr(expr string) string {
	return "json_agg(" + expr + ")"
}

func (d *PostgresDialect) CoalesceJSONArray(alias string) string {
	return "coalesce(json_agg(" + core.QuoteIdentifier(alias) + "), '[]')"
}

func (d *PostgresDialect) JSONBuildObject() string {
	return "json_build_object"
}

func (d *PostgresDialect) ToJSON(expr string) string {
	return "to_jsonb(" + expr + ")"
}

func (d *PostgresDialect) EmptyJSONArray() string {
	return "'[]'::json"
}

func (d *PostgresDialect) TableRef(schema, table string) string {
	return core.QuoteIdentifier(schema) + "." + core.QuoteIdentifier(table)
}

func (d *PostgresDialect) SupportsLateral() bool {
	return true
}

func (d *PostgresDialect) ILike() string {
	return "ILIKE"
}

func (d *PostgresDialect) NotILike() string {
	return "NOT ILIKE"
}

func (d *PostgresDialect) SupportsRegex() bool {
	return true
}

func (d *PostgresDialect) SupportsDistinctOn() bool {
	return true
}

// ThrowError calls the constellation_throw_error PL/pgSQL function (installed by
// the connector) so the error surfaces with both a message and a SQLSTATE-style
// code; SQLite has no equivalent custom-function story and uses RAISE(ABORT).
func (d *PostgresDialect) ThrowError(message, code string) string {
	message = strings.ReplaceAll(message, "'", "''")
	code = strings.ReplaceAll(code, "'", "''")

	return "constellation_throw_error('" + message + "', '" + code + "')"
}

func (d *PostgresDialect) MaterializedCTE() string {
	return "AS MATERIALIZED"
}

func (d *PostgresDialect) WriteArrayContains(b *strings.Builder, column, castPlaceholder string) {
	b.WriteString(column)
	b.WriteString(" @> ")
	b.WriteString(castPlaceholder)
}

func (d *PostgresDialect) WriteArrayContainedIn(
	b *strings.Builder,
	column, castPlaceholder string,
) {
	b.WriteString(column)
	b.WriteString(" <@ ")
	b.WriteString(castPlaceholder)
}

func (d *PostgresDialect) SupportsJSONB() bool {
	return true
}

func (d *PostgresDialect) SupportsFunctions() bool {
	return true
}

func (d *PostgresDialect) SupportsArrays() bool {
	return true
}

// WriteCountAggregate uses PostgreSQL's row-constructor form for multi-column
// counts: COUNT((c1, c2)) / COUNT(DISTINCT (c1, c2)).
func (d *PostgresDialect) WriteCountAggregate(
	b *strings.Builder, distinct bool, expressions []string,
) {
	b.WriteString("COUNT(")

	if len(expressions) == 0 {
		b.WriteByte('*')
		b.WriteByte(')')

		return
	}

	if distinct {
		b.WriteString("DISTINCT ")
	}

	b.WriteByte('(')
	writeExpressionList(b, expressions)
	b.WriteString("))")
}

// WriteAggregateOrderByExpr writes PostgreSQL's native aggregate function call.
func (d *PostgresDialect) WriteAggregateOrderByExpr(
	b *strings.Builder, function string, expression string,
) {
	b.WriteString(strings.ToUpper(function))
	b.WriteByte('(')
	b.WriteString(expression)
	b.WriteByte(')')
}

// SupportsStableVarianceOrderBy returns true: PostgreSQL has native, numerically
// stable stddev/variance aggregates, so ordering by them is well-defined.
func (d *PostgresDialect) SupportsStableVarianceOrderBy() bool { return true }

// SupportsVarianceAggregates returns true: PostgreSQL has native stddev/variance
// aggregate functions, so the corresponding aggregate selection fields are
// exposed and computed.
func (d *PostgresDialect) SupportsVarianceAggregates() bool { return true }

func (d *PostgresDialect) SupportsUpsertUpdateAction() bool { return true }

func (d *PostgresDialect) WriteUpsertUpdateAction(b *strings.Builder) {
	b.WriteString("(xmax <> 0)")
}

// BoolAndFunc returns PostgreSQL's native bool_and aggregate.
func (d *PostgresDialect) BoolAndFunc() string { return "bool_and" }

// BoolOrFunc returns PostgreSQL's native bool_or aggregate.
func (d *PostgresDialect) BoolOrFunc() string { return "bool_or" }

func (d *PostgresDialect) WriteJSONRowPrefix(b *strings.Builder) {
	b.WriteString(`row_to_json((SELECT "_e" FROM (SELECT `)
}

func (d *PostgresDialect) WriteJSONRowColumn(b *strings.Builder, alias, expr string) {
	b.WriteString(expr)
	b.WriteString(" AS ")
	core.WriteQuotedIdentifier(b, alias)
}

func (d *PostgresDialect) WriteJSONRowSuffix(b *strings.Builder, outputAlias string) {
	b.WriteString(`) AS "_e")) AS `)
	core.WriteQuotedIdentifier(b, outputAlias)
}

func (d *PostgresDialect) WriteJSONRowSuffixNoAlias(b *strings.Builder) {
	b.WriteString(`) AS "_e"))`)
}

func (d *PostgresDialect) WriteGroupKeysFrom(
	b *strings.Builder,
	keysAlias, colAlias, sqlType string,
	values []any, params []any, paramIndex int,
) ([]any, int) {
	b.WriteString("unnest($")
	b.WriteString(strconv.Itoa(paramIndex))
	b.WriteString("::")
	b.WriteString(sqlType)
	b.WriteString("[]) AS ")
	core.WriteQuotedIdentifier(b, keysAlias)
	b.WriteByte('(')
	core.WriteQuotedIdentifier(b, colAlias)
	b.WriteByte(')')

	params = append(params, values)

	return params, paramIndex + 1
}

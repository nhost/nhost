package dialect

import (
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

// SQLiteDialect implements Dialect for SQLite.
type SQLiteDialect struct{}

// Compile-time assertion that SQLiteDialect satisfies Dialect; a missing
// method becomes a build error instead of a runtime "method not found" panic.
var _ Dialect = (*SQLiteDialect)(nil)

// NewSQLiteDialect returns a SQLiteDialect ready for use. Prefer the
// constructor over literal initialisation so future configuration fields can
// be added without breaking call sites.
func NewSQLiteDialect() *SQLiteDialect {
	return &SQLiteDialect{}
}

// Placeholder ignores the parameter index because SQLite uses positional
// "?" markers — the same placeholder for every parameter, ordered by the
// position they appear in the SQL string.
func (d *SQLiteDialect) Placeholder(_ int) string {
	return "?"
}

// TypeCast returns the placeholder unchanged: SQLite has dynamic typing and
// does not accept ::type casts on bind parameters.
func (d *SQLiteDialect) TypeCast(placeholder string, _ string) string {
	return placeholder
}

// WriteArrayIn emits a flat "col IN (?, ?, ...)" expansion because SQLite has
// no array type. The sqlType argument is ignored (no array casts apply). When
// values is empty SQLite would reject "IN ()" as a syntax error, so we emit
// "1 = 0" instead — preserving the predicate's "never matches" semantics
// without breaking the surrounding statement.
func (d *SQLiteDialect) WriteArrayIn(
	b *strings.Builder, source, sqlName, _ string,
	values []any, params []any, paramIndex int,
) ([]any, int) {
	if len(values) == 0 {
		b.WriteString("1 = 0")
		return params, paramIndex
	}

	core.WriteQualifiedColumn(b, source, sqlName)
	b.WriteString(" IN (")

	for i, v := range values {
		if i > 0 {
			b.WriteString(", ")
		}

		b.WriteString("?")

		params = append(params, v)
		paramIndex++
	}

	b.WriteString(")")

	return params, paramIndex
}

// WriteArrayNotIn is the inverse of WriteArrayIn. The empty-values case
// returns "1 = 1" — an always-true predicate — to preserve the NOT IN
// semantics (nothing was excluded) without emitting the SQLite-illegal
// "NOT IN ()" form.
func (d *SQLiteDialect) WriteArrayNotIn(
	b *strings.Builder, source, sqlName, _ string,
	values []any, params []any, paramIndex int,
) ([]any, int) {
	if len(values) == 0 {
		b.WriteString("1 = 1")
		return params, paramIndex
	}

	core.WriteQualifiedColumn(b, source, sqlName)
	b.WriteString(" NOT IN (")

	for i, v := range values {
		if i > 0 {
			b.WriteString(", ")
		}

		b.WriteString("?")

		params = append(params, v)
		paramIndex++
	}

	b.WriteString(")")

	return params, paramIndex
}

// JSONAggQuotedAlias wraps the supplied identifier in double quotes and uses
// json_group_array with an inner json() call: SQLite stores JSON as TEXT, and
// without the json() wrapper json_group_array would emit the structure as a
// quoted string rather than as a nested JSON value.
func (d *SQLiteDialect) JSONAggQuotedAlias(alias string) string {
	return "json_group_array(json(" + core.QuoteIdentifier(alias) + "))"
}

// JSONAggRawExpr emits json_group_array(expr) with the expression verbatim.
// Unlike JSONAggQuotedAlias it does not wrap in json(); the caller is expected
// to either be aggregating scalar values or to apply json() themselves.
func (d *SQLiteDialect) JSONAggRawExpr(expr string) string {
	return "json_group_array(" + expr + ")"
}

func (d *SQLiteDialect) CoalesceJSONArray(alias string) string {
	return "coalesce(json_group_array(json(" + core.QuoteIdentifier(alias) + ")), '[]')"
}

func (d *SQLiteDialect) JSONBuildObject() string {
	return "json_object"
}

func (d *SQLiteDialect) ToJSON(expr string) string {
	return "json(" + expr + ")"
}

func (d *SQLiteDialect) EmptyJSONArray() string {
	return "'[]'"
}

// TableRef drops the schema argument: SQLite has a single per-database
// namespace and does not support "schema"."table" qualification the way
// PostgreSQL does. Callers may pass any schema value; only table is used.
func (d *SQLiteDialect) TableRef(_, table string) string {
	return core.QuoteIdentifier(table)
}

func (d *SQLiteDialect) SupportsLateral() bool {
	return false
}

func (d *SQLiteDialect) ILike() string {
	return "LIKE"
}

func (d *SQLiteDialect) NotILike() string {
	return "NOT LIKE"
}

func (d *SQLiteDialect) SupportsRegex() bool {
	return false
}

func (d *SQLiteDialect) SupportsDistinctOn() bool {
	return false
}

// ThrowError synthesises a (SELECT RAISE(ABORT, ...)) expression: RAISE is only
// legal inside a trigger body, so wrapping it in a scalar subquery lets us drop
// it into the same positions where Postgres calls constellation_throw_error.
// SQLite's RAISE has no error-code argument, so the code is intentionally ignored.
func (d *SQLiteDialect) ThrowError(message, _ string) string {
	return "(SELECT RAISE(ABORT, '" + strings.ReplaceAll(message, "'", "''") + "'))"
}

func (d *SQLiteDialect) MaterializedCTE() string {
	return "AS"
}

func (d *SQLiteDialect) JSONBuildArray() string {
	return "json_array"
}

// WriteArrayContains is unreachable on SQLite: array operators are gated by
// SupportsArrays() (which returns false here), so any caller hitting this
// method has skipped the capability check. Failing loudly turns that
// programming error into an obvious panic instead of silently broken SQL.
func (d *SQLiteDialect) WriteArrayContains(_ *strings.Builder, _, _ string) {
	panic("dialect: WriteArrayContains called on SQLiteDialect; gate with SupportsArrays()")
}

// WriteArrayContainedIn is unreachable on SQLite for the same reason as
// WriteArrayContains; see that method for the rationale.
func (d *SQLiteDialect) WriteArrayContainedIn(_ *strings.Builder, _, _ string) {
	panic(
		"dialect: WriteArrayContainedIn called on SQLiteDialect; gate with SupportsArrays()",
	)
}

func (d *SQLiteDialect) SupportsJSONB() bool {
	return false
}

func (d *SQLiteDialect) SupportsFunctions() bool {
	return false
}

func (d *SQLiteDialect) SupportsArrays() bool {
	return false
}

func (d *SQLiteDialect) WriteJSONRowPrefix(b *strings.Builder) {
	b.WriteString("json_object(")
}

func (d *SQLiteDialect) WriteJSONRowColumn(b *strings.Builder, alias, expr string) {
	b.WriteByte('\'')
	b.WriteString(alias)
	b.WriteString("', ")
	b.WriteString(expr)
}

func (d *SQLiteDialect) WriteJSONRowSuffix(b *strings.Builder, outputAlias string) {
	b.WriteString(") AS ")
	core.WriteQuotedIdentifier(b, outputAlias)
}

func (d *SQLiteDialect) WriteJSONRowSuffixNoAlias(b *strings.Builder) {
	b.WriteString(")")
}

func (d *SQLiteDialect) WriteGroupKeysFrom(
	b *strings.Builder,
	keysAlias, colAlias, _ string,
	values []any, params []any, paramIndex int,
) ([]any, int) {
	b.WriteString("(VALUES ")

	for i, v := range values {
		if i > 0 {
			b.WriteString(", ")
		}

		b.WriteString("(?)")

		params = append(params, v)
		paramIndex++
	}

	b.WriteString(") AS ")
	core.WriteQuotedIdentifier(b, keysAlias)
	b.WriteByte('(')
	core.WriteQuotedIdentifier(b, colAlias)
	b.WriteByte(')')

	return params, paramIndex
}

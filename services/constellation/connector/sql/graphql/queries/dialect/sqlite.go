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

// WriteCountAggregate renders multi-column counts through a stable JSON tuple
// key. SQLite rejects COUNT((c1, c2)) as "row value misused"; wrapping each
// value in quote() keeps NULLs and BLOBs representable while producing a
// non-null tuple value, matching PostgreSQL row-constructor count semantics.
func (d *SQLiteDialect) WriteCountAggregate(
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

	if len(expressions) == 1 {
		b.WriteByte('(')
		b.WriteString(expressions[0])
		b.WriteString("))")

		return
	}

	b.WriteString("json_array(")
	writeQuotedExpressionList(b, expressions)
	b.WriteString("))")
}

// WriteAggregateOrderByExpr writes SQLite-supported aggregate expressions for
// array-relationship aggregate order_by. SQLite has no stddev/variance aggregate
// functions; the stddev/variance family is rejected upstream (gated by
// SupportsStableVarianceOrderBy) because the one-pass identity that would
// emulate them is numerically unstable and inverts the ordering for large,
// close values. Only avg/sum/min/max reach this method.
func (d *SQLiteDialect) WriteAggregateOrderByExpr(
	b *strings.Builder, function string, expression string,
) {
	switch function {
	case "avg":
		writeSQLiteUnaryAggregate(b, "AVG", expression)
	case "max":
		writeSQLiteUnaryAggregate(b, "MAX", expression)
	case "min":
		writeSQLiteUnaryAggregate(b, "MIN", expression)
	case "sum":
		writeSQLiteUnaryAggregate(b, "SUM", expression)
	default:
		// The caller validates the function name and rejects unsupported ones
		// before reaching the dialect; keep the fallback syntactically obvious if
		// a new schema field is added without extending this switch.
		writeSQLiteUnaryAggregate(b, strings.ToUpper(function), expression)
	}
}

// SupportsStableVarianceOrderBy returns false: SQLite has no native
// stddev/variance aggregate, and the one-pass sum-of-squares identity that would
// emulate them loses all precision (and can go negative) for large, close
// values, so the row ordering would diverge from PostgreSQL/Hasura. The caller
// rejects such orderings instead of returning a silently wrong order.
func (d *SQLiteDialect) SupportsStableVarianceOrderBy() bool { return false }

// SupportsVarianceAggregates returns false: go-sqlite3 has no stddev/variance
// aggregate functions, so STDDEV(...)/VARIANCE(...) etc. would fail at execution
// with an opaque "no such function" error. Schema generation therefore omits the
// stddev/variance aggregate fields for SQLite and the selection builder rejects
// them; avg/sum/min/max/count remain native and unaffected.
func (d *SQLiteDialect) SupportsVarianceAggregates() bool { return false }

func (d *SQLiteDialect) SupportsUpsertUpdateAction() bool { return false }

func (d *SQLiteDialect) WriteUpsertUpdateAction(_ *strings.Builder) {
	panic(
		"dialect: WriteUpsertUpdateAction called on SQLiteDialect; gate with SupportsUpsertUpdateAction",
	)
}

// WriteOnConflictTarget lists the constraint's columns: SQLite has no
// "ON CONFLICT ON CONSTRAINT <name>" form, so it identifies the conflict target
// by its index columns ("ON CONFLICT (\"col1\", \"col2\")"). constraintName is
// unused. When conflictColumns is empty (a constraint whose columns could not be
// resolved) we emit a bare "ON CONFLICT" — SQLite reads that as "any conflict",
// which still drives the following DO UPDATE/DO NOTHING rather than producing the
// syntax error an empty "()" would.
func (d *SQLiteDialect) WriteOnConflictTarget(
	b *strings.Builder, _ string, conflictColumns []string,
) {
	b.WriteString(" ON CONFLICT")

	if len(conflictColumns) == 0 {
		return
	}

	b.WriteString(" (")

	for i, column := range conflictColumns {
		if i > 0 {
			b.WriteString(", ")
		}

		core.WriteQuotedIdentifier(b, column)
	}

	b.WriteByte(')')
}

func writeQuotedExpressionList(b *strings.Builder, expressions []string) {
	for i, expr := range expressions {
		if i > 0 {
			b.WriteString(", ")
		}

		b.WriteString("quote(")
		b.WriteString(expr)
		b.WriteByte(')')
	}
}

func writeSQLiteUnaryAggregate(b *strings.Builder, function string, expression string) {
	b.WriteString(function)
	b.WriteByte('(')
	b.WriteString(expression)
	b.WriteByte(')')
}

// BoolAndFunc returns min: SQLite has no bool_and, but over its 0/1 boolean
// storage min() is true (1) iff every value is true, matching bool_and —
// including NULL over an empty set.
func (d *SQLiteDialect) BoolAndFunc() string { return "min" }

// BoolOrFunc returns max: over SQLite's 0/1 boolean storage max() is true (1)
// iff any value is true, matching bool_or.
func (d *SQLiteDialect) BoolOrFunc() string { return "max" }

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

// WriteGroupKeysFrom renders the grouped-key derived table as a chain of
// single-row SELECTs unioned together: the first SELECT names the column via
// "AS", subsequent rows reuse it positionally, and the whole subquery is given
// the derived-table alias. SQLite does NOT support the PostgreSQL
// "(VALUES ...) AS alias(column)" table-alias column-list clause — it rejects it
// with a prepare-time syntax error — so a VALUES list cannot name its column
// here. Each value is bound through a placeholder, never concatenated.
//
//	(SELECT ? AS "_join_key" UNION ALL SELECT ? UNION ALL ...) AS "__cs_grp_keys"
//
// The empty case (no parent keys) cannot occur in production — the resolver
// returns before building when there are no join values — but a zero-row,
// correctly-named derived table is emitted defensively so the surrounding
// statement stays valid regardless of the caller.
func (d *SQLiteDialect) WriteGroupKeysFrom(
	b *strings.Builder,
	keysAlias, colAlias, _ string,
	values []any, params []any, paramIndex int,
) ([]any, int) {
	b.WriteString("(SELECT ")

	if len(values) == 0 {
		b.WriteString("NULL AS ")
		core.WriteQuotedIdentifier(b, colAlias)
		b.WriteString(" WHERE 0) AS ")
		core.WriteQuotedIdentifier(b, keysAlias)

		return params, paramIndex
	}

	for i, v := range values {
		if i > 0 {
			b.WriteString(" UNION ALL SELECT ?")
		} else {
			b.WriteString("? AS ")
			core.WriteQuotedIdentifier(b, colAlias)
		}

		params = append(params, v)
		paramIndex++
	}

	b.WriteString(") AS ")
	core.WriteQuotedIdentifier(b, keysAlias)

	return params, paramIndex
}

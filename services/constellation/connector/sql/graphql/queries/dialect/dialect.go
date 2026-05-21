// Package dialect abstracts SQL syntax differences between database backends.
// The Dialect interface defines the contract; PostgresDialect and SQLiteDialect
// provide the two concrete implementations. Consumers (query builders, filters)
// depend on the interface; concrete drivers (connector/sql/postgres, sqlite)
// construct the implementation values.
package dialect

import (
	"strings"
)

//go:generate mockgen -package mock -destination mock/dialect.go . Dialect

// Dialect abstracts SQL syntax differences between database backends.
// Each method maps to an unavoidable PG/SQLite syntax divergence;
// subsetting would push the branch onto every call site.
type Dialect interface { //nolint:interfacebloat
	// Placeholder returns the parameter placeholder for the N-th param (1-indexed).
	// PostgreSQL: "$1", "$2"    SQLite: "?", "?"
	Placeholder(paramIndex int) string

	// TypeCast wraps a placeholder with a type cast.
	// PostgreSQL: "$1::uuid"    SQLite: "?" (no cast needed)
	TypeCast(placeholder string, sqlType string) string

	// WriteArrayIn writes "= ANY($N::type[])" or "IN (?, ?, ?)" and expands params.
	// Returns updated params and paramIndex.
	WriteArrayIn(
		b *strings.Builder, source, sqlName, sqlType string,
		values []any, params []any, paramIndex int,
	) ([]any, int)

	// WriteArrayNotIn writes "!= ALL($N::type[])" or "NOT IN (?, ?, ?)".
	WriteArrayNotIn(
		b *strings.Builder, source, sqlName, sqlType string,
		values []any, params []any, paramIndex int,
	) ([]any, int)

	// JSONAggQuotedAlias wraps a column/alias identifier in a JSON array
	// aggregation, quoting the identifier. The argument is treated as an
	// identifier name, not raw SQL: it is wrapped in double quotes verbatim.
	// PostgreSQL: json_agg("alias")    SQLite: json_group_array("alias")
	JSONAggQuotedAlias(alias string) string

	// JSONAggRawExpr wraps a raw SQL expression in a JSON array aggregation.
	// The argument is emitted verbatim, no quoting.
	// PostgreSQL: json_agg(expr)    SQLite: json_group_array(expr)
	JSONAggRawExpr(expr string) string

	// CoalesceJSONArray wraps JSONAggQuotedAlias with coalesce to default to empty array.
	// PostgreSQL: coalesce(json_agg("x"), '[]')    SQLite: coalesce(json_group_array("x"), '[]')
	CoalesceJSONArray(alias string) string

	// JSONBuildObject returns the function name for building JSON objects.
	// PostgreSQL: json_build_object    SQLite: json_object
	JSONBuildObject() string

	// ToJSON converts an expression to JSON.
	// PostgreSQL: to_jsonb(expr)    SQLite: json(expr)
	ToJSON(expr string) string

	// EmptyJSONArray returns an empty JSON array literal.
	// PostgreSQL: '[]'::json    SQLite: '[]'
	EmptyJSONArray() string

	// TableRef returns a schema-qualified table reference.
	// PostgreSQL: "schema"."table"    SQLite: "table"
	TableRef(schema, table string) string

	// SupportsLateral returns whether LEFT JOIN LATERAL is available.
	SupportsLateral() bool

	// ILike returns the case-insensitive LIKE operator.
	// PostgreSQL: ILIKE    SQLite: LIKE
	ILike() string

	// NotILike returns the negated case-insensitive LIKE operator.
	// PostgreSQL: NOT ILIKE    SQLite: NOT LIKE
	NotILike() string

	// SupportsRegex returns whether regex operators are available.
	SupportsRegex() bool

	// SupportsDistinctOn returns whether DISTINCT ON is available.
	SupportsDistinctOn() bool

	// ThrowError returns SQL to raise an error.
	// PostgreSQL: constellation_throw_error('msg', 'code')
	// SQLite:     uses a subquery approach
	ThrowError(message, code string) string

	// MaterializedCTE returns "AS MATERIALIZED" or "AS" depending on support.
	MaterializedCTE() string

	// JSONBuildArray returns the function name for building JSON arrays.
	// PostgreSQL: jsonb_build_array    SQLite: json_array
	JSONBuildArray() string

	// WriteArrayContains writes the "array contains" operator (column @> value).
	// PostgreSQL: column @> $N::type[]
	WriteArrayContains(b *strings.Builder, column, castPlaceholder string)

	// WriteArrayContainedIn writes the "array contained in" operator (column <@ value).
	// PostgreSQL: column <@ $N::type[]
	WriteArrayContainedIn(b *strings.Builder, column, castPlaceholder string)

	// SupportsJSONB returns whether JSONB operators (@>, <@, ?, ?&, ?|) are available.
	SupportsJSONB() bool

	// SupportsFunctions returns whether tracked SQL functions are available.
	SupportsFunctions() bool

	// SupportsArrays returns whether array column types are available.
	SupportsArrays() bool

	// WriteJSONRowPrefix writes the start of a row-to-JSON expression.
	// PostgreSQL: row_to_json((SELECT "_e" FROM (SELECT
	// SQLite: json_object(
	WriteJSONRowPrefix(b *strings.Builder)

	// WriteJSONRowColumn writes a column entry in a JSON row expression.
	// PostgreSQL: writes `expr AS "alias"`
	// SQLite: writes `'alias', expr`
	WriteJSONRowColumn(b *strings.Builder, alias, expr string)

	// WriteJSONRowSuffix writes the end of a row-to-JSON expression with output alias.
	// PostgreSQL: ) AS "_e")) AS "outputAlias"
	// SQLite: ) AS "outputAlias"
	WriteJSONRowSuffix(b *strings.Builder, outputAlias string)

	// WriteJSONRowSuffixNoAlias writes the end of a row-to-JSON expression without output alias.
	// PostgreSQL: ) AS "_e"))
	// SQLite: )
	WriteJSONRowSuffixNoAlias(b *strings.Builder)

	// WriteGroupKeysFrom writes a FROM-source expression that produces one row
	// per join value, used to build grouped-aggregate queries that batch
	// multiple parent keys in a single statement.
	//
	// PostgreSQL: unnest($N::T[]) AS "keysAlias"("colAlias")
	// SQLite:     (VALUES (?), (?), ...) AS "keysAlias"("colAlias")
	//
	// keysAlias names the derived table; colAlias names the single column it
	// exposes. sqlType is the SQL type of the column being grouped on (used
	// only by PostgreSQL for the array cast).
	WriteGroupKeysFrom(
		b *strings.Builder,
		keysAlias, colAlias, sqlType string,
		values []any, params []any, paramIndex int,
	) ([]any, int)
}

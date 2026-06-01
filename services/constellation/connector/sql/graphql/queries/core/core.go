// Package core holds the primitive data types shared across the queries
// package and its subpackages (dialect, values, multiplexed). Types defined
// here have no behavior beyond struct field access and a single SQL-quoting
// helper. The split exists so that consumers like connector/sql/postgres and
// connector/sql/sqlite can import a small focused package instead of pulling
// in the entire query-builder symbol table.
package core

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"
)

// ErrUnknownOrderDirection is returned when unmarshalling an OrderDirection
// JSON string that doesn't match any of the known SQL fragment forms.
var ErrUnknownOrderDirection = errors.New("OrderDirection: unknown value")

// SQLOperation is the parameterized SQL output produced by the query builders.
// StreamCursors is populated only for stream-subscription operations; see
// StreamCursorInfo for its lifecycle.
type SQLOperation struct {
	// Name is the GraphQL field alias (or field name when no alias is set)
	// used as the result-map key by postgres.ExecuteOperations and
	// sqlite.ExecuteOperations when assembling the response.
	Name string
	// SQL is the dialect-rendered SQL statement with positional placeholders
	// matching Parameters by index.
	SQL string
	// Parameters is the positional argument list bound to SQL. For stream
	// subscriptions it may contain CursorValue markers; for function
	// session_argument placeholders in multiplexed subscription templates it may
	// contain FunctionSessionArgument markers. multiplexed.Multiplex rewrites
	// both marker types into result_vars references before execution.
	Parameters []any
	// StreamCursors is non-nil only for stream-subscription operations and
	// records one entry per cursor column referenced by the operation.
	StreamCursors []StreamCursorInfo
}

// StreamCursorInfo carries metadata for a single cursor column on a stream
// subscription. The subscription manager seeds result_vars with InitialValue
// on the first poll, extracts the new cursor value from each result row using
// GraphQLName, and writes it back into result_vars for the next poll.
type StreamCursorInfo struct {
	// ColumnName is the underlying SQL column the cursor advances over.
	ColumnName string
	// GraphQLName is the GraphQL field alias used to extract the next cursor
	// value out of each result row before it is fed back into result_vars.
	GraphQLName string
	// InitialValue seeds result_vars on the first poll; the subscription
	// manager replaces it with the latest row's value on each subsequent poll.
	InitialValue any
	// Ordering selects between `>` and `<` cursor comparison operators when
	// building the WHERE clause; only the ASC vs DESC distinction is consulted
	// via OrderDirection.IsDescending.
	Ordering OrderDirection
}

// OrderDirection is a typed SQL ordering direction. Values render to a fixed
// SQL fragment via SQL(); callers must not construct an OrderDirection from a
// raw integer or stringly-typed input — use the defined constants. The closed
// set prevents user-controlled strings from being concatenated into ORDER BY
// clauses by callers that bypass the argument parsers.
//
// UnmarshalJSON requires a pointer receiver to mutate; the read-only methods
// (SQL, IsDescending, MarshalJSON) keep value receivers because they don't,
// mirroring the standard library convention for JSON-marshalable scalar types.
//
//nolint:recvcheck // mixed receivers are intentional; see godoc above.
type OrderDirection int

// OrderDirection constants. The zero value (OrderAsc) is the implicit default
// for callers that leave the field unset (e.g. stream cursors without an
// explicit ordering).
const (
	OrderAsc OrderDirection = iota
	OrderDesc
	OrderAscNullsFirst
	OrderAscNullsLast
	OrderDescNullsFirst
	OrderDescNullsLast
)

// SQL returns the SQL fragment for the direction (e.g. "ASC NULLS FIRST").
// An unknown OrderDirection value falls back to "ASC" — the safe default —
// rather than panicking, because the producer-side parsers already validate
// the input set.
func (d OrderDirection) SQL() string {
	switch d {
	case OrderAsc:
		return "ASC" //nolint:goconst
	case OrderDesc:
		return "DESC"
	case OrderAscNullsFirst:
		return "ASC NULLS FIRST"
	case OrderAscNullsLast:
		return "ASC NULLS LAST"
	case OrderDescNullsFirst:
		return "DESC NULLS FIRST"
	case OrderDescNullsLast:
		return "DESC NULLS LAST"
	default:
		return "ASC"
	}
}

// IsDescending reports whether the direction is one of the DESC variants.
// Used by the stream-cursor SQL builder to choose between `>` and `<` cursor
// comparison operators.
func (d OrderDirection) IsDescending() bool {
	switch d {
	case OrderDesc, OrderDescNullsFirst, OrderDescNullsLast:
		return true
	case OrderAsc, OrderAscNullsFirst, OrderAscNullsLast:
		return false
	default:
		return false
	}
}

// MarshalJSON marshals the direction as its SQL fragment (e.g. "ASC NULLS
// FIRST"). The textual form keeps JSON golden files human-readable and stable
// across re-orderings of the constants.
func (d OrderDirection) MarshalJSON() ([]byte, error) {
	return []byte(strconv.Quote(d.SQL())), nil
}

// UnmarshalJSON parses the SQL-fragment form produced by MarshalJSON back into
// an OrderDirection. Unknown strings are rejected so a corrupted or
// hand-edited golden file fails loudly instead of silently becoming the zero
// value.
func (d *OrderDirection) UnmarshalJSON(data []byte) error {
	s, err := strconv.Unquote(string(data))
	if err != nil {
		return fmt.Errorf("OrderDirection: %w", err)
	}

	switch s {
	case "ASC":
		*d = OrderAsc
	case "DESC":
		*d = OrderDesc
	case "ASC NULLS FIRST":
		*d = OrderAscNullsFirst
	case "ASC NULLS LAST":
		*d = OrderAscNullsLast
	case "DESC NULLS FIRST":
		*d = OrderDescNullsFirst
	case "DESC NULLS LAST":
		*d = OrderDescNullsLast
	default:
		return fmt.Errorf("%w: %q", ErrUnknownOrderDirection, s)
	}

	return nil
}

// Column describes a SQL column exposed through the GraphQL schema.
type Column struct {
	SQLName     string
	GraphqlName string
	SQLType     string
	// IsArray is true when the underlying SQL type is an array type (Postgres
	// typcategory 'A'); it drives the column's GraphQL list type and disables
	// scalar aggregates.
	IsArray bool
	// IsGenerated is true when the column is a database-generated column
	// (GENERATED ALWAYS / STORED / VIRTUAL); such columns are excluded from
	// insert and update mutation input types.
	IsGenerated bool
	// IsIdentity is true when the column auto-populates from a database-managed
	// source the insert payload cannot reliably precompute: PostgreSQL
	// GENERATED ALWAYS / BY DEFAULT AS IDENTITY (pg_attribute.attidentity != '')
	// and SQLite INTEGER PRIMARY KEY rowid aliases (with or without
	// AUTOINCREMENT). These columns do not appear in pg_attrdef nor in
	// PRAGMA table_xinfo's dflt_value, so HasDefault stays false; IsIdentity is
	// the separate signal RequiresPostInsertCheck consults to force an
	// insert-check predicate referencing such a column to run after the INSERT
	// (against the row carrying the engine-assigned value) rather than against
	// the payload (where the column would still be NULL).
	IsIdentity bool
	// HasDefault is true when the column has a database DEFAULT expression.
	// When such a column is omitted from an insert, the row carries the
	// default rather than NULL, so an insert-check that references it (directly
	// or via a relationship join column) must be evaluated after the INSERT.
	HasDefault bool
	// DefaultExpr is the raw SQL default expression (e.g. "'public'::text",
	// "now()", "gen_random_uuid()"), or "" when the column has no default. It
	// is used by multi-row insert builders to emit the default expression
	// inline for rows that omit a column whose siblings supply it: a
	// UNION-ALL branch that wrote NULL for an absent NOT NULL DEFAULT column
	// would raise a 23502 not-null-violation at INSERT time, where Hasura
	// would let the DB default apply per row. Volatile defaults like now()
	// and gen_random_uuid() evaluate per row in INSERT ... SELECT, so emitting
	// the expression inline preserves the per-row semantics.
	DefaultExpr string
}

// Operation is the function signature for the per-field SQL builders
// registered by queries.BuildRoots. Builders are pure with respect to roots:
// they read sibling entries to dispatch into relationship subqueries within
// the same role but must not mutate the map. Recursive dispatch is by lookup
// (`roots[siblingName](...)`) and each returned SQLOperation carries its own
// fully-rendered SQL and positional Parameters — callers compose the
// surrounding statement and append the nested Parameters in order. See
// connector/sql/graphql/queries/relationship.go for the canonical pattern.
type Operation func(
	field *ast.Field,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]Operation,
) (SQLOperation, error)

// FunctionSessionArgument is a marker placed in SQLOperation.Parameters by
// function-backed subscription builders when a SQL function's session_argument
// should receive the per-subscriber session object. The multiplexed converter
// rewrites the corresponding placeholder to _subs.result_vars->'session' and
// casts it to SQLType (usually json or jsonb), keeping the parameter dynamic
// across all subscribers in a cohort.
type FunctionSessionArgument struct {
	// SQLType is the database type of the function's session_argument. It is
	// used as the cast on the rewritten result_vars expression.
	SQLType string
}

// CursorValue is a marker placed in SQLOperation.Parameters by stream
// subscription builders. The multiplexed converter (multiplexed.Multiplex)
// recognises the marker and rewrites the corresponding placeholder into a
// result_vars reference so each cohort member resumes from its own cursor.
type CursorValue struct {
	// ColumnName is the cursor column whose latest value the multiplexed
	// converter should reference via result_vars on subsequent polls.
	ColumnName string
	// Value is the initial cursor value supplied by the client; it seeds
	// result_vars for the first poll before being replaced from results.
	Value any
}

// MultiplexedResult is a single per-subscriber row produced by a SQL driver's
// ExecuteMultiplexedOperation. It pairs the subscription ID extracted from
// the query's result_vars with the raw JSON payload for that subscriber.
// Lives here (rather than in subscription) so SQL drivers can return values
// of this type without taking a dependency on the subscription package.
type MultiplexedResult struct {
	// SubscriptionID identifies which subscription this result belongs to.
	SubscriptionID string
	// Data is the raw JSON result payload for the subscription.
	Data []byte
}

// QuoteIdentifier wraps name in double quotes, doubling any embedded double
// quote so the identifier cannot break out of the quoted context. Both
// PostgreSQL and SQLite use the SQL-standard `"` quoting with `""` escaping,
// so the single helper serves both dialects.
//
// This mirrors the escaping the introspection layer already applies
// (connector/sql/postgres/introspect.go, connector/sql/sqlite/introspect.go),
// closing the second-order injection gap where an actor with DDL rights could
// name a column/table with an embedded `"` and break out of the generated SQL.
func QuoteIdentifier(name string) string {
	if !strings.Contains(name, `"`) {
		return `"` + name + `"`
	}

	return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
}

// WriteQuotedIdentifier writes name to b as a double-quoted SQL identifier,
// doubling any embedded double quote. See QuoteIdentifier for the rationale.
func WriteQuotedIdentifier(b *strings.Builder, name string) {
	if !strings.Contains(name, `"`) {
		b.WriteByte('"')
		b.WriteString(name)
		b.WriteByte('"')

		return
	}

	b.WriteByte('"')
	b.WriteString(strings.ReplaceAll(name, `"`, `""`))
	b.WriteByte('"')
}

// WriteQualifiedColumn writes a properly quoted column reference into b.
// Source must already be quoted (e.g. `"schema"."table"` or `"alias"`); it is
// written verbatim, so an unquoted source produces invalid SQL. An empty
// source writes just the quoted column. The column name is quoted via
// WriteQuotedIdentifier, so an embedded `"` is escaped.
func WriteQualifiedColumn(b *strings.Builder, source, column string) {
	if source == "" {
		WriteQuotedIdentifier(b, column)

		return
	}

	b.WriteString(source)
	b.WriteByte('.')
	WriteQuotedIdentifier(b, column)
}

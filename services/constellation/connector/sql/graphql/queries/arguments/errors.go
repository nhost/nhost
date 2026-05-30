package arguments

import "errors"

// ErrInvalidArgument is the sentinel error wrapped by every validation failure
// emitted by the Parse* functions (e.g. missing required argument, unknown
// argument name, wrong AST kind). Callers (the controller / HTTP layer) can
// use errors.Is to distinguish a 4xx "bad request" from a 5xx server-side
// failure.
var ErrInvalidArgument = errors.New("invalid argument")

// ErrUnsupportedAggregateOrderBy is wrapped when a requested aggregate
// order_by function cannot be rendered faithfully by the active backend. It
// currently fires for the stddev/variance family on SQLite, which has no native
// stddev/variance aggregate; emulating it with the one-pass sum-of-squares
// identity is numerically unstable and would order rows differently from
// PostgreSQL/Hasura, so the ordering is rejected rather than silently wrong.
var ErrUnsupportedAggregateOrderBy = errors.New("unsupported aggregate order_by")

// ErrDistinctOnOrderByMismatch is the sentinel wrapped by a
// *QueryValidationError when a distinct_on argument is combined with an
// order_by whose leading columns do not match the distinct_on columns (same
// columns, same order, as a prefix). Hasura rejects this combination at query
// validation, so Constellation does too rather than silently reconciling it.
var ErrDistinctOnOrderByMismatch = errors.New(
	`"distinct_on" columns must match initial "order_by" columns`,
)

// graphqlCodeValidationFailed is the extensions.code Hasura attaches to query
// validation failures and that Constellation mirrors byte-for-byte.
const graphqlCodeValidationFailed = "validation-failed"

// QueryValidationError is a query-validation failure that must surface to the
// client with the same GraphQL error envelope Hasura produces: an
// extensions.code of "validation-failed" and an extensions.path of
// "$.selectionSet.<rootField>.args". It carries the offending root field name
// (set by the SQL connector once it is known, since the argument parser only
// sees the table) so the controller can render the path verbatim.
//
// It mirrors remoteschema.RemoteError: a trusted, already-shaped GraphQL error
// the controller passes through (via AsMap) instead of sanitising into a trace
// id, so the wire envelope matches Hasura exactly.
type QueryValidationError struct {
	// Err is the wrapped sentinel (e.g. ErrDistinctOnOrderByMismatch); its
	// message is the verbatim Hasura error message.
	Err error
	// RootField is the queried root field (alias or name) used to build the
	// extensions.path. Empty until the SQL connector stamps it.
	RootField string
}

// Error implements error, returning the wrapped sentinel's message verbatim so
// it equals the Hasura message even when further wrapped with call-site
// context.
func (e *QueryValidationError) Error() string {
	return e.Err.Error()
}

// Unwrap exposes the wrapped sentinel so errors.Is(err,
// ErrDistinctOnOrderByMismatch) matches through any call-site wrapping.
func (e *QueryValidationError) Unwrap() error {
	return e.Err
}

// AsMap renders the error in Hasura's GraphQL error response shape: the
// verbatim message plus an extensions block carrying the "validation-failed"
// code and the "$.selectionSet.<rootField>.args" path. No top-level path or
// locations are emitted, matching Hasura.
func (e *QueryValidationError) AsMap() map[string]any {
	return map[string]any{
		"message": e.Err.Error(),
		"extensions": map[string]any{
			"code": graphqlCodeValidationFailed,
			"path": "$.selectionSet." + e.RootField + ".args",
		},
	}
}

// argNameWhere is the GraphQL argument name for the WHERE clause shared by
// delete / insert (on_conflict) / update mutations.
const argNameWhere = "where"

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

var errNegativeLimitOffset = errors.New("limit/offset must be non-negative")

// ErrDistinctOnOrderByMismatch is the sentinel wrapped by a
// *QueryValidationError when a distinct_on argument is combined with an
// order_by whose leading prefix does not contain the distinct_on columns (same
// column set; prefix order is irrelevant). Hasura rejects this combination at
// query validation, so Constellation does too rather than silently reconciling
// it.
var ErrDistinctOnOrderByMismatch = errors.New(
	`"distinct_on" columns must match initial "order_by" columns`,
)

// graphqlCodeValidationFailed is the extensions.code Hasura attaches to query
// validation failures and that Constellation mirrors byte-for-byte.
const graphqlCodeValidationFailed = "validation-failed"

// QueryValidationError is a query-validation failure that must surface to the
// client with the same GraphQL error envelope Hasura produces: an
// extensions.code of "validation-failed" and an extensions.path of
// "$.selectionSet.<fieldPath>.args" (or that path plus the offending argument
// name when Hasura reports an argument-specific failure). It carries the
// offending field path suffix (set by the SQL connector once it is known, since
// the argument parser only sees the table) so the controller can render the
// path verbatim.
//
// It mirrors remoteschema.RemoteError: a trusted, already-shaped GraphQL error
// the controller passes through (via AsMap) instead of sanitising into a trace
// id. The distinct_on/order_by mismatch message intentionally matches Hasura
// byte-for-byte.
type QueryValidationError struct {
	// Err is the wrapped validation error (e.g.
	// ErrDistinctOnOrderByMismatch). Its message is safe to expose to the
	// GraphQL client.
	Err error
	// RootField is the queried field-path suffix used to build extensions.path:
	// the root field alias/name, or that root plus nested ".selectionSet.<field>"
	// hops for relationship arguments. Empty until the SQL connector stamps it.
	RootField string

	argumentName string
}

// Error implements error, returning the wrapped validation message verbatim so
// call-site wrapping can preserve the client-facing text through errors.As.
func (e *QueryValidationError) Error() string {
	return e.Err.Error()
}

// Unwrap exposes the wrapped validation error so errors.Is matches through any
// call-site wrapping.
func (e *QueryValidationError) Unwrap() error {
	return e.Err
}

// AsMap renders the error in Hasura's GraphQL error response shape: the safe
// validation message plus an extensions block carrying the "validation-failed"
// code and the "$.selectionSet.<fieldPath>.args" path. No top-level path or
// locations are emitted, matching Hasura.
func (e *QueryValidationError) AsMap() map[string]any {
	return map[string]any{
		"message": e.Err.Error(),
		"extensions": map[string]any{
			"code": graphqlCodeValidationFailed,
			"path": e.extensionsPath(),
		},
	}
}

func (e *QueryValidationError) extensionsPath() string {
	path := "$.selectionSet." + e.RootField + ".args"
	if e.argumentName != "" {
		path += "." + e.argumentName
	}

	return path
}

type validationMessageError struct {
	message string
	err     error
}

func (e *validationMessageError) Error() string {
	return e.message
}

func (e *validationMessageError) Unwrap() error {
	return e.err
}

// argNameWhere is the GraphQL argument name for the WHERE clause shared by
// delete / insert (on_conflict) / update mutations.
const argNameWhere = "where"

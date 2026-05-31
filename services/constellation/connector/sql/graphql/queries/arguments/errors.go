package arguments

import (
	"errors"
	"fmt"
)

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

// distinctOnOrderByMismatchMessage is the client-facing validation message
// Hasura emits (and Constellation mirrors byte-for-byte) when a distinct_on
// argument is combined with an order_by whose leading prefix does not contain
// the distinct_on columns (same column set; prefix order is irrelevant). Hasura
// rejects this combination at query validation, so Constellation does too
// rather than silently reconciling it.
const distinctOnOrderByMismatchMessage = `"distinct_on" columns must match initial "order_by" columns`

// graphqlCodeValidationFailed is the extensions.code Hasura attaches to query
// validation failures and that Constellation mirrors byte-for-byte.
const graphqlCodeValidationFailed = "validation-failed"

// QueryValidationError is a query-validation failure that must surface to the
// client with the same GraphQL error envelope Hasura produces: an
// extensions.code of "validation-failed" and an extensions.path of
// "$.selectionSet.<fieldPath>.args" (or that path plus the offending argument
// name when Hasura reports an argument-specific failure). Its client-facing
// message and wrapped sentinel errors are private so packages outside
// arguments cannot smuggle arbitrary raw error strings through the controller's
// structured-error bypass.
//
// It mirrors remoteschema.RemoteError: a trusted, already-shaped GraphQL error
// the controller passes through (via AsMap) instead of sanitising into a trace
// id. Constructors in this package are the trust boundary for which validation
// messages are safe to expose.
type QueryValidationError struct {
	message      string
	err          error
	argumentPath string
	argumentName string
}

// newDistinctOnOrderByMismatchError returns the Hasura-compatible validation
// failure emitted when distinct_on columns do not match the leading order_by
// columns.
func newDistinctOnOrderByMismatchError() *QueryValidationError {
	return newQueryValidationError(
		distinctOnOrderByMismatchMessage,
		fmt.Errorf("%w: %s", ErrInvalidArgument, distinctOnOrderByMismatchMessage),
		"",
	)
}

func newNegativeLimitOffsetError(argumentName string) *QueryValidationError {
	message := "unexpected negative value"
	if argumentName == "limit" || argumentName == "offset" {
		message += " for " + argumentName
	} else {
		argumentName = ""
	}

	return newQueryValidationError(
		message,
		fmt.Errorf("%w: limit/offset must be non-negative", ErrInvalidArgument),
		argumentName,
	)
}

func newQueryValidationError(message string, err error, argumentName string) *QueryValidationError {
	if message == "" {
		message = ErrInvalidArgument.Error()
	}

	if err == nil {
		err = ErrInvalidArgument
	}

	return &QueryValidationError{
		message:      message,
		err:          err,
		argumentPath: "",
		argumentName: argumentName,
	}
}

// StampArgumentPath records the GraphQL selection-path suffix used to render
// extensions.path. The first non-empty path wins so a root-field annotation
// cannot overwrite the more specific relationship path stamped deeper in the
// SQL builder.
func (e *QueryValidationError) StampArgumentPath(argumentPath string) {
	if e == nil || e.argumentPath != "" || argumentPath == "" {
		return
	}

	e.argumentPath = argumentPath
}

// Error implements error, returning the safe validation message verbatim so
// call-site wrapping can preserve the client-facing text through errors.As.
func (e *QueryValidationError) Error() string {
	return e.clientMessage()
}

// Unwrap exposes the wrapped validation sentinels so errors.Is matches through
// any call-site wrapping.
func (e *QueryValidationError) Unwrap() error {
	if e == nil {
		return nil
	}

	if e.err == nil {
		return ErrInvalidArgument
	}

	return e.err
}

// AsMap renders the error in Hasura's GraphQL error response shape: the safe
// validation message plus an extensions block carrying the "validation-failed"
// code and the "$.selectionSet.<fieldPath>.args" path. No top-level path or
// locations are emitted, matching Hasura.
func (e *QueryValidationError) AsMap() map[string]any {
	return map[string]any{
		"message": e.clientMessage(),
		"extensions": map[string]any{
			"code": graphqlCodeValidationFailed,
			"path": e.extensionsPath(),
		},
	}
}

func (e *QueryValidationError) clientMessage() string {
	if e == nil || e.message == "" {
		return ErrInvalidArgument.Error()
	}

	return e.message
}

func (e *QueryValidationError) extensionsPath() string {
	path := "$.selectionSet"
	if e != nil && e.argumentPath != "" {
		path += "." + e.argumentPath
	}

	path += ".args"
	if e != nil && e.argumentName != "" {
		path += "." + e.argumentName
	}

	return path
}

// argNameWhere is the GraphQL argument name for the WHERE clause shared by
// delete / insert (on_conflict) / update mutations.
const argNameWhere = "where"

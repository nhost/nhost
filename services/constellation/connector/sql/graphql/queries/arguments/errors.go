package arguments

import (
	"errors"
	"fmt"
)

// ErrInvalidArgument is the sentinel error wrapped by every client-actionable
// argument failure emitted by the Parse* functions (e.g. missing required
// argument, unknown argument name, wrong AST kind, invalid limit/offset).
// Callers (the controller / HTTP layer) can use errors.Is to distinguish a 4xx
// "bad request" from a 5xx server-side failure.
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

const (
	// graphqlCodeValidationFailed is the extensions.code Hasura attaches to query
	// validation failures and that Constellation mirrors byte-for-byte.
	graphqlCodeValidationFailed = "validation-failed"

	// graphqlCodeDataException is the extensions.code Hasura attaches to safe
	// database data exceptions such as a negative OFFSET.
	graphqlCodeDataException = "data-exception"

	negativeLimitMessagePrefix = "expected a non-negative 32-bit integer for type 'Int', but found "
	negativeLimitFoundInteger  = "an integer"
	negativeLimitFoundNumber   = "a number"
	negativeOffsetMessage      = "OFFSET must not be negative"
)

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

// emptyUpdateMessage is the validation message emitted when an update mutation
// supplies no update operator (_set, _inc, _append, _prepend, _delete_key,
// _delete_elem, _delete_at_path). Live Hasura is inconsistent here (a silent
// no-op for the collection field, an empty object for _by_pk, and a SET-less SQL
// syntax error for _many); Constellation rejects all three uniformly with this
// validation-failed error. See KNOWN_DIFFERENCES.md.
const emptyUpdateMessage = "at least one update operator must be provided"

// newEmptyUpdateError returns the validation failure emitted when an update
// mutation targets no column. Surfacing it as a QueryValidationError gives the
// client a clean validation-failed envelope in production instead of a sanitized
// "internal server error".
func newEmptyUpdateError() *QueryValidationError {
	return newQueryValidationError(
		emptyUpdateMessage,
		fmt.Errorf("%w: %s", ErrInvalidArgument, emptyUpdateMessage),
		"",
	)
}

// newDuplicateUpdateColumnError mirrors Hasura's "Column found in multiple
// operators: ['<col>']." validation failure, byte for byte, for a column
// targeted by more than one update operator (e.g. _set and _inc on the column).
func newDuplicateUpdateColumnError(column string) *QueryValidationError {
	message := fmt.Sprintf("Column found in multiple operators: ['%s'].", column)

	return newQueryValidationError(
		message,
		fmt.Errorf("%w: %s", ErrInvalidArgument, message),
		"",
	)
}

func newNegativeLimitOffsetError(argumentName string, found string) error {
	switch argumentName {
	case "limit":
		if found == "" {
			found = negativeLimitFoundInteger
		}

		message := negativeLimitMessagePrefix + found

		return newQueryValidationError(
			message,
			fmt.Errorf("%w: %s", ErrInvalidArgument, message),
			argumentName,
		)
	case "offset":
		return newDataExceptionError(
			negativeOffsetMessage,
			fmt.Errorf("%w: %s", ErrInvalidArgument, negativeOffsetMessage),
		)
	default:
		return newQueryValidationError(
			"unexpected negative value",
			fmt.Errorf("%w: limit/offset must be non-negative", ErrInvalidArgument),
			"",
		)
	}
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

// DataExceptionError is a trusted Hasura-compatible data-exception envelope for
// argument failures whose live Hasura response is shaped like a database
// execution error rather than a validation-failed error. Its fields are private
// so only constructors in this package can expose client-facing messages.
type DataExceptionError struct {
	message string
	err     error
}

func newDataExceptionError(message string, err error) *DataExceptionError {
	if message == "" {
		message = ErrInvalidArgument.Error()
	}

	if err == nil {
		err = ErrInvalidArgument
	}

	return &DataExceptionError{message: message, err: err}
}

// Error implements error, returning the safe data-exception message verbatim so
// call-site wrapping can preserve the client-facing text through errors.As.
func (e *DataExceptionError) Error() string {
	return e.clientMessage()
}

// Unwrap exposes the wrapped argument sentinel so errors.Is matches through any
// call-site wrapping.
func (e *DataExceptionError) Unwrap() error {
	if e == nil {
		return nil
	}

	if e.err == nil {
		return ErrInvalidArgument
	}

	return e.err
}

// AsMap renders the error in Hasura's GraphQL data-exception response shape:
// the safe message plus an extensions block carrying code "data-exception" and
// path "$". No top-level path or locations are emitted, matching Hasura.
func (e *DataExceptionError) AsMap() map[string]any {
	return map[string]any{
		"message": e.clientMessage(),
		"extensions": map[string]any{
			"code": graphqlCodeDataException,
			"path": "$",
		},
	}
}

func (e *DataExceptionError) clientMessage() string {
	if e == nil || e.message == "" {
		return ErrInvalidArgument.Error()
	}

	return e.message
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

// RemapArgumentPath rewrites the already-stamped GraphQL selection-path suffix
// used to render extensions.path. Connector decorators that validate a
// rewritten operation use this to restore the client-facing path before the
// controller serializes the trusted validation error. The mapper cannot change
// the client-facing message or wrapped sentinel, and an empty mapped path leaves
// the original path intact.
func (e *QueryValidationError) RemapArgumentPath(remap func(string) string) {
	if e == nil || e.argumentPath == "" || remap == nil {
		return
	}

	if argumentPath := remap(e.argumentPath); argumentPath != "" {
		e.argumentPath = argumentPath
	}
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

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

// argNameWhere is the GraphQL argument name for the WHERE clause shared by
// delete / insert (on_conflict) / update mutations.
const argNameWhere = "where"

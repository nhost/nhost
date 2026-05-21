package arguments

import "errors"

// ErrInvalidArgument is the sentinel error wrapped by every validation failure
// emitted by the Parse* functions (e.g. missing required argument, unknown
// argument name, wrong AST kind). Callers (the controller / HTTP layer) can
// use errors.Is to distinguish a 4xx "bad request" from a 5xx server-side
// failure.
var ErrInvalidArgument = errors.New("invalid argument")

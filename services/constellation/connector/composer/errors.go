package composer

import "errors"

// ErrMissingConnector is returned when metadata references a database or
// remote schema that has no corresponding connector registered with the
// composer.
var ErrMissingConnector = errors.New("missing connector")

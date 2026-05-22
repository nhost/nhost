package schemamerge

import "errors"

// ErrConflictingEnum is returned when two connectors expose an enum with the
// same name but a different value set.
var ErrConflictingEnum = errors.New("enum has conflicting definitions")

// ErrConflictingInput is returned when two connectors expose an input object
// with the same name but a structurally different shape.
var ErrConflictingInput = errors.New("input has conflicting definitions")

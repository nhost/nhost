package schemamerge

import "errors"

// ErrConflictingEnum is returned when two connectors expose an enum with the
// same name but a different value set.
var ErrConflictingEnum = errors.New("enum has conflicting definitions")

// ErrConflictingInput is returned when two connectors expose an input object
// with the same name but a structurally different shape.
var ErrConflictingInput = errors.New("input has conflicting definitions")

// ErrConflictingObject is returned when two connectors expose an object type
// with the same name but a structurally different shape.
var ErrConflictingObject = errors.New("object type has conflicting definitions")

// ErrConflictingInterface is returned when two connectors expose an interface
// with the same name but a structurally different shape.
var ErrConflictingInterface = errors.New("interface has conflicting definitions")

// ErrConflictingUnion is returned when two connectors expose a union with the
// same name but a different member set.
var ErrConflictingUnion = errors.New("union has conflicting definitions")

// ErrConflictingDirective is returned when two connectors expose a directive
// with the same name but a structurally different definition.
var ErrConflictingDirective = errors.New("directive has conflicting definitions")

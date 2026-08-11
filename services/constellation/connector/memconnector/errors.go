package memconnector

import "errors"

// ErrDuplicateQueryDef is returned by New when the same QueryDef name is
// supplied more than once.
var ErrDuplicateQueryDef = errors.New("memconnector: duplicate QueryDef name")

// ErrNonFieldSelection is returned by Execute when an operation's root
// selection set contains a non-Field selection (fragment spread or inline
// fragment), which the in-memory connector does not support.
var ErrNonFieldSelection = errors.New("memconnector: non-Field selection at root")

// ErrUnknownField is returned by Execute when the operation selects a root
// field that has no canned response registered with the connector.
var ErrUnknownField = errors.New("memconnector: no canned response registered for field")

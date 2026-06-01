package websocket

import "errors"

var (
	errConnectionInitTimeout = errors.New("connection_init timeout")
	errConnectionInitFailed  = errors.New("connection_init failed")
	errConnectionExpired     = errors.New("connection expired")
	errCouldNotReadMessage   = errors.New("could not read message")
	errInvalidMessageFormat  = errors.New("invalid message format")
)

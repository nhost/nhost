package websocket

import "errors"

var (
	errConnectionInitTimeout     = errors.New("connection_init timeout")
	errConnectionInitFailed      = errors.New("connection_init failed")
	errConnectionExpired         = errors.New("connection expired")
	errConnectionLivenessTimeout = errors.New("connection liveness timeout")
	errDuplicateConnectionInit   = errors.New("duplicate connection_init")
	errSubscribeBeforeInit       = errors.New("subscribe received before connection_init")
	errCouldNotReadMessage       = errors.New("could not read message")
	errInvalidMessageFormat      = errors.New("invalid message format")
)

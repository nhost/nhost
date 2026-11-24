package server

import (
	"encoding/json"
	"net/http"
)

// jsonrpcErrorResponseWriter is the minimum surface needed by
// writeJSONRPCError to emit a JSON-RPC error response onto an HTTP-style
// transport. Both http.ResponseWriter and HTTPResponseWriter satisfy this
// interface, so the same helper serves the SSE and streamable HTTP
// transports.
type jsonrpcErrorResponseWriter interface {
	Header() http.Header
	WriteHeader(statusCode int)
	Write(p []byte) (int, error)
}

// writeJSONRPCError encodes a JSON-RPC error response identified by id with
// the given code and message and writes it to w with HTTP status 400 Bad
// Request and Content-Type application/json. If JSON encoding fails and
// onEncodeErr is non-nil, it is invoked with the encode error so callers
// can decide how to report the failure (e.g. log it, escalate to HTTP 500).
func writeJSONRPCError(
	w jsonrpcErrorResponseWriter,
	id any,
	code int,
	message string,
	onEncodeErr func(error),
) {
	writeJSONRPCErrorStatus(w, http.StatusBadRequest, id, code, message, onEncodeErr)
}

// writeJSONRPCErrorStatus is writeJSONRPCError with the HTTP status given.
func writeJSONRPCErrorStatus(
	w jsonrpcErrorResponseWriter,
	status int,
	id any,
	code int,
	message string,
	onEncodeErr func(error),
) {
	response := createErrorResponse(id, code, message)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(response); err != nil && onEncodeErr != nil {
		onEncodeErr(err)
	}
}

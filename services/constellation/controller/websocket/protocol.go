package websocket

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"fmt"
	"log/slog"
)

// graphql-transport-ws protocol message types
// https://github.com/enisdenjo/graphql-ws/blob/master/PROTOCOL.md
const (
	// messageTypeConnectionInit initiates the connection (Client -> Server).
	messageTypeConnectionInit = "connection_init"
	messageTypePing           = "ping"
	messageTypePong           = "pong"
	messageTypeSubscribe      = "subscribe"
	messageTypeComplete       = "complete"

	// messageTypeConnectionAck acknowledges the connection (Server -> Client).
	messageTypeConnectionAck = "connection_ack"
	messageTypeNext          = "next"
	messageTypeError         = "error"
)

const (
	closeCodeUnauthorized                    = 4401
	closeCodeTooManyInitialisationRequests   = 4429
	closeReasonUnauthorized                  = "Unauthorized"
	closeReasonTooManyInitialisationRequests = "Too many initialisation requests"
)

// Message represents a graphql-ws protocol message.
type Message struct {
	ID      string         `json:"id,omitempty"`
	Type    string         `json:"type"`
	Payload jsontext.Value `json:"payload,omitempty"`
}

// SubscribePayload is the payload for subscribe messages.
type SubscribePayload struct {
	OperationName string         `json:"operationName,omitempty"`
	Query         string         `json:"query"`
	Variables     map[string]any `json:"variables,omitempty"`
	Extensions    map[string]any `json:"extensions,omitempty"`
}

// executionResult represents the result of a GraphQL execution.
type executionResult struct {
	Data   any `json:"data,omitzero"`
	Errors any `json:"errors,omitempty"`
}

func newConnectionAckMessage() *Message {
	return &Message{ID: "", Type: messageTypeConnectionAck, Payload: nil}
}

// NewNextMessage creates a next message with execution result.
func NewNextMessage(id string, data any, errors any) *Message {
	payload, err := json.Marshal(executionResult{Data: data, Errors: errors})
	if err != nil {
		slog.Error("failed to marshal next message payload", slog.String("error", err.Error()))

		return newErrorMessage(id, fmt.Sprintf("internal error: failed to marshal result: %v", err))
	}

	return &Message{ID: id, Type: messageTypeNext, Payload: payload}
}

// NewErrorMessage creates an error message.
func NewErrorMessage(id string, errs []map[string]any) *Message {
	payload, err := json.Marshal(errs)
	if err != nil {
		slog.Error("failed to marshal error message payload", slog.String("error", err.Error()))

		return newErrorMessage(id, fmt.Sprintf("internal error: failed to marshal errors: %v", err))
	}

	return &Message{ID: id, Type: messageTypeError, Payload: payload}
}

// newErrorMessage creates a simple error message with a single error string.
// This is the last-resort fallback for NewNextMessage / NewErrorMessage when
// their primary marshal fails. If even this second marshal fails we log it and
// fall back to a hard-coded JSON literal so we never ship an empty payload.
func newErrorMessage(id string, msg string) *Message {
	payload, err := json.Marshal([]map[string]any{{"message": msg}})
	if err != nil {
		slog.Error(
			"failed to marshal fallback error payload",
			slog.String("error", err.Error()),
			slog.String("message", msg),
		)

		payload = jsontext.Value(`[{"message":"internal error"}]`)
	}

	return &Message{ID: id, Type: messageTypeError, Payload: payload}
}

func newPingMessage() *Message {
	return &Message{ID: "", Type: messageTypePing, Payload: nil}
}

func newPongMessage() *Message {
	return &Message{ID: "", Type: messageTypePong, Payload: nil}
}

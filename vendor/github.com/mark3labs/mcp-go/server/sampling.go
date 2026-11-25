package server

import (
	"context"
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"
)

// EnableSampling enables sampling capabilities for the server.
// This allows the server to send sampling requests to clients that support it.
func (s *MCPServer) EnableSampling() {
	s.capabilitiesMu.Lock()
	defer s.capabilitiesMu.Unlock()

	enabled := true
	s.capabilities.sampling = &enabled
}

// RequestSampling sends a sampling request to the client.
// The client must have declared sampling capability during initialization.
//
// Protocol version 2026-07-28 removed server-initiated requests (SEP-2322):
// against a client using that version or later, a handler must instead return
// an input_required result carrying the request. Use [InputRequestBuilder] to
// build one; the same handler still works with older clients, because this
// package issues the server-initiated request on their behalf.
//
// Deprecated: the Sampling feature is deprecated as of protocol version
// 2026-07-28 (SEP-2577). Integrate with an LLM provider API directly.
func (s *MCPServer) RequestSampling(ctx context.Context, request mcp.CreateMessageRequest) (*mcp.CreateMessageResult, error) {
	// An in-process handler is a direct function call rather than a protocol
	// message, so it is unaffected by the removal of server-initiated
	// requests.
	if handler := InProcessSamplingHandlerFromContext(ctx); handler != nil {
		return handler.CreateMessage(ctx, request)
	}

	if err := s.assertServerInitiatedRequestAllowed(ctx, mcp.MethodSamplingCreateMessage); err != nil {
		return nil, err
	}

	session := ClientSessionFromContext(ctx)
	if session == nil {
		return nil, fmt.Errorf("no active session")
	}

	// Check if the session supports sampling requests
	if samplingSession, ok := session.(SessionWithSampling); ok {
		return samplingSession.RequestSampling(ctx, request)
	}

	return nil, fmt.Errorf("session does not support sampling")
}

// SessionWithSampling extends ClientSession to support sampling requests.
type SessionWithSampling interface {
	ClientSession
	RequestSampling(ctx context.Context, request mcp.CreateMessageRequest) (*mcp.CreateMessageResult, error)
}

// inProcessSamplingHandlerKey is the context key for storing inprocess sampling handler
type inProcessSamplingHandlerKey struct{}

// WithInProcessSamplingHandler adds a sampling handler to the context for inprocess clients
func WithInProcessSamplingHandler(ctx context.Context, handler SamplingHandler) context.Context {
	return context.WithValue(ctx, inProcessSamplingHandlerKey{}, handler)
}

// InProcessSamplingHandlerFromContext retrieves the inprocess sampling handler from context
func InProcessSamplingHandlerFromContext(ctx context.Context) SamplingHandler {
	if handler, ok := ctx.Value(inProcessSamplingHandlerKey{}).(SamplingHandler); ok {
		return handler
	}
	return nil
}

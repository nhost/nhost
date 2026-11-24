package server

import (
	"context"
	"errors"

	"github.com/mark3labs/mcp-go/mcp"
)

var (
	// ErrNoActiveSession is returned when there is no active session in the context
	ErrNoActiveSession = errors.New("no active session")
	// ErrElicitationNotSupported is returned when the session does not support elicitation
	ErrElicitationNotSupported = errors.New("session does not support elicitation")
)

// RequestElicitation sends an elicitation request to the client.
// The client must have declared elicitation capability during initialization.
// The session must implement SessionWithElicitation to support this operation.
func (s *MCPServer) RequestElicitation(ctx context.Context, request mcp.ElicitationRequest) (*mcp.ElicitationResult, error) {
	if err := s.assertServerInitiatedRequestAllowed(ctx, mcp.MethodElicitationCreate); err != nil {
		return nil, err
	}

	session := ClientSessionFromContext(ctx)
	if session == nil {
		return nil, ErrNoActiveSession
	}

	// Check if the session supports elicitation requests
	if elicitationSession, ok := session.(SessionWithElicitation); ok {
		if err := request.Params.Validate(); err != nil {
			return nil, err
		}
		return elicitationSession.RequestElicitation(ctx, request)
	}

	return nil, ErrElicitationNotSupported
}

// RequestURLElicitation sends a URL mode elicitation request to the client.
// This is used when the server needs the user to perform an out-of-band interaction.
func (s *MCPServer) RequestURLElicitation(
	ctx context.Context,
	session ClientSession,
	elicitationID string,
	url string,
	message string,
) (*mcp.ElicitationResult, error) {
	// URL mode sends the same elicitation/create request, so it is subject to
	// the same restriction: server-initiated requests were replaced by multi
	// round-trip requests in protocol version 2026-07-28 (SEP-2322).
	if err := s.assertServerInitiatedRequestAllowed(ctx, mcp.MethodElicitationCreate); err != nil {
		return nil, err
	}

	if session == nil {
		return nil, ErrNoActiveSession
	}

	params := mcp.ElicitationParams{
		Mode:          mcp.ElicitationModeURL,
		Message:       message,
		ElicitationID: elicitationID,
		URL:           url,
	}

	if err := params.Validate(); err != nil {
		return nil, err
	}

	request := mcp.ElicitationRequest{
		Request: mcp.Request{
			Method: string(mcp.MethodElicitationCreate),
		},
		Params: params,
	}

	if elicitationSession, ok := session.(SessionWithElicitation); ok {
		return elicitationSession.RequestElicitation(ctx, request)
	}
	return nil, ErrElicitationNotSupported
}

// SendElicitationComplete sends a notification that a URL mode elicitation has completed
// SendElicitationComplete sends a notification that a URL mode elicitation has completed
func (s *MCPServer) SendElicitationComplete(
	ctx context.Context,
	session ClientSession,
	elicitationID string,
) error {
	if session == nil {
		return ErrNoActiveSession
	}

	jsonRPCNotif := mcp.NewElicitationCompleteNotification(elicitationID)
	return s.sendNotificationCore(ctx, session, jsonRPCNotif)
}

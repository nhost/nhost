package client

import (
	"context"
	"fmt"

	"github.com/mark3labs/mcp-go/client/transport"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// NewInProcessClient connect directly to a mcp server object in the same process
func NewInProcessClient(server *server.MCPServer) (*Client, error) {
	inProcessTransport := transport.NewInProcessTransport(server)
	return NewClient(inProcessTransport), nil
}

// NewInProcessClientWithOptions connects directly to an MCP server and applies
// client options, including sampling, elicitation, and roots handlers, to the
// in-process transport.
func NewInProcessClientWithOptions(mcpServer *server.MCPServer, options ...ClientOption) (*Client, error) {
	client := NewClient(nil, options...)
	var transportOptions []transport.InProcessOption
	if client.samplingHandler != nil {
		transportOptions = append(transportOptions, transport.WithSamplingHandler(
			&inProcessSamplingHandlerWrapper{handler: client.samplingHandler},
		))
	}
	if client.elicitationHandler != nil {
		transportOptions = append(transportOptions, transport.WithElicitationHandler(
			&inProcessElicitationHandlerAdapter{handler: client.elicitationHandler},
		))
	}
	if client.rootsHandler != nil {
		transportOptions = append(transportOptions, transport.WithRootsHandler(
			&inProcessRootsHandlerAdapter{handler: client.rootsHandler},
		))
	}

	client.transport = transport.NewInProcessTransportWithOptions(mcpServer, transportOptions...)
	return client, nil
}

// NewInProcessClientWithSamplingHandler creates an in-process client with sampling support
func NewInProcessClientWithSamplingHandler(server *server.MCPServer, handler SamplingHandler) (*Client, error) {
	// Create a wrapper that implements server.SamplingHandler
	serverHandler := &inProcessSamplingHandlerWrapper{handler: handler}

	inProcessTransport := transport.NewInProcessTransportWithOptions(server,
		transport.WithSamplingHandler(serverHandler))

	client := NewClient(inProcessTransport)
	client.samplingHandler = handler

	return client, nil
}

// inProcessSamplingHandlerWrapper wraps client.SamplingHandler to implement server.SamplingHandler
type inProcessSamplingHandlerWrapper struct {
	handler SamplingHandler
}

func (w *inProcessSamplingHandlerWrapper) CreateMessage(ctx context.Context, request mcp.CreateMessageRequest) (*mcp.CreateMessageResult, error) {
	result, err := w.handler.CreateMessage(ctx, request)
	if err == nil && result == nil {
		return nil, fmt.Errorf("sampling handler returned no result")
	}
	return result, err
}

type inProcessElicitationHandlerAdapter struct {
	handler ElicitationHandler
}

func (a *inProcessElicitationHandlerAdapter) Elicit(ctx context.Context, request mcp.ElicitationRequest) (*mcp.ElicitationResult, error) {
	result, err := a.handler.Elicit(ctx, request)
	if err == nil && result == nil {
		return nil, fmt.Errorf("elicitation handler returned no result")
	}
	return result, err
}

type inProcessRootsHandlerAdapter struct {
	handler RootsHandler
}

func (a *inProcessRootsHandlerAdapter) ListRoots(ctx context.Context, request mcp.ListRootsRequest) (*mcp.ListRootsResult, error) {
	result, err := a.handler.ListRoots(ctx, request)
	if err == nil && result == nil {
		return nil, fmt.Errorf("roots handler returned no result")
	}
	return result, err
}

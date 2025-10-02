package client

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"sync"
	"sync/atomic"

	"github.com/mark3labs/mcp-go/client/transport"
	"github.com/mark3labs/mcp-go/mcp"
)

// Client implements the MCP client.
type Client struct {
	transport transport.Interface

	initialized        bool
	notifications      []func(mcp.JSONRPCNotification)
	notifyMu           sync.RWMutex
	requestID          atomic.Int64
	clientCapabilities mcp.ClientCapabilities
	serverCapabilities mcp.ServerCapabilities
	protocolVersion    string
	samplingHandler    SamplingHandler
	elicitationHandler ElicitationHandler
}

type ClientOption func(*Client)

// WithClientCapabilities sets the client capabilities for the client.
func WithClientCapabilities(capabilities mcp.ClientCapabilities) ClientOption {
	return func(c *Client) {
		c.clientCapabilities = capabilities
	}
}

// WithSamplingHandler sets the sampling handler for the client.
// When set, the client will declare sampling capability during initialization.
func WithSamplingHandler(handler SamplingHandler) ClientOption {
	return func(c *Client) {
		c.samplingHandler = handler
	}
}

// WithElicitationHandler sets the elicitation handler for the client.
// When set, the client will declare elicitation capability during initialization.
func WithElicitationHandler(handler ElicitationHandler) ClientOption {
	return func(c *Client) {
		c.elicitationHandler = handler
	}
}

// WithSession assumes a MCP Session has already been initialized
func WithSession() ClientOption {
	return func(c *Client) {
		c.initialized = true
	}
}

// NewClient creates a new MCP client with the given transport.
// Usage:
//
//	stdio := transport.NewStdio("./mcp_server", nil, "xxx")
//	client, err := NewClient(stdio)
//	if err != nil {
//	    log.Fatalf("Failed to create client: %v", err)
//	}
func NewClient(transport transport.Interface, options ...ClientOption) *Client {
	client := &Client{
		transport: transport,
	}

	for _, opt := range options {
		opt(client)
	}

	return client
}

// Start initiates the connection to the server.
// Must be called before using the client.
func (c *Client) Start(ctx context.Context) error {
	if c.transport == nil {
		return fmt.Errorf("transport is nil")
	}

	if _, ok := c.transport.(*transport.Stdio); !ok {
		// the stdio transport from NewStdioMCPClientWithOptions
		// is already started, dont start again.
		//
		// Start the transport for other transport types
		err := c.transport.Start(ctx)
		if err != nil {
			return err
		}
	}

	c.transport.SetNotificationHandler(func(notification mcp.JSONRPCNotification) {
		c.notifyMu.RLock()
		defer c.notifyMu.RUnlock()
		for _, handler := range c.notifications {
			handler(notification)
		}
	})

	// Set up request handler for bidirectional communication (e.g., sampling)
	if bidirectional, ok := c.transport.(transport.BidirectionalInterface); ok {
		bidirectional.SetRequestHandler(c.handleIncomingRequest)
	}

	return nil
}

// Close shuts down the client and closes the transport.
func (c *Client) Close() error {
	return c.transport.Close()
}

// OnNotification registers a handler function to be called when notifications are received.
// Multiple handlers can be registered and will be called in the order they were added.
func (c *Client) OnNotification(
	handler func(notification mcp.JSONRPCNotification),
) {
	c.notifyMu.Lock()
	defer c.notifyMu.Unlock()
	c.notifications = append(c.notifications, handler)
}

// OnConnectionLost registers a handler function to be called when the connection is lost.
// This is useful for handling HTTP2 idle timeout disconnections that should not be treated as errors.
func (c *Client) OnConnectionLost(handler func(error)) {
	type connectionLostSetter interface {
		SetConnectionLostHandler(func(error))
	}
	if setter, ok := c.transport.(connectionLostSetter); ok {
		setter.SetConnectionLostHandler(handler)
	}
}

// sendRequest sends a JSON-RPC request to the server and waits for a response.
// Returns the raw JSON response message or an error if the request fails.
func (c *Client) sendRequest(
	ctx context.Context,
	method string,
	params any,
) (*json.RawMessage, error) {
	if !c.initialized && method != "initialize" {
		return nil, fmt.Errorf("client not initialized")
	}

	id := c.requestID.Add(1)

	request := transport.JSONRPCRequest{
		JSONRPC: mcp.JSONRPC_VERSION,
		ID:      mcp.NewRequestId(id),
		Method:  method,
		Params:  params,
	}

	response, err := c.transport.SendRequest(ctx, request)
	if err != nil {
		return nil, transport.NewError(err)
	}

	if response.Error != nil {
		return nil, response.Error.AsError()
	}

	return &response.Result, nil
}

// Initialize negotiates with the server.
// Must be called after Start, and before any request methods.
func (c *Client) Initialize(
	ctx context.Context,
	request mcp.InitializeRequest,
) (*mcp.InitializeResult, error) {
	// Merge client capabilities with sampling capability if handler is configured
	capabilities := request.Params.Capabilities
	if c.samplingHandler != nil {
		capabilities.Sampling = &struct{}{}
	}
	// Add elicitation capability if handler is configured
	if c.elicitationHandler != nil {
		capabilities.Elicitation = &struct{}{}
	}

	// Ensure we send a params object with all required fields
	params := struct {
		ProtocolVersion string                 `json:"protocolVersion"`
		ClientInfo      mcp.Implementation     `json:"clientInfo"`
		Capabilities    mcp.ClientCapabilities `json:"capabilities"`
	}{
		ProtocolVersion: request.Params.ProtocolVersion,
		ClientInfo:      request.Params.ClientInfo,
		Capabilities:    capabilities,
	}

	response, err := c.sendRequest(ctx, "initialize", params)
	if err != nil {
		return nil, err
	}

	var result mcp.InitializeResult
	if err := json.Unmarshal(*response, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	// Validate protocol version
	if !slices.Contains(mcp.ValidProtocolVersions, result.ProtocolVersion) {
		return nil, mcp.UnsupportedProtocolVersionError{Version: result.ProtocolVersion}
	}

	// Store serverCapabilities and protocol version
	c.serverCapabilities = result.Capabilities
	c.protocolVersion = result.ProtocolVersion

	// Set protocol version on HTTP transports
	if httpConn, ok := c.transport.(transport.HTTPConnection); ok {
		httpConn.SetProtocolVersion(result.ProtocolVersion)
	}

	// Send initialized notification
	notification := mcp.JSONRPCNotification{
		JSONRPC: mcp.JSONRPC_VERSION,
		Notification: mcp.Notification{
			Method: "notifications/initialized",
		},
	}

	err = c.transport.SendNotification(ctx, notification)
	if err != nil {
		return nil, fmt.Errorf(
			"failed to send initialized notification: %w",
			err,
		)
	}

	c.initialized = true
	return &result, nil
}

func (c *Client) Ping(ctx context.Context) error {
	_, err := c.sendRequest(ctx, "ping", nil)
	return err
}

// ListResourcesByPage manually list resources by page.
func (c *Client) ListResourcesByPage(
	ctx context.Context,
	request mcp.ListResourcesRequest,
) (*mcp.ListResourcesResult, error) {
	result, err := listByPage[mcp.ListResourcesResult](ctx, c, request.PaginatedRequest, "resources/list")
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (c *Client) ListResources(
	ctx context.Context,
	request mcp.ListResourcesRequest,
) (*mcp.ListResourcesResult, error) {
	result, err := c.ListResourcesByPage(ctx, request)
	if err != nil {
		return nil, err
	}
	for result.NextCursor != "" {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
			request.Params.Cursor = result.NextCursor
			newPageRes, err := c.ListResourcesByPage(ctx, request)
			if err != nil {
				return nil, err
			}
			result.Resources = append(result.Resources, newPageRes.Resources...)
			result.NextCursor = newPageRes.NextCursor
		}
	}
	return result, nil
}

func (c *Client) ListResourceTemplatesByPage(
	ctx context.Context,
	request mcp.ListResourceTemplatesRequest,
) (*mcp.ListResourceTemplatesResult, error) {
	result, err := listByPage[mcp.ListResourceTemplatesResult](ctx, c, request.PaginatedRequest, "resources/templates/list")
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (c *Client) ListResourceTemplates(
	ctx context.Context,
	request mcp.ListResourceTemplatesRequest,
) (*mcp.ListResourceTemplatesResult, error) {
	result, err := c.ListResourceTemplatesByPage(ctx, request)
	if err != nil {
		return nil, err
	}
	for result.NextCursor != "" {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
			request.Params.Cursor = result.NextCursor
			newPageRes, err := c.ListResourceTemplatesByPage(ctx, request)
			if err != nil {
				return nil, err
			}
			result.ResourceTemplates = append(result.ResourceTemplates, newPageRes.ResourceTemplates...)
			result.NextCursor = newPageRes.NextCursor
		}
	}
	return result, nil
}

func (c *Client) ReadResource(
	ctx context.Context,
	request mcp.ReadResourceRequest,
) (*mcp.ReadResourceResult, error) {
	response, err := c.sendRequest(ctx, "resources/read", request.Params)
	if err != nil {
		return nil, err
	}

	return mcp.ParseReadResourceResult(response)
}

func (c *Client) Subscribe(
	ctx context.Context,
	request mcp.SubscribeRequest,
) error {
	_, err := c.sendRequest(ctx, "resources/subscribe", request.Params)
	return err
}

func (c *Client) Unsubscribe(
	ctx context.Context,
	request mcp.UnsubscribeRequest,
) error {
	_, err := c.sendRequest(ctx, "resources/unsubscribe", request.Params)
	return err
}

func (c *Client) ListPromptsByPage(
	ctx context.Context,
	request mcp.ListPromptsRequest,
) (*mcp.ListPromptsResult, error) {
	result, err := listByPage[mcp.ListPromptsResult](ctx, c, request.PaginatedRequest, "prompts/list")
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (c *Client) ListPrompts(
	ctx context.Context,
	request mcp.ListPromptsRequest,
) (*mcp.ListPromptsResult, error) {
	result, err := c.ListPromptsByPage(ctx, request)
	if err != nil {
		return nil, err
	}
	for result.NextCursor != "" {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
			request.Params.Cursor = result.NextCursor
			newPageRes, err := c.ListPromptsByPage(ctx, request)
			if err != nil {
				return nil, err
			}
			result.Prompts = append(result.Prompts, newPageRes.Prompts...)
			result.NextCursor = newPageRes.NextCursor
		}
	}
	return result, nil
}

func (c *Client) GetPrompt(
	ctx context.Context,
	request mcp.GetPromptRequest,
) (*mcp.GetPromptResult, error) {
	response, err := c.sendRequest(ctx, "prompts/get", request.Params)
	if err != nil {
		return nil, err
	}

	return mcp.ParseGetPromptResult(response)
}

func (c *Client) ListToolsByPage(
	ctx context.Context,
	request mcp.ListToolsRequest,
) (*mcp.ListToolsResult, error) {
	result, err := listByPage[mcp.ListToolsResult](ctx, c, request.PaginatedRequest, "tools/list")
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (c *Client) ListTools(
	ctx context.Context,
	request mcp.ListToolsRequest,
) (*mcp.ListToolsResult, error) {
	result, err := c.ListToolsByPage(ctx, request)
	if err != nil {
		return nil, err
	}
	for result.NextCursor != "" {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
			request.Params.Cursor = result.NextCursor
			newPageRes, err := c.ListToolsByPage(ctx, request)
			if err != nil {
				return nil, err
			}
			result.Tools = append(result.Tools, newPageRes.Tools...)
			result.NextCursor = newPageRes.NextCursor
		}
	}
	return result, nil
}

func (c *Client) CallTool(
	ctx context.Context,
	request mcp.CallToolRequest,
) (*mcp.CallToolResult, error) {
	response, err := c.sendRequest(ctx, "tools/call", request.Params)
	if err != nil {
		return nil, err
	}

	return mcp.ParseCallToolResult(response)
}

func (c *Client) SetLevel(
	ctx context.Context,
	request mcp.SetLevelRequest,
) error {
	_, err := c.sendRequest(ctx, "logging/setLevel", request.Params)
	return err
}

func (c *Client) Complete(
	ctx context.Context,
	request mcp.CompleteRequest,
) (*mcp.CompleteResult, error) {
	response, err := c.sendRequest(ctx, "completion/complete", request.Params)
	if err != nil {
		return nil, err
	}

	var result mcp.CompleteResult
	if err := json.Unmarshal(*response, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &result, nil
}

// handleIncomingRequest processes incoming requests from the server.
// This is the main entry point for server-to-client requests like sampling and elicitation.
func (c *Client) handleIncomingRequest(ctx context.Context, request transport.JSONRPCRequest) (*transport.JSONRPCResponse, error) {
	switch request.Method {
	case string(mcp.MethodSamplingCreateMessage):
		return c.handleSamplingRequestTransport(ctx, request)
	case string(mcp.MethodElicitationCreate):
		return c.handleElicitationRequestTransport(ctx, request)
	case string(mcp.MethodPing):
		return c.handlePingRequestTransport(ctx, request)
	default:
		return nil, fmt.Errorf("unsupported request method: %s", request.Method)
	}
}

// handleSamplingRequestTransport handles sampling requests at the transport level.
func (c *Client) handleSamplingRequestTransport(ctx context.Context, request transport.JSONRPCRequest) (*transport.JSONRPCResponse, error) {
	if c.samplingHandler == nil {
		return nil, fmt.Errorf("no sampling handler configured")
	}

	// Parse the request parameters
	var params mcp.CreateMessageParams
	if request.Params != nil {
		paramsBytes, err := json.Marshal(request.Params)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal params: %w", err)
		}
		if err := json.Unmarshal(paramsBytes, &params); err != nil {
			return nil, fmt.Errorf("failed to unmarshal params: %w", err)
		}
	}

	// Create the MCP request
	mcpRequest := mcp.CreateMessageRequest{
		Request: mcp.Request{
			Method: string(mcp.MethodSamplingCreateMessage),
		},
		CreateMessageParams: params,
	}

	// Call the sampling handler
	result, err := c.samplingHandler.CreateMessage(ctx, mcpRequest)
	if err != nil {
		return nil, err
	}

	// Marshal the result
	resultBytes, err := json.Marshal(result)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal result: %w", err)
	}

	// Create the transport response
	response := transport.NewJSONRPCResultResponse(request.ID, json.RawMessage(resultBytes))

	return response, nil
}

// handleElicitationRequestTransport handles elicitation requests at the transport level.
func (c *Client) handleElicitationRequestTransport(ctx context.Context, request transport.JSONRPCRequest) (*transport.JSONRPCResponse, error) {
	if c.elicitationHandler == nil {
		return nil, fmt.Errorf("no elicitation handler configured")
	}

	// Parse the request parameters
	var params mcp.ElicitationParams
	if request.Params != nil {
		paramsBytes, err := json.Marshal(request.Params)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal params: %w", err)
		}
		if err := json.Unmarshal(paramsBytes, &params); err != nil {
			return nil, fmt.Errorf("failed to unmarshal params: %w", err)
		}
	}

	// Create the MCP request
	mcpRequest := mcp.ElicitationRequest{
		Request: mcp.Request{
			Method: string(mcp.MethodElicitationCreate),
		},
		Params: params,
	}

	// Call the elicitation handler
	result, err := c.elicitationHandler.Elicit(ctx, mcpRequest)
	if err != nil {
		return nil, err
	}

	// Marshal the result
	resultBytes, err := json.Marshal(result)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal result: %w", err)
	}

	// Create the transport response
	response := transport.NewJSONRPCResultResponse(request.ID, resultBytes)

	return response, nil
}

func (c *Client) handlePingRequestTransport(ctx context.Context, request transport.JSONRPCRequest) (*transport.JSONRPCResponse, error) {
	b, _ := json.Marshal(&mcp.EmptyResult{})
	return transport.NewJSONRPCResultResponse(request.ID, b), nil
}

func listByPage[T any](
	ctx context.Context,
	client *Client,
	request mcp.PaginatedRequest,
	method string,
) (*T, error) {
	response, err := client.sendRequest(ctx, method, request.Params)
	if err != nil {
		return nil, err
	}
	var result T
	if err := json.Unmarshal(*response, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}
	return &result, nil
}

// Helper methods

// GetTransport gives access to the underlying transport layer.
// Cast it to the specific transport type and obtain the other helper methods.
func (c *Client) GetTransport() transport.Interface {
	return c.transport
}

// GetServerCapabilities returns the server capabilities.
func (c *Client) GetServerCapabilities() mcp.ServerCapabilities {
	return c.serverCapabilities
}

// GetClientCapabilities returns the client capabilities.
func (c *Client) GetClientCapabilities() mcp.ClientCapabilities {
	return c.clientCapabilities
}

// GetSessionId returns the session ID of the transport.
// If the transport does not support sessions, it returns an empty string.
func (c *Client) GetSessionId() string {
	if c.transport == nil {
		return ""
	}
	return c.transport.GetSessionId()
}

// IsInitialized returns true if the client has been initialized.
func (c *Client) IsInitialized() bool {
	return c.initialized
}

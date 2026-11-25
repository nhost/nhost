package transport

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
)

// SSE implements the transport layer of the MCP protocol using Server-Sent Events (SSE).
// It maintains a persistent HTTP connection to receive server-pushed events
// while sending requests over regular HTTP POST calls. The client handles
// automatic reconnection and message routing between requests and responses.
type SSE struct {
	baseURL        *url.URL
	endpoint       *url.URL
	httpClient     *http.Client
	responses      map[string]chan *JSONRPCResponse
	mu             sync.RWMutex
	onNotification func(mcp.JSONRPCNotification)
	notifyMu       sync.RWMutex
	headers        map[string]string
	headerFunc     HTTPHeaderFunc
	host           string
	logger         *slog.Logger

	// startMu protects startDone. Concurrent Start calls share one active
	// handshake and may cancel independently; Start and Close must not
	// overlap.
	startMu   sync.Mutex
	startDone chan struct{}

	// lifecycleMu serializes the closed transition with canceler publication.
	// Start publishes the stream canceler under it and Close flips closed and
	// reads the canceler under it, so an in-flight start cannot escape
	// shutdown with a live request context.
	lifecycleMu sync.Mutex

	started          atomic.Bool
	closed           atomic.Bool
	cancelSSEStream  context.CancelFunc
	protocolVersion  atomic.Value // string
	onConnectionLost func(error)
	connectionLostMu sync.RWMutex

	endpointTimeout time.Duration
	responseTimeout time.Duration
	maxMessageBytes int64

	// OAuth support
	oauthHandler *OAuthHandler
}

// ClientOption configures an SSE transport client.
type ClientOption func(*SSE)

// WithMaxMessageBytes bounds the size of the data of one event the client
// reads from the server's SSE stream. A larger event ends the stream, and the
// connection-lost handler gets ErrMessageTooLarge. The default is
// DefaultMaxMessageBytes; zero or less removes the bound.
func WithMaxMessageBytes(n int64) ClientOption {
	return func(sc *SSE) {
		sc.maxMessageBytes = n
	}
}

// WithSSELogger sets a custom structured logger for the SSE client.
// A nil logger falls back to slog.Default().
func WithSSELogger(logger *slog.Logger) ClientOption {
	return func(sc *SSE) {
		if logger == nil {
			sc.logger = slog.Default()
			return
		}
		sc.logger = logger
	}
}

// WithHeaders sets static headers for SSE HTTP requests.
func WithHeaders(headers map[string]string) ClientOption {
	return func(sc *SSE) {
		sc.headers = headers
	}
}

// WithHeaderFunc sets a function that returns headers for SSE HTTP requests.
func WithHeaderFunc(headerFunc HTTPHeaderFunc) ClientOption {
	return func(sc *SSE) {
		sc.headerFunc = headerFunc
	}
}

// WithHTTPClient sets a custom HTTP client for the SSE transport.
//
// The default client follows a redirect only to the same scheme, host and
// port, so configured headers and OAuth tokens are not sent elsewhere. A
// custom client's CheckRedirect policy is used as it is.
func WithHTTPClient(httpClient *http.Client) ClientOption {
	return func(sc *SSE) {
		sc.httpClient = httpClient
	}
}

// WithOAuth enables OAuth authentication for the SSE transport.
func WithOAuth(config OAuthConfig) ClientOption {
	return func(sc *SSE) {
		sc.oauthHandler = NewOAuthHandler(config)
	}
}

// WithEndpointTimeout sets the maximum time to wait for the SSE endpoint to be
// received during Start(). Defaults to 30 seconds. If the context has a shorter
// deadline, the shorter value is used.
func WithEndpointTimeout(d time.Duration) ClientOption {
	return func(sc *SSE) {
		if d > 0 {
			sc.endpointTimeout = d
		}
	}
}

// WithResponseTimeout sets the maximum time to wait for an SSE response after
// sending a request. Defaults to 60 seconds. If the context has a shorter
// deadline, the shorter value is used.
func WithResponseTimeout(d time.Duration) ClientOption {
	return func(sc *SSE) {
		if d > 0 {
			sc.responseTimeout = d
		}
	}
}

// WithHTTPHost sets a custom Host header for the SSE client, enabling manual DNS resolution.
// This allows connecting to an IP address while sending a specific Host header to the server.
// For example, connecting to "http://192.168.1.100:8080/sse" but sending Host: "api.example.com"
func WithHTTPHost(host string) ClientOption {
	return func(sc *SSE) {
		sc.host = host
	}
}

// NewSSE creates a new SSE-based MCP client with the given base URL.
// Returns an error if the URL is invalid.
func NewSSE(baseURL string, options ...ClientOption) (*SSE, error) {
	parsedURL, err := url.Parse(baseURL)
	if err != nil {
		return nil, fmt.Errorf("invalid URL: %w", err)
	}

	smc := &SSE{
		baseURL:         parsedURL,
		httpClient:      newDefaultHTTPClient(),
		responses:       make(map[string]chan *JSONRPCResponse),
		headers:         make(map[string]string),
		logger:          slog.Default(),
		endpointTimeout: 30 * time.Second,
		responseTimeout: 60 * time.Second,
		maxMessageBytes: DefaultMaxMessageBytes,
	}

	for _, opt := range options {
		opt(smc)
	}

	// If OAuth is configured, set the base URL for metadata discovery
	if smc.oauthHandler != nil {
		discoveryURL := *parsedURL
		discoveryURL.RawQuery = ""
		discoveryURL.Fragment = ""
		baseURL := discoveryURL.String()
		smc.oauthHandler.SetBaseURL(baseURL)
	}

	return smc, nil
}

// Start initiates the SSE connection to the server and waits for the endpoint information.
// Returns an error if the connection fails or times out waiting for the endpoint.
func (c *SSE) Start(ctx context.Context) error {
	for {
		c.startMu.Lock()
		// Reject any start after Close before the started fast-path so a closed
		// transport reports ErrTransportClosed instead of nil.
		if c.closed.Load() {
			c.startMu.Unlock()
			return ErrTransportClosed
		}
		if c.started.Load() {
			c.startMu.Unlock()
			return nil
		}
		// A concurrent Start is already in flight: wait for it and honor
		// our own context instead of blocking on the mutex.
		if startDone := c.startDone; startDone != nil {
			c.startMu.Unlock()
			select {
			case <-startDone:
				if err := ctx.Err(); err != nil {
					return fmt.Errorf("context cancelled while waiting for concurrent start: %w", err)
				}
				continue
			case <-ctx.Done():
				return fmt.Errorf("context cancelled while waiting for concurrent start: %w", ctx.Err())
			}
		}

		// Become the owner of this handshake attempt.
		startDone := make(chan struct{})
		c.startDone = startDone
		c.startMu.Unlock()

		err := c.start(ctx)

		c.startMu.Lock()
		c.startDone = nil
		close(startDone)
		c.startMu.Unlock()
		return err
	}
}

// start performs one SSE connection and endpoint handshake attempt.
func (c *SSE) start(ctx context.Context) error {
	// The handshake state belongs to this Start attempt only. Delayed
	// endpoint events from a superseded reader (e.g. after a failed Start)
	// close only this attempt's channel and cannot corrupt a later retry.
	endpointChan := make(chan struct{})
	endpointOnce := &sync.Once{}

	// Publish the canceler under the same lock Close uses for the closed
	// transition. Close therefore either rejects this attempt or observes its
	// canceler.
	c.lifecycleMu.Lock()
	if c.closed.Load() {
		c.lifecycleMu.Unlock()
		return ErrTransportClosed
	}
	ctx, cancel := context.WithCancel(ctx)
	c.cancelSSEStream = cancel
	c.lifecycleMu.Unlock()

	startSucceeded := false
	defer func() {
		if !startSucceeded {
			cancel()
		}
	}()

	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL.String(), nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	// Set custom Host header if provided
	if c.host != "" {
		req.Host = c.host
	}

	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Cache-Control", "no-cache")
	req.Header.Set("Connection", "keep-alive")

	// set custom http headers
	for k, v := range c.headers {
		req.Header.Set(k, v)
	}
	if c.headerFunc != nil {
		for k, v := range c.headerFunc(ctx) {
			req.Header.Set(k, v)
		}
	}

	// Add OAuth authorization if configured
	if c.oauthHandler != nil {
		authHeader, err := c.oauthHandler.GetAuthorizationHeader(ctx)
		if err != nil {
			// If we get an authorization error, return a specific error that can be handled by the client
			if errors.Is(err, ErrOAuthAuthorizationRequired) {
				return &OAuthAuthorizationRequiredError{
					Handler: c.oauthHandler,
					AuthorizationRequiredError: AuthorizationRequiredError{
						ResourceMetadataURL: "", // No response available in this code path
					},
				}
			}
			return fmt.Errorf("failed to get authorization header: %w", err)
		}
		req.Header.Set("Authorization", authHeader)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect to SSE stream: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		// Handle unauthorized error
		if resp.StatusCode == http.StatusUnauthorized {
			// Extract discovered metadata URL per RFC9728
			metadataURL := extractResourceMetadataURL(resp.Header.Values("WWW-Authenticate"))

			// Feed discovered URL back to OAuthHandler so next auth attempt uses it.
			// HandleUnauthorizedResponse applies RFC 9728 origin validation — a
			// compromised resource advertising a cross-origin PRM URL is ignored.
			if c.oauthHandler != nil {
				c.oauthHandler.HandleUnauthorizedResponse(resp)
			}

			// If OAuth handler exists, return OAuth-specific error
			if c.oauthHandler != nil {
				return &OAuthAuthorizationRequiredError{
					Handler: c.oauthHandler,
					AuthorizationRequiredError: AuthorizationRequiredError{
						ResourceMetadataURL: metadataURL,
					},
				}
			}

			// No OAuth handler, return base authorization error
			return &AuthorizationRequiredError{
				ResourceMetadataURL: metadataURL,
			}
		}
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	go c.readSSE(resp.Body, endpointChan, endpointOnce)

	// Wait for the endpoint to be received
	endpointTimeout := c.endpointTimeout
	if deadline, ok := ctx.Deadline(); ok {
		remaining := time.Until(deadline)
		// If context deadline has already passed, return immediately
		if remaining <= 0 {
			cancel()
			return ctx.Err()
		}
		// Use the shorter of remaining time or default timeout
		if remaining < endpointTimeout {
			endpointTimeout = remaining
		}
	}

	timer := time.NewTimer(endpointTimeout)
	defer timer.Stop()

	select {
	case <-endpointChan:
		// Endpoint received, proceed
	case <-ctx.Done():
		return fmt.Errorf("context cancelled while waiting for endpoint: %w", ctx.Err())
	case <-timer.C:
		cancel()
		return fmt.Errorf("timeout waiting for endpoint after %v", endpointTimeout)
	}

	// Do not publish a successful start after a concurrent Close has won.
	c.lifecycleMu.Lock()
	if c.closed.Load() {
		c.lifecycleMu.Unlock()
		return ErrTransportClosed
	}
	c.started.Store(true)
	startSucceeded = true
	c.lifecycleMu.Unlock()
	return nil
}

// readSSE continuously reads the SSE stream and processes events.
// It runs until the connection is closed or an error occurs.
func (c *SSE) readSSE(reader io.ReadCloser, endpointChan chan struct{}, endpointOnce *sync.Once) {
	defer reader.Close()

	br := bufio.NewReader(reader)
	var event, data string

	// end handles the stream ending with err.
	end := func(err error) {
		// Close() cancels the stream context, which surfaces here as a read
		// error; firing the handler would reconnect a transport the caller
		// just shut down.
		if c.closed.Load() {
			return
		}
		if err == io.EOF {
			// Process any pending event before exit
			if data != "" {
				// If no event type is specified, use empty string (default event type)
				if event == "" {
					event = "message"
				}
				c.handleSSEEvent(event, data, endpointChan, endpointOnce)
			}
		}
		c.connectionLostMu.RLock()
		handler := c.onConnectionLost
		c.connectionLostMu.RUnlock()
		if handler != nil {
			// Notify that the connection will be closed due to an error
			handler(err)
		} else if err == io.EOF || err == ErrMessageTooLarge {
			c.logger.Error("SSE stream error", "err", err)
		}
	}

	for {
		// when close or start's ctx cancel, the reader will be closed
		// and the for loop will break.
		line, err := readSSELine(br, c.maxMessageBytes)
		if err != nil {
			end(err)
			return
		}

		// Remove only newline markers
		line = strings.TrimRight(line, "\r\n")
		if line == "" {
			// Empty line means end of event
			if data != "" {
				// If no event type is specified, use empty string (default event type)
				if event == "" {
					event = "message"
				}
				c.handleSSEEvent(event, data, endpointChan, endpointOnce)
				data = ""
			}
			// The event type resets on every dispatch, even one with no
			// data, so it cannot leak into the next event.
			event = ""
			continue
		}

		if after, ok := strings.CutPrefix(line, "event:"); ok {
			event = strings.TrimSpace(after)
		} else if after, ok := strings.CutPrefix(line, "data:"); ok {
			data = appendSSEData(data, after)
			if c.maxMessageBytes > 0 && int64(len(data)) > c.maxMessageBytes {
				end(ErrMessageTooLarge)
				return
			}
		}
	}
}

// appendSSEData joins the value of an SSE "data:" field onto any data already
// accumulated for the current event. Per the Server-Sent Events specification,
// a single event may carry multiple "data:" lines and they must be
// concatenated with a newline. The previous implementation overwrote the
// buffer on every line, silently truncating multi-line payloads to their final
// line and corrupting JSON-RPC messages that span more than one data line.
//
// Only a single optional leading space after "data:" is removed, as the spec
// requires; any other leading or trailing whitespace in the value is
// significant and preserved.
func appendSSEData(existing, line string) string {
	value := strings.TrimPrefix(line, " ")
	if existing == "" {
		return value
	}
	return existing + "\n" + value
}

// handleSSEEvent processes SSE events based on their type.
// Handles 'endpoint' events for connection setup and 'message' events for JSON-RPC communication.
func (c *SSE) handleSSEEvent(event, data string, endpointChan chan struct{}, endpointOnce *sync.Once) {
	switch event {
	case "endpoint":
		endpoint, err := c.baseURL.Parse(data)
		if err != nil {
			c.logger.Error("Error parsing endpoint URL", "err", err)
			return
		}
		// Scheme and port must match too: an https connection must not
		// post headers and bodies to an http endpoint on the same host.
		if !sameOrigin(endpoint, c.baseURL) {
			c.logger.Error("Endpoint origin does not match connection origin")
			return
		}
		c.mu.Lock()
		c.endpoint = endpoint
		c.mu.Unlock()
		// The SSE spec sends a single endpoint event, but a proxy or a
		// re-broadcasting server can emit it more than once. Closing the
		// channel twice panics, so guard the close with the attempt's
		// sync.Once.
		endpointOnce.Do(func() {
			close(endpointChan)
		})
	case "message":
		var baseMessage struct {
			JSONRPCResponse
			Method string `json:"method,omitempty"`
		}
		if err := json.Unmarshal([]byte(data), &baseMessage); err != nil {
			c.logger.Error("Error unmarshaling message", "err", err)
			return
		}

		// Handle notification
		if baseMessage.ID.IsNil() {
			var notification mcp.JSONRPCNotification
			if err := json.Unmarshal([]byte(data), &notification); err != nil {
				return
			}
			c.notifyMu.RLock()
			handler := c.onNotification
			c.notifyMu.RUnlock()
			if handler != nil {
				handler(notification)
			}
			return
		}

		// The server numbers its own requests, such as keep-alive pings,
		// independently of ours, so a request can carry the id of one that
		// is still waiting for its response.
		if baseMessage.Method != "" {
			return
		}

		// Create string key for map lookup
		idKey := baseMessage.ID.String()

		// Hold the write lock while sending: Close() also takes the write
		// lock to close pending response channels, so the send can never
		// race a close and panic with "send on closed channel".
		c.mu.Lock()
		ch, exists := c.responses[idKey]
		if exists {
			ch <- &baseMessage.JSONRPCResponse
			delete(c.responses, idKey)
		}
		c.mu.Unlock()
	}
}

// SetNotificationHandler sets the handler for incoming JSON-RPC notifications.
// A handler may replace or remove itself; the change applies to subsequent notifications.
func (c *SSE) SetNotificationHandler(handler func(notification mcp.JSONRPCNotification)) {
	c.notifyMu.Lock()
	defer c.notifyMu.Unlock()
	c.onNotification = handler
}

// SetConnectionLostHandler sets the handler called when the SSE connection is lost.
func (c *SSE) SetConnectionLostHandler(handler func(error)) {
	c.connectionLostMu.Lock()
	defer c.connectionLostMu.Unlock()
	c.onConnectionLost = handler
}

// SendRequest sends a JSON-RPC request to the server and waits for a response.
// Returns the raw JSON response message or an error if the request fails.
func (c *SSE) SendRequest(
	ctx context.Context,
	request JSONRPCRequest,
) (*JSONRPCResponse, error) {
	if !c.started.Load() {
		return nil, fmt.Errorf("transport not started yet")
	}
	if c.closed.Load() {
		return nil, fmt.Errorf("transport has been closed")
	}

	c.mu.RLock()
	endpoint := c.endpoint
	c.mu.RUnlock()

	if endpoint == nil {
		return nil, fmt.Errorf("endpoint not received")
	}

	// Marshal request
	requestBytes, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint.String(), bytes.NewReader(requestBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	// Set protocol version header if negotiated
	if v := c.protocolVersion.Load(); v != nil {
		if version, ok := v.(string); ok && version != "" {
			req.Header.Set(HeaderKeyProtocolVersion, version)
		}
	}
	for k, v := range c.headers {
		req.Header.Set(k, v)
	}

	for k, v := range request.Header {
		if _, ok := req.Header[k]; !ok {
			req.Header[k] = v
		}
	}

	// Set custom Host header if provided
	if c.host != "" {
		req.Host = c.host
	}

	// Add OAuth authorization if configured
	if c.oauthHandler != nil {
		authHeader, err := c.oauthHandler.GetAuthorizationHeader(ctx)
		if err != nil {
			// If we get an authorization error, return a specific error that can be handled by the client
			if errors.Is(err, ErrOAuthAuthorizationRequired) {
				return nil, &OAuthAuthorizationRequiredError{
					Handler: c.oauthHandler,
					AuthorizationRequiredError: AuthorizationRequiredError{
						ResourceMetadataURL: "", // No response available in this code path
					},
				}
			}
			return nil, fmt.Errorf("failed to get authorization header: %w", err)
		}
		req.Header.Set("Authorization", authHeader)
	}

	if c.headerFunc != nil {
		for k, v := range c.headerFunc(ctx) {
			req.Header.Set(k, v)
		}
	}

	// Create string key for map lookup
	idKey := request.ID.String()

	// Register response channel
	responseChan := make(chan *JSONRPCResponse, 1)
	c.mu.Lock()
	c.responses[idKey] = responseChan
	c.mu.Unlock()
	deleteResponseChan := func() {
		c.mu.Lock()
		delete(c.responses, idKey)
		c.mu.Unlock()
	}

	// Send request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		deleteResponseChan()
		return nil, fmt.Errorf("failed to send request: %w", err)
	}

	// Drain any outstanding io; the body is only used to report an error.
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxErrorBodyBytes))
	resp.Body.Close()

	if err != nil {
		deleteResponseChan()
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Check if we got an error response
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
		deleteResponseChan()

		// Handle unauthorized error
		if resp.StatusCode == http.StatusUnauthorized {
			// Extract discovered metadata URL per RFC9728
			metadataURL := extractResourceMetadataURL(resp.Header.Values("WWW-Authenticate"))

			// Feed discovered URL back to OAuthHandler so next auth attempt uses it.
			// HandleUnauthorizedResponse applies RFC 9728 origin validation — a
			// compromised resource advertising a cross-origin PRM URL is ignored.
			if c.oauthHandler != nil {
				c.oauthHandler.HandleUnauthorizedResponse(resp)
			}

			// If OAuth handler exists, return OAuth-specific error
			if c.oauthHandler != nil {
				return nil, &OAuthAuthorizationRequiredError{
					Handler: c.oauthHandler,
					AuthorizationRequiredError: AuthorizationRequiredError{
						ResourceMetadataURL: metadataURL,
					},
				}
			}

			// No OAuth handler, return base authorization error
			return nil, &AuthorizationRequiredError{
				ResourceMetadataURL: metadataURL,
			}
		}

		return nil, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, body)
	}

	// Calculate response timeout
	responseTimeout := c.responseTimeout
	if deadline, ok := ctx.Deadline(); ok {
		remaining := time.Until(deadline)
		// Check if context deadline has already passed
		if remaining <= 0 {
			deleteResponseChan()
			return nil, ctx.Err()
		}
		// Use the shorter of remaining time or default timeout
		if remaining < responseTimeout {
			responseTimeout = remaining
		}
	}

	timer := time.NewTimer(responseTimeout)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		deleteResponseChan()
		return nil, ctx.Err()
	case <-timer.C:
		// Timeout handling
		deleteResponseChan()
		return nil, fmt.Errorf("timeout waiting for SSE response after %v", responseTimeout)
	case response, ok := <-responseChan:
		if ok {
			return response, nil
		}
		return nil, fmt.Errorf("connection has been closed")
	}
}

// Close shuts down the SSE client connection and cleans up any pending responses.
// Returns an error if the shutdown process fails.
func (c *SSE) Close() error {
	// Synchronize the closed transition with Start's canceler publication so
	// an in-flight start cannot escape shutdown with a live request context.
	c.lifecycleMu.Lock()
	if c.closed.Load() {
		c.lifecycleMu.Unlock()
		return nil // Already closed
	}
	c.closed.Store(true)
	cancelSSEStream := c.cancelSSEStream
	c.lifecycleMu.Unlock()

	if cancelSSEStream != nil {
		// It could stop the sse stream body, to quit the readSSE loop immediately
		// Also, it could quit start() immediately if not receiving the endpoint
		cancelSSEStream()
	}

	// Clean up any pending responses
	c.mu.Lock()
	for _, ch := range c.responses {
		close(ch)
	}
	c.responses = make(map[string]chan *JSONRPCResponse)
	c.mu.Unlock()

	return nil
}

// GetSessionId returns the session ID of the transport.
// Since SSE does not maintain a session ID, it returns an empty string.
func (c *SSE) GetSessionId() string {
	return ""
}

// SetProtocolVersion sets the negotiated protocol version for this connection.
func (c *SSE) SetProtocolVersion(version string) {
	c.protocolVersion.Store(version)
}

// SendNotification sends a JSON-RPC notification to the server without expecting a response.
func (c *SSE) SendNotification(ctx context.Context, notification mcp.JSONRPCNotification) error {
	if c.closed.Load() {
		return ErrTransportClosed
	}
	c.mu.RLock()
	endpoint := c.endpoint
	c.mu.RUnlock()

	if endpoint == nil {
		return fmt.Errorf("endpoint not received")
	}

	notificationBytes, err := json.Marshal(notification)
	if err != nil {
		return fmt.Errorf("failed to marshal notification: %w", err)
	}

	req, err := http.NewRequestWithContext(
		ctx,
		"POST",
		endpoint.String(),
		bytes.NewReader(notificationBytes),
	)
	if err != nil {
		return fmt.Errorf("failed to create notification request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	// Set protocol version header if negotiated
	if v := c.protocolVersion.Load(); v != nil {
		if version, ok := v.(string); ok && version != "" {
			req.Header.Set(HeaderKeyProtocolVersion, version)
		}
	}
	// Set custom HTTP headers
	for k, v := range c.headers {
		req.Header.Set(k, v)
	}

	// Add OAuth authorization if configured
	if c.oauthHandler != nil {
		authHeader, err := c.oauthHandler.GetAuthorizationHeader(ctx)
		if err != nil {
			// If we get an authorization error, return a specific error that can be handled by the client
			if errors.Is(err, ErrOAuthAuthorizationRequired) {
				return &OAuthAuthorizationRequiredError{
					Handler: c.oauthHandler,
					AuthorizationRequiredError: AuthorizationRequiredError{
						ResourceMetadataURL: "", // No response available in this code path
					},
				}
			}
			return fmt.Errorf("failed to get authorization header: %w", err)
		}
		req.Header.Set("Authorization", authHeader)
	}

	if c.headerFunc != nil {
		for k, v := range c.headerFunc(ctx) {
			req.Header.Set(k, v)
		}
	}

	// Set custom Host header if provided
	if c.host != "" {
		req.Host = c.host
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send notification: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
		// Handle unauthorized error
		if resp.StatusCode == http.StatusUnauthorized {
			// Extract discovered metadata URL per RFC9728
			metadataURL := extractResourceMetadataURL(resp.Header.Values("WWW-Authenticate"))

			// Feed discovered URL back to OAuthHandler so next auth attempt uses it.
			// HandleUnauthorizedResponse applies RFC 9728 origin validation — a
			// compromised resource advertising a cross-origin PRM URL is ignored.
			if c.oauthHandler != nil {
				c.oauthHandler.HandleUnauthorizedResponse(resp)
			}

			// If OAuth handler exists, return OAuth-specific error
			if c.oauthHandler != nil {
				return &OAuthAuthorizationRequiredError{
					Handler: c.oauthHandler,
					AuthorizationRequiredError: AuthorizationRequiredError{
						ResourceMetadataURL: metadataURL,
					},
				}
			}

			// No OAuth handler, return base authorization error
			return &AuthorizationRequiredError{
				ResourceMetadataURL: metadataURL,
			}
		}

		// Handle other error responses
		body := readErrorBody(resp.Body)
		return fmt.Errorf(
			"notification failed with status %d: %s",
			resp.StatusCode,
			body,
		)
	}

	return nil
}

// GetEndpoint returns the current endpoint URL for the SSE connection.
func (c *SSE) GetEndpoint() *url.URL {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.endpoint
}

// GetBaseURL returns the base URL set in the SSE constructor.
func (c *SSE) GetBaseURL() *url.URL {
	return c.baseURL
}

// GetOAuthHandler returns the OAuth handler if configured
func (c *SSE) GetOAuthHandler() *OAuthHandler {
	return c.oauthHandler
}

// IsOAuthEnabled returns true if OAuth is enabled
func (c *SSE) IsOAuthEnabled() bool {
	return c.oauthHandler != nil
}

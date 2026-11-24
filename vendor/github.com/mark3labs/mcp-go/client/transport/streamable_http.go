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
	"mime"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
)

// StreamableHTTPCOption configures a StreamableHTTP transport client.
type StreamableHTTPCOption func(*StreamableHTTP)

// WithContinuousListening enables receiving server-to-client notifications when no request is in flight.
// In particular, if you want to receive global notifications from the server (like ToolListChangedNotification),
// you should enable this option.
//
// It will establish a standalone long-live GET HTTP connection to the server.
// https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#listening-for-messages-from-the-server
// NOTICE: Even enabled, the server may not support this feature.
//
// Deprecated: protocol version 2026-07-28 removed the standalone GET stream
// (SEP-2575). A transport with this option enabled keeps the connection on a
// legacy protocol version; use Client.Listen to open a subscriptions/listen
// stream instead.
func WithContinuousListening() StreamableHTTPCOption {
	return func(sc *StreamableHTTP) {
		sc.getListeningEnabled = true
	}
}

// WithContinuousListeningBackoff configures exponential backoff for the
// reconnect attempts performed by the continuous listener enabled with
// [WithContinuousListening]. After a connection attempt fails, the delay
// before the next attempt doubles, starting at initialDelay and capped at
// maxDelay. The delay resets to initialDelay once a connection ends cleanly.
//
// Without this option the listener retries at a fixed interval, preserving
// the historical behavior. Values are sanitized: a non-positive initialDelay
// disables backoff, and a maxDelay smaller than initialDelay is treated as
// initialDelay.
//
// Deprecated: like [WithContinuousListening], this only applies to the legacy
// standalone GET stream removed by protocol version 2026-07-28 (SEP-2575).
func WithContinuousListeningBackoff(initialDelay, maxDelay time.Duration) StreamableHTTPCOption {
	return func(sc *StreamableHTTP) {
		sc.reconnectInitialDelay = initialDelay
		sc.reconnectMaxDelay = maxDelay
	}
}

// WithHTTPBasicClient sets a custom HTTP client on the StreamableHTTP transport.
//
// The default client follows a redirect only to the same scheme, host and
// port, so configured headers and OAuth tokens are not sent elsewhere. A
// custom client's CheckRedirect policy is used as it is.
func WithHTTPBasicClient(client *http.Client) StreamableHTTPCOption {
	return func(sc *StreamableHTTP) {
		sc.httpClient = client
	}
}

// WithHTTPHeaders sets static headers for StreamableHTTP requests.
func WithHTTPHeaders(headers map[string]string) StreamableHTTPCOption {
	return func(sc *StreamableHTTP) {
		sc.headers = headers
	}
}

// WithHTTPHeaderFunc sets a function that returns headers for StreamableHTTP requests.
func WithHTTPHeaderFunc(headerFunc HTTPHeaderFunc) StreamableHTTPCOption {
	return func(sc *StreamableHTTP) {
		sc.headerFunc = headerFunc
	}
}

// WithHTTPTimeout sets the timeout for a HTTP request and stream.
func WithHTTPTimeout(timeout time.Duration) StreamableHTTPCOption {
	return func(sc *StreamableHTTP) {
		sc.httpClient.Timeout = timeout
	}
}

// WithHTTPOAuth enables OAuth authentication for the client.
func WithHTTPOAuth(config OAuthConfig) StreamableHTTPCOption {
	return func(sc *StreamableHTTP) {
		sc.oauthHandler = NewOAuthHandler(config)
	}
}

// WithHTTPLogger sets a custom structured logger for the StreamableHTTP
// transport. A nil logger falls back to slog.Default().
func WithHTTPLogger(logger *slog.Logger) StreamableHTTPCOption {
	return func(sc *StreamableHTTP) {
		if logger == nil {
			sc.logger = slog.Default()
			return
		}
		sc.logger = logger
	}
}

// WithLogger sets a custom structured logger for the StreamableHTTP transport.
//
// Deprecated: Use [WithHTTPLogger] instead.
func WithLogger(logger *slog.Logger) StreamableHTTPCOption {
	return WithHTTPLogger(logger)
}

// WithSession creates a client with a pre-configured session
func WithSession(sessionID string) StreamableHTTPCOption {
	return func(sc *StreamableHTTP) {
		sc.sessionID.Store(sessionID)
	}
}

// WithStreamableHTTPHost sets a custom Host header for the StreamableHTTP client, enabling manual DNS resolution.
// This allows connecting to an IP address while sending a specific Host header to the server.
// For example, connecting to "http://192.168.1.100:8080/mcp" but sending Host: "api.example.com"
func WithStreamableHTTPHost(host string) StreamableHTTPCOption {
	return func(sc *StreamableHTTP) {
		sc.host = host
	}
}

// WithHTTPMaxMessageBytes bounds the size of a message the client reads from
// the server: a JSON response body, or the data of one SSE event. A request
// whose response is larger fails with ErrMessageTooLarge, and so does a
// larger event on the GET stream, which then ends. The default is
// DefaultMaxMessageBytes; zero or less removes the bound.
func WithHTTPMaxMessageBytes(n int64) StreamableHTTPCOption {
	return func(sc *StreamableHTTP) {
		sc.maxMessageBytes = n
	}
}

// StreamableHTTP implements Streamable HTTP transport.
//
// It transmits JSON-RPC messages over individual HTTP requests. One message per request.
// The HTTP response body can either be a single JSON-RPC response,
// or an upgraded SSE stream that concludes with a JSON-RPC response for the same request.
//
// https://modelcontextprotocol.io/specification/2025-03-26/basic/transports
//
// Before protocol version 2026-07-28, a response stream the server ends
// before the response, once it has sent an event ID, is resumed with a GET
// carrying Last-Event-ID (SEP-1699). Streams that break off are not resumed
// (https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#resumability-and-redelivery).
// A server may keep a resumed request open indefinitely, so callers should
// give requests a deadline.
type StreamableHTTP struct {
	serverURL           *url.URL
	httpClient          *http.Client
	headers             map[string]string
	headerFunc          HTTPHeaderFunc
	host                string
	logger              *slog.Logger
	getListeningEnabled bool
	maxMessageBytes     int64

	reconnectInitialDelay time.Duration
	reconnectMaxDelay     time.Duration

	sessionID       atomic.Value // string
	protocolVersion atomic.Value // string

	// sessionMu guards sessionEnded and the GET stream's connection, and
	// makes reading the session ID for a request and ending the session
	// exclusive.
	sessionMu sync.Mutex
	// sessionEnded is set when the server answers 404 for the session, and
	// closed and cleared when a new connection starts. Meanwhile requests fail
	// with ErrSessionTerminated rather than go out without a session ID, which
	// the server would reject or take as the start of another session.
	sessionEnded chan struct{}
	// listenSession is the session the GET stream is connected on, and
	// listenCancel ends that connection.
	listenSession string
	listenCancel  context.CancelFunc

	initialized     chan struct{}
	initializedOnce sync.Once

	notificationHandler func(mcp.JSONRPCNotification)
	notifyMu            sync.RWMutex

	// Request handler for incoming server-to-client requests (like sampling)
	requestHandler RequestHandler
	requestMu      sync.RWMutex

	closed    chan struct{}
	closeOnce sync.Once

	retryInterval time.Duration

	// OAuth support
	oauthHandler *OAuthHandler
}

// NewStreamableHTTP creates a new Streamable HTTP transport with the given server URL.
// Returns an error if the URL is invalid.
func NewStreamableHTTP(serverURL string, options ...StreamableHTTPCOption) (*StreamableHTTP, error) {
	parsedURL, err := url.Parse(serverURL)
	if err != nil {
		return nil, fmt.Errorf("invalid URL: %w", err)
	}

	smc := &StreamableHTTP{
		serverURL:   parsedURL,
		httpClient:  newDefaultHTTPClient(),
		headers:     make(map[string]string),
		closed:      make(chan struct{}),
		logger:      slog.Default(),
		initialized: make(chan struct{}),

		maxMessageBytes: DefaultMaxMessageBytes,
		retryInterval:   retryInterval,
	}
	smc.sessionID.Store("") // set initial value to simplify later usage

	for _, opt := range options {
		if opt != nil {
			opt(smc)
		}
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

// Start initiates the HTTP connection to the server.
func (c *StreamableHTTP) Start(ctx context.Context) error {
	// Start is idempotent - check if already initialized
	select {
	case <-c.initialized:
		return nil
	default:
	}

	// For Streamable HTTP, we don't need to establish a persistent connection by default
	if c.getListeningEnabled {
		go func() {
			defer func() {
				if r := recover(); r != nil {
					c.logger.Error("panic in listener goroutine", "panic", r)
				}
			}()
			select {
			case <-c.initialized:
				// Protocol version 2026-07-28 removed the standalone GET
				// stream; server-to-client notifications arrive on a
				// subscriptions/listen response stream instead.
				if c.isModern() {
					return
				}
				ctx, cancel := c.contextAwareOfClientClose(ctx)
				defer cancel()
				c.listenForever(ctx)
			case <-c.closed:
				return
			case <-ctx.Done():
				return
			}
		}()
	}

	return nil
}

// Close closes the all the HTTP connections to the server.
func (c *StreamableHTTP) Close() error {
	c.closeOnce.Do(func() {
		// Cancel all in-flight requests
		close(c.closed)

		// Protocol version 2026-07-28 removed protocol-level sessions, so
		// there is nothing to terminate and DELETE is not part of the
		// transport any more.
		sessionId := c.sessionID.Load().(string)
		if sessionId != "" && !c.isModern() {
			c.sessionID.Store("")
			// notify server session closed
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			req, err := http.NewRequestWithContext(ctx, http.MethodDelete, c.serverURL.String(), nil)
			if err != nil {
				c.logger.Error("failed to create close request", "err", err)
				return
			}
			req.Header.Set(HeaderKeySessionID, sessionId)
			// Set protocol version header if negotiated
			if v := c.protocolVersion.Load(); v != nil {
				if version, ok := v.(string); ok && version != "" {
					req.Header.Set(HeaderKeyProtocolVersion, version)
				}
			}

			// Set custom Host header if provided
			if c.host != "" {
				req.Host = c.host
			}
			res, err := c.httpClient.Do(req)
			if err != nil {
				c.logger.Error("failed to send close request", "err", err)
				return
			}
			res.Body.Close()
		}
	})
	return nil
}

// SetProtocolVersion sets the negotiated protocol version for this connection.
func (c *StreamableHTTP) SetProtocolVersion(version string) {
	c.protocolVersion.Store(version)
}

// markInitializedOnDiscover opens the initialization gate once a
// server/discover request has actually succeeded.
//
// A successful discover marks the connection ready in the same way initialize
// does for legacy servers: it is the first request of a modern connection
// (SEP-2575). A server predating the method answers HTTP 200 with a JSON-RPC
// error, which is a failed probe: the gate must stay shut so the caller can
// fall back to the initialize handshake before anything treats the transport
// as ready.
func (c *StreamableHTTP) markInitializedOnDiscover(request JSONRPCRequest, response *JSONRPCResponse) {
	if request.Method != string(mcp.MethodServerDiscover) || response.Error != nil {
		return
	}
	c.initializedOnce.Do(func() {
		close(c.initialized)
	})
}

// currentSession returns the session ID to send with a request, and whether
// the session has ended.
func (c *StreamableHTTP) currentSession() (string, bool) {
	c.sessionMu.Lock()
	defer c.sessionMu.Unlock()
	sessionID, _ := c.sessionID.Load().(string)
	return sessionID, c.sessionEnded != nil
}

// endSession records that the server no longer knows sessionID: the caller
// has to start a new session.
func (c *StreamableHTTP) endSession(sessionID string) {
	if sessionID == "" {
		return
	}
	c.sessionMu.Lock()
	defer c.sessionMu.Unlock()
	if c.sessionID.CompareAndSwap(sessionID, "") && c.sessionEnded == nil {
		c.sessionEnded = make(chan struct{})
	}
}

// startsConnection reports whether request starts a new connection, and so
// may go out after the session has ended: initialize, or server/discover on
// 2026-07-28, which has no session.
func (c *StreamableHTTP) startsConnection(request JSONRPCRequest) bool {
	return request.Method == string(mcp.MethodInitialize) ||
		request.Method == string(mcp.MethodServerDiscover) && c.isModern()
}

// markSessionStarted records that a request that starts a new connection
// succeeded, leaving session as the session ID: requests go out again, and a
// GET stream connected on another session reconnects on this one. If the
// session ID has changed since, as when this session has ended already, it
// does nothing.
func (c *StreamableHTTP) markSessionStarted(request JSONRPCRequest, response *JSONRPCResponse, session string) {
	if !c.startsConnection(request) || response.Error != nil {
		return
	}
	c.sessionMu.Lock()
	defer c.sessionMu.Unlock()
	if current, _ := c.sessionID.Load().(string); current != session {
		return
	}
	if c.sessionEnded != nil {
		close(c.sessionEnded)
		c.sessionEnded = nil
	}
	if c.listenCancel != nil && c.listenSession != session {
		c.listenCancel()
	}
}

// listenOn waits while the session has ended, then records cancel as the way
// to end the GET stream's next connection, and returns the session that
// connection uses. It returns false if ctx ends first.
func (c *StreamableHTTP) listenOn(ctx context.Context, cancel context.CancelFunc) (string, bool) {
	for {
		c.sessionMu.Lock()
		ended := c.sessionEnded
		if ended == nil {
			c.listenSession, _ = c.sessionID.Load().(string)
			c.listenCancel = cancel
			session := c.listenSession
			c.sessionMu.Unlock()
			return session, true
		}
		c.sessionMu.Unlock()
		select {
		case <-ended:
		case <-ctx.Done():
			return "", false
		}
	}
}

// listenDone forgets the GET stream's connection once it is over.
func (c *StreamableHTTP) listenDone() {
	c.sessionMu.Lock()
	defer c.sessionMu.Unlock()
	c.listenSession = ""
	c.listenCancel = nil
}

// negotiatedProtocolVersion returns the protocol version in effect, or "" when
// none has been negotiated yet.
func (c *StreamableHTTP) negotiatedProtocolVersion() string {
	if v := c.protocolVersion.Load(); v != nil {
		if version, ok := v.(string); ok {
			return version
		}
	}
	return ""
}

// isModern reports whether this connection uses the stateless protocol core
// introduced in 2026-07-28, where the transport carries no session state.
func (c *StreamableHTTP) isModern() bool {
	return mcp.IsModernProtocol(c.negotiatedProtocolVersion())
}

// RequiresLegacyProtocol reports whether this transport has been configured in
// a way that only protocol versions before 2026-07-28 can satisfy.
//
// Continuous listening depends on the standalone GET stream, which that
// revision removed, so a transport using it must stay on a legacy version.
func (c *StreamableHTTP) RequiresLegacyProtocol() bool {
	return c.getListeningEnabled
}

// ErrOAuthAuthorizationRequired is a sentinel error for OAuth authorization required
var ErrOAuthAuthorizationRequired = errors.New("no valid token available, authorization required")

// ErrAuthorizationRequired is a sentinel error for authorization required (401)
var ErrAuthorizationRequired = errors.New("authorization required")

// parseAuthParams parses the auth-params from a WWW-Authenticate header value
// per RFC 7235. It skips the auth-scheme (first token) and returns a map of
// key=value pairs. Values may be tokens or quoted-strings (with backslash
// escaping per RFC 7230 §3.2.6).
func parseAuthParams(header string) map[string]string {
	params := make(map[string]string)

	// Skip leading whitespace
	header = strings.TrimSpace(header)
	if header == "" {
		return params
	}

	// Skip the auth-scheme (first token before space)
	_, rest, found := strings.Cut(header, " ")
	if !found {
		return params // auth-scheme only, no params
	}
	rest = strings.TrimSpace(rest)

	for rest != "" {
		rest = strings.TrimSpace(rest)
		if rest == "" {
			break
		}

		// Parse key
		eqIdx := strings.IndexByte(rest, '=')
		if eqIdx == -1 {
			break
		}
		key := strings.TrimSpace(rest[:eqIdx])
		rest = strings.TrimLeft(rest[eqIdx+1:], " \t")

		// Parse value: quoted-string or token
		var value string
		if len(rest) > 0 && rest[0] == '"' {
			value, rest = parseQuotedString(rest)
		} else {
			// Token value: ends at comma, space, or end of string
			end := strings.IndexAny(rest, ", \t")
			if end == -1 {
				value = rest
				rest = ""
			} else {
				value = rest[:end]
				rest = rest[end:]
			}
		}

		params[key] = value

		// Skip comma separator
		rest = strings.TrimSpace(rest)
		if len(rest) > 0 && rest[0] == ',' {
			rest = rest[1:]
		}
	}

	return params
}

// parseQuotedString parses a quoted-string value per RFC 7230 §3.2.6.
// Input must start with a double-quote. Returns the unescaped value and
// the remaining unparsed input after the closing quote.
func parseQuotedString(s string) (value, rest string) {
	if len(s) == 0 || s[0] != '"' {
		return "", s
	}
	s = s[1:] // skip opening quote

	var b strings.Builder
	for i := 0; i < len(s); i++ {
		switch s[i] {
		case '\\':
			if i+1 < len(s) {
				b.WriteByte(s[i+1])
				i++ // skip escaped char
			}
		case '"':
			return b.String(), s[i+1:]
		default:
			b.WriteByte(s[i])
		}
	}
	// No closing quote found; return what we have
	return b.String(), ""
}

// extractResourceMetadataURL extracts the resource_metadata parameter from WWW-Authenticate headers
// per RFC9728 Section 5.1. Scans all provided header values since a response may contain multiple
// WWW-Authenticate headers (RFC 9110). Returns empty string if not found.
// Example: Bearer resource_metadata="https://resource.example.com/.well-known/oauth-protected-resource"
func extractResourceMetadataURL(wwwAuthHeaders []string) string {
	for _, header := range wwwAuthHeaders {
		for _, u := range extractResourceMetadataURLs(header) {
			if u != "" {
				return u
			}
		}
	}
	return ""
}

// extractResourceMetadataURLs returns every resource_metadata parameter
// value from a single WWW-Authenticate header value per RFC 9728 §5.1,
// in the order they appear. Returns an empty slice when the header is
// empty or no such parameters are present. Parameter names are matched
// case-insensitively per RFC 9110 §11.2; both quoted-string and token
// value forms are accepted. Multiple occurrences are possible when a
// single header value contains several Bearer challenges each carrying
// their own resource_metadata — an attacker-controlled first candidate
// must not mask a legitimate later one.
func extractResourceMetadataURLs(header string) []string {
	const target = "resource_metadata"
	var out []string
	i := 0
	for i < len(header) {
		// Advance to the next token start.
		for i < len(header) && !isAuthTokenChar(header[i]) {
			i++
		}
		nameStart := i
		for i < len(header) && isAuthTokenChar(header[i]) {
			i++
		}
		name := header[nameStart:i]
		// Skip optional whitespace between the name and '='.
		for i < len(header) && (header[i] == ' ' || header[i] == '\t') {
			i++
		}
		if i >= len(header) || header[i] != '=' {
			// Name was a scheme token (e.g. "Bearer"), not a parameter.
			continue
		}
		// Skip '=' and optional whitespace.
		i++
		for i < len(header) && (header[i] == ' ' || header[i] == '\t') {
			i++
		}
		value, next, ok := parseAuthParamValue(header, i)
		i = next
		if !ok {
			continue
		}
		if value != "" && strings.EqualFold(name, target) {
			out = append(out, value)
		}
	}
	return out
}

// parseAuthParamValue reads a single WWW-Authenticate parameter value
// starting at offset i: a quoted-string (with backslash escapes) when the
// first byte is '"', otherwise a bare token. It returns the decoded
// value, the index of the first byte after it, and whether the value
// was well-formed. Truncated quoted strings (no closing '"') and lone
// trailing backslashes yield ok=false so malformed input is rejected
// rather than producing a partial value.
func parseAuthParamValue(s string, i int) (string, int, bool) {
	if i >= len(s) {
		return "", i, false
	}
	if s[i] == '"' {
		i++
		var b strings.Builder
		for i < len(s) {
			c := s[i]
			if c == '\\' {
				if i+1 >= len(s) {
					// Lone trailing backslash — the quoted string was
					// truncated mid-escape, so the value is malformed.
					return "", i + 1, false
				}
				b.WriteByte(s[i+1])
				i += 2
				continue
			}
			if c == '"' {
				return b.String(), i + 1, true
			}
			b.WriteByte(c)
			i++
		}
		// Reached end of input without a closing '"'.
		return "", i, false
	}
	start := i
	for i < len(s) && isAuthTokenChar(s[i]) {
		i++
	}
	return s[start:i], i, i > start
}

// isAuthTokenChar reports whether c is a valid RFC 9110 §5.6.2 token
// character — the character class used for scheme and parameter names in
// WWW-Authenticate.
func isAuthTokenChar(c byte) bool {
	switch {
	case c >= 'a' && c <= 'z', c >= 'A' && c <= 'Z', c >= '0' && c <= '9':
		return true
	}
	return strings.IndexByte("!#$%&'*+-.^_`|~", c) >= 0
}

// AuthorizationRequiredError is returned when a 401 Unauthorized response is received.
// It contains the protected resource metadata URL from the WWW-Authenticate header if present.
type AuthorizationRequiredError struct {
	ResourceMetadataURL string // Extracted from WWW-Authenticate header per RFC9728
}

func (e *AuthorizationRequiredError) Error() string {
	return ErrAuthorizationRequired.Error()
}

func (e *AuthorizationRequiredError) Unwrap() error {
	return ErrAuthorizationRequired
}

// OAuthAuthorizationRequiredError is returned when OAuth authorization is required
// and an OAuth handler is available.
type OAuthAuthorizationRequiredError struct {
	Handler *OAuthHandler
	AuthorizationRequiredError
}

func (e *OAuthAuthorizationRequiredError) Error() string {
	return ErrOAuthAuthorizationRequired.Error()
}

func (e *OAuthAuthorizationRequiredError) Unwrap() error {
	return ErrOAuthAuthorizationRequired
}

// SendRequest sends a JSON-RPC request to the server and waits for a response.
// Returns the raw JSON response message or an error if the request fails.
func (c *StreamableHTTP) SendRequest(
	ctx context.Context,
	request JSONRPCRequest,
) (*JSONRPCResponse, error) {
	// Marshal request
	requestBody, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	ctx, cancel := c.contextAwareOfClientClose(ctx)

	// After the session has ended, only the requests that start a new
	// connection go out.
	resp, err := c.sendHTTP(ctx, http.MethodPost, bytes.NewReader(requestBody), "application/json, text/event-stream", request.Header, c.startsConnection(request))
	if err != nil {
		cancel()
		if errors.Is(err, ErrSessionTerminated) && request.Method == string(mcp.MethodInitialize) {
			// Per the MCP spec's backwards compatibility section: a 404 on an
			// initialize POST means the server likely only supports legacy SSE.
			return nil, ErrLegacySSEServer
		}
		return nil, fmt.Errorf("failed to send request: %w", err)
	}

	// Only proceed if we have a valid response.
	if resp == nil {
		cancel()
		return nil, fmt.Errorf("failed to send request: no response received")
	}
	// Cancel the context before closing the body. On HTTP/2, Close() blocks in a
	// select on cs.donec (stream cleanup) or cs.ctx.Done() (context cancellation).
	// If cc.wmu is contended, cs.donec may never close, making ctx.Done() the only
	// exit path. Canceling first guarantees Close() returns promptly.
	defer func() { cancel(); resp.Body.Close() }()

	// Check if we got an error response
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

		// Per the MCP spec's backwards compatibility section: if an initialize
		// POST receives an HTTP 4xx (e.g. 405 Method Not Allowed, 404 Not Found),
		// the server likely only supports the legacy HTTP+SSE transport.
		if request.Method == string(mcp.MethodInitialize) && resp.StatusCode >= 400 && resp.StatusCode < 500 {
			return nil, ErrLegacySSEServer
		}

		// handle error response
		var errResponse JSONRPCResponse
		body := readErrorBody(resp.Body)
		if isJSONRPCErrorBody(body) {
			if err := json.Unmarshal(body, &errResponse); err == nil && errResponse.Error != nil {
				return &errResponse, nil
			}
		}
		return nil, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, body)
	}

	if request.Method == string(mcp.MethodInitialize) {
		// saved the received session ID in the response
		// empty session ID is allowed
		if sessionID := resp.Header.Get(HeaderKeySessionID); sessionID != "" {
			c.sessionID.Store(sessionID)
		}

		c.initializedOnce.Do(func() {
			close(c.initialized)
		})
	}
	// The session ID this response leaves in place, for markSessionStarted.
	session, _ := c.sessionID.Load().(string)

	// Handle different response types
	mediaType, _, _ := mime.ParseMediaType(resp.Header.Get("Content-Type"))
	switch mediaType {
	case "application/json":
		// Single response
		var response JSONRPCResponse
		if err := json.NewDecoder(newBoundedReader(resp.Body, c.maxMessageBytes)).Decode(&response); err != nil {
			return nil, fmt.Errorf("failed to decode response: %w", err)
		}

		// should not be a notification
		if response.ID.IsNil() {
			return nil, fmt.Errorf("response should contain RPC id: %v", response)
		}

		c.markInitializedOnDiscover(request, &response)
		c.markSessionStarted(request, &response, session)

		return &response, nil

	case "text/event-stream":
		// Server is using SSE for streaming responses
		sseResponse, err := c.handleSSEResponse(ctx, resp.Body, false)
		if err != nil {
			return nil, err
		}
		if sseResponse != nil {
			c.markInitializedOnDiscover(request, sseResponse)
			c.markSessionStarted(request, sseResponse, session)
		}
		return sseResponse, nil

	default:
		return nil, fmt.Errorf("unexpected content type: %s", resp.Header.Get("Content-Type"))
	}
}

// isJSONRPCErrorBody reports whether body is a JSON-RPC error message with
// a numeric code and a string message. Member names are matched exactly,
// unlike json.Unmarshal into a struct.
func isJSONRPCErrorBody(body []byte) bool {
	var msg map[string]json.RawMessage
	if err := json.Unmarshal(body, &msg); err != nil {
		return false
	}
	var version string
	if err := json.Unmarshal(msg["jsonrpc"], &version); err != nil || version != mcp.JSONRPC_VERSION {
		return false
	}
	var errObj map[string]json.RawMessage
	if err := json.Unmarshal(msg["error"], &errObj); err != nil {
		return false
	}
	var code *int
	if err := json.Unmarshal(errObj["code"], &code); err != nil || code == nil {
		return false
	}
	var message *string
	if err := json.Unmarshal(errObj["message"], &message); err != nil || message == nil {
		return false
	}
	return true
}

// sendHTTP sends an HTTP request to the server. Once the session has ended,
// it refuses to, unless startsSession is set.
func (c *StreamableHTTP) sendHTTP(
	ctx context.Context,
	method string,
	body io.Reader,
	acceptType string,
	header http.Header,
	startsSession bool,
) (resp *http.Response, err error) {
	sessionID, ended := c.currentSession()
	if ended && !startsSession {
		return nil, ErrSessionTerminated
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, method, c.serverURL.String(), body)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// request headers; cloned because the transport headers below must not
	// leak into (or race on) the caller's map
	if header != nil {
		req.Header = header.Clone()
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", acceptType)
	// Protocol version 2026-07-28 retired the session header: a modern client
	// neither sends nor stores one (SEP-2567).
	sentSession := ""
	if sessionID != "" && !c.isModern() {
		sentSession = sessionID
		req.Header.Set(HeaderKeySessionID, sessionID)
	}
	// Set protocol version header if negotiated
	if v := c.protocolVersion.Load(); v != nil {
		if version, ok := v.(string); ok && version != "" {
			req.Header.Set(HeaderKeyProtocolVersion, version)
		}
	}
	for k, v := range c.headers {
		req.Header.Set(k, v)
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

	// Send request
	resp, err = c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}

	// universal handling for session terminated
	if resp.StatusCode == http.StatusNotFound {
		// A 404 on the GET stream may only mean the server doesn't offer it,
		// so the caller decides. Hand the body back: Close can block until
		// the request context is canceled, and the caller cancels first.
		// POST still closes here, then ends the session, before the caller
		// sees the error.
		if method == http.MethodGet {
			return resp, ErrSessionTerminated
		}
		resp.Body.Close()
		c.endSession(sentSession)
		return nil, ErrSessionTerminated
	}

	return resp, nil
}

// handleSSEResponse processes an SSE stream for a specific request.
// It returns the final result for the request once received, or an error.
// If ignoreResponse is true, it won't return when a response messge is received. This is for continuous listening.
func (c *StreamableHTTP) handleSSEResponse(ctx context.Context, reader io.ReadCloser, ignoreResponse bool) (*JSONRPCResponse, error) {
	// Create a channel for this specific request
	responseChan := make(chan *JSONRPCResponse, 1)
	// readErrChan reports how the SSE stream ended: nil means a clean EOF.
	readErrChan := make(chan error, 1)

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	// Start a goroutine to process the SSE stream
	go func() {
		defer func() {
			if r := recover(); r != nil {
				c.logger.Error("panic in SSE stream reader", "panic", r)
				readErrChan <- fmt.Errorf("panic in SSE stream reader: %v", r)
			}
		}()

		var cursor sseCursor
		delivered := false
		handle := func(event, data string) {
			// Try to unmarshal as a response first
			var message JSONRPCResponse
			if err := json.Unmarshal([]byte(data), &message); err != nil {
				c.logger.Info("failed to unmarshal message (non-fatal)", "err", err, "message_len", len(data))
				return
			}

			// Handle notification
			if message.ID.IsNil() {
				var notification mcp.JSONRPCNotification
				if err := json.Unmarshal([]byte(data), &notification); err != nil {
					c.logger.Error("failed to unmarshal notification", "err", err)
					return
				}
				c.notifyMu.RLock()
				handler := c.notificationHandler
				c.notifyMu.RUnlock()
				if handler != nil {
					handler(notification)
				}
				return
			}

			// Check if this is actually a request from the server by looking for method field
			var rawMessage map[string]json.RawMessage
			if err := json.Unmarshal([]byte(data), &rawMessage); err == nil {
				if _, hasMethod := rawMessage["method"]; hasMethod && !message.ID.IsNil() {
					var request JSONRPCRequest
					if err := json.Unmarshal([]byte(data), &request); err == nil {
						// This is a request from the server
						c.handleIncomingRequest(ctx, request)
						return
					}
				}
			}

			if !ignoreResponse {
				delivered = true
				responseChan <- &message
			}
		}
		readErr := c.readSSEWithCursor(ctx, reader, &cursor, handle)

		// Before protocol version 2026-07-28, a server may end the stream
		// before the response, once it has sent an event ID, and the client
		// polls it by reconnecting (SEP-1699). A stream that breaks off
		// fails the request, as before.
		for readErr == nil && !ignoreResponse && !delivered && ctx.Err() == nil && cursor.lastEventID != "" && !c.isModern() {
			_, readErr = c.resumeSSE(ctx, &cursor, handle)
			if readErr != nil {
				readErr = fmt.Errorf("failed to resume the SSE stream for the response: %w", readErr)
			}
		}
		if !delivered {
			readErrChan <- readErr
		}
	}()

	// Wait for the response, the end of the stream, or context cancellation
	select {
	case response := <-responseChan:
		if response == nil {
			return nil, fmt.Errorf("unexpected nil response")
		}
		return response, nil
	case readErr := <-readErrChan:
		if readErr != nil {
			return nil, readErr
		}
		// The stream ended cleanly without delivering a response.
		if ignoreResponse {
			// For continuous listening, a clean EOF means the server closed the
			// stream normally — this is a successful (ended) session, not a failure.
			return nil, nil
		}
		return nil, fmt.Errorf("SSE stream ended without a response")
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// defaultSSEReconnectDelay is how long a client waits before resuming an SSE
// stream when the server sent no retry field. minSSEReconnectDelay is the
// shortest wait it takes from one, so that a server asking for no wait at
// all isn't polled in a tight loop.
var (
	defaultSSEReconnectDelay = 1 * time.Second
	minSSEReconnectDelay     = 10 * time.Millisecond
)

// resumeSSE waits the reconnection time the server asked for, reopens the
// stream with a GET carrying Last-Event-ID, the 2025-11-25 way of resuming a
// stream the server ended before the response, and reads it. It reports
// whether the server ended this stream too.
func (c *StreamableHTTP) resumeSSE(ctx context.Context, cursor *sseCursor, handler func(event, data string)) (bool, error) {
	delay := defaultSSEReconnectDelay
	if cursor.hasRetry {
		delay = max(cursor.retry, minSSEReconnectDelay)
	}
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-timer.C:
	case <-ctx.Done():
		return false, ctx.Err()
	}

	// The connection gets a context of its own, so that it and the goroutine
	// readSSEWithCursor starts for it are released as soon as it ends, not
	// when the request does.
	ctx, cancel := context.WithCancel(ctx)
	header := make(http.Header)
	header.Set("Last-Event-ID", cursor.lastEventID)
	resp, err := c.sendHTTP(ctx, http.MethodGet, nil, "text/event-stream", header, false)
	if err != nil {
		cancel()
		// A GET 404 comes back with the body still open.
		if resp != nil && resp.Body != nil {
			resp.Body.Close()
		}
		return false, err
	}
	// Cancel before closing the body, as SendRequest does.
	defer func() { cancel(); resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return false, fmt.Errorf("unexpected status %d", resp.StatusCode)
	}
	if mediaType, _, _ := mime.ParseMediaType(resp.Header.Get("Content-Type")); mediaType != "text/event-stream" {
		return false, fmt.Errorf("unexpected content type %q", resp.Header.Get("Content-Type"))
	}
	err = c.readSSEWithCursor(ctx, resp.Body, cursor, handler)
	return err == nil, err
}

// readSSE reads the SSE stream(reader) and calls the handler for each event and data pair.
// It will end when the reader is closed (or the context is done).
//
// It returns nil when the stream ends cleanly (io.EOF), the context error when
// ctx is cancelled, or the underlying read error otherwise. Callers use this to
// distinguish a clean disconnect from a failed one.
//
// A background goroutine closes the reader when ctx is cancelled, which unblocks
// any in-progress ReadString call. This is necessary because ReadString is blocking
// I/O that does not respect context cancellation on its own.
func (c *StreamableHTTP) readSSE(ctx context.Context, reader io.ReadCloser, handler func(event, data string)) error {
	return c.readSSEWithCursor(ctx, reader, nil, handler)
}

// sseCursor holds what a client needs to resume an SSE stream (SEP-1699):
// the ID of the last event dispatched and the reconnection time the server
// asked for with the retry field, if any.
type sseCursor struct {
	lastEventID string
	retry       time.Duration
	hasRetry    bool
}

// readSSEWithCursor is readSSE that also records the id and retry fields
// in cursor, when it isn't nil, and returns nil when the server ended the
// stream, or an error if it breaks off or the context ends. As in the SSE
// spec, an event's id counts once the event is dispatched, even an event
// with no data, which is how a server primes the client to reconnect.
func (c *StreamableHTTP) readSSEWithCursor(ctx context.Context, reader io.ReadCloser, cursor *sseCursor, handler func(event, data string)) error {
	// Close the reader when context is cancelled to interrupt blocking reads.
	// This ensures ReadString returns immediately with an error instead of
	// blocking indefinitely when the SSE stream is open but idle.
	go func() {
		defer func() {
			if r := recover(); r != nil {
				c.logger.Error("panic closing SSE reader", "panic", r)
			}
		}()
		<-ctx.Done()
		reader.Close()
	}()

	br := bufio.NewReader(reader)
	var event, data, id string
	var hasID bool
	commitID := func() {
		if cursor != nil && hasID {
			cursor.lastEventID = id
		}
		hasID = false
	}

	for {
		line, err := readSSELine(br, c.maxMessageBytes)
		if err != nil {
			// Context was cancelled — reader was closed by the goroutine above.
			if ctx.Err() != nil {
				return ctx.Err()
			}
			if err == io.EOF {
				// Process any pending event before exit. Its id isn't
				// recorded, as the event was never finished: resuming from
				// the one before at worst repeats it.
				if data != "" {
					if event == "" {
						event = "message"
					}
					handler(event, data)
				}
				return nil
			}
			c.logger.Error("SSE stream error", "err", err)
			return fmt.Errorf("SSE stream error: %w", err)
		}

		// Remove only newline markers
		line = strings.TrimRight(line, "\r\n")
		if line == "" {
			// Empty line means end of event
			commitID()
			if data != "" {
				if event == "" {
					event = "message"
				}
				handler(event, data)
				data = ""
			}
			// The event type resets on every dispatch, even one with no
			// data, so it cannot leak into the next event.
			event = ""
			continue
		}

		if eventStr, ok := strings.CutPrefix(line, "event:"); ok {
			event = strings.TrimSpace(eventStr)
		} else if dataStr, ok := strings.CutPrefix(line, "data:"); ok {
			data = appendSSEData(data, dataStr)
			if c.maxMessageBytes > 0 && int64(len(data)) > c.maxMessageBytes {
				c.logger.Error("SSE stream error", "err", ErrMessageTooLarge)
				return ErrMessageTooLarge
			}
		} else if idStr, ok := strings.CutPrefix(line, "id:"); ok {
			// The SSE spec ignores an id that contains a NUL character.
			if value := strings.TrimPrefix(idStr, " "); !strings.ContainsRune(value, 0) {
				id, hasID = value, true
			}
		} else if retryStr, ok := strings.CutPrefix(line, "retry:"); ok && cursor != nil {
			// Only ASCII digits are a valid retry value.
			value := strings.TrimPrefix(retryStr, " ")
			if ms, err := strconv.ParseUint(value, 10, 31); err == nil && value != "" && strings.Trim(value, "0123456789") == "" {
				cursor.retry = time.Duration(ms) * time.Millisecond
				cursor.hasRetry = true
			}
		}
	}
}

// SendNotification sends a JSON-RPC notification to the server without expecting a response.
func (c *StreamableHTTP) SendNotification(ctx context.Context, notification mcp.JSONRPCNotification) error {
	// Marshal request
	requestBody, err := json.Marshal(notification)
	if err != nil {
		return fmt.Errorf("failed to marshal notification: %w", err)
	}

	// Create HTTP request
	ctx, cancel := c.contextAwareOfClientClose(ctx)

	resp, err := c.sendHTTP(ctx, http.MethodPost, bytes.NewReader(requestBody), "application/json, text/event-stream", nil, false)
	if err != nil {
		cancel()
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer func() { cancel(); resp.Body.Close() }()

	switch resp.StatusCode {
	case http.StatusOK, http.StatusAccepted, http.StatusNoContent:
		return nil
	case http.StatusUnauthorized:
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
	default:
		body := readErrorBody(resp.Body)
		return fmt.Errorf(
			"notification failed with status %d: %s",
			resp.StatusCode,
			body,
		)
	}
}

// SetNotificationHandler sets the handler for incoming JSON-RPC notifications.
// A handler may replace or remove itself; the change applies to subsequent notifications.
func (c *StreamableHTTP) SetNotificationHandler(handler func(mcp.JSONRPCNotification)) {
	c.notifyMu.Lock()
	defer c.notifyMu.Unlock()
	c.notificationHandler = handler
}

// SetRequestHandler sets the handler for incoming requests from the server.
func (c *StreamableHTTP) SetRequestHandler(handler RequestHandler) {
	c.requestMu.Lock()
	defer c.requestMu.Unlock()
	c.requestHandler = handler
}

// GetSessionId returns the current StreamableHTTP session ID.
func (c *StreamableHTTP) GetSessionId() string {
	return c.sessionID.Load().(string)
}

// GetOAuthHandler returns the OAuth handler if configured
func (c *StreamableHTTP) GetOAuthHandler() *OAuthHandler {
	return c.oauthHandler
}

// IsOAuthEnabled returns true if OAuth is enabled
func (c *StreamableHTTP) IsOAuthEnabled() bool {
	return c.oauthHandler != nil
}

func (c *StreamableHTTP) listenForever(ctx context.Context) {
	c.logger.Info("listening to server forever")
	baseDelay := c.retryInterval
	maxDelay := time.Duration(0)
	if c.reconnectInitialDelay > 0 {
		baseDelay = c.reconnectInitialDelay
		maxDelay = max(c.reconnectMaxDelay, baseDelay)
	}
	delay := baseDelay
	// openedOn is the last session the stream opened on.
	openedOn := ""
	for {
		// No per-connection timeout - persistent SSE connections are meant to
		// stay open indefinitely:
		// 1. The SSE connection itself will detect disconnections via the underlying HTTP transport
		// 2. Network-level timeouts and keep-alives handle connection health
		// 3. Context cancellation (user-initiated or system shutdown) provides clean shutdown
		// Each connection has its own context, which a new session cancels so
		// that the stream follows it. While the session has ended, listenOn
		// waits for the caller to start a new one.
		connCtx, cancelConn := context.WithCancel(ctx)
		session, ok := c.listenOn(ctx, cancelConn)
		if !ok {
			cancelConn()
			return
		}
		opened, err := c.createGETConnectionToServer(connCtx)
		c.listenDone()
		moved := connCtx.Err() != nil
		cancelConn()
		if opened {
			openedOn = session
		}
		if errors.Is(err, ErrGetMethodNotAllowed) {
			// server does not support listening
			c.logger.Error("server does not support listening")
			return
		}
		if errors.Is(err, ErrSessionTerminated) {
			// The server answered 404, or the session ended before the GET went
			// out. If the stream worked on the session, the server has forgotten
			// it (restarted, or the session expired): listen again once the
			// caller starts a new session. If the stream never opened on it, and
			// the session is still current, the server doesn't offer the stream
			// (it should answer 405), so stop.
			if session == openedOn {
				c.endSession(session)
			}
			if current, ended := c.currentSession(); !ended && current == session {
				c.logger.Error("session terminated, stopping listener", "err", err)
				return
			}
			c.logger.Info("session terminated, listening again after re-initialization", "err", err)
			continue
		}

		select {
		case <-ctx.Done():
			return
		default:
		}
		if moved {
			// A new session started.
			continue
		}

		if err != nil {
			c.logger.Error("failed to listen to server", "err", err, "retryIn", delay)
		} else {
			// The stream ended cleanly: reconnect after baseDelay and let later
			// failures start backing off from baseDelay again.
			delay = baseDelay
		}

		// Use context-aware sleep
		select {
		case <-time.After(delay):
		case <-ctx.Done():
			return
		}

		if err != nil {
			delay = nextReconnectDelay(delay, baseDelay, maxDelay)
		}
	}
}

// nextReconnectDelay returns the reconnect delay to use after a failed
// attempt. A maxDelay <= 0 means backoff is disabled and the delay stays at
// baseDelay; otherwise the delay doubles, capped at maxDelay.
func nextReconnectDelay(current, baseDelay, maxDelay time.Duration) time.Duration {
	if maxDelay <= 0 {
		return baseDelay
	}
	if current > maxDelay/2 {
		return maxDelay
	}
	return current * 2
}

var (
	// ErrSessionTerminated indicates the server no longer recognizes the current session.
	ErrSessionTerminated   = fmt.Errorf("session terminated (404). need to re-initialize")
	ErrGetMethodNotAllowed = fmt.Errorf("GET method not allowed")
	ErrUnauthorized        = fmt.Errorf("unauthorized (401)")
	ErrLegacySSEServer     = fmt.Errorf("server returned 4xx for initialize POST, likely a legacy SSE server")

	retryInterval = 1 * time.Second // a variable is convenient for testing
)

// createGETConnectionToServer opens the GET stream and reads it until it
// ends. opened reports whether the server accepted the stream.
func (c *StreamableHTTP) createGETConnectionToServer(ctx context.Context) (opened bool, err error) {
	ctx, cancel := c.contextAwareOfClientClose(ctx)

	resp, err := c.sendHTTP(ctx, http.MethodGet, nil, "text/event-stream", nil, false)
	if err != nil {
		cancel()
		// A GET 404 comes back with the body still open.
		if resp != nil && resp.Body != nil {
			resp.Body.Close()
		}
		return false, fmt.Errorf("failed to send request: %w", err)
	}
	// Cancel the context before closing the body to prevent HTTP/2 drain hangs,
	// matching the pattern used in SendRequest and SendNotification.
	defer func() { cancel(); resp.Body.Close() }()

	// Check if we got an error response
	if resp.StatusCode == http.StatusMethodNotAllowed {
		return false, ErrGetMethodNotAllowed
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
		body := readErrorBody(resp.Body)
		return false, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, body)
	}

	// handle SSE response. Parse the media type to tolerate parameters such as
	// "text/event-stream; charset=utf-8" (same handling as SendRequest).
	mediaType, _, _ := mime.ParseMediaType(resp.Header.Get("Content-Type"))
	if mediaType != "text/event-stream" {
		return false, fmt.Errorf("unexpected content type: %s", resp.Header.Get("Content-Type"))
	}

	// With ignoreResponse set, this returns nil error when the stream ends
	// cleanly (server closed the connection), and a non-nil error on context
	// cancellation or an actual read/protocol failure.
	// NOTICE: Due to the ambiguity of the specification, other SDKs may use the GET connection to transfer the response
	// messages. To be more compatible, we should handle this response, however, as the transport layer is message-based,
	// currently, there is no convenient way to handle this response.
	// So we ignore the response here. It's not a bug, but may be not compatible with other SDKs.
	_, err = c.handleSSEResponse(ctx, resp.Body, true)
	if err != nil {
		return true, fmt.Errorf("failed to handle SSE response: %w", err)
	}

	return true, nil
}

// handleIncomingRequest processes requests from the server (like sampling requests)
func (c *StreamableHTTP) handleIncomingRequest(ctx context.Context, request JSONRPCRequest) {
	c.requestMu.RLock()
	handler := c.requestHandler
	c.requestMu.RUnlock()

	if handler == nil {
		c.logger.Error("received request from server but no handler set", "method", request.Method)
		// Send method not found error
		errorResponse := NewJSONRPCErrorResponse(
			request.ID,
			mcp.METHOD_NOT_FOUND,
			fmt.Sprintf("no handler configured for method: %s", request.Method),
			nil,
		)
		c.sendResponseToServer(ctx, errorResponse)
		return
	}

	// Handle the request in a goroutine to avoid blocking the SSE reader
	go func() {
		defer func() {
			if r := recover(); r != nil {
				c.logger.Error("panic handling server request", "method", request.Method, "panic", r)
				// Attempt to send an internal error response so the server doesn't hang.
				// Use a nested recover to prevent sendResponseToServer from propagating
				// a secondary panic (e.g., nil serverURL during shutdown).
				func() {
					defer func() {
						if r2 := recover(); r2 != nil {
							c.logger.Error("failed to send error response after panic", "err", r2)
						}
					}()
					errorResponse := NewJSONRPCErrorResponse(
						request.ID,
						mcp.INTERNAL_ERROR,
						fmt.Sprintf("internal error: panic in request handler: %v", r),
						nil,
					)
					c.sendResponseToServer(ctx, errorResponse)
				}()
			}
		}()
		// Create a new context with timeout for request handling, respecting parent context
		requestCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		defer cancel()

		response, err := handler(requestCtx, request)
		if err != nil {
			c.logger.Error("error handling request", "method", request.Method, "err", err)

			// Determine appropriate JSON-RPC error code based on error type
			var errorCode int
			var errorMessage string

			// Check for specific sampling-related errors
			if errors.Is(err, context.Canceled) {
				errorCode = mcp.REQUEST_INTERRUPTED
				errorMessage = "request was cancelled"
			} else if errors.Is(err, context.DeadlineExceeded) {
				errorCode = mcp.REQUEST_INTERRUPTED
				errorMessage = "request timed out"
			} else {
				// Generic error cases
				switch request.Method {
				case string(mcp.MethodSamplingCreateMessage):
					errorCode = mcp.INTERNAL_ERROR
					errorMessage = fmt.Sprintf("sampling request failed: %v", err)
				default:
					errorCode = mcp.INTERNAL_ERROR
					errorMessage = err.Error()
				}
			}

			// Send error response
			errorResponse := NewJSONRPCErrorResponse(request.ID, errorCode, errorMessage, nil)
			c.sendResponseToServer(requestCtx, errorResponse)
			return
		}

		if response != nil {
			c.sendResponseToServer(requestCtx, response)
		}
	}()
}

// sendResponseToServer sends a response back to the server via HTTP POST
func (c *StreamableHTTP) sendResponseToServer(ctx context.Context, response *JSONRPCResponse) {
	if response == nil {
		c.logger.Error("cannot send nil response to server")
		return
	}

	responseBody, err := json.Marshal(response)
	if err != nil {
		c.logger.Error("failed to marshal response", "err", err)
		return
	}

	ctx, cancel := c.contextAwareOfClientClose(ctx)

	resp, err := c.sendHTTP(ctx, http.MethodPost, bytes.NewReader(responseBody), "application/json, text/event-stream", nil, false)
	if err != nil {
		cancel()
		c.logger.Error("failed to send response to server", "err", err)
		return
	}
	defer func() { cancel(); resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
		body := readErrorBody(resp.Body)
		c.logger.Error("server rejected response", "status", resp.StatusCode, "body_len", len(body))
	}
}

func (c *StreamableHTTP) contextAwareOfClientClose(ctx context.Context) (context.Context, context.CancelFunc) {
	newCtx, cancel := context.WithCancel(ctx)
	go func() {
		defer func() {
			if r := recover(); r != nil {
				c.logger.Error("panic in context-close watcher", "panic", r)
			}
		}()
		select {
		case <-c.closed:
			cancel()
		case <-newCtx.Done():
			// The original context was canceled
			cancel()
		}
	}()
	return newCtx, cancel
}

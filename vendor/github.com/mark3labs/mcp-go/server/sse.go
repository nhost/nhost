package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"path"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"

	"github.com/mark3labs/mcp-go/mcp"
)

// sseSession represents an active SSE connection.
type sseSession struct {
	clientInfoStore // provides Get/SetClientInfo and Get/SetClientCapabilities via method promotion

	done                chan struct{}
	doneOnce            sync.Once
	eventQueue          chan string // Channel for queuing events
	sessionID           string
	requestID           atomic.Int64
	notificationChannel chan mcp.JSONRPCNotification
	initialized         atomic.Bool
	loggingLevel        atomic.Value
	tools               sync.Map // stores session-specific tools
	resources           sync.Map // stores session-specific resources
	resourceTemplates   sync.Map // stores session-specific resource templates
}

// closeDone safely closes the session's done channel exactly once,
// preventing panics from concurrent close attempts.
func (s *sseSession) closeDone() {
	s.doneOnce.Do(func() {
		close(s.done)
	})
}

// SSEContextFunc is a function that takes an existing context and the current
// request and returns a potentially modified context based on the request
// content. This can be used to inject context values from headers, for example.
type SSEContextFunc func(ctx context.Context, r *http.Request) context.Context

// DynamicBasePathFunc allows the user to provide a function to generate the
// base path for a given request and sessionID. This is useful for cases where
// the base path is not known at the time of SSE server creation, such as when
// using a reverse proxy or when the base path is dynamically generated. The
// function should return the base path (e.g., "/mcp/tenant123").
type DynamicBasePathFunc func(r *http.Request, sessionID string) string

// SessionIDGenFunc is a function that produces a session ID for a new SSE connection.
// It receives the request context and the HTTP request, and should return a session
// identifier (string) or an error.
type SessionIDGenFunc func(ctx context.Context, r *http.Request) (string, error)

func (s *sseSession) SessionID() string {
	return s.sessionID
}

func (s *sseSession) NotificationChannel() chan<- mcp.JSONRPCNotification {
	return s.notificationChannel
}

func (s *sseSession) Initialize() {
	// set default logging level
	s.loggingLevel.Store(mcp.LoggingLevelError)
	s.initialized.Store(true)
}

func (s *sseSession) Initialized() bool {
	return s.initialized.Load()
}

func (s *sseSession) SetLogLevel(level mcp.LoggingLevel) {
	s.loggingLevel.Store(level)
}

func (s *sseSession) GetLogLevel() mcp.LoggingLevel {
	level := s.loggingLevel.Load()
	if level == nil {
		return mcp.LoggingLevelError
	}
	return level.(mcp.LoggingLevel)
}

func (s *sseSession) GetSessionResources() map[string]ServerResource {
	resources := make(map[string]ServerResource)
	s.resources.Range(func(key, value any) bool {
		if resource, ok := value.(ServerResource); ok {
			resources[key.(string)] = resource
		}
		return true
	})
	return resources
}

func (s *sseSession) SetSessionResources(resources map[string]ServerResource) {
	// Clear existing resources
	s.resources.Clear()

	// Set new resources
	for name, resource := range resources {
		s.resources.Store(name, resource)
	}
}

func (s *sseSession) GetSessionResourceTemplates() map[string]ServerResourceTemplate {
	templates := make(map[string]ServerResourceTemplate)
	s.resourceTemplates.Range(func(key, value any) bool {
		if template, ok := value.(ServerResourceTemplate); ok {
			templates[key.(string)] = template
		}
		return true
	})
	return templates
}

func (s *sseSession) SetSessionResourceTemplates(templates map[string]ServerResourceTemplate) {
	// Clear existing templates
	s.resourceTemplates.Clear()

	// Set new templates
	for uriTemplate, template := range templates {
		s.resourceTemplates.Store(uriTemplate, template)
	}
}

func (s *sseSession) GetSessionTools() map[string]ServerTool {
	tools := make(map[string]ServerTool)
	s.tools.Range(func(key, value any) bool {
		if tool, ok := value.(ServerTool); ok {
			tools[key.(string)] = tool
		}
		return true
	})
	return tools
}

func (s *sseSession) SetSessionTools(tools map[string]ServerTool) {
	// Clear existing tools
	s.tools.Clear()

	// Set new tools
	for name, tool := range tools {
		s.tools.Store(name, tool)
	}
}

var (
	_ ClientSession                = (*sseSession)(nil)
	_ SessionWithTools             = (*sseSession)(nil)
	_ SessionWithResources         = (*sseSession)(nil)
	_ SessionWithResourceTemplates = (*sseSession)(nil)
	_ SessionWithLogging           = (*sseSession)(nil)
	_ SessionWithClientInfo        = (*sseSession)(nil)
)

// SSEServer implements a Server-Sent Events (SSE) based MCP server.
// It provides real-time communication capabilities over HTTP using the SSE protocol.
type SSEServer struct {
	server                       *MCPServer
	baseURL                      string
	basePath                     string
	appendQueryToMessageEndpoint bool
	useFullURLForMessageEndpoint bool
	messageEndpoint              string
	sseEndpoint                  string
	sessions                     sync.Map
	srv                          *http.Server
	contextFunc                  SSEContextFunc
	dynamicBasePathFunc          DynamicBasePathFunc
	sessionIDGenFunc             SessionIDGenFunc

	keepAlive         bool
	keepAliveInterval time.Duration

	// protectedResourceMetadata, when non-nil, is served as RFC 9728 OAuth
	// 2.0 Protected Resource Metadata. The well-known path is derived from
	// the configured Resource via ProtectedResourceMetadataPath.
	protectedResourceMetadata        *ProtectedResourceMetadataConfig
	protectedResourceMetadataPath    string
	protectedResourceMetadataHandler http.Handler

	// corsConfig, when non-nil and with at least one allowed origin, makes
	// the SSE server emit CORS headers and handle preflight requests. See
	// WithSSECORS.
	corsConfig *CORSConfig

	// disableLocalhostProtection, when true, turns off the automatic DNS
	// rebinding protection applied to requests arriving over loopback
	// connections. See WithSSEDisableLocalhostProtection.
	disableLocalhostProtection bool

	// maxRequestBodyBytes bounds a message POST body; zero or less is no
	// bound. See WithSSEMaxRequestBodyBytes.
	maxRequestBodyBytes int64

	mu sync.RWMutex
}

// SSEOption defines a function type for configuring SSEServer
type SSEOption func(*SSEServer)

// WithBaseURL sets the base URL for the SSE server
func WithBaseURL(baseURL string) SSEOption {
	return func(s *SSEServer) {
		if baseURL != "" {
			u, err := url.Parse(baseURL)
			if err != nil {
				return
			}
			if u.Scheme != "http" && u.Scheme != "https" {
				return
			}
			// Check if the host is empty or only contains a port
			if u.Host == "" || strings.HasPrefix(u.Host, ":") {
				return
			}
			if len(u.Query()) > 0 {
				return
			}
		}
		s.baseURL = strings.TrimSuffix(baseURL, "/")
	}
}

// WithStaticBasePath adds a new option for setting a static base path
func WithStaticBasePath(basePath string) SSEOption {
	return func(s *SSEServer) {
		s.basePath = normalizeURLPath(basePath)
	}
}

// WithBasePath adds a new option for setting a static base path.
//
// Deprecated: Use WithStaticBasePath instead. This will be removed in a future version.
//
//go:deprecated
func WithBasePath(basePath string) SSEOption {
	return WithStaticBasePath(basePath)
}

// WithDynamicBasePath accepts a function for generating the base path. This is
// useful for cases where the base path is not known at the time of SSE server
// creation, such as when using a reverse proxy or when the server is mounted
// at a dynamic path.
func WithDynamicBasePath(fn DynamicBasePathFunc) SSEOption {
	return func(s *SSEServer) {
		if fn != nil {
			s.dynamicBasePathFunc = func(r *http.Request, sid string) string {
				bp := fn(r, sid)
				return normalizeURLPath(bp)
			}
		}
	}
}

// WithMessageEndpoint sets the message endpoint path
func WithMessageEndpoint(endpoint string) SSEOption {
	return func(s *SSEServer) {
		s.messageEndpoint = endpoint
	}
}

// WithAppendQueryToMessageEndpoint configures the SSE server to append the original request's
// query parameters to the message endpoint URL that is sent to clients during the SSE connection
// initialization. This is useful when you need to preserve query parameters from the initial
// SSE connection request and carry them over to subsequent message requests, maintaining
// context or authentication details across the communication channel.
func WithAppendQueryToMessageEndpoint() SSEOption {
	return func(s *SSEServer) {
		s.appendQueryToMessageEndpoint = true
	}
}

// WithUseFullURLForMessageEndpoint controls whether the SSE server returns a complete URL (including baseURL)
// or just the path portion for the message endpoint. Set to false when clients will concatenate
// the baseURL themselves to avoid malformed URLs like "http://localhost/mcphttp://localhost/mcp/message".
func WithUseFullURLForMessageEndpoint(useFullURLForMessageEndpoint bool) SSEOption {
	return func(s *SSEServer) {
		s.useFullURLForMessageEndpoint = useFullURLForMessageEndpoint
	}
}

// WithSSEEndpoint sets the SSE endpoint path
func WithSSEEndpoint(endpoint string) SSEOption {
	return func(s *SSEServer) {
		s.sseEndpoint = endpoint
	}
}

// WithHTTPServer sets the HTTP server instance.
// NOTE: When providing a custom HTTP server, you must handle routing yourself
// If routing is not set up, the server will start but won't handle any MCP requests.
func WithHTTPServer(srv *http.Server) SSEOption {
	return func(s *SSEServer) {
		s.srv = srv
	}
}

func WithKeepAliveInterval(keepAliveInterval time.Duration) SSEOption {
	return func(s *SSEServer) {
		s.keepAlive = true
		s.keepAliveInterval = keepAliveInterval
	}
}

func WithKeepAlive(keepAlive bool) SSEOption {
	return func(s *SSEServer) {
		s.keepAlive = keepAlive
	}
}

// WithSSEProtectedResourceMetadata configures the SSEServer to serve OAuth
// 2.0 Protected Resource Metadata (RFC 9728) at the well-known endpoint
// derived from the configured Resource (see ProtectedResourceMetadataPath).
//
// The metadata is served both when the server is started via Start (the
// well-known path is dispatched from ServeHTTP) and when the server is used
// directly as an http.Handler. When using WithHTTPServer with a custom
// http.Server whose Handler is not the SSEServer itself, mount the metadata
// endpoint manually via NewProtectedResourceMetadataHandler.
func WithSSEProtectedResourceMetadata(config ProtectedResourceMetadataConfig) SSEOption {
	return func(s *SSEServer) {
		cfg := config
		s.protectedResourceMetadata = &cfg
		s.protectedResourceMetadataPath = ProtectedResourceMetadataPath(cfg.Resource)
		s.protectedResourceMetadataHandler = NewProtectedResourceMetadataHandler(cfg)
	}
}

// WithSSECORS configures Cross-Origin Resource Sharing for the SSE server.
//
// CORS handling is opt-in: callers must specify at least one allowed origin
// via WithCORSAllowedOrigins for any Access-Control-* headers to be emitted.
// When enabled, preflight (OPTIONS) requests are handled directly by the
// server and simple cross-origin responses get the appropriate Allow-Origin,
// Allow-Credentials, Expose-Headers and Vary headers attached.
//
// Example:
//
//	srv := server.NewSSEServer(mcpServer,
//	    server.WithSSECORS(
//	        server.WithCORSAllowedOrigins("https://example.com"),
//	        server.WithCORSAllowCredentials(),
//	    ),
//	)
func WithSSECORS(opts ...CORSOption) SSEOption {
	return func(s *SSEServer) {
		if s.corsConfig == nil {
			s.corsConfig = &CORSConfig{}
		}
		for _, opt := range opts {
			if opt != nil {
				opt(s.corsConfig)
			}
		}
	}
}

// WithSSEDisableLocalhostProtection disables the automatic DNS rebinding
// protection of the SSE server.
//
// By default, requests arriving over a loopback connection (127.0.0.1,
// [::1]) whose Host header is not a localhost value are rejected with 403
// Forbidden. This protects local MCP servers against DNS rebinding attacks,
// where a malicious website rebinds its own domain to 127.0.0.1 to make a
// victim's browser issue requests against a local server. The protection
// applies regardless of whether the server listens on localhost specifically
// or on 0.0.0.0, and never affects requests arriving via non-loopback
// addresses.
//
// Disable it only if you understand the security implications, for example
// when a reverse proxy on the same host forwards requests via localhost
// while preserving the original Host header. In that case, prefer
// configuring the proxy to rewrite the Host header to localhost instead.
//
// See https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices#local-mcp-server-compromise
func WithSSEDisableLocalhostProtection(disable bool) SSEOption {
	return func(s *SSEServer) {
		s.disableLocalhostProtection = disable
	}
}

// WithSSEMaxRequestBodyBytes bounds the body of a POST to the message
// endpoint: the server reads at most n bytes of it, and answers a larger one
// 413 Request Entity Too Large with a JSON-RPC error, so a client cannot make
// the server hold an arbitrary amount of memory. The default is
// DefaultMaxRequestBodyBytes; zero or less removes the bound.
func WithSSEMaxRequestBodyBytes(n int64) SSEOption {
	return func(s *SSEServer) {
		s.maxRequestBodyBytes = n
	}
}

// WithSSEContextFunc sets a function that will be called to customise the context
// to the server using the incoming request.
func WithSSEContextFunc(fn SSEContextFunc) SSEOption {
	return func(s *SSEServer) {
		s.contextFunc = fn
	}
}

// WithSessionIDGenerator sets a custom session ID generator. If fn == nil the call is ignored.
func WithSessionIDGenerator(fn SessionIDGenFunc) SSEOption {
	return func(s *SSEServer) {
		if fn != nil {
			s.sessionIDGenFunc = fn
		}
	}
}

// NewSSEServer creates a new SSE server instance with the given MCP server and options.
func NewSSEServer(server *MCPServer, opts ...SSEOption) *SSEServer {
	s := &SSEServer{
		server:                       server,
		sseEndpoint:                  "/sse",
		messageEndpoint:              "/message",
		useFullURLForMessageEndpoint: true,
		keepAlive:                    false,
		keepAliveInterval:            10 * time.Second,
		maxRequestBodyBytes:          DefaultMaxRequestBodyBytes,
		sessionIDGenFunc: func(ctx context.Context, r *http.Request) (string, error) {
			return uuid.New().String(), nil
		},
	}

	// Apply all options
	for _, opt := range opts {
		opt(s)
	}

	return s
}

// Start begins serving SSE connections on the specified address.
// It sets up HTTP handlers for SSE and message endpoints.
func (s *SSEServer) Start(addr string) error {
	s.mu.Lock()
	if s.srv == nil {
		s.srv = &http.Server{
			Addr:    addr,
			Handler: s,
		}
	} else {
		if s.srv.Addr == "" {
			s.srv.Addr = addr
		} else if s.srv.Addr != addr {
			s.mu.Unlock()
			return fmt.Errorf("conflicting listen address: WithHTTPServer(%q) vs Start(%q)", s.srv.Addr, addr)
		}
	}
	srv := s.srv
	s.mu.Unlock()

	return srv.ListenAndServe()
}

// Shutdown gracefully stops the SSE server, closing all active sessions
// and shutting down the HTTP server.
func (s *SSEServer) Shutdown(ctx context.Context) error {
	s.mu.RLock()
	srv := s.srv
	s.mu.RUnlock()

	if srv != nil {
		s.CloseSessions()
		return srv.Shutdown(ctx)
	}
	return nil
}

// CloseSessions terminates all active SSE sessions without stopping the HTTP
// server. This is useful when the SSE server is embedded within another HTTP
// service and you need to disconnect all clients independently of the server
// lifecycle (e.g., during a configuration reload or maintenance window).
// This signals termination; in-flight handlers exit asynchronously.
// Sessions connecting concurrently with this call may not be terminated.
func (s *SSEServer) CloseSessions() {
	s.sessions.Range(func(key, value any) bool {
		if session, ok := value.(*sseSession); ok {
			session.closeDone()
		}
		s.sessions.Delete(key)
		return true
	})
}

// handleSSE handles incoming SSE connection requests.
// It sets up appropriate headers and creates a new session for the client.
func (s *SSEServer) handleSSE(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	// Preserve historical default of allowing any origin for browser-based
	// EventSource clients, unless the caller has opted into an explicit
	// CORS configuration via WithSSECORS (which has already populated the
	// Access-Control-* headers on the response).
	if !s.corsConfig.enabled() {
		w.Header().Set("Access-Control-Allow-Origin", "*")
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	sessionID, err := s.sessionIDGenFunc(r.Context(), r)
	if err != nil {
		http.Error(w, "Failed to create session ID", http.StatusInternalServerError)
		return
	}
	if sessionID == "" {
		http.Error(w, "Failed to create session ID", http.StatusInternalServerError)
		return
	}

	session := &sseSession{
		done:                make(chan struct{}),
		eventQueue:          make(chan string, 100), // Buffer for events
		sessionID:           sessionID,
		notificationChannel: make(chan mcp.JSONRPCNotification, 100),
	}
	// Whichever way the stream ends, release the goroutines waiting to
	// queue a response for it.
	defer session.closeDone()

	s.sessions.Store(sessionID, session)
	defer s.sessions.Delete(sessionID)

	if err := s.server.RegisterSession(r.Context(), session); err != nil {
		http.Error(
			w,
			fmt.Sprintf("Session registration failed: %v", err),
			http.StatusInternalServerError,
		)
		return
	}
	defer s.server.UnregisterSession(r.Context(), sessionID)

	// Start notification handler for this session
	go func() {
		for {
			select {
			case notification := <-session.notificationChannel:
				eventData, err := json.Marshal(notification)
				if err == nil {
					select {
					case session.eventQueue <- fmt.Sprintf("event: message\ndata: %s\n\n", eventData):
						// Event queued successfully
					case <-session.done:
						return
					}
				}
			case <-session.done:
				return
			case <-r.Context().Done():
				return
			}
		}
	}()

	// Start keep alive : ping
	if s.keepAlive {
		go func() {
			ticker := time.NewTicker(s.keepAliveInterval)
			defer ticker.Stop()
			for {
				select {
				case <-ticker.C:
					message := mcp.JSONRPCRequest{
						JSONRPC: "2.0",
						ID:      mcp.NewRequestId(session.requestID.Add(1)),
						Request: mcp.Request{
							Method: string(mcp.MethodPing),
						},
					}
					messageBytes, _ := json.Marshal(message)
					pingMsg := fmt.Sprintf("event: message\ndata:%s\n\n", messageBytes)
					select {
					case session.eventQueue <- pingMsg:
						// Message sent successfully
					case <-session.done:
						return
					}
				case <-session.done:
					return
				case <-r.Context().Done():
					return
				}
			}
		}()
	}

	// Send the initial endpoint event
	endpoint := s.GetMessageEndpointForClient(r, sessionID)
	if s.appendQueryToMessageEndpoint && len(r.URL.RawQuery) > 0 {
		endpoint += "&" + r.URL.RawQuery
	}
	fmt.Fprintf(w, "event: endpoint\ndata: %s\r\n\r\n", endpoint)
	flusher.Flush()

	// Main event loop - this runs in the HTTP handler goroutine
	for {
		select {
		case event := <-session.eventQueue:
			// Write the event to the response
			fmt.Fprint(w, event)
			flusher.Flush()
		case <-r.Context().Done():
			session.closeDone()
			return
		case <-session.done:
			return
		}
	}
}

// GetMessageEndpointForClient returns the appropriate message endpoint URL with session ID
// for the given request. This is the canonical way to compute the message endpoint for a client.
// It handles both dynamic and static path modes, and honors the WithUseFullURLForMessageEndpoint flag.
func (s *SSEServer) GetMessageEndpointForClient(r *http.Request, sessionID string) string {
	basePath := s.basePath
	if s.dynamicBasePathFunc != nil {
		basePath = s.dynamicBasePathFunc(r, sessionID)
	}

	endpointPath := normalizeURLPath(basePath, s.messageEndpoint)
	if s.useFullURLForMessageEndpoint && s.baseURL != "" {
		endpointPath = s.baseURL + endpointPath
	}

	return fmt.Sprintf("%s?sessionId=%s", endpointPath, sessionID)
}

// handleMessage processes incoming JSON-RPC messages from clients and sends responses
// back through the SSE connection and 202 code to HTTP response.
func (s *SSEServer) handleMessage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.writeJSONRPCError(w, nil, mcp.INVALID_REQUEST, "Method not allowed")
		return
	}

	sessionID := r.URL.Query().Get("sessionId")
	if sessionID == "" {
		s.writeJSONRPCError(w, nil, mcp.INVALID_PARAMS, "Missing sessionId")
		return
	}
	sessionI, ok := s.sessions.Load(sessionID)
	if !ok {
		s.writeJSONRPCError(w, nil, mcp.INVALID_PARAMS, "Invalid session ID")
		return
	}
	session := sessionI.(*sseSession)

	// Set the client context before handling the message
	ctx := s.server.WithContext(r.Context(), session)
	if s.contextFunc != nil {
		ctx = s.contextFunc(ctx, r)
	}

	body, err := readRequestBody(r, s.maxRequestBodyBytes)
	if errors.Is(err, errBodyTooLarge) {
		writeJSONRPCErrorStatus(w, http.StatusRequestEntityTooLarge, nil, mcp.INVALID_REQUEST,
			fmt.Sprintf("request body exceeds %d bytes", s.maxRequestBodyBytes), func(err error) {
				log.Printf("Failed to encode response: %v", err)
			})
		return
	}

	// Parse message as raw JSON
	var rawMessage json.RawMessage
	if err != nil || json.NewDecoder(bytes.NewReader(body)).Decode(&rawMessage) != nil {
		s.writeJSONRPCError(w, nil, mcp.PARSE_ERROR, "Parse error")
		return
	}

	// Create a context that preserves all values from parent ctx but won't be canceled when the parent is canceled.
	// this is required because the http ctx will be canceled when the client disconnects
	detachedCtx := context.WithoutCancel(ctx)

	// quick return request, send 202 Accepted with no body, then deal the message and sent response via SSE
	w.WriteHeader(http.StatusAccepted)

	// Create a new context for handling the message that will be canceled when the message handling is done
	messageCtx := context.WithValue(detachedCtx, requestHeader, r.Header)
	messageCtx, cancel := context.WithCancel(messageCtx)

	go func(ctx context.Context) {
		defer cancel()
		defer func() {
			if r := recover(); r != nil {
				log.Printf("panic recovered in SSE message handler for session %s: %v", sessionID, r)
				// Send error response so the client doesn't hang waiting. It
				// carries the request's id, as that is how the client matches
				// a response to the call waiting for it. A message without an
				// id is a notification, as in HandleMessage, and gets no reply.
				var request struct {
					ID any `json:"id"`
				}
				_ = json.Unmarshal(rawMessage, &request)
				if request.ID == nil {
					return
				}
				errResp := createErrorResponse(request.ID, mcp.INTERNAL_ERROR, fmt.Sprintf("internal panic: %v", r))
				if eventData, err := json.Marshal(errResp); err == nil {
					message := fmt.Sprintf("event: message\ndata: %s\n\n", eventData)
					select {
					case session.eventQueue <- message:
					case <-session.done:
					}
				}
			}
		}()
		// Use the context that will be canceled when session is done
		// Process message through MCPServer
		response := s.server.HandleMessage(ctx, rawMessage)
		// Only send response if there is one (not for notifications)
		if response != nil {
			var message string
			if eventData, err := json.Marshal(response); err != nil {
				// If there is an error marshalling the response, send a generic error response
				log.Printf("failed to marshal response: %v", err)
				message = "event: message\ndata: {\"error\": \"internal error\",\"jsonrpc\": \"2.0\", \"id\": null}\n\n"
			} else {
				message = fmt.Sprintf("event: message\ndata: %s\n\n", eventData)
			}

			// Queue the event for sending via SSE. The client is waiting
			// for the response, so if the queue is full, wait for room
			// rather than drop it.
			select {
			case session.eventQueue <- message:
				// Event queued successfully
			case <-session.done:
				// Session is closed, don't try to queue
			}
		}
	}(messageCtx)
}

// writeJSONRPCError writes a JSON-RPC error response with the given error details.
func (s *SSEServer) writeJSONRPCError(
	w http.ResponseWriter,
	id any,
	code int,
	message string,
) {
	writeJSONRPCError(w, id, code, message, func(err error) {
		// The 400 status and partial JSON body have already been written
		// by writeJSONRPCError, so we cannot escalate to a different HTTP
		// status here without producing a malformed response. Log instead,
		// matching the streamable HTTP transport's behavior.
		log.Printf("Failed to encode response: %v", err)
	})
}

// SendEventToSession sends an event to a specific SSE session identified by sessionID.
// Returns an error if the session is not found or closed.
func (s *SSEServer) SendEventToSession(
	sessionID string,
	event any,
) error {
	sessionI, ok := s.sessions.Load(sessionID)
	if !ok {
		return fmt.Errorf("session not found: %s", sessionID)
	}
	session := sessionI.(*sseSession)

	eventData, err := json.Marshal(event)
	if err != nil {
		return err
	}

	// Queue the event for sending via SSE
	select {
	case session.eventQueue <- fmt.Sprintf("event: message\ndata: %s\n\n", eventData):
		return nil
	case <-session.done:
		return fmt.Errorf("session closed")
	default:
		return fmt.Errorf("event queue full")
	}
}

func (s *SSEServer) GetUrlPath(input string) (string, error) {
	parse, err := url.Parse(input)
	if err != nil {
		return "", fmt.Errorf("failed to parse URL %s: %w", input, err)
	}
	return parse.Path, nil
}

func (s *SSEServer) CompleteSseEndpoint() (string, error) {
	if s.dynamicBasePathFunc != nil {
		return "", &ErrDynamicPathConfig{Method: "CompleteSseEndpoint"}
	}

	path := normalizeURLPath(s.basePath, s.sseEndpoint)
	return s.baseURL + path, nil
}

func (s *SSEServer) CompleteSsePath() string {
	path, err := s.CompleteSseEndpoint()
	if err != nil {
		return normalizeURLPath(s.basePath, s.sseEndpoint)
	}
	urlPath, err := s.GetUrlPath(path)
	if err != nil {
		return normalizeURLPath(s.basePath, s.sseEndpoint)
	}
	return urlPath
}

func (s *SSEServer) CompleteMessageEndpoint() (string, error) {
	if s.dynamicBasePathFunc != nil {
		return "", &ErrDynamicPathConfig{Method: "CompleteMessageEndpoint"}
	}
	path := normalizeURLPath(s.basePath, s.messageEndpoint)
	return s.baseURL + path, nil
}

func (s *SSEServer) CompleteMessagePath() string {
	path, err := s.CompleteMessageEndpoint()
	if err != nil {
		return normalizeURLPath(s.basePath, s.messageEndpoint)
	}
	urlPath, err := s.GetUrlPath(path)
	if err != nil {
		return normalizeURLPath(s.basePath, s.messageEndpoint)
	}
	return urlPath
}

// SSEHandler returns an http.Handler for the SSE endpoint.
//
// When CORS has been configured via WithSSECORS, the returned handler
// transparently handles preflight requests and applies the appropriate
// Access-Control-* headers to simple responses.
//
// This method allows you to mount the SSE handler at any arbitrary path
// using your own router (e.g. net/http, gorilla/mux, chi, etc.). It is
// intended for advanced scenarios where you want to control the routing or
// support dynamic segments.
//
// IMPORTANT: When using this handler in advanced/dynamic mounting scenarios,
// you must use the WithDynamicBasePath option to ensure the correct base path
// is communicated to clients.
//
// Example usage:
//
//	// Advanced/dynamic:
//	sseServer := NewSSEServer(mcpServer,
//		WithDynamicBasePath(func(r *http.Request, sessionID string) string {
//			tenant := r.PathValue("tenant")
//			return "/mcp/" + tenant
//		}),
//		WithBaseURL("http://localhost:8080")
//	)
//	mux.Handle("/mcp/{tenant}/sse", sseServer.SSEHandler())
//	mux.Handle("/mcp/{tenant}/message", sseServer.MessageHandler())
//
// For non-dynamic cases, use ServeHTTP method instead.
func (s *SSEServer) SSEHandler() http.Handler {
	return s.withCORS(http.HandlerFunc(s.handleSSE))
}

// MessageHandler returns an http.Handler for the message endpoint.
//
// This method allows you to mount the message handler at any arbitrary path
// using your own router (e.g. net/http, gorilla/mux, chi, etc.). It is
// intended for advanced scenarios where you want to control the routing or
// support dynamic segments.
//
// IMPORTANT: When using this handler in advanced/dynamic mounting scenarios,
// you must use the WithDynamicBasePath option to ensure the correct base path
// is communicated to clients.
//
// Example usage:
//
//	// Advanced/dynamic:
//	sseServer := NewSSEServer(mcpServer,
//		WithDynamicBasePath(func(r *http.Request, sessionID string) string {
//			tenant := r.PathValue("tenant")
//			return "/mcp/" + tenant
//		}),
//		WithBaseURL("http://localhost:8080")
//	)
//	mux.Handle("/mcp/{tenant}/sse", sseServer.SSEHandler())
//	mux.Handle("/mcp/{tenant}/message", sseServer.MessageHandler())
//
// For non-dynamic cases, use ServeHTTP method instead.
func (s *SSEServer) MessageHandler() http.Handler {
	return s.withCORS(http.HandlerFunc(s.handleMessage))
}

// withCORS wraps next with DNS rebinding protection plus CORS preflight and
// header handling using the SSE server's configured CORSConfig. The CORS
// portion is a no-op when CORS is disabled.
func (s *SSEServer) withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !s.disableLocalhostProtection && rejectDNSRebinding(w, r) {
			return
		}
		if s.corsConfig.enabled() {
			if s.corsConfig.handlePreflight(w, r) {
				return
			}
			s.corsConfig.applySimple(w, r)
		}
		next.ServeHTTP(w, r)
	})
}

// ServeHTTP implements the http.Handler interface.
//
// When CORS is configured via WithSSECORS, preflight (OPTIONS) requests are
// answered directly and simple cross-origin responses are decorated with the
// configured Access-Control-* headers before being dispatched to the SSE or
// message handlers.
//
// Requests arriving over a loopback connection with a non-localhost Host
// header are rejected with 403 Forbidden to protect against DNS rebinding
// attacks, unless WithSSEDisableLocalhostProtection is set.
func (s *SSEServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if !s.disableLocalhostProtection && rejectDNSRebinding(w, r) {
		return
	}
	if s.corsConfig.enabled() {
		if s.corsConfig.handlePreflight(w, r) {
			return
		}
		s.corsConfig.applySimple(w, r)
	}
	if s.dynamicBasePathFunc != nil {
		http.Error(
			w,
			(&ErrDynamicPathConfig{Method: "ServeHTTP"}).Error(),
			http.StatusInternalServerError,
		)
		return
	}
	path := r.URL.Path
	if s.protectedResourceMetadataHandler != nil && matchProtectedResourceMetadataPath(r.URL.EscapedPath(), s.protectedResourceMetadataPath) {
		s.protectedResourceMetadataHandler.ServeHTTP(w, r)
		return
	}
	// Use exact path matching rather than Contains
	ssePath := s.CompleteSsePath()
	if ssePath != "" && path == ssePath {
		s.handleSSE(w, r)
		return
	}
	messagePath := s.CompleteMessagePath()
	if messagePath != "" && path == messagePath {
		s.handleMessage(w, r)
		return
	}

	http.NotFound(w, r)
}

// normalizeURLPath joins path elements like path.Join but ensures the
// result always starts with a leading slash and never ends with a slash
func normalizeURLPath(elem ...string) string {
	joined := path.Join(elem...)

	// Ensure leading slash
	if !strings.HasPrefix(joined, "/") {
		joined = "/" + joined
	}

	// Remove trailing slash if not just "/"
	if len(joined) > 1 && strings.HasSuffix(joined, "/") {
		joined = joined[:len(joined)-1]
	}

	return joined
}

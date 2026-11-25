package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"maps"
	"math"
	"mime"
	"net/http"
	"os"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"unicode"

	"github.com/google/uuid"

	"github.com/mark3labs/mcp-go/mcp"
)

// StreamableHTTPOption defines a function type for configuring StreamableHTTPServer
type StreamableHTTPOption func(*StreamableHTTPServer)

// WithEndpointPath sets the endpoint path for the server.
// The default is "/mcp".
// It's only works for `Start` method. When used as a http.Handler, it has no effect.
func WithEndpointPath(endpointPath string) StreamableHTTPOption {
	return func(s *StreamableHTTPServer) {
		// Normalize the endpoint path to ensure it starts with a slash and doesn't end with one
		normalizedPath := "/" + strings.Trim(endpointPath, "/")
		s.endpointPath = normalizedPath
	}
}

// WithStateLess sets the server to stateless mode.
// If true, the server will manage no session information. Every request will be treated
// as a new session. No session id returned to the client.
// The default is false.
//
// Note: This is a convenience method. It's identical to set WithSessionIdManager option
// to StatelessSessionIdManager.
func WithStateLess(stateLess bool) StreamableHTTPOption {
	return func(s *StreamableHTTPServer) {
		if stateLess {
			s.sessionIdManagerResolver = NewDefaultSessionIdManagerResolver(&StatelessSessionIdManager{})
		}
	}
}

// WithSessionIdManager sets a custom session id generator for the server.
// By default, the server uses StatelessGeneratingSessionIdManager (generates IDs but no local validation).
// Note: Options are applied in order; the last one wins. If combined with
// WithStateLess or WithSessionIdManagerResolver, whichever is applied last takes effect.
func WithSessionIdManager(manager SessionIdManager) StreamableHTTPOption {
	return func(s *StreamableHTTPServer) {
		if manager == nil {
			s.sessionIdManagerResolver = NewDefaultSessionIdManagerResolver(&StatelessSessionIdManager{})
			return
		}
		s.sessionIdManagerResolver = NewDefaultSessionIdManagerResolver(manager)
	}
}

// WithSessionIdManagerResolver sets a custom session id manager resolver for the server.
// This allows for request-based session id management strategies.
// Note: Options are applied in order; the last one wins. If combined with
// WithStateLess or WithSessionIdManager, whichever is applied last takes effect.
func WithSessionIdManagerResolver(resolver SessionIdManagerResolver) StreamableHTTPOption {
	return func(s *StreamableHTTPServer) {
		if resolver == nil {
			s.sessionIdManagerResolver = NewDefaultSessionIdManagerResolver(&StatelessSessionIdManager{})
			return
		}
		s.sessionIdManagerResolver = resolver
	}
}

// WithStateful enables stateful session management using InsecureStatefulSessionIdManager.
// This requires sticky sessions in multi-instance deployments.
func WithStateful(stateful bool) StreamableHTTPOption {
	return func(s *StreamableHTTPServer) {
		if stateful {
			s.sessionIdManagerResolver = NewDefaultSessionIdManagerResolver(&InsecureStatefulSessionIdManager{})
		}
	}
}

// WithHeartbeatInterval sets the heartbeat interval. Positive interval means the
// server will send a heartbeat to the client through the GET connection, to keep
// the connection alive from being closed by the network infrastructure (e.g.
// gateways). If the client does not establish a GET connection, it has no
// effect. The default is not to send heartbeats.
func WithHeartbeatInterval(interval time.Duration) StreamableHTTPOption {
	return func(s *StreamableHTTPServer) {
		s.listenHeartbeatInterval = interval
	}
}

// WithEventStore enables stream resumability, per the "Resumability and
// Redelivery" section of the MCP Streamable HTTP transport specification.
//
// Every JSON-RPC message delivered on an SSE stream is recorded in store
// before it is sent and carries the store-issued event ID in the SSE id
// field. A client whose connection broke can then reconnect with a GET
// carrying the standard Last-Event-ID header to be redelivered everything it
// missed on that stream and keep receiving from it.
//
// With an event store configured, session transport state survives client
// disconnects so that messages produced while no client is connected can
// still be recorded. It is reclaimed, and the session's events are purged
// from the store, when the session is terminated (DELETE) or, with
// WithSessionIdleTTL configured, when the session idles out.
func WithEventStore(store EventStore) StreamableHTTPOption {
	return func(s *StreamableHTTPServer) {
		s.eventStore = store
	}
}

// WithDisableStreaming prevents the server from responding to GET requests with
// a streaming response. Instead, it will respond with a 405 Method Not Allowed status.
// This can be useful in scenarios where streaming is not desired or supported.
// The default is false, meaning streaming is enabled.
func WithDisableStreaming(disable bool) StreamableHTTPOption {
	return func(s *StreamableHTTPServer) {
		s.disableStreaming = disable
	}
}

// DefaultMaxRequestBodyBytes is the bound WithMaxRequestBodyBytes puts on a
// POST body when the option is not given.
const DefaultMaxRequestBodyBytes = 4 << 20

// WithMaxRequestBodyBytes bounds the body of a POST request served through
// ServeHTTP: the server reads at most n bytes of it, and answers a larger
// one 413 Request Entity Too Large with a JSON-RPC error, so a client cannot
// make the server hold an arbitrary amount of memory. The default is
// DefaultMaxRequestBodyBytes; zero or less removes the bound. A request
// brought through Handle arrives with its body already read, so the caller
// bounds it there.
func WithMaxRequestBodyBytes(n int64) StreamableHTTPOption {
	return func(s *StreamableHTTPServer) {
		s.maxRequestBodyBytes = n
	}
}

// WithDisableLocalhostProtection disables the automatic DNS rebinding
// protection of the streamable HTTP server.
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
func WithDisableLocalhostProtection(disable bool) StreamableHTTPOption {
	return func(s *StreamableHTTPServer) {
		s.disableLocalhostProtection = disable
	}
}

// WithHTTPContextFunc sets a function that will be called to customise the context
// to the server using the incoming request.
// This can be used to inject context values from headers, for example.
func WithHTTPContextFunc(fn HTTPContextFunc) StreamableHTTPOption {
	return func(s *StreamableHTTPServer) {
		s.contextFunc = fn
	}
}

// WithStreamableHTTPServer sets the HTTP server instance for StreamableHTTPServer.
// NOTE: When providing a custom HTTP server, you must handle routing yourself
// If routing is not set up, the server will start but won't handle any MCP requests.
func WithStreamableHTTPServer(srv *http.Server) StreamableHTTPOption {
	return func(s *StreamableHTTPServer) {
		s.httpServer = srv
	}
}

// WithStreamableHTTPLogger sets the structured logger for transport-level
// events emitted by the HTTP server (panics in goroutines, SSE event-write
// errors, session expiry, etc.). It is renamed from WithLogger so that
// server-level structured logging — see WithLogger — can carry that name on
// the MCPServer. A nil logger falls back to slog.Default().
func WithStreamableHTTPLogger(logger *slog.Logger) StreamableHTTPOption {
	return func(s *StreamableHTTPServer) {
		if logger == nil {
			s.logger = slog.Default()
			return
		}
		s.logger = logger
	}
}

// WithTLSCert sets the TLS certificate and key files for HTTPS support.
// Both certFile and keyFile must be provided to enable TLS.
func WithTLSCert(certFile, keyFile string) StreamableHTTPOption {
	return func(s *StreamableHTTPServer) {
		s.tlsCertFile = certFile
		s.tlsKeyFile = keyFile
	}
}

// WithProtectedResourceMetadata configures the StreamableHTTPServer to serve
// OAuth 2.0 Protected Resource Metadata (RFC 9728) at the well-known endpoint
// derived from the configured Resource (see ProtectedResourceMetadataPath).
//
// The metadata is served both when the server is started via Start (registered
// on the internal mux) and when the server is used directly as an
// http.Handler via ServeHTTP. To mount the metadata endpoint manually on a
// custom router, use NewProtectedResourceMetadataHandler instead.
func WithProtectedResourceMetadata(config ProtectedResourceMetadataConfig) StreamableHTTPOption {
	return func(s *StreamableHTTPServer) {
		cfg := config
		s.protectedResourceMetadata = &cfg
		s.protectedResourceMetadataPath = ProtectedResourceMetadataPath(cfg.Resource)
		s.protectedResourceMetadataHandler = NewProtectedResourceMetadataHandler(cfg)
	}
}

// WithSessionIdleTTL sets the idle TTL for per-session transport state.
// When enabled, a background sweeper periodically removes entries from
// per-session stores (tools, resources, resource templates, log levels,
// request IDs) for sessions that have been idle longer than the given
// duration. This prevents memory leaks when clients disconnect without
// sending a DELETE request. A zero or negative value disables the sweeper
// (the default).
func WithSessionIdleTTL(ttl time.Duration) StreamableHTTPOption {
	return func(s *StreamableHTTPServer) {
		s.sessionIdleTTL = ttl
	}
}

// WithStreamableHTTPCORS configures Cross-Origin Resource Sharing for the
// Streamable HTTP server.
//
// CORS handling is opt-in: callers must specify at least one allowed origin
// via WithCORSAllowedOrigins for any Access-Control-* headers to be emitted.
// When enabled, preflight (OPTIONS) requests are answered directly by the
// server and simple cross-origin responses are decorated with the configured
// Allow-Origin, Allow-Credentials, Expose-Headers and Vary headers.
//
// Example:
//
//	srv := server.NewStreamableHTTPServer(mcpServer,
//	    server.WithEndpointPath("/mcp"),
//	    server.WithStreamableHTTPCORS(
//	        server.WithCORSAllowedOrigins("https://my-ai-app.com"),
//	        server.WithCORSAllowCredentials(),
//	    ),
//	)
func WithStreamableHTTPCORS(opts ...CORSOption) StreamableHTTPOption {
	return func(s *StreamableHTTPServer) {
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

// StreamableHTTPServer implements a Streamable-http based MCP server.
// It communicates with clients over HTTP protocol, supporting both direct HTTP responses, and SSE streams.
// https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http
//
// Usage:
//
//	server := NewStreamableHTTPServer(mcpServer)
//	server.Start(":8080") // The final url for client is http://xxxx:8080/mcp by default
//
// or the server itself can be used as a http.Handler, which is convenient to
// integrate with existing http servers, or advanced usage:
//
//	handler := NewStreamableHTTPServer(mcpServer)
//	http.Handle("/streamable-http", handler)
//	http.ListenAndServe(":8080", nil)
//
// Notice:
// Except for the GET handlers(listening), the POST handlers(request/notification) will
// not trigger the session registration. So the methods like `SendNotificationToSpecificClient`
// or `hooks.onRegisterSession` will not be triggered for POST messages.
//
// Stream resumability (redelivery of the messages a client missed while its
// SSE connection was broken) is opt-in via WithEventStore.
type StreamableHTTPServer struct {
	server                   *MCPServer
	sessionTools             *sessionToolsStore
	sessionResources         *sessionResourcesStore
	sessionResourceTemplates *sessionResourceTemplatesStore
	activeSessions           sync.Map     // sessionId --> *streamableHttpSession (for sampling responses)
	requestIDCounter         atomic.Int64 // server -> client request IDs, shared across sessions

	eventStore         EventStore
	resumableStreams   sync.Map // streamID --> *resumableStream
	listeningStreams   sync.Map // sessionID --> *resumableStream (the standalone listening stream)
	listeningPumpStops sync.Map // sessionID --> chan struct{} (stops the session's pump)

	httpServer *http.Server
	mu         sync.RWMutex

	endpointPath             string
	contextFunc              HTTPContextFunc
	sessionIdManagerResolver SessionIdManagerResolver
	sessionIdManager         SessionIdManager // for non-request contexts (sweeper)
	listenHeartbeatInterval  time.Duration
	logger                   *slog.Logger
	sessionLogLevels         *sessionLogLevelsStore
	disableStreaming         bool

	// disableLocalhostProtection, when true, turns off the automatic DNS
	// rebinding protection applied to requests arriving over loopback
	// connections. See WithDisableLocalhostProtection.
	disableLocalhostProtection bool

	// maxRequestBodyBytes bounds a POST body read by ServeHTTP; zero or less
	// is no bound. See WithMaxRequestBodyBytes.
	maxRequestBodyBytes int64

	tlsCertFile string
	tlsKeyFile  string

	sessionIdleTTL    time.Duration
	sessionLastActive sync.Map // sessionID → *atomic.Int64 (unix nanos)
	sweeperCancel     context.CancelFunc

	// protectedResourceMetadata, when non-nil, is served as RFC 9728 OAuth
	// 2.0 Protected Resource Metadata. The well-known path is derived from
	// the configured Resource via ProtectedResourceMetadataPath.
	protectedResourceMetadata        *ProtectedResourceMetadataConfig
	protectedResourceMetadataPath    string
	protectedResourceMetadataHandler http.Handler

	// corsConfig, when non-nil and with at least one allowed origin, makes
	// the server emit CORS headers and answer preflight requests. See
	// WithStreamableHTTPCORS.
	corsConfig *CORSConfig

	// protocolVersions restricts the protocol versions advertised through
	// server/discover. Empty means every version this SDK implements.
	protocolVersions []string
}

// NewStreamableHTTPServer creates a new streamable-http server instance
func NewStreamableHTTPServer(server *MCPServer, opts ...StreamableHTTPOption) *StreamableHTTPServer {
	s := &StreamableHTTPServer{
		server:                   server,
		sessionTools:             newSessionToolsStore(),
		sessionLogLevels:         newSessionLogLevelsStore(),
		endpointPath:             "/mcp",
		sessionIdManagerResolver: NewDefaultSessionIdManagerResolver(&StatelessGeneratingSessionIdManager{}),
		logger:                   slog.Default(),
		maxRequestBodyBytes:      DefaultMaxRequestBodyBytes,
		sessionResources:         newSessionResourcesStore(),
		sessionResourceTemplates: newSessionResourceTemplatesStore(),
	}

	// Apply all options
	for _, opt := range opts {
		opt(s)
	}

	// Cache the session ID manager for use in non-request contexts (sweeper).
	// DefaultSessionIdManagerResolver always returns the same manager,
	// so resolving it once at startup is semantically identical.
	if r, ok := s.sessionIdManagerResolver.(*DefaultSessionIdManagerResolver); ok {
		s.sessionIdManager = r.manager
	}

	if s.sessionIdleTTL > 0 {
		ctx, cancel := context.WithCancel(context.Background())
		s.sweeperCancel = cancel
		s.startSessionSweeper(ctx)
	}

	return s
}

// ServeHTTP implements the http.Handler interface.
//
// When WithProtectedResourceMetadata has been configured, requests to the
// derived /.well-known/oauth-protected-resource path are dispatched to the
// metadata handler so that the same StreamableHTTPServer can be mounted as a
// single http.Handler while still exposing OAuth discovery metadata.
//
// When WithStreamableHTTPCORS has been configured, CORS preflight (OPTIONS)
// requests are answered directly and simple cross-origin responses are
// decorated with the configured Access-Control-* headers before dispatch.
//
// Requests arriving over a loopback connection with a non-localhost Host
// header are rejected with 403 Forbidden to protect against DNS rebinding
// attacks, unless WithDisableLocalhostProtection is set.
//
// ServeHTTP is the conventional net/http entry point; for non-net/http HTTP
// frameworks (fasthttp, fiber, etc.), see Handle.
func (s *StreamableHTTPServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if !s.disableLocalhostProtection && rejectDNSRebinding(w, r) {
		return
	}
	if s.corsConfig.enabled() {
		if s.corsConfig.handlePreflight(w, r) {
			return
		}
		s.corsConfig.applySimple(w, r)
	}
	if s.protectedResourceMetadataHandler != nil && matchProtectedResourceMetadataPath(r.URL.EscapedPath(), s.protectedResourceMetadataPath) {
		s.protectedResourceMetadataHandler.ServeHTTP(w, r)
		return
	}

	// Read the request body up-front so the transport-agnostic core never
	// needs to keep an io.Reader alive across SSE upgrades. Body errors are
	// surfaced by the per-method handlers below for parity with the previous
	// behavior (PARSE_ERROR JSON-RPC reply for POST, ignored for GET/DELETE).
	var body []byte
	var bodyErr error
	if r.Method == http.MethodPost && r.Body != nil {
		body, bodyErr = readRequestBody(r, s.maxRequestBodyBytes)
	}

	hr := &HTTPRequest{
		Method:   r.Method,
		URL:      r.URL,
		Header:   r.Header,
		Body:     body,
		Context:  r.Context(),
		original: r,
	}
	hw := newHTTPResponseWriterAdapter(w)

	if bodyErr != nil && r.Method == http.MethodPost {
		if errors.Is(bodyErr, errBodyTooLarge) {
			writeJSONRPCErrorStatus(hw, http.StatusRequestEntityTooLarge, nil, mcp.INVALID_REQUEST,
				fmt.Sprintf("request body exceeds %d bytes", s.maxRequestBodyBytes), func(err error) {
					s.logger.Error("Failed to write JSONRPCError", "err", err)
				})
			return
		}
		s.writeJSONRPCError(hw, nil, mcp.PARSE_ERROR, fmt.Sprintf("read request body error: %v", bodyErr))
		return
	}

	switch r.Method {
	case http.MethodPost:
		s.handlePost(hw, hr)
	case http.MethodGet:
		s.handleGet(hw, hr)
	case http.MethodDelete:
		s.handleDelete(hw, hr)
	case http.MethodHead:
		w.WriteHeader(http.StatusOK)
	default:
		http.NotFound(w, r)
	}
}

// errBodyTooLarge is the read error of a POST body over the bound.
var errBodyTooLarge = errors.New("request body too large")

// readRequestBody reads r's body up to limit bytes; a longer body is
// errBodyTooLarge. Zero or a negative limit reads it whole.
func readRequestBody(r *http.Request, limit int64) ([]byte, error) {
	switch {
	case limit <= 0:
		return io.ReadAll(r.Body)
	case r.ContentLength > limit:
		// Refused unread: net/http closes the connection rather than
		// drain the body.
		return nil, errBodyTooLarge
	default:
		return readBounded(r.Body, limit)
	}
}

// readBounded reads r to its end, up to limit bytes; a longer r is
// errBodyTooLarge. It is io.ReadAll with the bound checked as the buffer
// grows, and without a reader of its own, which would allocate on every
// request. Content-Length is not trusted: middleware may replace the body.
func readBounded(r io.Reader, limit int64) ([]byte, error) {
	// The reader is never offered more than the bound and one byte, the one
	// that proves the body too long, whatever the buffer's capacity. A bound
	// at the top of int's range has no room for that byte: a body that
	// fills it is too long as well.
	most := int(min(limit, math.MaxInt-1)) + 1
	b := make([]byte, 0, min(512, most))
	for {
		if len(b) == cap(b) {
			b = slices.Grow(b, min(cap(b), most-len(b)))
		}
		n, err := r.Read(b[len(b):min(cap(b), most)])
		b = b[:len(b)+n]
		if int64(len(b)) > limit || len(b) == most {
			return nil, errBodyTooLarge
		}
		if err != nil {
			if err == io.EOF {
				return b, nil
			}
			return b, err
		}
	}
}

// Start begins serving the http server on the specified address and path
// (endpointPath). like:
//
//	s.Start(":8080")
func (s *StreamableHTTPServer) Start(addr string) error {
	s.mu.Lock()
	if s.httpServer == nil {
		mux := http.NewServeMux()
		mux.Handle(s.endpointPath, s)
		if s.protectedResourceMetadataHandler != nil && s.protectedResourceMetadataPath != s.endpointPath {
			mux.Handle(s.protectedResourceMetadataPath, s.protectedResourceMetadataHandler)
		}
		s.httpServer = &http.Server{
			Addr:    addr,
			Handler: mux,
		}
	} else {
		if s.httpServer.Addr == "" {
			s.httpServer.Addr = addr
		} else if s.httpServer.Addr != addr {
			s.mu.Unlock()
			return fmt.Errorf("conflicting listen address: WithStreamableHTTPServer(%q) vs Start(%q)", s.httpServer.Addr, addr)
		}
	}
	srv := s.httpServer
	s.mu.Unlock()

	if s.tlsCertFile != "" || s.tlsKeyFile != "" {
		if s.tlsCertFile == "" || s.tlsKeyFile == "" {
			return fmt.Errorf("both TLS cert and key must be provided")
		}
		if _, err := os.Stat(s.tlsCertFile); err != nil {
			return fmt.Errorf("failed to find TLS certificate file: %w", err)
		}
		if _, err := os.Stat(s.tlsKeyFile); err != nil {
			return fmt.Errorf("failed to find TLS key file: %w", err)
		}
		return srv.ListenAndServeTLS(s.tlsCertFile, s.tlsKeyFile)
	}

	return srv.ListenAndServe()
}

// Shutdown gracefully stops the server, closing all active sessions
// and shutting down the HTTP server.
func (s *StreamableHTTPServer) Shutdown(ctx context.Context) error {
	if s.sweeperCancel != nil {
		s.sweeperCancel()
	}

	s.CloseSessions(ctx)

	// shutdown the server if needed (may use as a http.Handler)
	s.mu.RLock()
	srv := s.httpServer
	s.mu.RUnlock()
	if srv == nil {
		return nil
	}

	shutdownDone := make(chan error, 1)
	go func() {
		shutdownDone <- srv.Shutdown(ctx)
	}()

	drainTicker := time.NewTicker(5 * time.Millisecond)
	defer drainTicker.Stop()

	for {
		select {
		case err := <-shutdownDone:
			return err
		case <-ctx.Done():
			return ctx.Err()
		case <-drainTicker.C:
			// Drain sessions registered after the initial CloseSessions snapshot.
			s.CloseSessions(ctx)
		}
	}
}

// CloseSessions terminates all active streamable HTTP listening sessions
// without stopping the HTTP server. This unblocks long-lived GET handlers so
// Shutdown can complete while clients are still connected.
func (s *StreamableHTTPServer) CloseSessions(ctx context.Context) {
	sessionIDs := make([]string, 0)
	s.activeSessions.Range(func(key, value any) bool {
		sessionID, ok := key.(string)
		if !ok {
			return true
		}
		if session, ok := value.(*streamableHttpSession); ok {
			session.closeDone()
		}
		sessionIDs = append(sessionIDs, sessionID)
		return true
	})

	mgr := s.sessionIdManager
	if mgr == nil {
		mgr = s.sessionIdManagerResolver.ResolveSessionIdManager(nil)
	}

	for _, sessionID := range sessionIDs {
		if _, err := mgr.Terminate(sessionID); err != nil {
			s.logger.Warn("failed to terminate session during CloseSessions", "sessionID", sessionID, "err", err)
		}
		s.cleanupSessionState(ctx, sessionID)
	}
}

// --- internal methods ---

func (s *StreamableHTTPServer) handlePost(w HTTPResponseWriter, r *HTTPRequest) {
	// post request carry request/notification message

	// Check content type
	contentType := r.header().Get("Content-Type")
	mediaType, _, err := mime.ParseMediaType(contentType)
	if err != nil || mediaType != "application/json" {
		writeHTTPError(w, "Invalid content type: must be 'application/json'", http.StatusBadRequest)
		return
	}

	// Body has already been buffered by the caller (ServeHTTP or Handle).
	rawData := r.Body
	// First, try to parse as a response (sampling responses don't have a method field)
	type postEnvelope struct {
		ID     json.RawMessage `json:"id"`
		Result json.RawMessage `json:"result,omitempty"`
		Error  json.RawMessage `json:"error,omitempty"`
		Method mcp.MCPMethod   `json:"method,omitempty"`
	}
	var jsonMessage struct {
		postEnvelope
		Params struct {
			Meta *mcp.Meta `json:"_meta"`
		} `json:"params"`
	}
	if err := json.Unmarshal(rawData, &jsonMessage); err != nil {
		jsonMessage.postEnvelope = postEnvelope{}
		jsonMessage.Params.Meta = nil
		if err := json.Unmarshal(rawData, &jsonMessage.postEnvelope); err != nil {
			s.writeJSONRPCError(w, nil, mcp.PARSE_ERROR, "request body is not valid json")
			return
		}
	}

	isInitializeRequest := jsonMessage.Method == mcp.MethodInitialize

	// Decide which protocol era this message belongs to before branching on
	// its shape. Protocol version 2026-07-28 removed protocol-level sessions,
	// so a modern message never carries, mints, or echoes a session ID
	// (SEP-2567), and must not reach a session-dependent path.
	era := detectRequestEra(r.header(), jsonMessage.Params.Meta)

	// The header is only required after initialize, which negotiates the
	// version itself. Responses posted by the client are checked as well.
	if !era.modern && !isInitializeRequest && rejectUnsupportedProtocolVersion(w, era.headerVersion) {
		return
	}

	// detect empty ping response, skip session ID validation
	isEmptyResponse := jsonMessage.Method == "" && jsonMessage.ID != nil &&
		(isJSONEmpty(jsonMessage.Result) && isJSONEmpty(jsonMessage.Error))
	isPingResponse := jsonMessage.Method == "" && jsonMessage.ID != nil &&
		isExplicitEmptyObject(jsonMessage.Result) && len(bytes.TrimSpace(jsonMessage.Error)) == 0

	if isPingResponse {
		w.WriteHeader(http.StatusAccepted)
		return
	}
	if isEmptyResponse {
		// Per MCP spec (Streamable HTTP transport, rule 4): the server MUST return
		// 202 Accepted for any accepted JSON-RPC response or notification, regardless
		// of whether result is {} or omitted. HTTP 200 with no body has no defined
		// meaning in this transport for POST requests carrying responses.
		w.WriteHeader(http.StatusAccepted)
		return
	}

	// Check if this is a sampling response (has result/error but no method)
	isSamplingResponse := jsonMessage.Method == "" && jsonMessage.ID != nil &&
		(jsonMessage.Result != nil || jsonMessage.Error != nil)

	var id mcp.RequestId
	if len(jsonMessage.ID) > 0 {
		_ = json.Unmarshal(jsonMessage.ID, &id)
	}
	requestID := id.Value()

	// Handle sampling responses separately.
	//
	// A client-to-server response answers a server-initiated request, which
	// protocol version 2026-07-28 replaced with multi round-trip requests
	// (SEP-2322). Accepting one from a modern client would let a valid
	// Mcp-Session-Id steer a modern message onto the legacy, session-scoped
	// delivery path, so it is refused.
	if isSamplingResponse {
		if era.modern {
			s.writeJSONRPCErrorStatus(w, requestID, mcp.INVALID_REQUEST,
				"client-to-server responses are not supported in protocol version "+
					mcp.ProtocolVersion20260728+
					": server-initiated requests were replaced by multi round-trip requests",
				http.StatusBadRequest)
			return
		}
		if err := s.handleSamplingResponse(w, r, jsonMessage.postEnvelope); err != nil {
			s.logger.Error("Failed to handle sampling response", "err", err)
			// HTTP Status code is already set in handleSamplingResponse, just return here
		}
		return
	}

	// Prepare the session for the mcp server
	// The session is ephemeral. Its life is the same as the request. It's only created
	// for interaction with the mcp server.
	var sessionID string
	listening := false
	if era.modern {
		if !s.validateModernRequest(w, r, era, requestID) {
			return
		}
		// The Mcp-Session-Id header is ignored, and no session ID is minted.
		// Each modern request is served by its own ephemeral session.
		isInitializeRequest = false
		// A subscriptions/listen stream is where a modern client receives
		// the notifications the server broadcasts, such as
		// notifications/tools/list_changed.
		listening = jsonMessage.Method == mcp.MethodSubscriptionsListen && requestID != nil
		// The stream cannot be delivered when the response writer cannot
		// stream (for example a middleware wrapper that hides http.Flusher).
		// Fail now, as handleGet does, rather than hold the request open
		// with nothing ever written to it.
		if listening && !w.CanStream() {
			s.logger.Error("Rejected subscriptions/listen: response writer does not support streaming")
			s.writeJSONRPCErrorStatus(w, requestID, mcp.INTERNAL_ERROR,
				"Streaming unsupported: subscriptions/listen requires a response writer that can stream",
				http.StatusInternalServerError)
			return
		}
	} else {
		sessionIdManager := s.resolveSessionIdManager(r)
		if isInitializeRequest {
			// generate a new one for initialize request
			sessionID = sessionIdManager.Generate()
		} else {
			// Get session ID from header.
			// Stateful servers need the client to carry the session ID.
			sessionID = r.header().Get(HeaderKeySessionID)
			isTerminated, err := sessionIdManager.Validate(sessionID)
			if err != nil {
				writeHTTPError(w, "Invalid session ID", http.StatusNotFound)
				return
			}
			if isTerminated {
				writeHTTPError(w, "Session terminated", http.StatusNotFound)
				return
			}
		}

		s.touchSession(sessionID)
	}

	// For non-initialize requests, try to reuse existing registered session
	var session *streamableHttpSession
	if !isInitializeRequest && !era.modern {
		if sessionValue, ok := s.server.sessions.Load(sessionID); ok {
			if existingSession, ok := sessionValue.(*streamableHttpSession); ok {
				session = existingSession
			}
		}
	}

	// Check if a persistent session exists (for sampling support), otherwise create ephemeral session
	// Persistent sessions are created by GET (continuous listening) connections
	if session == nil && !era.modern {
		if sessionInterface, exists := s.activeSessions.Load(sessionID); exists {
			if persistentSession, ok := sessionInterface.(*streamableHttpSession); ok {
				session = persistentSession
			}
		}
	}

	// Create ephemeral session if no persistent session exists
	if session == nil {
		session = newStreamableHttpSession(sessionID, s.sessionTools, s.sessionResources, s.sessionResourceTemplates, s.sessionLogLevels, &s.requestIDCounter)
	}

	// Broadcasts only reach sessions the server knows of, and a modern
	// request's session is known nowhere else. A listen stream's session is
	// made reachable while the request runs; it receives nothing until
	// subscriptions/listen records the types the client asked for.
	if listening {
		session.serveSubscriptionStream()
		s.server.registerListenSession(session)
		defer s.server.unregisterListenSession(session)
	}

	// Set the client context before handling the message
	ctx := s.server.WithContext(r.ctx(), session)
	ctx = WithSupportedProtocolVersions(ctx, s.supportedProtocolVersions())
	if s.contextFunc != nil {
		ctx = s.contextFunc(ctx, r.asHTTPRequest())
	}

	// handle potential notifications
	mu := sync.Mutex{}
	upgradedHeader := false
	done := make(chan struct{})

	ctx = context.WithValue(ctx, requestHeader, r.header())

	// SSE upgrades require a streaming-capable response writer; if the
	// underlying transport can't stream, we still attempt the request but
	// any notifications will be buffered and flushed at the end as a single
	// application/json response (the upgrade simply won't fire).
	canStream := w.CanStream()

	// Stream resumability was removed in protocol version 2026-07-28
	// (SEP-2575), and a modern request carries no session ID to key a stored
	// stream on, so replay is confined to legacy requests.
	resumable := s.eventStore != nil && !era.modern

	// Request stream for resumability, created lazily when the first SSE
	// message for this request is delivered. Guarded by mu. Stored events
	// must outlive the request context, which ends with the connection.
	var rst *resumableStream
	storeCtx := context.WithoutCancel(ctx)

	// deliverResumable records msg on the request's resumable stream (creating
	// it on first use), upgrading the response to SSE first while the
	// connection is still usable. Callers must hold mu.
	deliverResumable := func(msg any, last bool) {
		if rst == nil {
			rst = s.newResumableStream(sessionID, w)
		}
		if ctx.Err() != nil {
			rst.clearPostWriter()
		} else if !upgradedHeader {
			w.Header().Set("Content-Type", "text/event-stream")
			w.Header().Set("Connection", "keep-alive")
			w.Header().Set("Cache-Control", "no-cache")
			w.WriteHeader(http.StatusOK)
			upgradedHeader = true
		}
		rst.deliver(storeCtx, msg, last)
	}

	// forwarderExited lets the response path wait until the forwarder can no
	// longer be holding an undelivered notification.
	forwarderExited := make(chan struct{})

	// When the response can stream, server requests issued while this message
	// is being handled (for example elicitation/create from a tool handler)
	// are written to this POST's SSE stream, per the Streamable HTTP guidance
	// that server requests on a POST stream should relate to the originating
	// request. The standalone GET stream remains the path for everything else.
	//
	// Protocol version 2026-07-28 removed both mechanisms this block depends
	// on: server-initiated requests (SEP-2322) and stream resumability
	// (SEP-2575). A modern request also has no session ID, so registering it
	// would key every concurrent request on "" and let a response reach the
	// wrong one.
	//
	// Notifications sent from a handler of this message (progress, logging)
	// take the same route: they relate to the originating request, and on the
	// session's shared channel the standalone GET stream's forwarder races
	// this POST's for them, so a notification could reach the client on the
	// GET stream after the response it belongs to.
	var scopedRequests chan mcp.JSONRPCRequest
	var scopedNotifications chan mcp.JSONRPCNotification
	closeDone := func() { close(done) }
	if canStream && !era.modern {
		scopedRequests = make(chan mcp.JSONRPCRequest, 8)
		scopedNotifications = make(chan mcp.JSONRPCNotification, 100)
		// Registration makes responses to request-scoped server requests
		// routable when nothing else has registered the session (stateless
		// mode without a standalone GET stream). It only happens once a
		// request is actually sent on this stream, and only the POST that
		// stored the registration removes it, so registrations made by the
		// GET handler or by stateful initialization are never touched.
		var ownsRegistration atomic.Bool
		register := sync.OnceFunc(func() {
			if _, loaded := s.activeSessions.LoadOrStore(sessionID, session); !loaded {
				ownsRegistration.Store(true)
			}
		})
		defer func() {
			if ownsRegistration.Load() {
				s.activeSessions.CompareAndDelete(sessionID, session)
			}
		}()
		scoped := &requestScopedSSE{
			session:       session,
			requests:      scopedRequests,
			notifications: scopedNotifications,
			done:          done,
			register:      register,
		}
		closeDone = scoped.close
		ctx = context.WithValue(ctx, requestScopedSSEKey{}, scoped)
	}

	go func() {
		defer close(forwarderExited)
		defer func() {
			if r := recover(); r != nil {
				s.logger.Error("panic in notification forwarder", "panic", r)
			}
		}()
		// forward writes a notification the forwarder took off a channel to
		// this POST's response.
		forward := func(nt mcp.JSONRPCNotification) {
			if listening {
				nt = tagSubscription(nt, requestID)
			}
			mu.Lock()
			defer mu.Unlock()
			// The notification is already off the channel, so the
			// response path's drain loop can no longer see it:
			// returning here because done is closed would lose it
			// outright. Fall through and deliver it exactly as if done
			// were still open. Both paths that close done now wait on
			// forwarderExited before writing, so this cannot interleave
			// with the final response.
			if !canStream {
				// Without streaming we can't deliver notifications mid-flight;
				// they will be dropped on the floor here. The final response
				// path remains the buffered JSON reply below.
				return
			}
			defer w.Flush()

			if resumable {
				deliverResumable(nt, false)
				return
			}

			// if there's notifications, upgradedHeader to SSE response
			if !upgradedHeader {
				w.Header().Set("Content-Type", "text/event-stream")
				w.Header().Set("Connection", "keep-alive")
				w.Header().Set("Cache-Control", "no-cache")
				w.WriteHeader(http.StatusOK)
				upgradedHeader = true
			}
			err := writeSSEEvent(w, nt)
			if err != nil {
				s.logger.Error("Failed to write SSE event", "err", err)
				return
			}
		}
		for {
			select {
			case nt := <-session.notificationChannel:
				forward(nt)
			case nt := <-scopedNotifications:
				forward(nt)
			case req := <-scopedRequests:
				func() {
					mu.Lock()
					defer mu.Unlock()
					select {
					case <-done:
						// The request is already off the channel; with an
						// event store it must still be recorded so a resuming
						// client sees it.
						if resumable {
							deliverResumable(req, false)
						}
						return
					default:
					}
					defer w.Flush()

					if resumable {
						deliverResumable(req, false)
						return
					}

					if !upgradedHeader {
						w.Header().Set("Content-Type", "text/event-stream")
						w.Header().Set("Connection", "keep-alive")
						w.Header().Set("Cache-Control", "no-cache")
						w.WriteHeader(http.StatusOK)
						upgradedHeader = true
					}
					if err := writeSSEEvent(w, req); err != nil {
						s.logger.Error("Failed to write SSE event", "err", err)
					}
				}()
			case <-done:
				return
			case <-ctx.Done():
				return
			}
		}
	}()

	// Process message through MCPServer
	response := s.server.HandleMessage(ctx, rawData)
	if listening {
		// Stop broadcasts before draining what is already queued.
		s.server.unregisterListenSession(session)
	}
	// drain writes a notification left queued once the forwarder has exited.
	// Callers must hold mu.
	drain := func(nt mcp.JSONRPCNotification) {
		if listening {
			nt = tagSubscription(nt, requestID)
		}
		if !canStream {
			return
		}
		if resumable {
			deliverResumable(nt, false)
			w.Flush()
			return
		}
		if !upgradedHeader {
			w.Header().Set("Content-Type", "text/event-stream")
			w.Header().Set("Connection", "keep-alive")
			w.Header().Set("Cache-Control", "no-cache")
			w.WriteHeader(http.StatusOK)
			upgradedHeader = true
		}
		if err := writeSSEEvent(w, nt); err != nil {
			s.logger.Error("Failed to write SSE event during drain", "err", err)
		}
		w.Flush()
	}

	if response == nil {
		// Await the forwarder here too. It may be holding a notification it
		// took off the channel but has not yet written; letting this path
		// return first would either lose that notification or let the
		// forwarder write to a ResponseWriter whose handler has already
		// returned. Waiting settles both. If the forwarder does deliver, it
		// sets upgradedHeader and this path correctly skips the 202.
		closeDone()
		<-forwarderExited
		mu.Lock()
		// Notifications queued for this POST by the handler have no other
		// consumer once the forwarder has exited.
	scopedDrain:
		for {
			select {
			case nt := <-scopedNotifications:
				drain(nt)
			default:
				break scopedDrain
			}
		}
		if !upgradedHeader {
			mu.Unlock()
			w.WriteHeader(http.StatusAccepted)
		} else {
			mu.Unlock()
		}
		return
	}

	// Write response
	//
	// Stop the forwarder and wait for it to exit before draining, so that
	// exactly one consumer handles whatever notifications remain and their
	// order ahead of the response is preserved.
	//
	// The wait is not an event-store concern. The forwarder takes a
	// notification off the channel and THEN acquires mu; if the response path
	// were to drain and close done in between, that notification would be
	// stranded in the forwarder's local variable, where the drain loop cannot
	// see it. Awaiting the forwarder is what makes delivery deterministic.
	closeDone()
	<-forwarderExited
	mu.Lock()

drainLoop:
	for {
		select {
		case nt := <-scopedNotifications:
			drain(nt)
		case nt := <-session.notificationChannel:
			drain(nt)
		default:
			break drainLoop
		}
	}

	mu.Unlock()
	if ctx.Err() != nil {
		// The connection is gone, but with an event store the response of an
		// interrupted SSE request is still recorded so that a resuming client
		// can be redelivered it.
		if resumable && (rst != nil || (session.upgradeToSSE.Load() && canStream)) {
			mu.Lock()
			deliverResumable(response, true)
			mu.Unlock()
		}
		return
	}
	// If client-server communication already upgraded to SSE stream
	// Also check upgradedHeader: a notification during HandleMessage processing
	// may have already written SSE headers on this response, so we must continue
	// in SSE mode to avoid writing JSON on top of SSE data.
	if resumable && (rst != nil || (session.upgradeToSSE.Load() && canStream)) {
		mu.Lock()
		deliverResumable(response, true)
		mu.Unlock()
	} else if (session.upgradeToSSE.Load() && canStream) || upgradedHeader {
		if !upgradedHeader {
			w.Header().Set("Content-Type", "text/event-stream")
			w.Header().Set("Connection", "keep-alive")
			w.Header().Set("Cache-Control", "no-cache")
			w.WriteHeader(http.StatusOK)
			upgradedHeader = true
		}
		if err := writeSSEEvent(w, response); err != nil {
			s.logger.Error("Failed to write final SSE response event", "err", err)
		}
		w.Flush()
	} else {
		w.Header().Set("Content-Type", "application/json")
		if isInitializeRequest && sessionID != "" {
			// send the session ID back to the client
			w.Header().Set(HeaderKeySessionID, sessionID)
		}
		// Protocol version 2026-07-28 maps JSON-RPC error codes onto HTTP
		// status codes, so that intermediaries can act on failures without
		// parsing the body.
		status := http.StatusOK
		if era.modern {
			if errResponse, ok := response.(mcp.JSONRPCError); ok {
				status = httpStatusForJSONRPCError(errResponse.Error.Code)
			}
		}
		w.WriteHeader(status)
		err := json.NewEncoder(w).Encode(response)
		if err != nil {
			s.logger.Error("Failed to write response", "err", err)
		}
	}

	// Register session after successful initialization
	// Only register if not already registered (e.g., by a GET connection)
	if isInitializeRequest && sessionID != "" {
		if _, exists := s.server.sessions.Load(sessionID); !exists {
			// Store in activeSessions to prevent duplicate registration from GET
			s.activeSessions.Store(sessionID, session)
			// Register the session with the MCPServer for notification support
			if err := s.server.RegisterSession(ctx, session); err != nil {
				s.logger.Error("Failed to register POST session", "err", err)
				s.activeSessions.Delete(sessionID)
				// Don't fail the request, just log the error
			}
		}
	}
}

func (s *StreamableHTTPServer) handleGet(w HTTPResponseWriter, r *HTTPRequest) {
	// Protocol version 2026-07-28 removed the standalone GET stream: clients
	// receive server-initiated messages through subscriptions/listen instead.
	if isModernHTTPRequest(r) {
		s.rejectModernSessionMethod(w, http.MethodGet)
		return
	}
	if rejectUnsupportedProtocolVersion(w, r.header().Get(mcp.HeaderProtocolVersion)) {
		return
	}

	// get request is for listening to notifications
	// https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#listening-for-messages-from-the-server
	if s.disableStreaming {
		s.logger.Info("Rejected GET request: streaming is disabled", "session", r.header().Get(HeaderKeySessionID))
		writeHTTPError(w, "Streaming is disabled on this server", http.StatusMethodNotAllowed)
		return
	}

	// Check streaming support in the responseWriter. This can happen if the responseWriter has been overridden,
	// or the integrating framework cannot deliver SSE responses (CanStream returns false).
	// If not supported, return 405 early.
	if !w.CanStream() {
		writeHTTPError(w, "Streaming unsupported", http.StatusMethodNotAllowed)
		return
	}

	// A GET carrying Last-Event-ID resumes a previously broken SSE stream
	// rather than opening a fresh listening stream.
	if s.eventStore != nil {
		if lastEventID := r.header().Get("Last-Event-ID"); lastEventID != "" {
			s.handleResumeGet(w, r, lastEventID)
			return
		}
	}

	sessionID := r.header().Get(HeaderKeySessionID)
	// The MCP specification doesn't require validating session ID for GET requests.
	// If no session ID is provided by the client, generate one using the configured SessionIdManager
	// so that custom session id generators are honored consistently across POST/GET flows.
	if sessionID == "" {
		sessionIdManager := s.resolveSessionIdManager(r)
		sessionID = sessionIdManager.Generate()
	}

	// Get or create session atomically to prevent TOCTOU races
	// where concurrent GETs could both create and register duplicate sessions
	var session *streamableHttpSession
	newSession := newStreamableHttpSession(sessionID, s.sessionTools, s.sessionResources, s.sessionResourceTemplates, s.sessionLogLevels, &s.requestIDCounter)
	actual, loaded := s.activeSessions.LoadOrStore(sessionID, newSession)
	session = actual.(*streamableHttpSession)

	if !loaded {
		// We created a new session, need to register it
		if err := s.server.RegisterSession(r.ctx(), session); err != nil {
			s.activeSessions.Delete(sessionID)
			writeHTTPErrorf(w, http.StatusBadRequest, "Session registration failed: %v", err)
			return
		}
		if s.eventStore == nil {
			defer s.server.UnregisterSession(r.ctx(), sessionID)
			defer s.activeSessions.Delete(sessionID)
		}
		// With an event store, the session outlives the connection so that
		// messages produced while the client is away are recorded for
		// replay; it is cleaned up on DELETE or by the idle sweeper.
	}

	s.touchSession(sessionID)

	if s.eventStore != nil {
		s.serveListeningStream(w, r, sessionID, session)
		return
	}

	// Set the client context before handling the message
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)

	w.Flush()

	// Start notification handler for this session
	done := make(chan struct{})
	defer close(done)
	writeChan := make(chan any, 16)

	go func() {
		defer func() {
			if r := recover(); r != nil {
				s.logger.Error("panic in SSE notification writer", "panic", r)
			}
		}()
		for {
			select {
			case nt := <-session.notificationChannel:
				select {
				case writeChan <- &nt:
				case <-done:
					return
				}
			case samplingReq := <-session.samplingRequestChan:
				// Send sampling request to client via SSE
				jsonrpcRequest := mcp.JSONRPCRequest{
					JSONRPC: "2.0",
					ID:      mcp.NewRequestId(samplingReq.requestID),
					Request: mcp.Request{
						Method: string(mcp.MethodSamplingCreateMessage),
					},
					Params: samplingReq.request.CreateMessageParams,
				}
				select {
				case writeChan <- jsonrpcRequest:
				case <-done:
					return
				}
			case elicitationReq := <-session.elicitationRequestChan:
				// Send elicitation request to client via SSE
				jsonrpcRequest := mcp.JSONRPCRequest{
					JSONRPC: "2.0",
					ID:      mcp.NewRequestId(elicitationReq.requestID),
					Request: mcp.Request{
						Method: string(mcp.MethodElicitationCreate),
					},
					Params: elicitationReq.request.Params,
				}
				select {
				case writeChan <- jsonrpcRequest:
				case <-done:
					return
				}
			case rootsReq := <-session.rootsRequestChan:
				// Send list roots request to client via SSE
				jsonrpcRequest := mcp.JSONRPCRequest{
					JSONRPC: "2.0",
					ID:      mcp.NewRequestId(rootsReq.requestID),
					Request: mcp.Request{
						Method: string(mcp.MethodListRoots),
					},
				}
				select {
				case writeChan <- jsonrpcRequest:
				case <-done:
					return
				}
			case <-done:
				return
			}
		}
	}()

	if s.listenHeartbeatInterval > 0 {
		// heartbeat to keep the connection alive
		go func() {
			defer func() {
				if r := recover(); r != nil {
					s.logger.Error("panic in heartbeat goroutine", "panic", r)
				}
			}()
			ticker := time.NewTicker(s.listenHeartbeatInterval)
			defer ticker.Stop()
			for {
				select {
				case <-ticker.C:
					message := mcp.JSONRPCRequest{
						JSONRPC: "2.0",
						ID:      mcp.NewRequestId(s.nextRequestID(sessionID)),
						Request: mcp.Request{
							Method: string(mcp.MethodPing),
						},
					}
					select {
					case writeChan <- message:
					case <-done:
						return
					}
				case <-done:
					return
				}
			}
		}()
	}

	ctx := r.ctx()

	// Keep the connection open until the client disconnects
	//
	// There's will a Available() check when handler ends, and it maybe race with Flush(),
	// so we use a separate channel to send the data, inteading of flushing directly in other goroutine.
	for {
		select {
		case data := <-writeChan:
			if data == nil {
				continue
			}
			if err := writeSSEEvent(w, data); err != nil {
				s.logger.Error("Failed to write SSE event", "err", err)
				return
			}
			w.Flush()
			s.touchSession(sessionID)
		case <-ctx.Done():
			return
		case <-session.done:
			return
		}
	}
}

func (s *StreamableHTTPServer) handleDelete(w HTTPResponseWriter, r *HTTPRequest) {
	// Protocol version 2026-07-28 removed protocol-level sessions, so there is
	// nothing for a DELETE to terminate.
	if isModernHTTPRequest(r) {
		s.rejectModernSessionMethod(w, http.MethodDelete)
		return
	}
	if rejectUnsupportedProtocolVersion(w, r.header().Get(mcp.HeaderProtocolVersion)) {
		return
	}

	// delete request terminate the session
	sessionID := r.header().Get(HeaderKeySessionID)
	sessionIdManager := s.resolveSessionIdManager(r)
	notAllowed, err := sessionIdManager.Terminate(sessionID)
	if err != nil {
		writeHTTPErrorf(w, http.StatusInternalServerError, "Session termination failed: %v", err)
		return
	}
	if notAllowed {
		writeHTTPError(w, "Session termination not allowed", http.StatusMethodNotAllowed)
		return
	}

	s.cleanupSessionState(r.ctx(), sessionID)

	w.WriteHeader(http.StatusOK)
}

// tagSubscription tags a notification with the ID of the
// subscriptions/listen request whose stream carries it, as every notification
// on a subscription stream must be. The _meta map is copied, because a
// broadcast shares it with the copies sent to every other session.
func tagSubscription(notification mcp.JSONRPCNotification, id any) mcp.JSONRPCNotification {
	meta := make(map[string]any, len(notification.Params.Meta)+1)
	maps.Copy(meta, notification.Params.Meta)
	meta[mcp.MetaKeySubscriptionID] = id
	notification.Params.Meta = meta
	return notification
}

func writeSSEEvent(w io.Writer, data any) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal data: %w", err)
	}
	_, err = fmt.Fprintf(w, "event: message\ndata: %s\n\n", jsonData)
	if err != nil {
		return fmt.Errorf("failed to write SSE event: %w", err)
	}
	return nil
}

// handleSamplingResponse processes incoming sampling responses from clients
func (s *StreamableHTTPServer) handleSamplingResponse(w HTTPResponseWriter, r *HTTPRequest, responseMessage struct {
	ID     json.RawMessage `json:"id"`
	Result json.RawMessage `json:"result,omitempty"`
	Error  json.RawMessage `json:"error,omitempty"`
	Method mcp.MCPMethod   `json:"method,omitempty"`
}) error {
	// Get session ID from header
	sessionID := r.header().Get(HeaderKeySessionID)
	if sessionID == "" {
		writeHTTPError(w, "Missing session ID for sampling response", http.StatusBadRequest)
		return fmt.Errorf("missing session ID")
	}

	// Validate session
	sessionIdManager := s.resolveSessionIdManager(r)
	isTerminated, err := sessionIdManager.Validate(sessionID)
	if err != nil {
		writeHTTPError(w, "Invalid session ID", http.StatusNotFound)
		return err
	}
	if isTerminated {
		writeHTTPError(w, "Session terminated", http.StatusNotFound)
		return fmt.Errorf("session terminated")
	}

	// Parse the request ID
	var requestID int64
	if err := json.Unmarshal(responseMessage.ID, &requestID); err != nil {
		writeHTTPError(w, "Invalid request ID in sampling response", http.StatusBadRequest)
		return err
	}

	// Create the sampling response item
	response := samplingResponseItem{
		requestID: requestID,
	}

	// Parse result or error
	if responseMessage.Error != nil {
		// Parse error
		var jsonrpcError struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		}
		if err := json.Unmarshal(responseMessage.Error, &jsonrpcError); err != nil {
			response.err = fmt.Errorf("failed to parse error: %v", err)
		} else {
			// Defer building the final error to deliverSamplingResponse, which
			// knows which method (sampling/createMessage, elicitation/create, or
			// roots/list) this response corresponds to.
			response.clientError = &clientJSONRPCError{code: jsonrpcError.Code, message: jsonrpcError.Message}
		}
	} else if responseMessage.Result != nil {
		// Store the result to be unmarshaled later
		response.result = responseMessage.Result
	} else {
		response.err = fmt.Errorf("sampling response has neither result nor error")
	}

	// Find the corresponding session and deliver the response
	// The response is delivered to the specific session identified by sessionID
	if err := s.deliverSamplingResponse(w, sessionID, response); err != nil {
		// HTTP Status code is already set in deliverSamplingResponse, just return here
		return fmt.Errorf("failed to deliver sampling response: %w", err)
	}

	// Acknowledge receipt
	w.WriteHeader(http.StatusAccepted)
	return nil
}

// deliverSamplingResponse delivers a sampling response to the appropriate session.
// On failure it writes the HTTP error status directly to w.
func (s *StreamableHTTPServer) deliverSamplingResponse(w HTTPResponseWriter, sessionID string, response samplingResponseItem) error {
	// Look up the active session
	sessionInterface, ok := s.activeSessions.Load(sessionID)
	if !ok {
		writeHTTPError(w, "No active session found for the given session ID", http.StatusNotFound)
		return fmt.Errorf("no active session found for session %s", sessionID)
	}

	session, ok := sessionInterface.(*streamableHttpSession)
	if !ok {
		writeHTTPError(w, "Invalid session type for the given session ID", http.StatusInternalServerError)
		return fmt.Errorf("invalid session type for session %s", sessionID)
	}

	// Look up the dedicated pending request for this specific request ID.
	pendingInterface, exists := session.samplingRequests.Load(response.requestID)
	if !exists {
		writeHTTPError(w, "No pending sampling request found for the given request ID", http.StatusBadRequest)
		return fmt.Errorf("no pending request found for session %s, request %d", sessionID, response.requestID)
	}

	pending, ok := pendingInterface.(pendingClientRequest)
	if !ok {
		writeHTTPError(w, "Failed to deliver response", http.StatusInternalServerError)
		return fmt.Errorf("invalid pending request type for session %s, request %d", sessionID, response.requestID)
	}
	responseChan := pending.response

	// If the client returned a JSON-RPC error, label it with the method that
	// actually failed. This shared path serves sampling/createMessage,
	// elicitation/create and roots/list, so a generic "sampling error" prefix
	// would misattribute elicitation and roots failures (see #817).
	if response.clientError != nil {
		method := pending.method
		if method == "" {
			method = mcp.MethodSamplingCreateMessage
		}
		response.err = fmt.Errorf("%s error %d: %s", method, response.clientError.code, response.clientError.message)
	}

	// Attempt to deliver the response with timeout to prevent indefinite blocking
	select {
	case responseChan <- response:
		s.logger.Info("Delivered sampling response", "session", sessionID, "request", response.requestID)
		return nil
	default:
		writeHTTPError(w, "Failed to deliver response", http.StatusInternalServerError)
		return fmt.Errorf("failed to deliver sampling response for session %s, request %d: channel full or blocked", sessionID, response.requestID)
	}
}

// writeJSONRPCError writes a JSON-RPC error response with the given error details.
func (s *StreamableHTTPServer) writeJSONRPCError(
	w HTTPResponseWriter,
	id any,
	code int,
	message string,
) {
	writeJSONRPCError(w, id, code, message, func(err error) {
		s.logger.Error("Failed to write JSONRPCError", "err", err)
	})
}

// nextRequestID gets the next requestID for a server-initiated request. The
// counter is shared with sampling, elicitation and roots requests so IDs never
// collide within a session.
func (s *StreamableHTTPServer) nextRequestID(sessionID string) int64 {
	return s.requestIDCounter.Add(1)
}

// touchSession records the current time as the last activity for the given session.
// It is a no-op when the sweeper is disabled (sessionIdleTTL <= 0) or sessionID is empty.
// It runs on every request, so a known session is found with Load and touched
// without allocating; only a session's first touch pays for LoadOrStore.
func (s *StreamableHTTPServer) touchSession(sessionID string) {
	if sessionID == "" || s.sessionIdleTTL <= 0 {
		return
	}
	now := time.Now().UnixNano()
	actual, ok := s.sessionLastActive.Load(sessionID)
	if !ok {
		actual, _ = s.sessionLastActive.LoadOrStore(sessionID, new(atomic.Int64))
	}
	actual.(*atomic.Int64).Store(now)
}

// cleanupSessionState removes all per-session transport state for the given session ID.
func (s *StreamableHTTPServer) cleanupSessionState(ctx context.Context, sessionID string) {
	if s.eventStore != nil {
		s.cleanupResumableState(ctx, sessionID)
	}
	// Unregister first to stop notification routing before deleting data.
	s.server.UnregisterSession(ctx, sessionID)
	s.activeSessions.Delete(sessionID)
	s.sessionTools.delete(sessionID)
	s.sessionResources.delete(sessionID)
	s.sessionResourceTemplates.delete(sessionID)
	s.sessionLogLevels.delete(sessionID)
	s.sessionLastActive.Delete(sessionID)
}

// startSessionSweeper launches a background goroutine that periodically removes
// transport state for sessions that have been idle longer than sessionIdleTTL.
func (s *StreamableHTTPServer) startSessionSweeper(ctx context.Context) {
	interval := max(s.sessionIdleTTL/2, time.Second)

	go func() {
		defer func() {
			if r := recover(); r != nil {
				s.logger.Error("panic in session cleanup goroutine", "panic", r)
			}
		}()
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.sweepExpiredSessions()
			}
		}
	}()
}

// sweepExpiredSessions iterates all tracked sessions and cleans up those
// whose last activity exceeds sessionIdleTTL.
func (s *StreamableHTTPServer) sweepExpiredSessions() {
	now := time.Now().UnixNano()
	ttlNanos := s.sessionIdleTTL.Nanoseconds()

	s.sessionLastActive.Range(func(key, value any) bool {
		sessionID, ok := key.(string)
		if !ok {
			s.sessionLastActive.Delete(key)
			return true
		}
		lastActive, ok := value.(*atomic.Int64)
		if !ok {
			s.sessionLastActive.Delete(key)
			return true
		}

		capturedLastActive := lastActive.Load()
		if now-capturedLastActive < ttlNanos {
			return true
		}

		// Re-check: if lastActive changed since we read it, the session
		// was touched concurrently — skip it. A small TOCTOU window
		// remains between this check and cleanup, but it is acceptable
		// for a distributed best-effort sweeper.
		if lastActive.Load() != capturedLastActive {
			return true
		}

		s.logger.Info("Sweeping expired session", "session", sessionID)
		mgr := s.sessionIdManager
		if mgr == nil {
			mgr = s.sessionIdManagerResolver.ResolveSessionIdManager(nil)
		}
		_, _ = mgr.Terminate(sessionID)
		s.cleanupSessionState(context.Background(), sessionID)
		return true
	})
}

// --- session ---
type sessionLogLevelsStore struct {
	mu   sync.RWMutex
	logs map[string]mcp.LoggingLevel
}

func newSessionLogLevelsStore() *sessionLogLevelsStore {
	return &sessionLogLevelsStore{
		logs: make(map[string]mcp.LoggingLevel),
	}
}

func (s *sessionLogLevelsStore) get(sessionID string) mcp.LoggingLevel {
	s.mu.RLock()
	defer s.mu.RUnlock()
	val, ok := s.logs[sessionID]
	if !ok {
		return mcp.LoggingLevelError
	}
	return val
}

func (s *sessionLogLevelsStore) set(sessionID string, level mcp.LoggingLevel) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.logs[sessionID] = level
}

func (s *sessionLogLevelsStore) delete(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.logs, sessionID)
}

type sessionResourcesStore struct {
	mu        sync.RWMutex
	resources map[string]map[string]ServerResource // sessionID -> resourceURI -> resource
}

func newSessionResourcesStore() *sessionResourcesStore {
	return &sessionResourcesStore{
		resources: make(map[string]map[string]ServerResource),
	}
}

func (s *sessionResourcesStore) get(sessionID string) map[string]ServerResource {
	s.mu.RLock()
	defer s.mu.RUnlock()
	cloned := make(map[string]ServerResource, len(s.resources[sessionID]))
	maps.Copy(cloned, s.resources[sessionID])
	return cloned
}

func (s *sessionResourcesStore) set(sessionID string, resources map[string]ServerResource) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cloned := make(map[string]ServerResource, len(resources))
	maps.Copy(cloned, resources)
	s.resources[sessionID] = cloned
}

func (s *sessionResourcesStore) delete(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.resources, sessionID)
}

type sessionResourceTemplatesStore struct {
	mu        sync.RWMutex
	templates map[string]map[string]ServerResourceTemplate // sessionID -> uriTemplate -> template
}

func newSessionResourceTemplatesStore() *sessionResourceTemplatesStore {
	return &sessionResourceTemplatesStore{
		templates: make(map[string]map[string]ServerResourceTemplate),
	}
}

func (s *sessionResourceTemplatesStore) get(sessionID string) map[string]ServerResourceTemplate {
	s.mu.RLock()
	defer s.mu.RUnlock()
	cloned := make(map[string]ServerResourceTemplate, len(s.templates[sessionID]))
	maps.Copy(cloned, s.templates[sessionID])
	return cloned
}

func (s *sessionResourceTemplatesStore) set(sessionID string, templates map[string]ServerResourceTemplate) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cloned := make(map[string]ServerResourceTemplate, len(templates))
	maps.Copy(cloned, templates)
	s.templates[sessionID] = cloned
}

func (s *sessionResourceTemplatesStore) delete(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.templates, sessionID)
}

type sessionToolsStore struct {
	mu    sync.RWMutex
	tools map[string]map[string]ServerTool // sessionID -> toolName -> tool
}

func newSessionToolsStore() *sessionToolsStore {
	return &sessionToolsStore{
		tools: make(map[string]map[string]ServerTool),
	}
}

func (s *sessionToolsStore) get(sessionID string) map[string]ServerTool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	cloned := make(map[string]ServerTool, len(s.tools[sessionID]))
	maps.Copy(cloned, s.tools[sessionID])
	return cloned
}

func (s *sessionToolsStore) set(sessionID string, tools map[string]ServerTool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cloned := make(map[string]ServerTool, len(tools))
	maps.Copy(cloned, tools)
	s.tools[sessionID] = cloned
}

func (s *sessionToolsStore) delete(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.tools, sessionID)
}

// Sampling support types for HTTP transport
type samplingRequestItem struct {
	requestID int64
	request   mcp.CreateMessageRequest
	response  chan samplingResponseItem
}

type samplingResponseItem struct {
	requestID int64
	result    json.RawMessage
	err       error
	// clientError is set when the client returned a JSON-RPC error object.
	// deliverSamplingResponse turns it into err, labeled with the pending
	// request's method (sampling/createMessage, elicitation/create, roots/list).
	clientError *clientJSONRPCError
}

// clientJSONRPCError holds a JSON-RPC error returned by the client in response
// to a server-initiated request (sampling, elicitation, or roots).
type clientJSONRPCError struct {
	code    int
	message string
}

// pendingClientRequest tracks a server-initiated request that is awaiting a
// client response. Recording the method alongside the response channel lets
// deliverSamplingResponse attribute a client-returned JSON-RPC error to the
// method that actually failed instead of always reporting "sampling".
type pendingClientRequest struct {
	method   mcp.MCPMethod
	response chan samplingResponseItem
}

// Elicitation support types for HTTP transport
type elicitationRequestItem struct {
	requestID int64
	request   mcp.ElicitationRequest
	response  chan samplingResponseItem
}

// Roots support types for HTTP transport
type rootsRequestItem struct {
	requestID int64
	request   mcp.ListRootsRequest
	response  chan samplingResponseItem
}

// streamableHttpSession is a session for streamable-http transport
// requestScopedSSEKey carries a requestScopedSSE in the context of a POST
// message handler whose response supports SSE.
type requestScopedSSEKey struct{}

// requestScopedSSE lets server requests and notifications issued while a POST
// message is being handled be written to that POST's SSE response instead of
// the standalone GET stream.
type requestScopedSSE struct {
	// session is the session the POST serves; only messages addressed to it
	// take the POST's stream.
	session       ClientSession
	requests      chan<- mcp.JSONRPCRequest
	notifications chan<- mcp.JSONRPCNotification
	done          chan struct{}
	register      func()

	// sendMu orders sends against close: once close returns, every send that
	// reported success is queued, and every later send sees done closed, so
	// nothing is queued once the POST has drained its channels.
	sendMu sync.Mutex
}

// close marks the POST stream finished. done closes before close waits for
// sendMu, so a send blocked on a full channel with no consumer left returns
// instead of holding sendMu forever.
func (r *requestScopedSSE) close() {
	close(r.done)
	r.sendMu.Lock()
	defer r.sendMu.Unlock()
}

// trySend queues the request for the originating POST stream. It reports
// false when the POST has already finished or ctx expires, so the caller can
// fall back to the standalone GET stream. While the POST stream is active it
// waits for buffer space instead of treating backpressure as absence:
// spilling to the GET stream mid-request would reintroduce the cross-stream
// routing this type exists to avoid.
func (r *requestScopedSSE) trySend(ctx context.Context, request mcp.JSONRPCRequest) bool {
	select {
	case <-r.done:
		return false
	default:
	}
	r.register()
	r.sendMu.Lock()
	defer r.sendMu.Unlock()
	return sendWhileOpen(ctx, r.done, r.requests, request)
}

// trySendNotification queues the notification for the originating POST
// stream, with the same semantics as trySend. A notification needs no
// registration: nothing answers it.
func (r *requestScopedSSE) trySendNotification(ctx context.Context, notification mcp.JSONRPCNotification) bool {
	r.sendMu.Lock()
	defer r.sendMu.Unlock()
	return sendWhileOpen(ctx, r.done, r.notifications, notification)
}

// sendWhileOpen sends v on ch unless done is closed or ctx ends first, and
// reports whether it was sent.
func sendWhileOpen[T any](ctx context.Context, done <-chan struct{}, ch chan<- T, v T) bool {
	select {
	case <-done:
		return false
	default:
	}
	select {
	case ch <- v:
		return true
	case <-done:
		return false
	case <-ctx.Done():
		return false
	}
}

// When in POST handlers(request/notification), it's ephemeral, and only exists in the life of the request handler.
// When in GET handlers(listening), it's a real session, and will be registered in the MCP server.
type streamableHttpSession struct {
	clientInfoStore // provides Get/SetClientInfo and Get/SetClientCapabilities via method promotion

	done                chan struct{}
	doneOnce            sync.Once
	sessionID           string
	notificationChannel chan mcp.JSONRPCNotification // server -> client notifications
	tools               *sessionToolsStore
	resources           *sessionResourcesStore
	resourceTemplates   *sessionResourceTemplatesStore
	upgradeToSSE        atomic.Bool
	logLevels           *sessionLogLevelsStore

	// Sampling support for bidirectional communication
	samplingRequestChan    chan samplingRequestItem    // server -> client sampling requests
	elicitationRequestChan chan elicitationRequestItem // server -> client elicitation requests
	rootsRequestChan       chan rootsRequestItem       // server -> client list roots requests

	samplingRequests sync.Map      // requestID -> pending sampling request context
	requestIDCounter *atomic.Int64 // shared per server so IDs stay unique across sessions with the same session ID

	// Whether the session serves a subscriptions/listen stream, and the
	// notification types that stream opted in to.
	subscriptionMu     sync.RWMutex
	listening          bool
	subscriptionFilter mcp.SubscriptionFilter
}

func newStreamableHttpSession(sessionID string, toolStore *sessionToolsStore, resourcesStore *sessionResourcesStore, templatesStore *sessionResourceTemplatesStore, levels *sessionLogLevelsStore, requestIDCounter *atomic.Int64) *streamableHttpSession {
	s := &streamableHttpSession{
		done:                   make(chan struct{}),
		sessionID:              sessionID,
		notificationChannel:    make(chan mcp.JSONRPCNotification, 100),
		tools:                  toolStore,
		resources:              resourcesStore,
		resourceTemplates:      templatesStore,
		logLevels:              levels,
		samplingRequestChan:    make(chan samplingRequestItem, 10),
		elicitationRequestChan: make(chan elicitationRequestItem, 10),
		rootsRequestChan:       make(chan rootsRequestItem, 10),
		requestIDCounter:       requestIDCounter,
	}
	return s
}

// closeDone safely closes the session's done channel exactly once,
// allowing long-lived GET handlers to exit during server shutdown.
func (s *streamableHttpSession) closeDone() {
	s.doneOnce.Do(func() {
		close(s.done)
	})
}

func (s *streamableHttpSession) SessionID() string {
	return s.sessionID
}

func (s *streamableHttpSession) NotificationChannel() chan<- mcp.JSONRPCNotification {
	return s.notificationChannel
}

func (s *streamableHttpSession) Initialize() {
	// do nothing
	// the session is ephemeral, no real initialized action needed
}

func (s *streamableHttpSession) Initialized() bool {
	// the session is ephemeral, no real initialized action needed
	return true
}

func (s *streamableHttpSession) SetLogLevel(level mcp.LoggingLevel) {
	s.logLevels.set(s.sessionID, level)
}

func (s *streamableHttpSession) GetLogLevel() mcp.LoggingLevel {
	return s.logLevels.get(s.sessionID)
}

var _ ClientSession = (*streamableHttpSession)(nil)

func (s *streamableHttpSession) GetSessionTools() map[string]ServerTool {
	return s.tools.get(s.sessionID)
}

func (s *streamableHttpSession) SetSessionTools(tools map[string]ServerTool) {
	s.tools.set(s.sessionID, tools)
}

func (s *streamableHttpSession) GetSessionResources() map[string]ServerResource {
	return s.resources.get(s.sessionID)
}

func (s *streamableHttpSession) SetSessionResources(resources map[string]ServerResource) {
	s.resources.set(s.sessionID, resources)
}

func (s *streamableHttpSession) GetSessionResourceTemplates() map[string]ServerResourceTemplate {
	return s.resourceTemplates.get(s.sessionID)
}

func (s *streamableHttpSession) SetSessionResourceTemplates(templates map[string]ServerResourceTemplate) {
	s.resourceTemplates.set(s.sessionID, templates)
}

var (
	_ SessionWithTools             = (*streamableHttpSession)(nil)
	_ SessionWithResources         = (*streamableHttpSession)(nil)
	_ SessionWithResourceTemplates = (*streamableHttpSession)(nil)
	_ SessionWithLogging           = (*streamableHttpSession)(nil)
	_ SessionWithClientInfo        = (*streamableHttpSession)(nil)
)

func (s *streamableHttpSession) UpgradeToSSEWhenReceiveNotification() {
	s.upgradeToSSE.Store(true)
}

var _ SessionWithStreamableHTTPConfig = (*streamableHttpSession)(nil)

func (s *streamableHttpSession) SetSubscriptionFilter(filter mcp.SubscriptionFilter) {
	s.subscriptionMu.Lock()
	defer s.subscriptionMu.Unlock()
	s.subscriptionFilter = filter
}

// SubscriptionFilter reports a session serving a subscriptions/listen stream as
// filtered for as long as it serves it, so that it receives nothing before its
// filter is recorded or after it is cleared. Other sessions are unfiltered.
func (s *streamableHttpSession) SubscriptionFilter() (mcp.SubscriptionFilter, bool) {
	s.subscriptionMu.RLock()
	defer s.subscriptionMu.RUnlock()
	return s.subscriptionFilter, s.listening
}

// serveSubscriptionStream marks the session as serving a subscriptions/listen
// stream.
func (s *streamableHttpSession) serveSubscriptionStream() {
	s.subscriptionMu.Lock()
	defer s.subscriptionMu.Unlock()
	s.listening = true
}

var _ SessionWithSubscriptionFilter = (*streamableHttpSession)(nil)

// RequestSampling implements SessionWithSampling interface for HTTP transport
func (s *streamableHttpSession) RequestSampling(ctx context.Context, request mcp.CreateMessageRequest) (*mcp.CreateMessageResult, error) {
	// Generate unique request ID
	requestID := s.requestIDCounter.Add(1)

	// Create response channel for this specific request
	responseChan := make(chan samplingResponseItem, 1)

	// Create the sampling request item
	samplingRequest := samplingRequestItem{
		requestID: requestID,
		request:   request,
		response:  responseChan,
	}

	// Store the pending request
	s.samplingRequests.Store(requestID, pendingClientRequest{
		method:   mcp.MethodSamplingCreateMessage,
		response: responseChan,
	})
	defer s.samplingRequests.Delete(requestID)

	// Send the sampling request via the channel (non-blocking)
	select {
	case s.samplingRequestChan <- samplingRequest:
		// Request queued successfully
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
		return nil, fmt.Errorf("sampling request queue is full - server overloaded")
	}

	// Wait for response or context cancellation
	select {
	case response := <-responseChan:
		if response.err != nil {
			return nil, response.err
		}
		var result mcp.CreateMessageResult
		if err := json.Unmarshal(response.result, &result); err != nil {
			return nil, fmt.Errorf("failed to unmarshal sampling response: %v", err)
		}

		// Parse content from map[string]any to proper Content type (TextContent, ImageContent, AudioContent)
		// HTTP transport unmarshals Content as map[string]any, we need to convert it to the proper type
		content, err := mcp.ParseSamplingContent(result.Content)
		if err != nil {
			return nil, fmt.Errorf("failed to parse sampling response content: %w", err)
		}
		result.Content = content

		return &result, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// ListRoots implements SessionWithRoots interface for HTTP transport.
// It sends a list roots request to the client via SSE and waits for the response.
func (s *streamableHttpSession) ListRoots(ctx context.Context, request mcp.ListRootsRequest) (*mcp.ListRootsResult, error) {
	// Generate unique request ID
	requestID := s.requestIDCounter.Add(1)

	// Create response channel for this specific request
	responseChan := make(chan samplingResponseItem, 1)

	// Create the roots request item
	rootsRequest := rootsRequestItem{
		requestID: requestID,
		request:   request,
		response:  responseChan,
	}

	// Store the pending request
	s.samplingRequests.Store(requestID, pendingClientRequest{
		method:   mcp.MethodListRoots,
		response: responseChan,
	})
	defer s.samplingRequests.Delete(requestID)

	// Send the list roots request via the channel (non-blocking)
	select {
	case s.rootsRequestChan <- rootsRequest:
		// Request queued successfully
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
		return nil, fmt.Errorf("list roots request queue is full - server overloaded")
	}

	// Wait for response or context cancellation
	select {
	case response := <-responseChan:
		if response.err != nil {
			return nil, response.err
		}
		var result mcp.ListRootsResult
		if err := json.Unmarshal(response.result, &result); err != nil {
			return nil, fmt.Errorf("failed to unmarshal list roots response: %v", err)
		}
		return &result, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// RequestElicitation implements SessionWithElicitation interface for HTTP transport
func (s *streamableHttpSession) RequestElicitation(ctx context.Context, request mcp.ElicitationRequest) (*mcp.ElicitationResult, error) {
	// Generate unique request ID
	requestID := s.requestIDCounter.Add(1)

	// Create response channel for this specific request
	responseChan := make(chan samplingResponseItem, 1)

	// Create the sampling request item
	elicitationRequest := elicitationRequestItem{
		requestID: requestID,
		request:   request,
		response:  responseChan,
	}

	// Store the pending request
	s.samplingRequests.Store(requestID, pendingClientRequest{
		method:   mcp.MethodElicitationCreate,
		response: responseChan,
	})
	defer s.samplingRequests.Delete(requestID)

	// Prefer the originating POST's SSE stream when this call comes from an
	// active POST handler with a streaming response, so a client that only
	// dispatches server requests from that stream sees the elicitation before
	// the final response. Fall back to the standalone GET stream otherwise.
	jsonrpcRequest := mcp.JSONRPCRequest{
		JSONRPC: "2.0",
		ID:      mcp.NewRequestId(requestID),
		Request: mcp.Request{
			Method: string(mcp.MethodElicitationCreate),
		},
		Params: request.Params,
	}
	scoped, hasScoped := ctx.Value(requestScopedSSEKey{}).(*requestScopedSSE)
	if !hasScoped || !scoped.trySend(ctx, jsonrpcRequest) {
		// Send the elicitation request via the channel (non-blocking)
		select {
		case s.elicitationRequestChan <- elicitationRequest:
			// Request queued successfully
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
			return nil, fmt.Errorf("elicitation request queue is full - server overloaded")
		}
	}

	// Wait for response or context cancellation
	select {
	case response := <-responseChan:
		if response.err != nil {
			return nil, response.err
		}
		var result mcp.ElicitationResult
		if err := json.Unmarshal(response.result, &result); err != nil {
			return nil, fmt.Errorf("failed to unmarshal elicitation response: %v", err)
		}
		return &result, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

var _ SessionWithSampling = (*streamableHttpSession)(nil)
var _ SessionWithElicitation = (*streamableHttpSession)(nil)
var _ SessionWithRoots = (*streamableHttpSession)(nil)

// --- session id manager ---

// SessionIdManagerResolver resolves a SessionIdManager based on the HTTP request.
// Implementations must handle a nil r, which may be passed from non-request
// contexts such as the session idle TTL sweeper.
type SessionIdManagerResolver interface {
	ResolveSessionIdManager(r *http.Request) SessionIdManager
}

type SessionIdManager interface {
	Generate() string
	// Validate checks if a session ID is valid and not terminated.
	// Returns isTerminated=true if the ID is valid but belongs to a terminated session.
	// Returns err!=nil if the ID format is invalid or lookup failed.
	Validate(sessionID string) (isTerminated bool, err error)
	// Terminate marks a session ID as terminated.
	// Returns isNotAllowed=true if the server policy prevents client termination.
	// Returns err!=nil if the ID is invalid or termination failed.
	Terminate(sessionID string) (isNotAllowed bool, err error)
}

// DefaultSessionIdManagerResolver is a simple resolver that returns the same SessionIdManager for all requests
type DefaultSessionIdManagerResolver struct {
	manager SessionIdManager
}

// NewDefaultSessionIdManagerResolver creates a new DefaultSessionIdManagerResolver with the given SessionIdManager
func NewDefaultSessionIdManagerResolver(manager SessionIdManager) *DefaultSessionIdManagerResolver {
	if manager == nil {
		manager = &StatelessSessionIdManager{}
	}
	return &DefaultSessionIdManagerResolver{manager: manager}
}

// ResolveSessionIdManager returns the configured SessionIdManager for all requests
func (r *DefaultSessionIdManagerResolver) ResolveSessionIdManager(_ *http.Request) SessionIdManager {
	return r.manager
}

// StatelessSessionIdManager does nothing, which means it has no session management, which is stateless.
type StatelessSessionIdManager struct{}

func (s *StatelessSessionIdManager) Generate() string {
	return ""
}

func (s *StatelessSessionIdManager) Validate(sessionID string) (isTerminated bool, err error) {
	// In stateless mode, ignore session IDs completely - don't validate or reject them
	return false, nil
}

func (s *StatelessSessionIdManager) Terminate(sessionID string) (isNotAllowed bool, err error) {
	return false, nil
}

// StatelessGeneratingSessionIdManager generates session IDs but doesn't validate them locally.
// This allows session IDs to be generated for clients while working across multiple instances.
type StatelessGeneratingSessionIdManager struct{}

func (s *StatelessGeneratingSessionIdManager) Generate() string {
	return idPrefix + uuid.New().String()
}

func (s *StatelessGeneratingSessionIdManager) Validate(sessionID string) (isTerminated bool, err error) {
	// Only validate format, not existence - allows cross-instance operation
	if !strings.HasPrefix(sessionID, idPrefix) {
		return false, fmt.Errorf("invalid session id: %s", sessionID)
	}
	if _, err := uuid.Parse(sessionID[len(idPrefix):]); err != nil {
		return false, fmt.Errorf("invalid session id: %s", sessionID)
	}
	return false, nil
}

func (s *StatelessGeneratingSessionIdManager) Terminate(sessionID string) (isNotAllowed bool, err error) {
	// No-op termination since we don't track sessions
	return false, nil
}

// InsecureStatefulSessionIdManager generate id with uuid and tracks active sessions.
// It validates both format and existence of session IDs.
// For more secure session id, use a more complex generator, like a JWT.
type InsecureStatefulSessionIdManager struct {
	sessions   sync.Map
	terminated sync.Map
}

const idPrefix = "mcp-session-"

func (s *InsecureStatefulSessionIdManager) Generate() string {
	sessionID := idPrefix + uuid.New().String()
	s.sessions.Store(sessionID, true)
	return sessionID
}

func (s *InsecureStatefulSessionIdManager) Validate(sessionID string) (isTerminated bool, err error) {
	if !strings.HasPrefix(sessionID, idPrefix) {
		return false, fmt.Errorf("invalid session id: %s", sessionID)
	}
	if _, err := uuid.Parse(sessionID[len(idPrefix):]); err != nil {
		return false, fmt.Errorf("invalid session id: %s", sessionID)
	}
	if _, exists := s.terminated.Load(sessionID); exists {
		return true, nil
	}
	if _, exists := s.sessions.Load(sessionID); !exists {
		return false, fmt.Errorf("session not found: %s", sessionID)
	}
	return false, nil
}

func (s *InsecureStatefulSessionIdManager) Terminate(sessionID string) (isNotAllowed bool, err error) {
	if _, exists := s.terminated.Load(sessionID); exists {
		return false, nil
	}
	if _, exists := s.sessions.Load(sessionID); !exists {
		return false, nil
	}
	s.terminated.Store(sessionID, true)
	s.sessions.Delete(sessionID)
	return false, nil
}

// isJSONEmpty reports whether the provided JSON value is "empty":
//   - null
//   - empty object: {}
//   - empty array: []
//
// It also treats nil/whitespace-only input as empty.
// It does NOT treat 0, false, "" or non-empty composites as empty.
func isJSONEmpty(data json.RawMessage) bool {
	if len(data) == 0 {
		return true
	}

	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 {
		return true
	}

	switch trimmed[0] {
	case '{':
		if len(trimmed) == 2 && trimmed[1] == '}' {
			return true
		}
		for i := 1; i < len(trimmed); i++ {
			if !unicode.IsSpace(rune(trimmed[i])) {
				return trimmed[i] == '}'
			}
		}
	case '[':
		if len(trimmed) == 2 && trimmed[1] == ']' {
			return true
		}
		for i := 1; i < len(trimmed); i++ {
			if !unicode.IsSpace(rune(trimmed[i])) {
				return trimmed[i] == ']'
			}
		}

	case '"': // treat "" as not empty
		return false

	case 'n': // null
		return len(trimmed) == 4 &&
			trimmed[1] == 'u' &&
			trimmed[2] == 'l' &&
			trimmed[3] == 'l'
	}
	return false
}

// isExplicitEmptyObject reports whether data is a JSON object literal with no fields.
func isExplicitEmptyObject(data json.RawMessage) bool {
	if len(data) == 0 {
		return false
	}

	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 || trimmed[0] != '{' {
		return false
	}

	var obj map[string]json.RawMessage
	if err := json.Unmarshal(trimmed, &obj); err != nil {
		return false
	}

	return len(obj) == 0
}

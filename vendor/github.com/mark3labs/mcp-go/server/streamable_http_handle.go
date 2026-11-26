package server

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// HTTPRequest is a transport-agnostic view of an incoming MCP HTTP request.
// It contains everything StreamableHTTPServer.Handle needs to process a
// request without depending on net/http server primitives, allowing
// integration with frameworks such as fasthttp/fiber.
//
// All fields are read by Handle but never mutated. Body is fully buffered;
// adapters do not need to keep an io.Reader alive for the duration of
// streaming responses.
type HTTPRequest struct {
	// Method is the HTTP method ("POST", "GET", "DELETE"). Required.
	Method string
	// URL is the request URL. Optional; only Path is consulted by mcp-go and
	// only when WithProtectedResourceMetadata is configured. May be nil.
	URL *url.URL
	// Header carries the request headers. Required.
	Header http.Header
	// Body is the (already buffered) request body. May be nil for GET/DELETE.
	Body []byte
	// Context is the request context. Cancellation is honored for streaming
	// responses. Required.
	Context context.Context

	// original is the *http.Request that originated this HTTPRequest, when
	// the request entered through ServeHTTP. It is forwarded to legacy hooks
	// such as HTTPContextFunc that take a *http.Request, preserving any
	// request-scoped state (RemoteAddr, TLS, etc.) that the synthesized
	// request from asHTTPRequest cannot reconstruct. Nil when the request
	// entered through Handle.
	original *http.Request
}

// context returns Context, defaulting to context.Background() when nil so
// internal callers don't have to nil-check.
func (r *HTTPRequest) ctx() context.Context {
	if r == nil || r.Context == nil {
		return context.Background()
	}
	return r.Context
}

// header returns Header, defaulting to an empty http.Header when nil.
func (r *HTTPRequest) header() http.Header {
	if r == nil || r.Header == nil {
		return http.Header{}
	}
	return r.Header
}

// asHTTPRequest builds a synthetic *http.Request that exposes the headers,
// URL, and context of r. It is used to remain compatible with APIs that
// historically accept a *http.Request (e.g. SessionIdManagerResolver and
// HTTPContextFunc) when a caller has reached us through Handle.
//
// The returned request has no body; callers must not read it.
func (r *HTTPRequest) asHTTPRequest() *http.Request {
	if r == nil {
		return nil
	}
	if r.original != nil {
		return r.original
	}
	u := r.URL
	if u == nil {
		u = &url.URL{}
	}
	req := &http.Request{
		Method: r.Method,
		URL:    u,
		Header: r.header(),
		Host:   u.Host,
	}
	return req.WithContext(r.ctx())
}

// HTTPResponseWriter is the minimum surface mcp-go needs to write a
// streamable HTTP response. Adapters for fasthttp, fiber, or other transports
// can implement this directly to avoid going through the net/http server
// machinery.
//
// Implementations whose underlying transport buffers the response (and so
// cannot deliver SSE streams) MUST return false from CanStream and SHOULD
// make Flush a no-op. The server uses CanStream to decide whether to
// upgrade a POST response to text/event-stream and whether GET (which
// requires streaming) is supported at all.
type HTTPResponseWriter interface {
	// Header returns the response header map. The same semantics as
	// http.ResponseWriter.Header apply: changes after WriteHeader has been
	// called may be ignored.
	Header() http.Header
	// WriteHeader sends the HTTP status code. It must be called at most once.
	WriteHeader(statusCode int)
	// Write writes raw response bytes. WriteHeader is implicitly called with
	// 200 if it has not been called yet.
	Write(p []byte) (int, error)
	// Flush forwards any buffered bytes to the client. Implementations whose
	// underlying transport cannot stream may make this a no-op, but in that
	// case CanStream MUST return false.
	Flush()
	// CanStream reports whether Flush actually delivers bytes to the client
	// immediately. When false, the server will not upgrade POST responses to
	// SSE and will reject GET requests with 405 Method Not Allowed.
	CanStream() bool
}

// httpResponseWriterAdapter adapts an http.ResponseWriter to
// HTTPResponseWriter. Streaming support is detected via http.Flusher.
type httpResponseWriterAdapter struct {
	w       http.ResponseWriter
	flusher http.Flusher // nil when underlying writer cannot stream
}

func newHTTPResponseWriterAdapter(w http.ResponseWriter) *httpResponseWriterAdapter {
	a := &httpResponseWriterAdapter{w: w}
	if f, ok := w.(http.Flusher); ok {
		a.flusher = f
	}
	return a
}

func (a *httpResponseWriterAdapter) Header() http.Header         { return a.w.Header() }
func (a *httpResponseWriterAdapter) WriteHeader(status int)      { a.w.WriteHeader(status) }
func (a *httpResponseWriterAdapter) Write(p []byte) (int, error) { return a.w.Write(p) }

func (a *httpResponseWriterAdapter) Flush() {
	if a.flusher != nil {
		a.flusher.Flush()
	}
}

// SetWriteDeadline sets a deadline for future writes via
// http.ResponseController, bounding how long a stalled client can block the
// server. A zero time clears the deadline.
func (a *httpResponseWriterAdapter) SetWriteDeadline(t time.Time) error {
	return http.NewResponseController(a.w).SetWriteDeadline(t)
}

func (a *httpResponseWriterAdapter) CanStream() bool { return a.flusher != nil }

// httpErrorTextHeader sets the conventional headers for plain-text HTTP
// errors, matching net/http's http.Error behavior for response writers that
// don't go through net/http.
func httpErrorTextHeader(h http.Header) {
	h.Set("Content-Type", "text/plain; charset=utf-8")
	h.Set("X-Content-Type-Options", "nosniff")
}

// writeHTTPError writes a plain-text error response to w. Modeled after
// net/http's http.Error so the externally observable behavior of Handle
// matches ServeHTTP byte-for-byte.
func writeHTTPError(w HTTPResponseWriter, msg string, code int) {
	httpErrorTextHeader(w.Header())
	// Drop framing headers in case any were already set, mirroring http.Error.
	w.Header().Del("Content-Length")
	w.WriteHeader(code)
	_, _ = io.WriteString(w, msg+"\n")
}

// writeHTTPErrorf is a printf-style helper for writeHTTPError.
func writeHTTPErrorf(w HTTPResponseWriter, code int, format string, args ...any) {
	writeHTTPError(w, fmt.Sprintf(format, args...), code)
}

// Handle dispatches a single MCP request through the streamable HTTP state
// machine using transport-agnostic primitives.
//
// This is the framework-agnostic entry point intended for callers integrating
// MCP into HTTP frameworks other than net/http (e.g. fasthttp/fiber). For
// net/http callers, ServeHTTP is the conventional and equivalent entry
// point; in fact, ServeHTTP is implemented as a thin wrapper around Handle.
//
// Behavioral notes for callers integrating via Handle:
//
//   - WithStreamableHTTPCORS is NOT applied. Frameworks should use their
//     native CORS middleware.
//   - DNS rebinding protection is NOT applied, because Handle has no access
//     to the connection's local address. Adapters for localhost-reachable
//     servers should validate the Host header themselves (reject non-loopback
//     Host values on loopback connections with 403 Forbidden).
//   - WithProtectedResourceMetadata is NOT applied. The caller should mount
//     the metadata route separately if needed (see ProtectedResourceMetadataHandler).
//   - WithHTTPContextFunc is honored for backwards compatibility; it receives
//     a synthetic *http.Request derived from r so existing options keep working.
//     Callers may also pre-populate r.Context with any values they need.
//   - When w.CanStream() returns false, GET (SSE listening) is rejected with
//     405 Method Not Allowed and POST responses that would otherwise upgrade
//     to text/event-stream stay as a single buffered application/json reply.
func (s *StreamableHTTPServer) Handle(w HTTPResponseWriter, r *HTTPRequest) {
	if r == nil {
		writeHTTPError(w, "nil request", http.StatusBadRequest)
		return
	}
	switch r.Method {
	case http.MethodPost:
		s.handlePost(w, r)
	case http.MethodGet:
		s.handleGet(w, r)
	case http.MethodDelete:
		s.handleDelete(w, r)
	case http.MethodHead:
		w.WriteHeader(http.StatusOK)
	default:
		writeHTTPError(w, "404 page not found", http.StatusNotFound)
	}
}

// resolveSessionIdManager returns the SessionIdManager configured for r,
// preserving compatibility with custom SessionIdManagerResolver implementations
// that take a *http.Request.
func (s *StreamableHTTPServer) resolveSessionIdManager(r *HTTPRequest) SessionIdManager {
	// Fast path: when the resolver is a DefaultSessionIdManagerResolver (the
	// vast majority of deployments), the cached manager is identical to what
	// the resolver would return and we can skip building a synthetic request.
	if s.sessionIdManager != nil {
		return s.sessionIdManager
	}
	return s.sessionIdManagerResolver.ResolveSessionIdManager(r.asHTTPRequest())
}

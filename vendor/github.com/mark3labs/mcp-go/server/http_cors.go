package server

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"
)

// CORSConfig holds the Cross-Origin Resource Sharing configuration shared by
// the SSE and Streamable HTTP transports. The zero value disables CORS
// handling entirely; set at least one allowed origin via AllowedOrigins (or
// the WithCORSAllowedOrigins helper) to enable it.
//
// CORS handling is opt-in: when no origins are configured, the transports do
// not emit any Access-Control-* response headers and preflight (OPTIONS)
// requests are passed through to the underlying handlers unchanged.
type CORSConfig struct {
	// AllowedOrigins is the list of origins permitted to access the server.
	// The literal value "*" allows any origin, but is incompatible with
	// AllowCredentials per the CORS specification — when both are set, the
	// server echoes the request's Origin header instead of "*".
	AllowedOrigins []string

	// AllowedMethods is the list of HTTP methods allowed for cross-origin
	// requests. When empty, GET, POST, DELETE and OPTIONS are advertised.
	AllowedMethods []string

	// AllowedHeaders is the list of headers a client may send with the
	// actual request. When empty, a sensible MCP-aware default of
	// Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Mcp-Method,
	// Mcp-Name, Last-Event-ID and Authorization is advertised.
	AllowedHeaders []string

	// ExposedHeaders is the list of response headers the browser is
	// permitted to access from JavaScript. When empty, Mcp-Session-Id is
	// exposed by default so clients can read newly-issued session IDs.
	ExposedHeaders []string

	// AllowCredentials, when true, causes the server to send
	// Access-Control-Allow-Credentials: true on cross-origin responses.
	AllowCredentials bool

	// MaxAge is the number of seconds browsers may cache the preflight
	// response. Zero (or negative) omits the header.
	MaxAge int
}

// CORSOption configures a CORSConfig. It is consumed by the per-transport
// options WithSSECORS and WithStreamableHTTPCORS.
type CORSOption func(*CORSConfig)

// WithCORSAllowedOrigins sets the list of origins allowed to access the
// server. Passing "*" allows any origin. Calling this multiple times within a
// single WithSSECORS / WithStreamableHTTPCORS invocation replaces the previous
// value.
func WithCORSAllowedOrigins(origins ...string) CORSOption {
	return func(c *CORSConfig) {
		c.AllowedOrigins = append(c.AllowedOrigins[:0:0], origins...)
	}
}

// WithCORSAllowedMethods sets the list of HTTP methods advertised in
// preflight responses via Access-Control-Allow-Methods.
func WithCORSAllowedMethods(methods ...string) CORSOption {
	return func(c *CORSConfig) {
		c.AllowedMethods = append(c.AllowedMethods[:0:0], methods...)
	}
}

// WithCORSAllowedHeaders sets the list of headers advertised in preflight
// responses via Access-Control-Allow-Headers.
func WithCORSAllowedHeaders(headers ...string) CORSOption {
	return func(c *CORSConfig) {
		c.AllowedHeaders = append(c.AllowedHeaders[:0:0], headers...)
	}
}

// WithCORSExposedHeaders sets the list of headers exposed to the browser
// client via Access-Control-Expose-Headers.
func WithCORSExposedHeaders(headers ...string) CORSOption {
	return func(c *CORSConfig) {
		c.ExposedHeaders = append(c.ExposedHeaders[:0:0], headers...)
	}
}

// WithCORSAllowCredentials enables Access-Control-Allow-Credentials: true on
// cross-origin responses. When combined with an AllowedOrigins value of "*",
// the server echoes the request's Origin header to remain spec-compliant.
func WithCORSAllowCredentials() CORSOption {
	return func(c *CORSConfig) {
		c.AllowCredentials = true
	}
}

// WithCORSMaxAge sets the Access-Control-Max-Age header (in seconds)
// emitted on preflight responses. Zero or negative values omit the header.
func WithCORSMaxAge(seconds int) CORSOption {
	return func(c *CORSConfig) {
		c.MaxAge = seconds
	}
}

// enabled reports whether CORS handling should be performed for this
// configuration. A nil receiver or empty AllowedOrigins disables CORS.
func (c *CORSConfig) enabled() bool {
	return c != nil && len(c.AllowedOrigins) > 0
}

// resolveOrigin returns the value to set on Access-Control-Allow-Origin for
// the given request Origin, or the empty string if the origin is not allowed.
func (c *CORSConfig) resolveOrigin(origin string) string {
	for _, allowed := range c.AllowedOrigins {
		if allowed == "*" {
			// Per the CORS spec, "*" cannot be combined with credentials.
			// When credentials are required, echo the request origin
			// instead so the browser still accepts the response.
			if c.AllowCredentials {
				if origin == "" {
					return ""
				}
				return origin
			}
			return "*"
		}
		if origin != "" && allowed == origin {
			return origin
		}
	}
	return ""
}

// applyCommonHeaders writes the response headers shared between simple and
// preflight responses (Allow-Origin, Allow-Credentials, Expose-Headers, Vary).
// It returns true if the request's origin was permitted by the configuration.
func (c *CORSConfig) applyCommonHeaders(w http.ResponseWriter, r *http.Request) bool {
	h := w.Header()
	// Always advertise Vary: Origin so caches do not serve a response with
	// CORS headers from one origin to a request from a different one.
	h.Add("Vary", "Origin")

	origin := r.Header.Get("Origin")
	allowOrigin := c.resolveOrigin(origin)
	if allowOrigin == "" {
		return false
	}
	h.Set("Access-Control-Allow-Origin", allowOrigin)
	if c.AllowCredentials {
		h.Set("Access-Control-Allow-Credentials", "true")
	}

	exposed := c.ExposedHeaders
	if len(exposed) == 0 {
		exposed = []string{HeaderKeySessionID}
	}
	h.Set("Access-Control-Expose-Headers", strings.Join(exposed, ", "))
	return true
}

// handlePreflight writes a complete preflight (CORS OPTIONS) response and
// returns true. The caller must skip its normal request handling when this
// returns true. It returns false when the request is not a CORS preflight.
func (c *CORSConfig) handlePreflight(w http.ResponseWriter, r *http.Request) bool {
	if !c.enabled() {
		return false
	}
	if r.Method != http.MethodOptions || r.Header.Get("Access-Control-Request-Method") == "" {
		return false
	}

	c.applyCommonHeaders(w, r)

	h := w.Header()
	methods := c.AllowedMethods
	if len(methods) == 0 {
		methods = []string{http.MethodGet, http.MethodPost, http.MethodDelete, http.MethodOptions}
	}
	h.Set("Access-Control-Allow-Methods", strings.Join(methods, ", "))

	headers := c.AllowedHeaders
	if len(headers) == 0 {
		headers = []string{
			"Content-Type", HeaderKeySessionID, HeaderKeyProtocolVersion, mcp.HeaderMethod, mcp.HeaderName,
			"Last-Event-ID", "Authorization",
		}
	}
	h.Set("Access-Control-Allow-Headers", strings.Join(headers, ", "))

	if c.MaxAge > 0 {
		h.Set("Access-Control-Max-Age", strconv.Itoa(c.MaxAge))
	}

	w.WriteHeader(http.StatusNoContent)
	return true
}

// applySimple writes the headers for a non-preflight (simple) cross-origin
// response. It is a no-op when CORS is not enabled.
func (c *CORSConfig) applySimple(w http.ResponseWriter, r *http.Request) {
	if !c.enabled() {
		return
	}
	c.applyCommonHeaders(w, r)
}

// clone returns a deep copy of the configuration so callers cannot mutate
// internal state after construction.
func (c *CORSConfig) clone() *CORSConfig {
	if c == nil {
		return nil
	}
	cp := *c
	if c.AllowedOrigins != nil {
		cp.AllowedOrigins = append([]string(nil), c.AllowedOrigins...)
	}
	if c.AllowedMethods != nil {
		cp.AllowedMethods = append([]string(nil), c.AllowedMethods...)
	}
	if c.AllowedHeaders != nil {
		cp.AllowedHeaders = append([]string(nil), c.AllowedHeaders...)
	}
	if c.ExposedHeaders != nil {
		cp.ExposedHeaders = append([]string(nil), c.ExposedHeaders...)
	}
	return &cp
}

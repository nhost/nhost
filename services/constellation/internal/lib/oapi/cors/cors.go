// Package cors provides a Gin middleware that implements Cross-Origin Resource
// Sharing (CORS) per the W3C/Fetch specification, with configurable allow-lists
// for origins, methods, headers, and exposed headers, plus credentials and
// max-age controls. It mirrors the shared nhost CORS middleware so the code can
// be relocated there with only an import-path change.
package cors

import (
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"

	"github.com/gin-gonic/gin"
)

// ErrWildcardWithCredentials is returned by Options.Validate when a
// wildcard ("*") origin is combined with AllowCredentials. Reflecting an
// arbitrary request Origin while also sending
// Access-Control-Allow-Credentials: true lets any website read credentialed
// responses cross-origin, so the combination is rejected at configuration
// time.
var ErrWildcardWithCredentials = errors.New(
	"CORS wildcard origin \"*\" cannot be combined with allow-credentials",
)

// Options configures the CORS middleware behavior.
//
// The middleware supports several strategies for gating Access-Control-Allow-Origin:
//   - AllowOriginFunc non-nil: the function decides; AllowedOrigins is ignored.
//   - AllowedOrigins nil: all origins allowed.
//   - AllowedOrigins contains "*": all origins allowed.
//   - AllowedOrigins non-empty: only listed origins allowed.
//   - AllowedOrigins empty slice: all origins denied.
//
// And four strategies for handling Access-Control-Allow-Headers:
//   - AllowHeadersFunc non-nil: per-header predicate; the response reflects
//     only the entries of Access-Control-Request-Headers the function approves
//   - AllowedHeaders nil (default): Reflects the Access-Control-Request-Headers
//     from the client
//   - AllowedHeaders empty slice: Denies all headers (no
//     Access-Control-Allow-Headers header is set)
//   - AllowedHeaders non-empty: Uses the specified headers
type Options struct {
	// AllowOriginFunc, when non-nil, is consulted to decide whether an origin
	// is allowed. It takes precedence over AllowedOrigins. Use this when the
	// allowed origins are not a fixed enumerable list (e.g. a regex-matched
	// pattern).
	//
	// Validate cannot inspect a function, so the caller is responsible for the
	// safety of what it allows: a function that returns true for all origins
	// combined with AllowCredentials is exactly as dangerous as "*" with
	// credentials (it reflects an arbitrary Origin alongside
	// Access-Control-Allow-Credentials: true) and is NOT caught by CORS or
	// Validate. Never blanket-allow origins when AllowCredentials is true.
	AllowOriginFunc func(origin string) bool

	// AllowedOrigins is a list of origins permitted to make cross-origin requests.
	// Use "*" or nil slice to allow all origins. Ignored when AllowOriginFunc is set.
	AllowedOrigins []string

	// AllowedMethods is a list of HTTP methods the client is permitted to use.
	// Common values: GET, POST, PUT, DELETE, PATCH, OPTIONS.
	AllowedMethods []string

	// AllowHeadersFunc, when non-nil, is consulted per header name listed in
	// the client's Access-Control-Request-Headers. The response's
	// Access-Control-Allow-Headers will list exactly the requested entries the
	// function approved, preserving the client's casing and order. Use this
	// for open-ended header families like "X-Hasura-*" or "X-Nhost-*" whose
	// full set isn't known up front. Takes precedence over AllowedHeaders.
	//
	// The function receives the header name as the client sent it (trimmed of
	// surrounding whitespace); callers that want a case-insensitive match
	// should lower-case the input themselves.
	AllowHeadersFunc func(name string) bool

	// AllowedHeaders controls which headers clients can use in requests.
	// - nil: reflects client's Access-Control-Request-Headers (permissive)
	// - empty slice: denies all headers
	// - non-empty: allows only specified headers
	//
	// Ignored when AllowHeadersFunc is set.
	AllowedHeaders []string

	// ExposedHeaders lists headers that browsers are allowed to access.
	// By default, browsers only expose simple response headers.
	ExposedHeaders []string

	// AllowCredentials indicates whether the request can include credentials
	// (cookies, authorization headers, or TLS client certificates).
	AllowCredentials bool

	// MaxAge indicates how long (in seconds) the results of a preflight request
	// can be cached. Empty string means no caching directive is sent.
	MaxAge string
}

// Validate reports whether the options form a safe CORS configuration. It
// returns ErrWildcardWithCredentials when a wildcard origin is paired with
// AllowCredentials, which is the dangerous combination browsers honor (a
// reflected concrete origin plus credentials). All other combinations are
// considered valid.
func (o Options) Validate() error {
	if o.AllowCredentials && slices.Contains(o.AllowedOrigins, "*") {
		return ErrWildcardWithCredentials
	}

	return nil
}

// headerStrategy selects how Access-Control-Allow-Headers is computed at
// request time. Encoding the three branches as a typed enum (rather than bare
// strings) lets the compiler catch typos in either the assignment or the
// consuming switch.
type headerStrategy uint8

const (
	// headerReflect mirrors the client's Access-Control-Request-Headers back
	// to it. Selected when Options.AllowedHeaders is nil.
	headerReflect headerStrategy = iota
	// headerSpecific emits a fixed Access-Control-Allow-Headers list.
	// Selected when Options.AllowedHeaders is non-empty.
	headerSpecific
	// headerDeny omits Access-Control-Allow-Headers entirely. Selected when
	// Options.AllowedHeaders is an empty (non-nil) slice.
	headerDeny
	// headerFiltered reflects the subset of the client's
	// Access-Control-Request-Headers approved by Options.AllowHeadersFunc.
	// Selected whenever AllowHeadersFunc is non-nil; takes precedence over
	// the AllowedHeaders nil/empty/non-empty distinction.
	headerFiltered
)

// corsConfig holds the values precomputed once at middleware construction
// time so the per-request closure can be a straight read of the same shape
// regardless of Options.
type corsConfig struct {
	originAllowed    func(origin string) bool
	headerAllowed    func(name string) bool // non-nil only when strategy == headerFiltered
	allowedMethods   string
	exposedHeaders   string
	allowedHeaders   string
	allowCredentials string
	maxAge           string
	strategy         headerStrategy
}

// newCORSConfig precomputes the constant pieces of the response (origin
// decision, joined header lists, header-strategy enum) so that CORS can stay
// small enough to read without needing a funlen suppression.
func newCORSConfig(opts Options) corsConfig {
	allowCredentials := "false"
	if opts.AllowCredentials {
		allowCredentials = "true"
	}

	var (
		strategy       headerStrategy
		allowedHeaders string
		headerAllowed  func(name string) bool
	)

	switch {
	case opts.AllowHeadersFunc != nil:
		strategy = headerFiltered
		headerAllowed = opts.AllowHeadersFunc
	case opts.AllowedHeaders == nil:
		strategy = headerReflect
	case len(opts.AllowedHeaders) == 0:
		strategy = headerDeny
	default:
		strategy = headerSpecific
		allowedHeaders = strings.Join(opts.AllowedHeaders, ", ")
	}

	return corsConfig{
		originAllowed:    allowOriginFunc(opts),
		headerAllowed:    headerAllowed,
		allowedMethods:   strings.Join(opts.AllowedMethods, ", "),
		exposedHeaders:   strings.Join(opts.ExposedHeaders, ", "),
		allowedHeaders:   allowedHeaders,
		allowCredentials: allowCredentials,
		maxAge:           opts.MaxAge,
		strategy:         strategy,
	}
}

// filterRequestHeaders returns the subset of the comma-separated requested
// header list (in Access-Control-Request-Headers wire format) for which allow
// returns true. The returned list preserves the client's casing and original
// join order.
func filterRequestHeaders(requested string, allow func(name string) bool) string {
	if requested == "" {
		return ""
	}

	parts := strings.Split(requested, ",")
	allowed := make([]string, 0, len(parts))

	for _, raw := range parts {
		name := strings.TrimSpace(raw)
		if name == "" {
			continue
		}

		if allow(name) {
			allowed = append(allowed, name)
		}
	}

	return strings.Join(allowed, ", ")
}

// applyHeaders writes the CORS response headers for a single request whose
// Origin was already determined to be allowed.
func (cfg corsConfig) applyHeaders(c *gin.Context, origin string) {
	c.Header("Access-Control-Allow-Origin", origin)
	c.Header("Access-Control-Allow-Methods", cfg.allowedMethods)

	switch cfg.strategy {
	case headerSpecific:
		c.Header("Access-Control-Allow-Headers", cfg.allowedHeaders)
	case headerReflect:
		headers := c.Request.Header.Get("Access-Control-Request-Headers")
		if headers != "" {
			c.Header("Access-Control-Allow-Headers", headers)
		}
	case headerFiltered:
		requested := c.Request.Header.Get("Access-Control-Request-Headers")
		if filtered := filterRequestHeaders(requested, cfg.headerAllowed); filtered != "" {
			c.Header("Access-Control-Allow-Headers", filtered)
		}
	case headerDeny:
		// Don't set the header at all.
	}

	if cfg.exposedHeaders != "" {
		c.Header("Access-Control-Expose-Headers", cfg.exposedHeaders)
	}

	c.Header("Access-Control-Allow-Credentials", cfg.allowCredentials)

	if cfg.maxAge != "" {
		c.Header("Access-Control-Max-Age", cfg.maxAge)
	}

	c.Writer.Header().Add("Vary", "Origin, Access-Control-Request-Method")
}

// CORS returns a Gin middleware handler that implements Cross-Origin Resource Sharing (CORS).
//
// CORS is fail-closed: it calls opts.Validate() and returns the resulting error
// (ErrWildcardWithCredentials) rather than building a middleware that would
// reflect an arbitrary Origin alongside Access-Control-Allow-Credentials: true.
// This way the dangerous combination is rejected by the middleware itself, not
// only by callers that remember to validate. Validate cannot inspect
// AllowOriginFunc, so a blanket-allow function plus credentials is still the
// caller's responsibility (see Options.AllowOriginFunc).
//
// The middleware handles both preflight (OPTIONS) requests and actual requests, setting
// appropriate CORS headers based on the provided configuration. It automatically adds
// the "Vary: Origin, Access-Control-Request-Method" header for proper cache behavior.
//
// For preflight requests (OPTIONS), the middleware responds with 204 No Content and
// prevents further request processing. For actual requests, it sets CORS headers and
// continues the middleware chain.
//
// Example usage:
//
//	handler, err := cors.CORS(cors.Options{
//		AllowedOrigins:   []string{"https://example.com", "https://app.example.com"},
//		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE"},
//		AllowedHeaders:   nil, // reflects client headers
//		AllowCredentials: true,
//		MaxAge:           "3600",
//	})
//	if err != nil {
//		return err
//	}
//	router.Use(handler)
func CORS(opts Options) (gin.HandlerFunc, error) {
	if err := opts.Validate(); err != nil {
		return nil, fmt.Errorf("invalid CORS options: %w", err)
	}

	cfg := newCORSConfig(opts)

	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		if c.Request.Method == http.MethodOptions {
			if cfg.originAllowed(origin) {
				cfg.applyHeaders(c, origin)
			}

			c.Header("Content-Length", "0")
			c.AbortWithStatus(http.StatusNoContent)

			return
		}

		if origin != "" && cfg.originAllowed(origin) {
			cfg.applyHeaders(c, origin)
		}

		c.Next()
	}, nil
}

// allowOriginFunc picks an origin-check strategy once at construction time
// and returns a closure that the per-request path can call without re-doing
// the strategy switch (or scanning AllowedOrigins for "*") on every request.
func allowOriginFunc(opts Options) func(origin string) bool {
	switch {
	case opts.AllowOriginFunc != nil:
		return opts.AllowOriginFunc
	case opts.AllowedOrigins == nil, slices.Contains(opts.AllowedOrigins, "*"):
		return func(string) bool { return true }
	default:
		allowed := opts.AllowedOrigins

		return func(origin string) bool {
			return slices.Contains(allowed, origin)
		}
	}
}

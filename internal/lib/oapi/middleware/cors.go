package middleware

import (
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"

	"github.com/gin-gonic/gin"
)

// ErrWildcardWithCredentials is returned by CORSOptions.Validate when an
// allow-all origin is combined with AllowCredentials. Reflecting an arbitrary
// request Origin while also sending Access-Control-Allow-Credentials: true lets
// any website read credentialed responses cross-origin, so the combination is
// rejected unless UnsafeAllowAllOriginsWithCredentials is set for legacy
// migration.
var ErrWildcardWithCredentials = errors.New(
	"CORS wildcard origin cannot be combined with allow-credentials",
)

// CORSOptions configures the CORS middleware behavior.
//
// The middleware supports several strategies for gating Access-Control-Allow-Origin:
//   - AllowOriginFunc non-nil: the function decides; AllowedOrigins is ignored.
//   - AllowedOrigins nil: all origins allowed.
//   - AllowedOrigins contains an allow-all token: all origins allowed.
//   - AllowedOrigins non-empty: entries are matched literally, or as anchored
//     globs when they contain "*". A "*" never spans "/".
//   - AllowedOrigins empty slice: all origins denied.
//
// And four strategies for handling Access-Control-Allow-Headers:
//   - AllowHeadersFunc non-nil: reflects only requested headers approved by the function.
//   - AllowedHeaders nil: reflects Access-Control-Request-Headers.
//   - AllowedHeaders empty slice: denies all headers.
//   - AllowedHeaders non-empty: emits the configured header list.
type CORSOptions struct {
	// AllowOriginFunc, when non-nil, is consulted to decide whether an origin
	// is allowed. It takes precedence over AllowedOrigins. Validate cannot
	// inspect a function, so callers are responsible for not blanket-allowing
	// origins when AllowCredentials is true.
	AllowOriginFunc func(origin string) bool

	// AllowedOrigins is a list of origins permitted to make cross-origin
	// requests. A nil slice or an allow-all token permits any origin. Entries
	// containing glob markers are matched as anchored patterns, where each marker
	// stands for any run of characters except "/". Ignored when AllowOriginFunc
	// is set.
	AllowedOrigins []string

	// AllowedMethods is a list of HTTP methods the client is permitted to use.
	AllowedMethods []string

	// AllowHeadersFunc, when non-nil, is consulted per header name listed in
	// Access-Control-Request-Headers. The response reflects exactly the requested
	// entries approved by the function, preserving client casing and order.
	AllowHeadersFunc func(name string) bool

	// AllowedHeaders controls which headers clients can use in requests.
	// - nil: reflects client's Access-Control-Request-Headers
	// - empty slice: denies all headers
	// - non-empty: allows only specified headers
	// Ignored when AllowHeadersFunc is set.
	AllowedHeaders []string

	// ExposedHeaders lists headers that browsers are allowed to access.
	ExposedHeaders []string

	// AllowCredentials indicates whether the request can include credentials.
	AllowCredentials bool

	// MaxAge indicates how long preflight results can be cached. Empty means no directive.
	MaxAge string

	// UnsafeAllowAllOriginsWithCredentials preserves legacy behavior that reflects
	// arbitrary origins together with Access-Control-Allow-Credentials: true. Do
	// not use for new services; this exists only to migrate older wildcard CORS
	// configurations without changing runtime behavior in the same PR.
	UnsafeAllowAllOriginsWithCredentials bool
}

// Validate reports whether the options form a safe CORS configuration.
func (o CORSOptions) Validate() error {
	if !o.AllowCredentials || o.UnsafeAllowAllOriginsWithCredentials || o.AllowOriginFunc != nil {
		return nil
	}

	if o.AllowedOrigins == nil {
		return ErrWildcardWithCredentials
	}

	if slices.ContainsFunc(o.AllowedOrigins, isAllowAllOrigin) {
		return ErrWildcardWithCredentials
	}

	return nil
}

func isAllowAllOrigin(origin string) bool {
	return origin != "" && strings.Trim(origin, "*") == ""
}

func matchWildcardOrigin(pattern, origin string) bool {
	var px, ox int

	starPx, starOx := -1, -1

	for ox < len(origin) {
		switch {
		case px < len(pattern) && pattern[px] == '*':
			starPx, starOx = px, ox
			px++
		case px < len(pattern) && pattern[px] == origin[ox]:
			px++
			ox++
		case starPx != -1 && origin[starOx] != '/':
			px = starPx + 1
			starOx++
			ox = starOx
		default:
			return false
		}
	}

	for px < len(pattern) && pattern[px] == '*' {
		px++
	}

	return px == len(pattern)
}

type headerStrategy uint8

const (
	headerReflect headerStrategy = iota
	headerSpecific
	headerDeny
	headerFiltered
)

type corsConfig struct {
	originAllowed    func(origin string) bool
	headerAllowed    func(name string) bool
	allowedMethods   string
	exposedHeaders   string
	allowedHeaders   string
	allowCredentials string
	maxAge           string
	strategy         headerStrategy
}

func newCORSConfig(opts CORSOptions) corsConfig {
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
}

// CORS returns a Gin middleware handler that implements Cross-Origin Resource Sharing.
//
// Call [CORSOptions.Validate] at configuration time when configuration errors
// should fail startup. NewRouter does this automatically; direct users that
// intentionally preserve legacy wildcard-with-credentials behavior should set
// UnsafeAllowAllOriginsWithCredentials explicitly.
func CORS(opts CORSOptions) gin.HandlerFunc {
	cfg := newCORSConfig(opts)

	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		c.Writer.Header().Add("Vary", "Origin, Access-Control-Request-Method")

		if origin != "" && cfg.originAllowed(origin) {
			cfg.applyHeaders(c, origin)
		}

		if c.Request.Method == http.MethodOptions {
			c.Header("Content-Length", "0")
			c.AbortWithStatus(http.StatusNoContent)

			return
		}

		c.Next()
	}
}

func allowOriginFunc(opts CORSOptions) func(origin string) bool {
	if opts.AllowOriginFunc != nil {
		return opts.AllowOriginFunc
	}

	if opts.AllowedOrigins == nil {
		return func(string) bool { return true }
	}

	exact := make(map[string]struct{}, len(opts.AllowedOrigins))

	var patterns []string

	for _, origin := range opts.AllowedOrigins {
		switch {
		case isAllowAllOrigin(origin):
			return func(string) bool { return true }
		case strings.Contains(origin, "*"):
			patterns = append(patterns, origin)
		default:
			exact[origin] = struct{}{}
		}
	}

	return func(origin string) bool {
		if _, ok := exact[origin]; ok {
			return true
		}

		for _, pattern := range patterns {
			if matchWildcardOrigin(pattern, origin) {
				return true
			}
		}

		return false
	}
}

// ValidateCORSOptions wraps [CORSOptions.Validate] with context for callers that
// want a package-level helper instead of invoking the method directly.
func ValidateCORSOptions(opts CORSOptions) error {
	if err := opts.Validate(); err != nil {
		return fmt.Errorf("invalid CORS options: %w", err)
	}

	return nil
}

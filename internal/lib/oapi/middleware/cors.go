package middleware

import (
	"net/http"
	"slices"
	"strings"

	"github.com/gin-gonic/gin"
)

// CORSOptions configures the CORS middleware behavior.
//
// The middleware supports three strategies for handling Access-Control-Allow-Headers:
//   - nil (default): Reflects the Access-Control-Request-Headers from the client
//   - empty slice: Denies all headers (no Access-Control-Allow-Headers header is set)
//   - non-empty slice: Uses the specified headers
type CORSOptions struct {
	// AllowedOrigins is a list of origins permitted to make cross-origin requests.
	// Use "*" or nil slice to allow all origins.
	AllowedOrigins []string

	// AllowedMethods is a list of HTTP methods the client is permitted to use.
	// Common values: GET, POST, PUT, DELETE, PATCH, OPTIONS.
	AllowedMethods []string

	// AllowedHeaders controls which headers clients can use in requests.
	// - nil: reflects client's Access-Control-Request-Headers (permissive)
	// - empty slice: denies all headers
	// - non-empty: allows only specified headers
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

// CORS returns a Gin middleware handler that implements Cross-Origin Resource Sharing (CORS).
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
//	router.Use(middleware.CORS(middleware.CORSOptions{
//		AllowedOrigins:   []string{"https://example.com", "https://app.example.com"},
//		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE"},
//		AllowedHeaders:   nil, // reflects client headers
//		AllowCredentials: true,
//		MaxAge:           "3600",
//	}))
func CORS(opts CORSOptions) gin.HandlerFunc { //nolint:cyclop,funlen
	allowedMethods := strings.Join(opts.AllowedMethods, ", ")
	exposedHeaders := strings.Join(opts.ExposedHeaders, ", ")

	allowCredentials := "false"
	if opts.AllowCredentials {
		allowCredentials = "true"
	}

	var (
		headerStrategy string // "reflect", "specific", or "deny"
		allowedHeaders string
	)
	switch {
	case opts.AllowedHeaders == nil:
		headerStrategy = "reflect"
	case len(opts.AllowedHeaders) == 0:
		headerStrategy = "deny"
	default:
		headerStrategy = "specific"
		allowedHeaders = strings.Join(opts.AllowedHeaders, ", ")
	}

	f := func(c *gin.Context, origin string) {
		if opts.AllowedOrigins != nil &&
			!slices.Contains(opts.AllowedOrigins, origin) &&
			!slices.Contains(opts.AllowedOrigins, "*") {
			return
		}

		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Access-Control-Allow-Methods", allowedMethods)

		// Handle allowed headers based on strategy
		switch headerStrategy {
		case "specific":
			c.Header("Access-Control-Allow-Headers", allowedHeaders)
		case "reflect":
			headers := c.Request.Header.Get("Access-Control-Request-Headers")
			if headers != "" {
				c.Header("Access-Control-Allow-Headers", headers)
			}
		case "deny":
			// Don't set the header at all
		}

		if exposedHeaders != "" {
			c.Header("Access-Control-Expose-Headers", exposedHeaders)
		}

		c.Header("Access-Control-Allow-Credentials", allowCredentials)

		if opts.MaxAge != "" {
			c.Header("Access-Control-Max-Age", opts.MaxAge)
		}

		c.Writer.Header().Add("Vary", "Origin, Access-Control-Request-Method")
	}

	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if c.Request.Method == http.MethodOptions {
			f(c, origin)

			c.Header("Content-Length", "0")
			c.AbortWithStatus(http.StatusNoContent)

			return
		}

		if origin != "" {
			f(c, origin)
		}

		c.Next()
	}
}

// Package securityheaders provides a gin middleware that sets standard browser
// security headers on every storage response.
//
// Storage serves user-uploaded bytes with the MIME type detected at upload
// time and Content-Disposition: inline. These headers tell the browser to
// handle such responses conservatively: not to sniff the content type and not
// to run active content.
//
// Framing is intentionally left unrestricted: the served bytes are static and
// sandboxed (no active content), so the clickjacking risk is negligible, while
// X-Frame-Options/frame-ancestors would break legitimate embedding of files
// (e.g. inline PDF or document previews via <iframe>).
package securityheaders

import "github.com/gin-gonic/gin"

const (
	headerXContentTypeOptions   = "X-Content-Type-Options"
	headerContentSecurityPolicy = "Content-Security-Policy"

	// valueNoSniff stops the browser from sniffing a response into a more
	// dangerous type than the one we declare.
	valueNoSniff = "nosniff"

	// valueCSP constrains how the browser may interpret a served response: the
	// sandbox directive (without allow-scripts) prevents active content from
	// running and default-src 'none' blocks every subresource and external
	// load. Static files still render.
	valueCSP = "default-src 'none'; sandbox"
)

// New returns a gin middleware that sets browser hardening headers on every
// response. It must be registered before the API handlers so the headers are
// in place when a handler writes its response.
func New() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		header := ctx.Writer.Header()
		header.Set(headerXContentTypeOptions, valueNoSniff)
		header.Set(headerContentSecurityPolicy, valueCSP)

		ctx.Next()
	}
}

// Package securityheaders provides a gin middleware that sets standard browser
// security headers on every storage response.
//
// Storage serves user-uploaded bytes with the MIME type detected at upload
// time and Content-Disposition: inline. These headers tell the browser to
// handle such responses conservatively: not to sniff the content type, not to
// run active content, and not to allow framing.
package securityheaders

import "github.com/gin-gonic/gin"

const (
	headerXContentTypeOptions   = "X-Content-Type-Options"
	headerContentSecurityPolicy = "Content-Security-Policy"
	headerXFrameOptions         = "X-Frame-Options"

	// valueNoSniff stops the browser from sniffing a response into a more
	// dangerous type than the one we declare.
	valueNoSniff = "nosniff"

	// valueCSP constrains how the browser may interpret a served response: the
	// sandbox directive (without allow-scripts) prevents active content from
	// running, default-src 'none' blocks every subresource and external load,
	// and frame-ancestors 'none' blocks framing. Static files still render.
	valueCSP = "default-src 'none'; sandbox; frame-ancestors 'none'"

	// valueXFrameOptions backs up frame-ancestors for legacy browsers.
	valueXFrameOptions = "DENY"
)

// New returns a gin middleware that sets browser hardening headers on every
// response. It must be registered before the API handlers so the headers are
// in place when a handler writes its response.
func New() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		header := ctx.Writer.Header()
		header.Set(headerXContentTypeOptions, valueNoSniff)
		header.Set(headerContentSecurityPolicy, valueCSP)
		header.Set(headerXFrameOptions, valueXFrameOptions)

		ctx.Next()
	}
}

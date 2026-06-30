// Package securityheaders provides a gin middleware that sets browser security
// headers on storage responses.
//
// Storage serves user-uploaded bytes with the MIME type detected at upload time
// and Content-Disposition: inline. Two hardening headers are applied:
//
//   - X-Content-Type-Options: nosniff is set on every response so the browser
//     never sniffs a payload into a more dangerous type than the one we declare.
//
//   - Content-Security-Policy: default-src 'none'; sandbox is set only on
//     responses whose Content-Type is a type the browser may run active content
//     for when it loads the response as a document or embeds it: HTML and the
//     XML family (text/xml, application/xml, and any "+xml" type such as SVG,
//     XHTML, RSS or Atom). For those, the sandbox directive stops scripts from
//     running and default-src 'none' blocks every subresource, neutralising
//     stored XSS while the markup itself still renders.
//
// The CSP is intentionally NOT applied to other types (PDF, images, plain
// downloads, ...): the sandbox directive breaks in-browser rendering and
// embedding of such files (e.g. Chrome's built-in PDF viewer) without adding
// security, since nosniff already prevents them from being reinterpreted as one
// of the active-content types above. Scoping on Content-Type is therefore safe:
// the set of types a browser executes scripts for is exactly the set that
// receives the CSP, and nosniff closes the type-confusion gap.
//
// Framing is left unrestricted: the served bytes are static and, for the
// active-content types, sandboxed, so the clickjacking risk is negligible while
// X-Frame-Options/frame-ancestors would break legitimate embedding of files
// (e.g. inline PDF or document previews via <iframe>).
package securityheaders

import (
	"mime"
	"strings"

	"github.com/gin-gonic/gin"
)

const (
	headerXContentTypeOptions   = "X-Content-Type-Options"
	headerContentSecurityPolicy = "Content-Security-Policy"
	headerContentType           = "Content-Type"

	// valueNoSniff stops the browser from sniffing a response into a more
	// dangerous type than the one we declare.
	valueNoSniff = "nosniff"

	// valueCSP constrains how the browser may interpret a served response: the
	// sandbox directive (without allow-scripts) prevents active content from
	// running and default-src 'none' blocks every subresource and external
	// load. Static markup still renders.
	valueCSP = "default-src 'none'; sandbox"
)

// isActiveContentType reports whether a browser may execute active content for
// a response of the given media type when it loads it as a document or embeds
// it (<iframe>/<embed>/<object>). These are the stored-XSS vectors the CSP
// guards; every other type is left untouched so it still renders/embeds.
//
// HTML is the only non-XML executable document type. The whole XML family is
// covered: text/xml and application/xml, plus — per RFC 6839 — any type with a
// "+xml" structured-syntax suffix (image/svg+xml, application/xhtml+xml,
// application/rss+xml, application/atom+xml, ...). A browser parses those as XML
// and honours an <?xml-stylesheet?> PI, so an XSLT can emit script-bearing HTML
// in this origin; matching the suffix avoids enumerating (and missing) each
// vocabulary.
func isActiveContentType(mediaType string) bool {
	switch mediaType {
	case "text/html", "application/xml", "text/xml":
		return true
	default:
		return strings.HasSuffix(mediaType, "+xml")
	}
}

// writer defers the Content-Security-Policy decision until the response is
// written, because the handler sets the Content-Type we scope on while it runs.
type writer struct {
	gin.ResponseWriter

	wrote bool
}

func (w *writer) setHeader() {
	if w.wrote {
		return
	}

	w.wrote = true

	// The handler may append parameters (e.g. "; charset=utf-8"); scope on the
	// bare media type only.
	contentType := w.Header().Get(headerContentType)

	mediaType, _, err := mime.ParseMediaType(contentType)
	if err != nil {
		// A non-empty Content-Type we cannot parse is suspicious: a lenient
		// browser may still derive an executable essence from it (e.g.
		// "text/html; charset" -> text/html), so fail closed and sandbox rather
		// than serve possible active content uncovered. An empty Content-Type is
		// left alone — there is nothing to execute, and nosniff still stops it
		// from being sniffed into an active type.
		if contentType != "" {
			w.Header().Set(headerContentSecurityPolicy, valueCSP)
		}

		return
	}

	if isActiveContentType(mediaType) {
		w.Header().Set(headerContentSecurityPolicy, valueCSP)
	}
}

func (w *writer) Write(data []byte) (int, error) {
	w.setHeader()

	return w.ResponseWriter.Write(data) //nolint:wrapcheck
}

func (w *writer) WriteString(s string) (int, error) {
	w.setHeader()

	return w.ResponseWriter.WriteString(s) //nolint:wrapcheck
}

func (w *writer) WriteHeaderNow() {
	w.setHeader()
	w.ResponseWriter.WriteHeaderNow()
}

// New returns a gin middleware that sets browser hardening headers. It must be
// registered before the API handlers so the headers are in place when a handler
// writes its response.
//
// X-Content-Type-Options is set up front on every response; the
// Content-Security-Policy is decided once the response is written, when the
// Content-Type it scopes on is known.
func New() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.Writer.Header().Set(headerXContentTypeOptions, valueNoSniff)

		ctx.Writer = &writer{
			ResponseWriter: ctx.Writer,
			wrote:          false,
		}

		ctx.Next()
	}
}

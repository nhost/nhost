// Package header can be used to sanitize HTTP request and response headers.
package header

import (
	"fmt"
	"net/http"
	"strings"
)

// Sanitize list of headers.
// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ can be consulted for header syntax.
func Sanitize(sanitizers map[string]SanitizeHeaderFunc, headers http.Header) http.Header {
	var redacted = http.Header{}

	for k, values := range headers {
		if s, ok := sanitizers[http.CanonicalHeaderKey(k)]; ok {
			redacted[k] = sanitize(s, values)
			continue
		}

		redacted[k] = values
	}

	return redacted
}

func sanitize(s SanitizeHeaderFunc, values []string) []string {
	var redacted = []string{}

	for _, v := range values {
		redacted = append(redacted, s(v))
	}

	return redacted
}

// DefaultSanitizers contains a list of sanitizers to be used for common headers.
var DefaultSanitizers = map[string]SanitizeHeaderFunc{
	"Authorization":       AuthorizationSanitizer,
	"Set-Cookie":          SetCookieSanitizer,
	"Cookie":              CookieSanitizer,
	"Proxy-Authorization": AuthorizationSanitizer,
}

// SanitizeHeaderFunc implements sanitization for a header value.
type SanitizeHeaderFunc func(string) string

// AuthorizationSanitizer is used to sanitize Authorization and Proxy-Authorization headers.
func AuthorizationSanitizer(unsafe string) string {
	if unsafe == "" {
		return ""
	}

	directives := strings.SplitN(unsafe, " ", 2)

	l := 0

	if len(directives) > 1 {
		l = len(directives[1])
	}

	if l == 0 {
		return directives[0]
	}

	return directives[0] + " " + redact(l)
}

// SetCookieSanitizer is used to sanitize Set-Cookie header.
func SetCookieSanitizer(unsafe string) string {
	directives := strings.SplitN(unsafe, ";", 2)

	cookie := strings.SplitN(directives[0], "=", 2)

	l := 0

	if len(cookie) > 1 {
		l = len(cookie[1])
	}

	if len(directives) == 2 {
		return fmt.Sprintf("%s=%s; %s", cookie[0], redact(l), strings.TrimPrefix(directives[1], " "))
	}

	return fmt.Sprintf("%s=%s", cookie[0], redact(l))
}

// CookieSanitizer is used to sanitize Cookie header.
func CookieSanitizer(unsafe string) string {
	cookies := strings.Split(unsafe, ";")

	var list []string

	for _, unsafeCookie := range cookies {
		cookie := strings.SplitN(unsafeCookie, "=", 2)
		l := 0

		if len(cookie) > 1 {
			l = len(cookie[1])
		}

		list = append(list, fmt.Sprintf("%s=%s", cookie[0], redact(l)))
	}

	return strings.Join(list, "; ")
}

func redact(count int) string {
	if count == 0 {
		return ""
	}

	return "████████████████████"
}

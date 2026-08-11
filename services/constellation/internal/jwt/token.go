package jwt

import (
	"net/http"
	"strings"

	"github.com/nhost/nhost/services/constellation/internal/jwt/jwtconfig"
)

// extractToken extracts a JWT token string from HTTP headers based on the header config.
func extractToken(headers http.Header, cfg jwtconfig.HeaderConfig) string {
	switch cfg.Type {
	case jwtconfig.HeaderTypeCookie:
		return extractFromCookie(headers, cfg.Name)
	case jwtconfig.HeaderTypeCustomHeader:
		return extractFromCustomHeader(headers, cfg.Name)
	case jwtconfig.HeaderTypeAuthorization, "":
		return extractFromAuthorizationHeader(headers)
	default:
		return extractFromAuthorizationHeader(headers)
	}
}

// extractFromAuthorizationHeader extracts a Bearer token from the Authorization header.
func extractFromAuthorizationHeader(headers http.Header) string {
	auth := headers.Get("Authorization")
	if auth == "" {
		return ""
	}

	const prefix = "Bearer "
	if len(auth) > len(prefix) && strings.EqualFold(auth[:len(prefix)], prefix) {
		return auth[len(prefix):]
	}

	return ""
}

// extractFromCookie extracts a token from a named cookie.
func extractFromCookie(headers http.Header, name string) string {
	cookieHeader := headers.Get("Cookie")
	if cookieHeader == "" {
		return ""
	}

	cookies, err := http.ParseCookie(cookieHeader)
	if err != nil {
		return ""
	}

	for _, cookie := range cookies {
		if cookie.Name == name {
			return cookie.Value
		}
	}

	return ""
}

// extractFromCustomHeader extracts a token from a custom header.
func extractFromCustomHeader(headers http.Header, name string) string {
	return headers.Get(name)
}

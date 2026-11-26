package transport

import (
	"errors"
	"fmt"
	"net/http"
	"net/netip"
	"net/url"
	"strconv"
	"strings"
)

// ErrCrossOriginRedirect is returned when a server redirects a request to a
// different origin (scheme, host or port) and the redirect policy does not
// allow it. The redirected request would otherwise carry the configured
// headers, the OAuth bearer token and, for 307 and 308, the request body to a
// destination the server chose.
var ErrCrossOriginRedirect = errors.New("refusing cross-origin redirect")

// ErrInsecureRedirect is returned when a server redirects an https request to
// a plain http URL.
var ErrInsecureRedirect = errors.New("refusing redirect from https to http")

// ErrTooManyRedirects is returned when a redirect chain reaches maxRedirects.
var ErrTooManyRedirects = errors.New("too many redirects")

// maxRedirects matches the limit net/http applies when CheckRedirect is nil.
const maxRedirects = 10

// newDefaultHTTPClient returns the HTTP client a transport uses when the
// caller does not supply one. It only follows same-origin redirects.
func newDefaultHTTPClient() *http.Client {
	return &http.Client{CheckRedirect: sameOriginRedirectPolicy}
}

// sameOriginRedirectPolicy is an http.Client CheckRedirect function that
// follows a redirect only when the new URL has the origin of the request that
// started the chain, and at most maxRedirects times.
func sameOriginRedirectPolicy(req *http.Request, via []*http.Request) error {
	if len(via) >= maxRedirects {
		return fmt.Errorf("%w: stopped after %d redirects", ErrTooManyRedirects, maxRedirects)
	}
	if len(via) == 0 {
		return nil
	}
	from := via[0].URL
	if !sameOrigin(from, req.URL) {
		return fmt.Errorf("%w: %s://%s to %s://%s",
			ErrCrossOriginRedirect, from.Scheme, from.Host, req.URL.Scheme, req.URL.Host)
	}
	return nil
}

// oauthRedirectPolicy is the CheckRedirect function of the OAuth handler's
// default client. Requests that carry credentials (token, refresh and client
// registration requests, which are not GET or HEAD) follow only same-origin
// redirects. Metadata discovery requests, which carry no credentials, may be
// redirected to another origin but never from https to http.
func oauthRedirectPolicy(req *http.Request, via []*http.Request) error {
	if len(via) == 0 {
		return nil
	}
	first := via[0]
	if first.Method != http.MethodGet && first.Method != http.MethodHead {
		return sameOriginRedirectPolicy(req, via)
	}
	if len(via) >= maxRedirects {
		return fmt.Errorf("%w: stopped after %d redirects", ErrTooManyRedirects, maxRedirects)
	}
	prev := via[len(via)-1].URL
	if asciiLower(prev.Scheme) == "https" && asciiLower(req.URL.Scheme) != "https" {
		return fmt.Errorf("%w: %s to %s", ErrInsecureRedirect, prev.Redacted(), req.URL.Redacted())
	}
	return nil
}

// sameOrigin reports whether a and b have the same scheme, host and port.
func sameOrigin(a, b *url.URL) bool {
	return origin(a) == origin(b)
}

// origin returns a normalized scheme://host:port string. The scheme and a
// host name are lowercased (ASCII only), an IP literal is written in its
// canonical form (so "[0:0::1]" and "[::1]" compare equal) with its zone
// unchanged, a missing port becomes the
// scheme's default, and a numeric port loses leading zeros, so ":0443" and
// ":443" compare equal as net/http dials them.
func origin(u *url.URL) string {
	scheme := asciiLower(u.Scheme)
	host := u.Hostname()
	if addr, err := netip.ParseAddr(host); err == nil {
		// netip writes hex digits in lowercase and keeps the zone as is:
		// zone names are interface names, which can differ only in case.
		host = addr.String()
	} else {
		host = asciiLower(host)
	}
	port := u.Port()
	if n, err := strconv.ParseUint(port, 10, 16); err == nil {
		port = strconv.FormatUint(n, 10)
	}
	if port == "" {
		port = defaultPort(scheme)
	}
	return scheme + "://[" + host + "]:" + port
}

// asciiLower lowercases only ASCII letters. Unicode case mapping must not be
// used on hosts: strings.ToLower maps "İ" to "i" and strings.EqualFold matches
// "K" (Kelvin sign) with "k", while net/http dials those as different hosts.
func asciiLower(s string) string {
	return strings.Map(func(r rune) rune {
		if 'A' <= r && r <= 'Z' {
			return r + ('a' - 'A')
		}
		return r
	}, s)
}

// defaultPort returns the port net/http dials for scheme when a URL has none,
// or "" for a scheme it does not know.
func defaultPort(scheme string) string {
	switch scheme {
	case "http":
		return "80"
	case "https":
		return "443"
	}
	return ""
}

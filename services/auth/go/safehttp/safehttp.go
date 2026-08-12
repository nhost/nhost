// Package safehttp builds hardened HTTP clients for outbound requests to
// owner-supplied URLs (OIDC discovery documents, JWKS, token and userinfo
// endpoints, client metadata documents).
//
// The returned client refuses to connect to loopback, private, link-local,
// carrier-grade-NAT, multicast and reserved addresses. Every resolved IP is
// checked and the connection is dialed against a checked IP — not the
// hostname — so a second DNS resolution cannot swap in a private address
// (DNS rebinding). Requests and redirect targets must use HTTPS and
// redirects are capped. Response bodies are capped at MaxResponseSize at the
// transport layer, so the bound also applies to libraries that read the body
// themselves (keyfunc's JWKS fetch).
//
// HTTP(S)_PROXY environment variables are deliberately ignored: with a proxy
// configured the transport would dial the proxy and the real target — which
// travels in the CONNECT line — would never be checked, silently defeating
// the address denylist. Do not set Transport.Proxy on a client from this
// package.
//
// AllowPrivateIPs disables the address denylist and allows plain http;
// InsecureSkipTLSVerify disables certificate verification. Both are for
// local development and tests only.
package safehttp

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/netip"
	"time"
)

const (
	// DefaultTimeout is the request timeout applied when Config.Timeout is zero.
	DefaultTimeout = 10 * time.Second
	// DefaultMaxRedirects is the redirect cap applied when Config.MaxRedirects
	// is zero.
	DefaultMaxRedirects = 3
	// DefaultMaxResponseSize is the response-body cap the client enforces at
	// the transport layer when Config.MaxResponseSize is zero, and the cap
	// callers should pass to ReadAllLimited when reading documents of
	// unbounded size (discovery, userinfo).
	DefaultMaxResponseSize = 1 << 20 // 1 MiB

	// dialTimeout and tlsHandshakeTimeout are sub-budgets of the whole-request
	// timeout: without them a stalled connect or handshake consumes the entire
	// budget and the failure is indistinguishable from a slow upstream.
	dialTimeout         = 5 * time.Second
	tlsHandshakeTimeout = 5 * time.Second
	// idleConnTimeout bounds pooled connections; the zero value keeps them
	// forever, and this pool is process-lifetime and shared across providers.
	idleConnTimeout = 90 * time.Second
	maxIdleConns    = 32
	// maxResponseHeaderBytes replaces net/http's 10 MiB default, which would
	// otherwise let a hostile upstream force ten times the body cap into
	// memory in headers alone.
	maxResponseHeaderBytes = 64 << 10 // 64 KiB

	schemeHTTPS = "https"
)

var (
	// ErrDeniedIP is returned when a request resolves to a loopback, private,
	// link-local, or otherwise internal address.
	ErrDeniedIP = errors.New("resolved IP is a private/loopback address")
	// ErrTooManyRedirects is returned when a request exceeds the redirect cap.
	ErrTooManyRedirects = errors.New("too many redirects")
	// ErrNonHTTPSURL is returned when a request or redirect targets a
	// non-HTTPS URL.
	ErrNonHTTPSURL = errors.New("non-HTTPS URL not allowed")
	// ErrResponseTooLarge is returned by ReadAllLimited when the body exceeds
	// the given cap.
	ErrResponseTooLarge = errors.New("response body exceeds maximum size")
)

// Config controls the hardened client returned by New. The zero value is a
// production-safe configuration.
type Config struct {
	// Timeout is the whole-request timeout. Zero means DefaultTimeout.
	Timeout time.Duration
	// MaxRedirects caps followed redirects. Zero means DefaultMaxRedirects.
	MaxRedirects int
	// MaxResponseSize caps every response body read through the client.
	// Zero means DefaultMaxResponseSize.
	MaxResponseSize int64
	// AllowPrivateIPs disables the address denylist and allows plain http, so
	// the client can reach an IdP on a private network. It does not affect
	// certificate verification — see InsecureSkipTLSVerify. Operator/dev flag
	// only, never derived from tenant configuration.
	AllowPrivateIPs bool
	// InsecureSkipTLSVerify disables TLS certificate verification for every
	// host the client talks to, public ones included. Needed for IdPs with
	// self-signed certificates in local development. Operator/dev flag only,
	// never derived from tenant configuration.
	InsecureSkipTLSVerify bool

	// Test seams, settable only from this package's internal tests: the
	// redirect re-validation tests need a first hop that clears the denylist
	// under a public-looking identity while still reaching a local server.
	lookupIPAddr func(ctx context.Context, host string) ([]net.IPAddr, error)
	dialContext  func(ctx context.Context, network, addr string) (net.Conn, error)
	rootCAs      *x509.CertPool
}

// New returns an *http.Client hardened according to cfg.
func New(cfg Config) *http.Client {
	timeout := cfg.Timeout
	if timeout == 0 {
		timeout = DefaultTimeout
	}

	maxRedirects := cfg.MaxRedirects
	if maxRedirects == 0 {
		maxRedirects = DefaultMaxRedirects
	}

	maxResponseSize := cfg.MaxResponseSize
	if maxResponseSize == 0 {
		maxResponseSize = DefaultMaxResponseSize
	}

	return &http.Client{ //nolint:exhaustruct
		Transport: &schemeCheckingTransport{
			base:            newHardenedTransport(cfg, timeout),
			allowHTTP:       cfg.AllowPrivateIPs,
			maxResponseSize: maxResponseSize,
		},
		Timeout: timeout,
		CheckRedirect: func(_ *http.Request, via []*http.Request) error {
			if len(via) >= maxRedirects {
				return fmt.Errorf("%w (max %d)", ErrTooManyRedirects, maxRedirects)
			}

			return nil
		},
	}
}

func newHardenedTransport(cfg Config, timeout time.Duration) *http.Transport {
	lookup := cfg.lookupIPAddr
	if lookup == nil {
		lookup = net.DefaultResolver.LookupIPAddr
	}

	dialer := &net.Dialer{ //nolint:exhaustruct
		Timeout: min(dialTimeout, timeout),
	}

	dial := cfg.dialContext
	if dial == nil {
		dial = dialer.DialContext
	}

	// Computed once per client rather than per dial.
	denied := deniedPrefixes()

	return &http.Transport{ //nolint:exhaustruct
		// Proxy must stay nil: a proxy would have DialContext validate the
		// proxy's address while the real target travels unchecked in the
		// CONNECT line. See the package doc.
		Proxy: nil,
		TLSClientConfig: &tls.Config{ //nolint:exhaustruct
			MinVersion:         tls.VersionTLS12,
			InsecureSkipVerify: cfg.InsecureSkipTLSVerify, //nolint:gosec // dev/test flag
			RootCAs:            cfg.rootCAs,
		},
		DialContext: func(
			ctx context.Context, network, addr string,
		) (net.Conn, error) {
			if cfg.AllowPrivateIPs {
				// No address to vet, so let the stdlib dialer resolve the host
				// itself and keep its Happy-Eyeballs / serial fallback.
				return dial(ctx, network, addr)
			}

			return dialChecked(ctx, lookup, dial, denied, network, addr)
		},
		MaxResponseHeaderBytes: maxResponseHeaderBytes,
		TLSHandshakeTimeout:    min(tlsHandshakeTimeout, timeout),
		ResponseHeaderTimeout:  timeout,
		IdleConnTimeout:        idleConnTimeout,
		MaxIdleConns:           maxIdleConns,
		MaxIdleConnsPerHost:    maxIdleConns,
	}
}

// dialChecked resolves addr, rejects the whole attempt if any resolved
// address is denied, and then dials the checked addresses in order. Dialing
// literal IPs (rather than the hostname) pins the connection to what was
// vetted, so a second resolution cannot return a different address; trying
// each in turn preserves the stdlib's fallback across a multi-homed host.
// TLS verification still runs against the hostname from the URL.
func dialChecked(
	ctx context.Context,
	lookup func(ctx context.Context, host string) ([]net.IPAddr, error),
	dial func(ctx context.Context, network, addr string) (net.Conn, error),
	denied []netip.Prefix,
	network, addr string,
) (net.Conn, error) {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, fmt.Errorf("invalid address: %w", err)
	}

	ips, err := lookup(ctx, host)
	if err != nil {
		return nil, fmt.Errorf("DNS lookup failed: %w", err)
	}

	// net.DefaultResolver never returns an empty list with a nil error, but
	// the lookup is a seam — an injected resolver that does must not reach
	// the dial loop below and silently succeed.
	if len(ips) == 0 {
		return nil, fmt.Errorf("%w: %s resolved to no addresses", ErrDeniedIP, host)
	}

	// Every resolved address must clear the denylist, not just the one that
	// ends up being dialed: a host that resolves to both a public and an
	// internal address is not a host we are willing to talk to.
	for _, ip := range ips {
		if isDeniedIP(denied, ip.IP) {
			return nil, fmt.Errorf("%w: %s", ErrDeniedIP, ip.IP.String())
		}
	}

	var lastErr error

	for _, ip := range ips {
		conn, err := dial(ctx, network, net.JoinHostPort(ip.IP.String(), port))
		if err == nil {
			return conn, nil
		}

		lastErr = err

		if ctx.Err() != nil {
			break
		}
	}

	return nil, fmt.Errorf("dialing %s: %w", host, lastErr)
}

// deniedPrefixes lists the address ranges the client refuses to dial. It is
// an explicit prefix list rather than a chain of net.IP predicates because
// the predicates miss ranges that routinely reach internal infrastructure —
// CGNAT (cloud metadata, Tailscale, Kubernetes pod CIDRs), 0.0.0.0/8, and
// the IPv6 transition prefixes that can embed an IPv4 loopback address.
func deniedPrefixes() []netip.Prefix {
	return []netip.Prefix{
		netip.MustParsePrefix("0.0.0.0/8"),      // "this network"; Linux treats it as local
		netip.MustParsePrefix("10.0.0.0/8"),     // RFC 1918
		netip.MustParsePrefix("100.64.0.0/10"),  // CGNAT: cloud metadata, Tailscale, pod CIDRs
		netip.MustParsePrefix("127.0.0.0/8"),    // loopback
		netip.MustParsePrefix("169.254.0.0/16"), // link-local, incl. 169.254.169.254
		netip.MustParsePrefix("172.16.0.0/12"),  // RFC 1918
		netip.MustParsePrefix("192.0.0.0/24"),   // IETF protocol assignments
		netip.MustParsePrefix("192.88.99.0/24"), // 6to4 relay anycast
		netip.MustParsePrefix("192.168.0.0/16"), // RFC 1918
		netip.MustParsePrefix("198.18.0.0/15"),  // benchmarking
		netip.MustParsePrefix("224.0.0.0/4"),    // multicast
		netip.MustParsePrefix("240.0.0.0/4"),    // reserved, incl. 255.255.255.255
		// ::/96 is IPv4-compatible IPv6 (::127.0.0.1, ::169.254.169.254): it
		// embeds an IPv4 address that Unmap() does not normalise, and it
		// subsumes the unspecified (::/128) and loopback (::1/128) addresses.
		// Do not "simplify" it back to those two.
		netip.MustParsePrefix("::/96"),
		netip.MustParsePrefix("::ffff:0:0:0/96"), // IPv4-translated (SIIT); also outside Unmap()
		netip.MustParsePrefix("64:ff9b::/96"),    // NAT64; can embed 127.0.0.1
		netip.MustParsePrefix("64:ff9b:1::/48"),  // local-use NAT64
		netip.MustParsePrefix("2001::/32"),       // Teredo; embeds server and client IPv4
		netip.MustParsePrefix("2001:10::/28"),    // ORCHID
		netip.MustParsePrefix("2001:20::/28"),    // ORCHIDv2
		netip.MustParsePrefix("2002::/16"),       // 6to4; can embed 127.0.0.1
		netip.MustParsePrefix("fc00::/7"),        // unique local
		netip.MustParsePrefix("fe80::/10"),       // link-local
		netip.MustParsePrefix("fec0::/10"),       // deprecated site-local
		netip.MustParsePrefix("ff00::/8"),        // multicast
	}
}

// IsDeniedHost reports whether host — an IP literal or a name to resolve —
// falls in a range this package refuses to dial. It exists so a caller that
// wants to reject a URL up front, with a better error than a failed request,
// can apply exactly the policy the transport enforces instead of keeping its
// own copy of it.
//
// It is advisory only. A name can resolve differently between this call and
// the dial, so the client returned by New remains the enforcement point.
// Resolution failures report false: a host that does not resolve is a failed
// request, not a denied address.
func IsDeniedHost(ctx context.Context, host string) bool {
	denied := deniedPrefixes()

	if ip := net.ParseIP(host); ip != nil {
		return isDeniedIP(denied, ip)
	}

	ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return false
	}

	for _, ip := range ips {
		if isDeniedIP(denied, ip.IP) {
			return true
		}
	}

	return false
}

// isDeniedIP reports whether ip falls in one of the denied ranges. An
// address that cannot be parsed is denied: the check must never fail open.
func isDeniedIP(denied []netip.Prefix, ip net.IP) bool {
	addr, ok := netip.AddrFromSlice(ip)
	if !ok {
		return true
	}

	// IPv4-mapped IPv6 forms (::ffff:127.0.0.1) must be compared as IPv4.
	addr = addr.Unmap()

	for _, prefix := range denied {
		if prefix.Contains(addr) {
			return true
		}
	}

	return false
}

// schemeCheckingTransport rejects non-HTTPS URLs on every request — including
// redirect targets, which the client re-submits through the transport — so
// libraries that take a bare *http.Client (x/oauth2, keyfunc) cannot be
// steered to plaintext endpoints by attacker-influenced documents.
type schemeCheckingTransport struct {
	base            http.RoundTripper
	allowHTTP       bool
	maxResponseSize int64
}

func (t *schemeCheckingTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if !t.allowHTTP && req.URL.Scheme != schemeHTTPS {
		return nil, fmt.Errorf("%w: %s", ErrNonHTTPSURL, req.URL.Redacted())
	}

	resp, err := t.base.RoundTrip(req)
	if err != nil {
		return nil, fmt.Errorf("executing request: %w", err)
	}

	resp.Body = &cappedBody{body: resp.Body, max: t.maxResponseSize, read: 0}

	return resp, nil
}

// cappedBody fails reads once more than max bytes have been consumed, so a
// malicious upstream cannot force unbounded allocation on consumers that
// stream-decode a response without their own cap.
type cappedBody struct {
	body io.ReadCloser
	max  int64
	read int64
}

func (b *cappedBody) Read(p []byte) (int, error) {
	n, err := b.body.Read(p)
	b.read += int64(n)

	if b.read > b.max {
		return 0, fmt.Errorf("%w (max %d bytes)", ErrResponseTooLarge, b.max)
	}

	if err != nil && !errors.Is(err, io.EOF) {
		return n, fmt.Errorf("reading response body: %w", err)
	}

	// io.EOF must pass through unwrapped: readers compare it with ==.
	return n, err //nolint:wrapcheck
}

func (b *cappedBody) Close() error {
	if err := b.body.Close(); err != nil {
		return fmt.Errorf("closing response body: %w", err)
	}

	return nil
}

// ReadAllLimited reads r to completion, failing with ErrResponseTooLarge if
// the content exceeds maxSize bytes.
func ReadAllLimited(r io.Reader, maxSize int64) ([]byte, error) {
	b, err := io.ReadAll(io.LimitReader(r, maxSize+1))
	if err != nil {
		return nil, fmt.Errorf("reading response body: %w", err)
	}

	if int64(len(b)) > maxSize {
		return nil, fmt.Errorf("%w (max %d bytes)", ErrResponseTooLarge, maxSize)
	}

	return b, nil
}

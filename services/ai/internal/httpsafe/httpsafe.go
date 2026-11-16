// Package httpsafe provides building blocks for SSRF-safe outbound HTTP.
//
// The package centralizes the IP allowlist, the DNS-rebinding-safe dialer,
// and URL normalization so every outbound HTTP client in the codebase can
// share the same protections. Use [NewClient] for short request/response
// fetches, [NewTransport] when you need to drive a long-lived connection
// such as Server-Sent Events (no per-request timeout), and [NormalizeURL]
// to validate user- or config-supplied URLs before handing them to a client.
package httpsafe

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Sentinel errors returned by helpers in this package.
var (
	ErrInvalidScheme = errors.New("invalid URL scheme: only http and https are allowed")
	ErrInvalidURL    = errors.New("invalid URL")
	ErrEmptyHost     = errors.New("URL has empty host")
	ErrNoIPsResolved = errors.New("no IP addresses resolved for host")
	ErrDialFailed    = errors.New("failed to dial")
)

// ErrPrivateIPAccessError is returned when a hostname resolves to a private,
// reserved, or otherwise blocked IP address and the dialer therefore
// refuses the connection.
type ErrPrivateIPAccessError struct {
	IP net.IP
}

func (e ErrPrivateIPAccessError) Error() string {
	return fmt.Sprintf("access to private IP %s is not allowed", e.IP)
}

// extraBlockedCIDRs lists ranges that net.IP.IsPrivate / IsLoopback /
// IsLinkLocalUnicast / IsUnspecified / IsMulticast do not cover but that
// should still be unreachable from outbound clients.
var extraBlockedCIDRs = func() []*net.IPNet { //nolint:gochecknoglobals
	cidrs := []string{
		"100.64.0.0/10",   // RFC 6598 CGNAT / shared address space.
		"192.0.0.0/24",    // RFC 6890 IETF protocol assignments.
		"192.0.2.0/24",    // RFC 5737 TEST-NET-1.
		"198.18.0.0/15",   // RFC 2544 benchmarking.
		"198.51.100.0/24", // RFC 5737 TEST-NET-2.
		"203.0.113.0/24",  // RFC 5737 TEST-NET-3.
		"100::/64",        // RFC 6666 IPv6 discard-only prefix.
		"2001:db8::/32",   // RFC 3849 IPv6 documentation.
	}

	nets := make([]*net.IPNet, 0, len(cidrs))

	for _, cidr := range cidrs {
		_, n, err := net.ParseCIDR(cidr)
		if err != nil {
			panic(fmt.Sprintf("invalid CIDR %q: %v", cidr, err))
		}

		nets = append(nets, n)
	}

	return nets
}()

// BlockedIP reports whether the given IP must not be dialed by an outbound
// client. IPv4-mapped IPv6 addresses (::ffff:a.b.c.d) and the deprecated
// IPv4-compatible form (::a.b.c.d) are both normalized to IPv4 first so an
// attacker cannot bypass the IPv4 checks by encoding 127.0.0.1 as
// ::7f00:1 / ::127.0.0.1.
func BlockedIP(ip net.IP) bool {
	if v4 := ip.To4(); v4 != nil {
		ip = v4
	} else if v4 := ipv4Compatible(ip); v4 != nil {
		ip = v4
	}

	if ip.IsPrivate() || ip.IsLoopback() || ip.IsLinkLocalUnicast() ||
		ip.IsUnspecified() || ip.IsMulticast() {
		return true
	}

	for _, n := range extraBlockedCIDRs {
		if n.Contains(ip) {
			return true
		}
	}

	return false
}

// ipv4Compatible returns the embedded IPv4 address when ip is in the
// deprecated IPv4-compatible IPv6 form (::a.b.c.d, high 12 bytes zero), or
// nil otherwise. :: (unspecified) and ::1 (loopback) are deliberately
// excluded because the standard library's IsUnspecified / IsLoopback already
// match them at the IPv6 level and re-mapping would lose that.
func ipv4Compatible(ip net.IP) net.IP {
	if len(ip) != net.IPv6len {
		return nil
	}

	for i := range 12 {
		if ip[i] != 0 {
			return nil
		}
	}

	embedded := uint32(ip[12])<<24 | uint32(ip[13])<<16 |
		uint32(ip[14])<<8 | uint32(ip[15])
	if embedded <= 1 {
		return nil
	}

	return net.IPv4(ip[12], ip[13], ip[14], ip[15]).To4()
}

// ResolverFunc resolves a hostname to a list of IP addresses. It matches the
// signature of [net.Resolver.LookupIPAddr] so callers can pass a method
// value of the default resolver, or a fake resolver for tests.
type ResolverFunc func(ctx context.Context, host string) ([]net.IPAddr, error)

// DialFunc opens a network connection to addr. It matches the signature of
// [net.Dialer.DialContext] and [http.Transport.DialContext].
type DialFunc func(ctx context.Context, network, addr string) (net.Conn, error)

// SafeDialContext returns a [DialFunc] that resolves the host once, rejects
// the dial if ANY resolved IP is blocked by [BlockedIP], and then dials the
// validated IP literals directly. Dialing by hostname after validation would
// re-resolve DNS and let an attacker-controlled authoritative server return
// a different (private) IP for the actual dial — the classic DNS rebinding /
// TOCTOU SSRF bypass. Each validated IP is tried in order; the first
// successful dial wins, otherwise the last error is wrapped with
// [ErrDialFailed].
func SafeDialContext(resolve ResolverFunc, dial DialFunc) DialFunc {
	return func(ctx context.Context, network, addr string) (net.Conn, error) {
		host, port, err := net.SplitHostPort(addr)
		if err != nil {
			return nil, fmt.Errorf("invalid address: %w", err)
		}

		ips, err := resolve(ctx, host)
		if err != nil {
			return nil, fmt.Errorf("failed to resolve host: %w", err)
		}

		if len(ips) == 0 {
			return nil, fmt.Errorf("%w: %s", ErrNoIPsResolved, host)
		}

		// Reject outright if ANY resolved IP is blocked. A malicious
		// authoritative DNS server can return mixed public/private A records
		// across lookups; treating any private record as fatal closes that
		// rebinding window regardless of which IP we end up dialing.
		for _, ip := range ips {
			if BlockedIP(ip.IP) {
				return nil, ErrPrivateIPAccessError{IP: ip.IP}
			}
		}

		var lastErr error

		for _, ip := range ips {
			target := net.JoinHostPort(ip.String(), port)

			conn, dialErr := dial(ctx, network, target)
			if dialErr == nil {
				return conn, nil
			}

			lastErr = dialErr
		}

		return nil, fmt.Errorf("%w: %w", ErrDialFailed, lastErr)
	}
}

// safeTLSHandshakeTimeout caps how long a TLS handshake may stall before the
// transport tears it down. Without it a hung peer can pin a goroutine
// indefinitely on streaming clients that intentionally omit
// [http.Client.Timeout].
const safeTLSHandshakeTimeout = 10 * time.Second

// safeResponseHeaderTimeout caps how long the transport will wait for a
// response status line / headers after writing the request. Body streaming
// (e.g., SSE) is unaffected once headers arrive.
const safeResponseHeaderTimeout = 30 * time.Second

// NewTransport returns an [*http.Transport] whose DialContext is
// [SafeDialContext] wired to the system DNS resolver and a dialer with the
// given dial timeout. The transport sets no per-request timeout, so it is
// safe for long-lived connections such as Server-Sent Events; callers that
// want a request-level deadline should set [http.Client.Timeout] or use
// [NewClient].
//
// Proxy is intentionally left nil. [http.DefaultTransport] uses
// [http.ProxyFromEnvironment], which would honor HTTP_PROXY/HTTPS_PROXY and
// route the connection through an attacker-controllable hop that bypasses
// [SafeDialContext] entirely. Do not add a Proxy here.
func NewTransport(dialTimeout time.Duration) *http.Transport {
	dialer := &net.Dialer{Timeout: dialTimeout} //nolint:exhaustruct

	return &http.Transport{ //nolint:exhaustruct
		DialContext: SafeDialContext(
			net.DefaultResolver.LookupIPAddr,
			dialer.DialContext,
		),
		TLSHandshakeTimeout:   safeTLSHandshakeTimeout,
		ResponseHeaderTimeout: safeResponseHeaderTimeout,
	}
}

// NewClient returns an [*http.Client] with SSRF-safe dialing and the same
// timeout applied to both the dial and the full request/response cycle.
// Suitable for short fetches; for streaming workloads use [NewTransport]
// directly and assemble the client without [http.Client.Timeout].
func NewClient(timeout time.Duration) *http.Client {
	return &http.Client{ //nolint:exhaustruct
		Timeout:   timeout,
		Transport: NewTransport(timeout),
	}
}

// NormalizeURL parses raw, defaults to https when no scheme was given, and
// rejects anything that is not http/https or that resolves to an empty
// host. Protocol-relative ("//evil.com/x") and non-web schemes ("file:",
// "gopher:", "data:", ...) are rejected. Any embedded userinfo
// ("https://user:pass@host/") is stripped so the returned URL is safe to
// log; callers needing basic auth should set the Authorization header
// explicitly.
func NormalizeURL(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", ErrInvalidURL
	}

	// Reject protocol-relative URLs outright; otherwise prepending https://
	// would silently "fix" them and obscure the user's intent.
	if strings.HasPrefix(raw, "//") {
		return "", fmt.Errorf("%w: protocol-relative URLs are not allowed", ErrInvalidURL)
	}

	parsed, err := url.Parse(raw)
	if err != nil {
		return "", fmt.Errorf("%w: %w", ErrInvalidURL, err)
	}

	// If the user passed a bare "example.com/path", url.Parse leaves
	// Scheme/Host empty and stores everything in Path. Re-parse with an
	// explicit https:// prefix so we can apply the same scheme/host checks.
	if parsed.Scheme == "" {
		parsed, err = url.Parse("https://" + raw)
		if err != nil {
			return "", fmt.Errorf("%w: %w", ErrInvalidURL, err)
		}
	}

	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", fmt.Errorf("%w: %s", ErrInvalidScheme, parsed.Scheme)
	}

	if parsed.Host == "" {
		return "", ErrEmptyHost
	}

	parsed.User = nil

	return parsed.String(), nil
}

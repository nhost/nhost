// Package safehttp provides bounded HTTPS clients for requests to external endpoints.
package safehttp

import (
	"bytes"
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/netip"
	"slices"
	"time"
)

const (
	defaultTimeout      = 5 * time.Second
	defaultBodyLimit    = 1 << 20
	responseHeaderLimit = 10 << 20 // The net/http default used by CIMD.
)

var (
	errHTTPSRequired    = errors.New("HTTPS is required")
	errBlockedAddress   = errors.New("resolved IP is a private or otherwise blocked address")
	errNoAddresses      = errors.New("DNS lookup returned no addresses")
	errTooManyRedirects = errors.New("too many redirects")
	errBodyTooLarge     = errors.New("response body exceeds maximum size")
)

// Config controls the request limits of a safe HTTP client. Zero values use a
// five-second timeout, disallow redirects, and cap the body at one MiB.
type Config struct {
	Timeout              time.Duration
	MaxRedirects         int
	MaxResponseBodyBytes int64
	PublicIPsOnly        bool
}

// New returns an HTTPS client that checks all resolved addresses and dials a
// checked IP directly. It uses the original hostname for TLS verification.
func New(cfg Config) *http.Client {
	timeout := cfg.Timeout
	if timeout <= 0 {
		timeout = defaultTimeout
	}

	bodyLimit := cfg.MaxResponseBodyBytes
	if bodyLimit <= 0 {
		bodyLimit = defaultBodyLimit
	}

	dialer := &net.Dialer{Timeout: timeout} //nolint:exhaustruct

	blocked := isBlockedIP
	if cfg.PublicIPsOnly {
		blocked = isNonPublicIP
	}

	transport := &http.Transport{ //nolint:exhaustruct
		// A proxy would resolve the destination outside the checked dial path.
		Proxy: nil,
		DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			return dialChecked(
				ctx,
				network,
				address,
				net.DefaultResolver.LookupIPAddr,
				dialer.DialContext,
				blocked,
			)
		},
		MaxResponseHeaderBytes: responseHeaderLimit,
		TLSHandshakeTimeout:    timeout,
	}

	return &http.Client{ //nolint:exhaustruct
		Transport: &boundedTransport{Transport: transport, bodyLimit: bodyLimit},
		Timeout:   timeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) > cfg.MaxRedirects {
				return fmt.Errorf("%w (maximum %d)", errTooManyRedirects, cfg.MaxRedirects)
			}

			if req.URL.Scheme != "https" {
				return errHTTPSRequired
			}

			return nil
		},
	}
}

// IsBlockedHost reports whether a literal IP or any DNS answer is blocked. A
// lookup error leaves the check to the dial path, which requires a valid answer.
func IsBlockedHost(ctx context.Context, host string) bool {
	if ip := net.ParseIP(host); ip != nil {
		return isBlockedIP(ip)
	}

	ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)

	return err == nil && hasBlockedAddress(ips, isBlockedIP)
}

func dialChecked(
	ctx context.Context,
	network, address string,
	lookup func(context.Context, string) ([]net.IPAddr, error),
	dial func(context.Context, string, string) (net.Conn, error),
	blocked func(net.IP) bool,
) (net.Conn, error) {
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return nil, fmt.Errorf("invalid dial address: %w", err)
	}

	ips, err := lookup(ctx, host)
	if err != nil {
		return nil, fmt.Errorf("DNS lookup failed: %w", err)
	}

	if len(ips) == 0 {
		return nil, errNoAddresses
	}

	if hasBlockedAddress(ips, blocked) {
		return nil, errBlockedAddress
	}

	conn, err := dial(ctx, network, net.JoinHostPort(ips[0].IP.String(), port))
	if err != nil {
		return nil, fmt.Errorf("dialing checked address: %w", err)
	}

	return conn, nil
}

func hasBlockedAddress(ips []net.IPAddr, blocked func(net.IP) bool) bool {
	return slices.ContainsFunc(ips, func(addr net.IPAddr) bool {
		return blocked(addr.IP)
	})
}

// Special-use prefixes within the global unicast address space.
var nonPublicPrefixes = []netip.Prefix{ //nolint:gochecknoglobals // Fixed address policy.
	netip.MustParsePrefix("0.0.0.0/8"),
	netip.MustParsePrefix("100.64.0.0/10"),
	netip.MustParsePrefix("192.0.0.0/24"),
	netip.MustParsePrefix("192.0.2.0/24"),
	netip.MustParsePrefix("192.88.99.0/24"),
	netip.MustParsePrefix("198.18.0.0/15"),
	netip.MustParsePrefix("198.51.100.0/24"),
	netip.MustParsePrefix("203.0.113.0/24"),
	netip.MustParsePrefix("240.0.0.0/4"),
	netip.MustParsePrefix("2001::/23"),
	netip.MustParsePrefix("2001:db8::/32"),
	netip.MustParsePrefix("2002::/16"),
	netip.MustParsePrefix("3fff::/20"),
}

//nolint:gochecknoglobals // Fixed address policy.
var ipv6GlobalUnicast = netip.MustParsePrefix("2000::/3")

func isNonPublicIP(ip net.IP) bool {
	addr, ok := netip.AddrFromSlice(ip)
	if !ok || isBlockedIP(ip) {
		return true
	}

	addr = addr.Unmap()
	if addr.Is6() && !ipv6GlobalUnicast.Contains(addr) {
		return true
	}

	return slices.ContainsFunc(nonPublicPrefixes, func(prefix netip.Prefix) bool {
		return prefix.Contains(addr)
	})
}

// embeddedIPv4 returns the IPv4 address wrapped by an IPv6 transition address,
// or nil if there is none.
func embeddedIPv4(ip net.IP) net.IP {
	ip16 := ip.To16()
	if ip16 == nil || ip.To4() != nil {
		// IPv4-mapped (::ffff:a.b.c.d) also lands here, via To4.
		return nil
	}

	// Prefixes carrying the IPv4 address in the last 32 bits.
	for _, prefix := range [][]byte{
		{0x00, 0x64, 0xff, 0x9b, 0, 0, 0, 0, 0, 0, 0, 0}, // NAT64, RFC 6052
		{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0},             // IPv4-compatible, RFC 4291
		{0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff, 0, 0},       // IPv4-translated, RFC 6145
	} {
		if bytes.HasPrefix(ip16, prefix) {
			return net.IPv4(ip16[12], ip16[13], ip16[14], ip16[15])
		}
	}

	switch {
	case ip16[0] == 0x20 && ip16[1] == 0x02: // 6to4, RFC 3056
		return net.IPv4(ip16[2], ip16[3], ip16[4], ip16[5])
	case ip16[0] == 0x20 && ip16[1] == 0x01 &&
		ip16[2] == 0x00 && ip16[3] == 0x00: // Teredo, RFC 4380
		return net.IPv4(^ip16[12], ^ip16[13], ^ip16[14], ^ip16[15])
	default:
		return nil
	}
}

func isBlockedIP(ip net.IP) bool {
	if ip == nil {
		return true
	}

	// 64:ff9b:1::/48 is NAT64 local use (RFC 8215). The embedded IPv4 address
	// can appear at different offsets, so the whole range is blocked.
	if bytes.HasPrefix(ip.To16(), []byte{0x00, 0x64, 0xff, 0x9b, 0x00, 0x01}) {
		return true
	}

	for _, candidate := range []net.IP{ip, embeddedIPv4(ip)} {
		if candidate == nil {
			continue
		}

		if candidate.IsUnspecified() || candidate.IsLoopback() ||
			candidate.IsPrivate() || candidate.IsLinkLocalUnicast() || candidate.IsMulticast() {
			return true
		}
	}

	return false
}

type boundedTransport struct {
	*http.Transport

	bodyLimit int64
}

func (t *boundedTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if req.URL.Scheme != "https" {
		if req.Body != nil {
			if err := req.Body.Close(); err != nil {
				return nil, fmt.Errorf(
					"closing rejected request body: %w",
					errors.Join(errHTTPSRequired, err),
				)
			}
		}

		return nil, errHTTPSRequired
	}

	response, err := t.Transport.RoundTrip(req)
	if err != nil {
		var headerErr tls.RecordHeaderError
		if errors.As(err, &headerErr) && string(headerErr.RecordHeader[:]) == "HTTP/" {
			return nil, http.ErrSchemeMismatch
		}

		return nil, fmt.Errorf("sending HTTPS request: %w", err)
	}

	response.Body = &boundedBody{ReadCloser: response.Body, remaining: t.bodyLimit}

	return response, nil
}

type boundedBody struct {
	io.ReadCloser

	remaining int64
}

func (b *boundedBody) Read(p []byte) (int, error) {
	if b.remaining < 0 {
		return 0, errBodyTooLarge
	}

	if b.remaining < int64(len(p)) {
		// Read at most one extra byte to distinguish the exact limit from a
		// larger body, including when the response has no Content-Length.
		p = p[:b.remaining+1]
	}

	n, err := b.ReadCloser.Read(p)
	if int64(n) > b.remaining {
		allowed := int(b.remaining)
		b.remaining = -1

		return allowed, errBodyTooLarge
	}

	b.remaining -= int64(n)
	if err == io.EOF {
		return n, io.EOF
	}

	if err != nil {
		return n, fmt.Errorf("reading HTTPS response: %w", err)
	}

	return n, nil
}

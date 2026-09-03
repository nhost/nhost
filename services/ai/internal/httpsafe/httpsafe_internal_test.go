package httpsafe

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

var (
	errTestDialShouldNotBeCalled = errors.New("dial should not be called")
	errTestCapturedDial          = errors.New("test captured dial")
	errTestFirstIPDown           = errors.New("first IP unreachable")
	errTestSecondIPDown          = errors.New("second IP also unreachable")
	errTestResolverBoom          = errors.New("test resolver failure")
	errTestUnreachable           = errors.New("unreachable")
)

func TestBlockedIP(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		ip      net.IP
		blocked bool
	}{
		{name: "loopback v4", ip: net.ParseIP("127.0.0.1"), blocked: true},
		{name: "loopback v6", ip: net.IPv6loopback, blocked: true},
		{name: "private 10.x", ip: net.ParseIP("10.0.0.1"), blocked: true},
		{name: "private 192.168.x", ip: net.ParseIP("192.168.1.1"), blocked: true},
		{name: "private 172.16.x", ip: net.ParseIP("172.16.0.1"), blocked: true},
		{name: "link-local", ip: net.ParseIP("169.254.1.1"), blocked: true},
		{name: "unspecified v4", ip: net.ParseIP("0.0.0.0"), blocked: true},
		{name: "unspecified v6", ip: net.IPv6unspecified, blocked: true},
		{name: "multicast v4", ip: net.ParseIP("224.0.0.1"), blocked: true},
		{name: "multicast v6", ip: net.ParseIP("ff02::1"), blocked: true},
		{name: "cgnat 100.64.0.1", ip: net.ParseIP("100.64.0.1"), blocked: true},
		{name: "cgnat 100.127.255.254", ip: net.ParseIP("100.127.255.254"), blocked: true},
		{name: "ietf protocol 192.0.0.1", ip: net.ParseIP("192.0.0.1"), blocked: true},
		{name: "test-net-1 192.0.2.1", ip: net.ParseIP("192.0.2.1"), blocked: true},
		{name: "benchmarking 198.18.0.1", ip: net.ParseIP("198.18.0.1"), blocked: true},
		{name: "test-net-2 198.51.100.1", ip: net.ParseIP("198.51.100.1"), blocked: true},
		{name: "test-net-3 203.0.113.1", ip: net.ParseIP("203.0.113.1"), blocked: true},
		{name: "ipv6 documentation 2001:db8::1", ip: net.ParseIP("2001:db8::1"), blocked: true},
		{name: "ipv6 discard 100::1", ip: net.ParseIP("100::1"), blocked: true},
		{name: "ipv4-mapped loopback", ip: net.ParseIP("::ffff:127.0.0.1"), blocked: true},
		{name: "ipv4-mapped private", ip: net.ParseIP("::ffff:10.0.0.1"), blocked: true},
		{name: "ipv4-mapped cgnat", ip: net.ParseIP("::ffff:100.64.0.1"), blocked: true},
		// IPv4-compatible IPv6 (deprecated ::a.b.c.d form). A bare ip.To4()
		// does not catch these; an attacker-controlled resolver returning
		// "::127.0.0.1" must still be blocked.
		{name: "ipv4-compatible loopback", ip: net.ParseIP("::127.0.0.1"), blocked: true},
		{name: "ipv4-compatible private", ip: net.ParseIP("::10.0.0.1"), blocked: true},
		{name: "ipv4-compatible cgnat", ip: net.ParseIP("::100.64.0.1"), blocked: true},
		{name: "ipv4-compatible link-local", ip: net.ParseIP("::169.254.169.254"), blocked: true},
		{name: "public v4 1.1.1.1", ip: net.ParseIP("1.1.1.1"), blocked: false},
		{name: "public v4 8.8.8.8", ip: net.ParseIP("8.8.8.8"), blocked: false},
		{name: "public v6 2606:4700::1111", ip: net.ParseIP("2606:4700::1111"), blocked: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := BlockedIP(tc.ip); got != tc.blocked {
				t.Errorf("BlockedIP(%s) = %v, want %v", tc.ip, got, tc.blocked)
			}
		})
	}
}

// TestSafeDialContextRejectsBlockedIPs covers DNS rebinding / TOCTOU: when a
// single resolution returns a mix of public and private records, the dialer
// must reject the connection outright rather than gamble on which IP would
// actually be dialed.
func TestSafeDialContextRejectsBlockedIPs(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		ips  []net.IPAddr
	}{
		{
			name: "single loopback",
			ips:  []net.IPAddr{{IP: net.ParseIP("127.0.0.1")}},
		},
		{
			name: "single AWS IMDS link-local",
			ips:  []net.IPAddr{{IP: net.ParseIP("169.254.169.254")}},
		},
		{
			name: "single rfc1918",
			ips:  []net.IPAddr{{IP: net.ParseIP("10.0.0.1")}},
		},
		{
			name: "single CGNAT",
			ips:  []net.IPAddr{{IP: net.ParseIP("100.64.0.1")}},
		},
		{
			name: "rebinding: public then loopback",
			ips: []net.IPAddr{
				{IP: net.ParseIP("1.1.1.1")},
				{IP: net.ParseIP("127.0.0.1")},
			},
		},
		{
			name: "rebinding: private then public",
			ips: []net.IPAddr{
				{IP: net.ParseIP("10.0.0.1")},
				{IP: net.ParseIP("8.8.8.8")},
			},
		},
		{
			name: "rebinding: public then IMDS",
			ips: []net.IPAddr{
				{IP: net.ParseIP("8.8.8.8")},
				{IP: net.ParseIP("169.254.169.254")},
			},
		},
		{
			name: "rebinding: ipv4-mapped private alongside public",
			ips: []net.IPAddr{
				{IP: net.ParseIP("1.1.1.1")},
				{IP: net.ParseIP("::ffff:127.0.0.1")},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			resolve := func(_ context.Context, _ string) ([]net.IPAddr, error) {
				return tc.ips, nil
			}

			dialed := false
			dial := func(_ context.Context, _, _ string) (net.Conn, error) {
				dialed = true

				return nil, errTestDialShouldNotBeCalled
			}

			dialCtx := SafeDialContext(resolve, dial)

			_, err := dialCtx(context.Background(), "tcp", "evil.example.com:443")
			if err == nil {
				t.Fatal("expected dial to be rejected, got nil error")
			}

			var ssrfErr ErrPrivateIPAccessError
			if !errors.As(err, &ssrfErr) {
				t.Errorf("expected ErrPrivateIPAccessError, got %v", err)
			}

			if dialed {
				t.Error("dialer was invoked for blocked address; SSRF check bypassed")
			}
		})
	}
}

// TestSafeDialContextDialsValidatedIP verifies the fix's core property: the
// dialer is invoked with the validated IP literal, never the original
// hostname. If we redialed by hostname, a second DNS lookup could resolve
// to a different (private) IP than the one we validated.
func TestSafeDialContextDialsValidatedIP(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		ips      []net.IPAddr
		wantAddr string
	}{
		{
			name:     "ipv4 public",
			ips:      []net.IPAddr{{IP: net.ParseIP("1.1.1.1")}},
			wantAddr: "1.1.1.1:443",
		},
		{
			name:     "ipv6 public",
			ips:      []net.IPAddr{{IP: net.ParseIP("2606:4700::1111")}},
			wantAddr: "[2606:4700::1111]:443",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			resolve := func(_ context.Context, _ string) ([]net.IPAddr, error) {
				return tc.ips, nil
			}

			var dialed []string

			dial := func(_ context.Context, _, addr string) (net.Conn, error) {
				dialed = append(dialed, addr)

				return nil, errTestCapturedDial
			}

			dialCtx := SafeDialContext(resolve, dial)

			_, err := dialCtx(context.Background(), "tcp", "example.com:443")
			if !errors.Is(err, errTestCapturedDial) {
				t.Fatalf("expected wrapped sentinel error, got %v", err)
			}

			if len(dialed) != 1 {
				t.Fatalf("expected exactly one dial, got %d (%v)", len(dialed), dialed)
			}

			if dialed[0] != tc.wantAddr {
				t.Errorf("dialer received %q, want %q (must be IP literal, not hostname)",
					dialed[0], tc.wantAddr)
			}
		})
	}
}

// TestSafeDialContextHappyEyeballs ensures the dialer falls through to the
// next validated IP when an earlier IP fails to connect.
func TestSafeDialContextHappyEyeballs(t *testing.T) {
	t.Parallel()

	resolve := func(_ context.Context, _ string) ([]net.IPAddr, error) {
		return []net.IPAddr{
			{IP: net.ParseIP("1.1.1.1")},
			{IP: net.ParseIP("8.8.8.8")},
		}, nil
	}

	var dialed []string

	dial := func(_ context.Context, _, addr string) (net.Conn, error) {
		dialed = append(dialed, addr)

		if addr == "1.1.1.1:80" {
			return nil, errTestFirstIPDown
		}

		return nil, errTestSecondIPDown
	}

	dialCtx := SafeDialContext(resolve, dial)

	_, err := dialCtx(context.Background(), "tcp", "example.com:80")
	if err == nil {
		t.Fatal("expected error when all dials fail")
	}

	if !errors.Is(err, ErrDialFailed) {
		t.Errorf("expected ErrDialFailed, got %v", err)
	}

	want := []string{"1.1.1.1:80", "8.8.8.8:80"}
	if len(dialed) != len(want) {
		t.Fatalf("expected %d dial attempts, got %d (%v)", len(want), len(dialed), dialed)
	}

	for i, w := range want {
		if dialed[i] != w {
			t.Errorf("dial[%d] = %q, want %q", i, dialed[i], w)
		}
	}
}

func TestSafeDialContextResolverErrors(t *testing.T) {
	t.Parallel()

	t.Run("resolver returns error", func(t *testing.T) {
		t.Parallel()

		resolve := func(_ context.Context, _ string) ([]net.IPAddr, error) {
			return nil, errTestResolverBoom
		}

		dial := func(_ context.Context, _, _ string) (net.Conn, error) {
			t.Error("dial should not be called when resolver fails")

			return nil, errTestUnreachable
		}

		dialCtx := SafeDialContext(resolve, dial)

		_, err := dialCtx(context.Background(), "tcp", "example.com:80")
		if !errors.Is(err, errTestResolverBoom) {
			t.Errorf("expected resolver error to be wrapped, got %v", err)
		}
	})

	t.Run("resolver returns no IPs", func(t *testing.T) {
		t.Parallel()

		resolve := func(_ context.Context, _ string) ([]net.IPAddr, error) {
			return nil, nil
		}

		dial := func(_ context.Context, _, _ string) (net.Conn, error) {
			t.Error("dial should not be called when resolver returns no IPs")

			return nil, errTestUnreachable
		}

		dialCtx := SafeDialContext(resolve, dial)

		_, err := dialCtx(context.Background(), "tcp", "example.com:80")
		if !errors.Is(err, ErrNoIPsResolved) {
			t.Errorf("expected ErrNoIPsResolved, got %v", err)
		}
	})

	t.Run("invalid addr format", func(t *testing.T) {
		t.Parallel()

		resolve := func(_ context.Context, _ string) ([]net.IPAddr, error) {
			t.Error("resolver should not be called for malformed addr")

			return nil, errTestUnreachable
		}

		dial := func(_ context.Context, _, _ string) (net.Conn, error) {
			t.Error("dial should not be called for malformed addr")

			return nil, errTestUnreachable
		}

		dialCtx := SafeDialContext(resolve, dial)

		_, err := dialCtx(context.Background(), "tcp", "no-port")
		if err == nil {
			t.Fatal("expected error for missing port")
		}
	})
}

// TestSafeDialContextPreservesSNI is the load-bearing property test for the
// whole package: rewriting the dial address to an IP literal must not change
// the TLS ServerName the client presents. Go derives ServerName from the URL
// host (via connectMethod.tlsHost), not from the dial target — if a future
// refactor breaks that assumption (e.g. by hard-coding ServerName from the
// dial addr on Transport.TLSClientConfig), this test fails.
//
// Setup: an httptest TLS server listening on 127.0.0.1; a resolver that
// returns a public IP literal (so SafeDialContext's block list allows the
// connection through); a wrapped dial function that ignores the
// SafeDialContext-rewritten addr and routes the TCP connection to the
// loopback test server. The discriminating signal is resp.TLS.ServerName
// (= the SNI the client actually sent): "example.com" means Go derived it
// from the URL host (correct), the public IP literal would mean it was
// derived from the dial address (the regression we're guarding).
func TestSafeDialContextPreservesSNI(t *testing.T) {
	t.Parallel()

	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, "ok")
	}))
	t.Cleanup(server.Close)

	// Resolver returns a public IP that SafeDialContext's block list accepts.
	// The actual TCP connection is redirected to the loopback test server by
	// the dial wrapper below.
	resolve := func(_ context.Context, _ string) ([]net.IPAddr, error) {
		return []net.IPAddr{{IP: net.ParseIP("1.1.1.1")}}, nil
	}

	dialer := &net.Dialer{Timeout: 2 * time.Second}
	loopbackAddr := server.Listener.Addr().String()

	dial := func(ctx context.Context, network, _ string) (net.Conn, error) {
		// SafeDialContext hands us "1.1.1.1:<port>"; ignore that and route
		// the real TCP connection to the httptest loopback listener.
		return dialer.DialContext(ctx, network, loopbackAddr)
	}

	certPool := x509.NewCertPool()
	certPool.AddCert(server.Certificate())

	transport := &http.Transport{
		DialContext: SafeDialContext(resolve, dial),
		TLSClientConfig: &tls.Config{
			RootCAs:    certPool,
			MinVersion: tls.VersionTLS12,
		},
	}
	t.Cleanup(transport.CloseIdleConnections)

	client := &http.Client{Transport: transport, Timeout: 5 * time.Second}

	_, port, err := net.SplitHostPort(loopbackAddr)
	if err != nil {
		t.Fatalf("split server addr: %v", err)
	}

	req, err := http.NewRequestWithContext(
		context.Background(),
		http.MethodGet,
		"https://example.com:"+port+"/",
		nil,
	)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if _, err := io.Copy(io.Discard, resp.Body); err != nil {
		t.Fatalf("read body: %v", err)
	}

	if resp.TLS == nil {
		t.Fatal("response has no TLS state; expected an https connection")
	}

	if got := resp.TLS.ServerName; got != "example.com" {
		t.Errorf(
			"ConnectionState.ServerName = %q, want %q (SNI must come from URL host, not dial IP)",
			got,
			"example.com",
		)
	}
}

func TestNormalizeURL(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		input   string
		want    string
		wantErr error
	}{
		{name: "https as-is", input: "https://example.com/path", want: "https://example.com/path"},
		{name: "http as-is", input: "http://example.com", want: "http://example.com"},
		{name: "bare host gets https", input: "example.com/path", want: "https://example.com/path"},
		{name: "trims whitespace", input: "  https://example.com  ", want: "https://example.com"},
		{name: "empty", input: "", wantErr: ErrInvalidURL},
		{name: "whitespace only", input: "   ", wantErr: ErrInvalidURL},
		{name: "protocol-relative", input: "//evil.com/x", wantErr: ErrInvalidURL},
		{name: "file scheme", input: "file:///etc/passwd", wantErr: ErrInvalidScheme},
		{name: "gopher scheme", input: "gopher://example.com/", wantErr: ErrInvalidScheme},
		{name: "ftp scheme", input: "ftp://example.com/", wantErr: ErrInvalidScheme},
		{name: "data scheme", input: "data:text/plain,hello", wantErr: ErrInvalidScheme},
		{
			name:    "javascript scheme",
			input:   "javascript:alert(1)",
			wantErr: ErrInvalidScheme,
		},
		{name: "http with empty host", input: "http:///path", wantErr: ErrEmptyHost},
		// Embedded basic-auth credentials must be stripped from the returned
		// URL so they don't leak through callers that log it.
		{
			name:  "strips userinfo",
			input: "https://user:pass@example.com/path",
			want:  "https://example.com/path",
		},
		{
			name:  "strips userinfo with no password",
			input: "https://user@example.com/",
			want:  "https://example.com/",
		},
		{
			name:  "strips userinfo from http",
			input: "http://u:p@example.com",
			want:  "http://example.com",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := NormalizeURL(tc.input)
			if tc.wantErr != nil {
				if !errors.Is(err, tc.wantErr) {
					t.Fatalf("expected error %v, got %v", tc.wantErr, err)
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if got != tc.want {
				t.Errorf("got %q, want %q", got, tc.want)
			}
		})
	}
}

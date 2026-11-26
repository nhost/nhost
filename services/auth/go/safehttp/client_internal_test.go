package safehttp

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestIsBlockedIP(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		ip       string
		expected bool
	}{
		{
			name:     "nat64 wrapped cloud metadata",
			ip:       "64:ff9b::a9fe:a9fe",
			expected: true,
		},
		{
			name:     "nat64 wrapped private ipv4",
			ip:       "64:ff9b::a00:1",
			expected: true,
		},
		{
			name:     "nat64 local use prefix",
			ip:       "64:ff9b:1::1",
			expected: true,
		},
		{
			name:     "6to4 wrapped loopback",
			ip:       "2002:7f00:1::",
			expected: true,
		},
		{
			name:     "teredo wrapped loopback",
			ip:       "2001:0000:4136:e378:8000:63bf:80ff:fffe",
			expected: true,
		},
		{
			name:     "ipv4 compatible wrapped private ipv4",
			ip:       "::10.0.0.1",
			expected: true,
		},
		{
			name:     "ipv4 translated wrapped private ipv4",
			ip:       "::ffff:0:10.0.0.1",
			expected: true,
		},
		{
			name:     "ipv4 mapped private ipv4",
			ip:       "::ffff:192.168.1.1",
			expected: true,
		},
		{
			name:     "unspecified ipv4",
			ip:       "0.0.0.0",
			expected: true,
		},
		{
			name:     "unspecified ipv6",
			ip:       "::",
			expected: true,
		},
		{
			name:     "multicast",
			ip:       "224.0.0.1",
			expected: true,
		},
		{
			name:     "unique local ipv6",
			ip:       "fd00::1",
			expected: true,
		},
		{
			name:     "public ipv4",
			ip:       "8.8.8.8",
			expected: false,
		},
		{
			name:     "public ipv6",
			ip:       "2606:4700:4700::1111",
			expected: false,
		},
		{
			name:     "nat64 wrapped public ipv4",
			ip:       "64:ff9b::808:808",
			expected: false,
		},
		{
			name:     "6to4 wrapped public ipv4",
			ip:       "2002:808:808::",
			expected: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ip := net.ParseIP(tc.ip)
			if ip == nil {
				t.Fatalf("failed to parse IP %q", tc.ip)
			}

			got := isBlockedIP(ip)
			if got != tc.expected {
				t.Errorf("isBlockedIP(%q) = %v, want %v", tc.ip, got, tc.expected)
			}
		})
	}
}

func TestPrivateIPPolicy(t *testing.T) {
	t.Parallel()

	for _, test := range []struct {
		addr    string
		blocked bool
	}{
		{addr: "10.0.0.1", blocked: false},
		{addr: "::ffff:192.168.1.1", blocked: false},
		{addr: "fd01::1", blocked: false},
		{addr: "8.8.8.8", blocked: false},
		{addr: "127.0.0.1", blocked: true},
		{addr: "::1", blocked: true},
		{addr: "169.254.169.254", blocked: true},
		{addr: "fd00:ec2::254", blocked: true},
		{addr: "fe80::1", blocked: true},
		{addr: "64:ff9b::a00:1", blocked: true},
	} {
		if got := isOutsidePublicOrPrivateIP(net.ParseIP(test.addr)); got != test.blocked {
			t.Errorf("block %s = %t, want %t", test.addr, got, test.blocked)
		}
	}
}

func TestPublicIPPolicy(t *testing.T) {
	t.Parallel()

	for _, ip := range []string{
		"0.1.0.1", "100.64.0.1", "::ffff:100.64.0.1", "192.0.2.1",
		"198.18.0.1", "240.0.0.1", "64:ff9b::808:808", "2002:808:808::",
		"2001:db8::1", "3fff::1", "fec0::1",
	} {
		if !isNonPublicIP(net.ParseIP(ip)) {
			t.Errorf("accepted a special-use IP %s", ip)
		}
	}

	for _, ip := range []string{"8.8.8.8", "::ffff:8.8.8.8", "2606:4700:4700::1111"} {
		if isNonPublicIP(net.ParseIP(ip)) {
			t.Errorf("rejected public IP %s", ip)
		}
	}
}

type requestBody struct {
	io.Reader

	closed bool
}

func (b *requestBody) Close() error {
	b.closed = true

	return nil
}

func TestHTTPSRejectionClosesRequestBody(t *testing.T) {
	t.Parallel()

	body := &requestBody{Reader: strings.NewReader("some request data"), closed: false}

	req, err := http.NewRequestWithContext(t.Context(), http.MethodPost, "http://idp.example", body)
	if err != nil {
		t.Fatal(err)
	}

	client := New(Config{})

	resp, err := client.Do(req)
	if resp != nil {
		defer resp.Body.Close()
	}

	if !errors.Is(err, errHTTPSRequired) || !body.closed {
		t.Fatalf(
			"expected rejection and request body closed, got %v and closed=%v",
			err,
			body.closed,
		)
	}
}

func TestHTTPSClientPreservesSchemeMismatch(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(server.Close)

	transport := &http.Transport{}
	t.Cleanup(transport.CloseIdleConnections)
	client := &http.Client{Transport: &boundedTransport{
		Transport: transport, bodyLimit: defaultBodyLimit,
	}}

	req, err := http.NewRequestWithContext(
		t.Context(), http.MethodGet, "https://"+strings.TrimPrefix(server.URL, "http://"), nil,
	)
	if err != nil {
		t.Fatal(err)
	}

	resp, err := client.Do(req)
	if resp != nil {
		defer resp.Body.Close()
	}

	if !errors.Is(err, http.ErrSchemeMismatch) {
		t.Fatalf("expected scheme mismatch, got %v", err)
	}
}

func TestDialChecked(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		address  string
		ips      []net.IPAddr
		dnsErr   error
		wantDial string
		wantErr  error
	}{
		{
			name:    "DNS failure",
			address: "example.test:443",
			dnsErr:  context.Canceled,
			wantErr: context.Canceled,
		},
		{
			name:    "empty answer",
			address: "example.test:443",
			wantErr: errNoAddresses,
		},
		{
			name:    "mixed public and private DNS answers",
			address: "example.test:443",
			ips: []net.IPAddr{
				{IP: net.ParseIP("8.8.8.8")},
				{IP: net.ParseIP("10.0.0.1")},
			},
			wantErr: errBlockedAddress,
		},
		{
			name:    "private IPv4 in IPv6 transition address",
			address: "example.test:443",
			ips:     []net.IPAddr{{IP: net.ParseIP("64:ff9b::a00:1")}},
			wantErr: errBlockedAddress,
		},
		{
			name:    "dial uses the checked address and original port",
			address: "example.test:8443",
			ips: []net.IPAddr{
				{IP: net.ParseIP("2606:4700:4700::1111")},
				{IP: net.ParseIP("8.8.8.8")},
			},
			wantDial: "[2606:4700:4700::1111]:8443",
			wantErr:  io.ErrClosedPipe,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var dialed []string

			_, err := dialChecked(t.Context(), "tcp", tt.address,
				func(_ context.Context, host string) ([]net.IPAddr, error) {
					if host != "example.test" {
						t.Errorf("DNS lookup host = %q, want example.test", host)
					}

					return tt.ips, tt.dnsErr
				},
				func(_ context.Context, network, address string) (net.Conn, error) {
					if network != "tcp" {
						t.Errorf("dial network = %q, want tcp", network)
					}

					dialed = append(dialed, address)

					return nil, io.ErrClosedPipe
				},
				isBlockedIP,
			)
			if !errors.Is(err, tt.wantErr) {
				t.Errorf("dial error = %v, want %v", err, tt.wantErr)
			}

			switch {
			case tt.wantDial == "" && len(dialed) != 0:
				t.Errorf("dial called with %v for an unsafe destination", dialed)
			case tt.wantDial != "" && (len(dialed) != 1 || dialed[0] != tt.wantDial):
				t.Errorf("dial called with %v, want [%q]", dialed, tt.wantDial)
			}
		})
	}
}

func TestBoundedTransportResponse(t *testing.T) {
	t.Parallel()

	const (
		bodyLimit   = 8
		headerLimit = 1024
	)

	tests := []struct {
		name          string
		body          string
		header        string
		wantBody      string
		wantReadError error
	}{
		{name: "below body limit", body: "short", wantBody: "short"},
		{name: "at body limit", body: "12345678", wantBody: "12345678"},
		{
			name:          "above body limit",
			body:          "123456789",
			wantBody:      "12345678",
			wantReadError: errBodyTooLarge,
		},
		{name: "above header limit", header: strings.Repeat("a", headerLimit+1)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			server := httptest.NewTLSServer(
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					w.Header().Set("X-Test", tt.header)

					if _, err := io.WriteString(w, tt.body); err != nil {
						t.Errorf("writing test response: %v", err)
					}
				}),
			)
			t.Cleanup(server.Close)

			client := server.Client()

			base, ok := client.Transport.(*http.Transport)
			if !ok {
				t.Fatalf("unexpected test transport %T", client.Transport)
			}

			transport := base.Clone()
			transport.MaxResponseHeaderBytes = headerLimit
			client.Transport = &boundedTransport{Transport: transport, bodyLimit: bodyLimit}
			t.Cleanup(client.CloseIdleConnections)

			resp, err := client.Get(server.URL)
			if err != nil {
				if tt.header == "" || !strings.Contains(err.Error(), "response headers exceeded") {
					t.Fatalf("getting test response: %v", err)
				}

				return
			}
			defer resp.Body.Close()

			if tt.header != "" {
				t.Fatal("oversized response headers were accepted")
			}

			body, err := io.ReadAll(resp.Body)
			if !errors.Is(err, tt.wantReadError) || string(body) != tt.wantBody {
				t.Errorf(
					"reading body = %q, %v, want %q, %v",
					body,
					err,
					tt.wantBody,
					tt.wantReadError,
				)
			}
		})
	}
}

func TestBoundedTransportChecksRedirectDestination(t *testing.T) {
	t.Parallel()

	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "https://127.0.0.1/", http.StatusFound)
	}))
	t.Cleanup(server.Close)

	const checkedAddress = "8.8.8.8:443"

	hostname := server.Certificate().DNSNames[0]
	client := server.Client()

	base, ok := client.Transport.(*http.Transport)
	if !ok {
		t.Fatalf("unexpected test transport %T", client.Transport)
	}

	transport := base.Clone()
	dialer := &net.Dialer{}
	transport.DialContext = func(ctx context.Context, network, address string) (net.Conn, error) {
		return dialChecked(ctx, network, address,
			func(_ context.Context, host string) ([]net.IPAddr, error) {
				if host == hostname {
					return []net.IPAddr{{IP: net.ParseIP("8.8.8.8")}}, nil
				}

				return []net.IPAddr{{IP: net.ParseIP(host)}}, nil
			},
			func(ctx context.Context, network, address string) (net.Conn, error) {
				if address != checkedAddress {
					t.Errorf("unexpected dial address %q", address)

					return nil, io.ErrClosedPipe
				}

				conn, err := dialer.DialContext(ctx, network, server.Listener.Addr().String())
				if err != nil {
					return nil, fmt.Errorf("dialing test server: %w", err)
				}

				return conn, nil
			},
			isBlockedIP,
		)
	}
	client.Transport = &boundedTransport{Transport: transport, bodyLimit: defaultBodyLimit}
	t.Cleanup(client.CloseIdleConnections)

	resp, err := client.Get("https://" + hostname)
	if err == nil {
		if closeErr := resp.Body.Close(); closeErr != nil {
			t.Fatalf("closing unexpected response: %v", closeErr)
		}

		t.Fatal("redirect to loopback succeeded")
	}

	if !errors.Is(err, errBlockedAddress) {
		t.Errorf("redirect error = %v, want %v", err, errBlockedAddress)
	}
}

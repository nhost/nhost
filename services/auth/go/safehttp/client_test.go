package safehttp_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/nhost/nhost/services/auth/go/safehttp"
)

func TestIsBlockedHost(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		host     string
		expected bool
	}{
		{
			name:     "localhost",
			host:     "localhost",
			expected: true,
		},
		{
			name:     "127.0.0.1",
			host:     "127.0.0.1",
			expected: true,
		},
		{
			name:     "ipv6 loopback",
			host:     "::1",
			expected: true,
		},
		{
			name:     "private 10.x",
			host:     "10.0.0.1",
			expected: true,
		},
		{
			name:     "private 192.168.x",
			host:     "192.168.1.1",
			expected: true,
		},
		{
			name:     "private 172.16.x",
			host:     "172.16.0.1",
			expected: true,
		},
		{
			name:     "link-local",
			host:     "169.254.1.1",
			expected: true,
		},
		{
			name:     "nat64 wrapped cloud metadata",
			host:     "64:ff9b::a9fe:a9fe",
			expected: true,
		},
		{
			name:     "CGNAT",
			host:     "100.64.0.1",
			expected: true,
		},
		{
			name:     "CGNAT cloud metadata",
			host:     "100.100.100.200",
			expected: true,
		},
		{
			name:     "benchmarking",
			host:     "198.18.0.1",
			expected: true,
		},
		{
			name:     "nat64 wrapped public IP",
			host:     "64:ff9b::808:808",
			expected: true,
		},
		{
			name:     "public IP",
			host:     "8.8.8.8",
			expected: false,
		},
		{
			name:     "public hostname",
			host:     "example.com",
			expected: false,
		},
		{
			name:     "unresolvable hostname",
			host:     "this-host-does-not-exist.invalid",
			expected: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := safehttp.IsBlockedHost(t.Context(), tc.host)
			if got != tc.expected {
				t.Errorf("IsBlockedHost(%q) = %v, want %v", tc.host, got, tc.expected)
			}
		})
	}
}

func TestNewRejectsUnsafeRequests(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		url  string
		want string
	}{
		{name: "plain HTTP", url: "http://example.test", want: "HTTPS is required"},
		{name: "loopback", url: "https://127.0.0.1", want: "blocked address"},
		{name: "IPv6 loopback", url: "https://[::1]", want: "blocked address"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			client := safehttp.New(safehttp.Config{})
			t.Cleanup(client.CloseIdleConnections)

			req, err := http.NewRequestWithContext(t.Context(), http.MethodGet, tt.url, nil)
			if err != nil {
				t.Fatalf("creating request: %v", err)
			}

			resp, err := client.Do(req)
			if err == nil {
				if closeErr := resp.Body.Close(); closeErr != nil {
					t.Fatalf("closing unexpected response: %v", closeErr)
				}

				t.Fatal("unsafe request succeeded")
			}

			if !strings.Contains(err.Error(), tt.want) {
				t.Errorf("request error = %v, want %q", err, tt.want)
			}
		})
	}
}

func TestNewClientSettings(t *testing.T) {
	t.Parallel()

	const configuredTimeout = 2 * time.Second

	tests := []struct {
		name         string
		cfg          safehttp.Config
		redirectURL  string
		hops         int
		wantTimeout  time.Duration
		wantRedirect string
	}{
		{
			name:         "zero config rejects redirects",
			cfg:          safehttp.Config{},
			redirectURL:  "https://example.test",
			hops:         1,
			wantTimeout:  5 * time.Second,
			wantRedirect: "too many redirects",
		},
		{
			name:        "configured HTTPS redirects",
			cfg:         safehttp.Config{Timeout: configuredTimeout, MaxRedirects: 2},
			redirectURL: "https://example.test",
			hops:        2,
			wantTimeout: configuredTimeout,
		},
		{
			name:         "redirect over the hop limit",
			cfg:          safehttp.Config{Timeout: configuredTimeout, MaxRedirects: 2},
			redirectURL:  "https://example.test",
			hops:         3,
			wantTimeout:  configuredTimeout,
			wantRedirect: "too many redirects",
		},
		{
			name:         "redirect downgrades to HTTP",
			cfg:          safehttp.Config{Timeout: configuredTimeout, MaxRedirects: 2},
			redirectURL:  "http://example.test",
			hops:         1,
			wantTimeout:  configuredTimeout,
			wantRedirect: "HTTPS is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			client := safehttp.New(tt.cfg)
			t.Cleanup(client.CloseIdleConnections)

			if client.Timeout != tt.wantTimeout {
				t.Errorf("Timeout = %v, want %v", client.Timeout, tt.wantTimeout)
			}

			req := httptest.NewRequest(http.MethodGet, tt.redirectURL, nil)
			err := client.CheckRedirect(req, make([]*http.Request, tt.hops))

			switch {
			case tt.wantRedirect == "" && err != nil:
				t.Errorf("redirect rejected: %v", err)
			case tt.wantRedirect != "" && (err == nil || !strings.Contains(err.Error(), tt.wantRedirect)):
				t.Errorf("redirect error = %v, want %q", err, tt.wantRedirect)
			}
		})
	}
}

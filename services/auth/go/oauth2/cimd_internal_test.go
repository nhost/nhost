package oauth2

import (
	"context"
	"log/slog"
	"net/url"
	"testing"
)

func TestIsLoopbackRedirectURI(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		uri      string
		expected bool
	}{
		{
			name:     "localhost",
			uri:      "http://localhost:3000/callback",
			expected: true,
		},
		{
			name:     "localhost no port",
			uri:      "http://localhost/callback",
			expected: true,
		},
		{
			name:     "127.0.0.1",
			uri:      "http://127.0.0.1:8080/callback",
			expected: true,
		},
		{
			name:     "127.0.0.1 no port",
			uri:      "http://127.0.0.1/callback",
			expected: true,
		},
		{
			name:     "ipv6 loopback",
			uri:      "http://[::1]:3000/callback",
			expected: true,
		},
		{
			name:     "external host",
			uri:      "https://evil.example.com/callback",
			expected: false,
		},
		{
			name:     "private IP",
			uri:      "http://192.168.1.1:3000/callback",
			expected: false,
		},
		{
			name:     "10.x private IP",
			uri:      "http://10.0.0.1:3000/callback",
			expected: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			u, err := url.Parse(tc.uri)
			if err != nil {
				t.Fatalf("failed to parse URI: %v", err)
			}

			got := isLoopbackRedirectURI(context.Background(), u)
			if got != tc.expected {
				t.Errorf("isLoopbackRedirectURI(%q) = %v, want %v", tc.uri, got, tc.expected)
			}
		})
	}
}

func TestIsPrivateOrLoopback(t *testing.T) {
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

			got := isPrivateOrLoopback(context.Background(), tc.host)
			if got != tc.expected {
				t.Errorf("isPrivateOrLoopback(%q) = %v, want %v", tc.host, got, tc.expected)
			}
		})
	}
}

func TestValidateRedirectURIOrigins(t *testing.T) {
	t.Parallel()

	logger := slog.New(slog.DiscardHandler)

	tests := []struct {
		name         string
		clientIDURL  string
		redirectURIs []string
		expectError  bool
	}{
		{
			name:         "same origin",
			clientIDURL:  "https://app.example.com/oauth/metadata.json",
			redirectURIs: []string{"https://app.example.com/callback"},
			expectError:  false,
		},
		{
			name:         "localhost with different origin client_id",
			clientIDURL:  "https://claude.ai/oauth/client-metadata",
			redirectURIs: []string{"http://localhost:3000/callback"},
			expectError:  false,
		},
		{
			name:         "127.0.0.1 with different origin client_id",
			clientIDURL:  "https://claude.ai/oauth/client-metadata",
			redirectURIs: []string{"http://127.0.0.1:8080/callback"},
			expectError:  false,
		},
		{
			name:        "mixed localhost and same origin",
			clientIDURL: "https://app.example.com/oauth/metadata.json",
			redirectURIs: []string{
				"http://localhost:3000/callback",
				"https://app.example.com/callback",
			},
			expectError: false,
		},
		{
			name:         "cross-origin non-loopback",
			clientIDURL:  "https://app.example.com/oauth/metadata.json",
			redirectURIs: []string{"https://evil.example.com/callback"},
			expectError:  true,
		},
		{
			name:         "private IP rejected",
			clientIDURL:  "https://app.example.com/oauth/metadata.json",
			redirectURIs: []string{"http://192.168.1.1:3000/callback"},
			expectError:  true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			oauthErr := validateRedirectURIOrigins(
				context.Background(),
				tc.clientIDURL,
				tc.redirectURIs,
				logger,
			)

			if tc.expectError && oauthErr == nil {
				t.Error("expected error, got nil")
			}

			if !tc.expectError && oauthErr != nil {
				t.Errorf("expected no error, got %q", oauthErr.Description)
			}
		})
	}
}

func TestMatchRedirectURI(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		redirectURI string
		registered  []string
		expected    bool
	}{
		{
			name:        "exact match",
			redirectURI: "https://app.example.com/callback",
			registered:  []string{"https://app.example.com/callback"},
			expected:    true,
		},
		{
			name:        "no match",
			redirectURI: "https://evil.example.com/callback",
			registered:  []string{"https://app.example.com/callback"},
			expected:    false,
		},
		{
			name:        "localhost port ignored",
			redirectURI: "http://localhost:53373/callback",
			registered:  []string{"http://localhost/callback"},
			expected:    true,
		},
		{
			name:        "localhost both have ports",
			redirectURI: "http://localhost:53373/callback",
			registered:  []string{"http://localhost:3000/callback"},
			expected:    true,
		},
		{
			name:        "127.0.0.1 port ignored",
			redirectURI: "http://127.0.0.1:8080/callback",
			registered:  []string{"http://127.0.0.1/callback"},
			expected:    true,
		},
		{
			name:        "non-loopback port must match",
			redirectURI: "https://app.example.com:8080/callback",
			registered:  []string{"https://app.example.com/callback"},
			expected:    false,
		},
		{
			name:        "scheme must match",
			redirectURI: "http://app.example.com/callback",
			registered:  []string{"https://app.example.com/callback"},
			expected:    false,
		},
		{
			name:        "path must match",
			redirectURI: "http://localhost:3000/evil",
			registered:  []string{"http://localhost/callback"},
			expected:    false,
		},
		{
			name:        "ipv6 loopback port ignored",
			redirectURI: "http://[::1]:53373/callback",
			registered:  []string{"http://[::1]/callback"},
			expected:    true,
		},
		{
			name:        "ipv6 loopback both have ports",
			redirectURI: "http://[::1]:53373/callback",
			registered:  []string{"http://[::1]:3000/callback"},
			expected:    true,
		},
		{
			name:        "multiple registered URIs",
			redirectURI: "http://localhost:9999/callback",
			registered: []string{
				"https://app.example.com/callback",
				"http://localhost/callback",
			},
			expected: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := matchRedirectURI(tc.redirectURI, tc.registered)
			if got != tc.expected {
				t.Errorf(
					"matchRedirectURI(%q, %v) = %v, want %v",
					tc.redirectURI, tc.registered, got, tc.expected,
				)
			}
		})
	}
}

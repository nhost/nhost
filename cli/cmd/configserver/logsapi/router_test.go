package logsapi //nolint:testpackage // whitebox test of unexported checkWebSocketOrigin

import (
	"net/http"
	"testing"
)

func TestCheckWebSocketOrigin(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		origin string
		allow  bool
	}{
		{"dashboard subdomain", "https://abc123.dashboard.local.nhost.run", true},
		{"dashboard root", "https://local.dashboard.nhost.run", true},
		{"localhost", "http://localhost:3000", true},
		{"loopback ip", "http://127.0.0.1:3000", true},
		{"evil host", "https://evil.example.com", false},
		{"wrong suffix", "https://dashboard.local.nhost.run.attacker.com", false},
		{"empty origin", "", false},
		{"garbage", "not a url at all %%%", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			r := &http.Request{Header: http.Header{}} //nolint:exhaustruct
			if tt.origin != "" {
				r.Header.Set("Origin", tt.origin)
			}

			if got := checkWebSocketOrigin(r); got != tt.allow {
				t.Errorf("checkWebSocketOrigin(%q) = %v, want %v", tt.origin, got, tt.allow)
			}
		})
	}
}

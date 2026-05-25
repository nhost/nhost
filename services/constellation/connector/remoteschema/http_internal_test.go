package remoteschema

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestApplyClientHeaders(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		headers     http.Header
		wantPresent map[string]string
		wantAbsent  []string
	}{
		{
			name: "forwards non-ignored headers",
			headers: http.Header{
				"Authorization":   {"Bearer token123"},
				"X-Custom-Header": {"custom-value"},
			},
			wantPresent: map[string]string{
				"Authorization":   "Bearer token123",
				"X-Custom-Header": "custom-value",
			},
		},
		{
			name: "ignores filtered headers",
			headers: http.Header{
				"Content-Length":  {"100"},
				"Content-Type":    {"application/json"},
				"Accept":          {"*/*"},
				"Accept-Encoding": {"gzip"},
			},
			wantAbsent: []string{"Content-Length", "Accept"},
		},
		{
			name: "filters x-hasura headers",
			headers: http.Header{
				"X-Hasura-User-Id": {"user-123"},
				"X-Hasura-Role":    {"admin"},
			},
			wantAbsent: []string{"X-Hasura-User-Id", "X-Hasura-Role"},
		},
		{
			name: "creates X-Forwarded headers",
			headers: http.Header{
				"Host":       {"original.example.com"},
				"User-Agent": {"TestBrowser/1.0"},
				"Origin":     {"https://app.example.com"},
			},
			wantPresent: map[string]string{
				"X-Forwarded-Host":       "original.example.com",
				"X-Forwarded-User-Agent": "TestBrowser/1.0",
				"X-Forwarded-Origin":     "https://app.example.com",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			req, _ := http.NewRequestWithContext(
				context.Background(), http.MethodPost, "http://example.com", nil,
			)

			applyClientHeaders(req, tt.headers)

			for name, want := range tt.wantPresent {
				if got := req.Header.Get(name); got != want {
					t.Errorf("header %s: expected %q, got %q", name, want, got)
				}
			}

			for _, name := range tt.wantAbsent {
				if got := req.Header.Get(name); got != "" {
					t.Errorf("header %s: expected absent, got %q", name, got)
				}
			}
		})
	}
}

func TestHTTPClient_HeaderPriority(t *testing.T) {
	t.Parallel()

	var receivedHeaders http.Header

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedHeaders = r.Header.Clone()
		w.Header().Set("Content-Type", "application/json")

		if _, err := w.Write([]byte(`{"data":{"ok":true}}`)); err != nil {
			t.Errorf("writing response: %v", err)
		}
	}))
	defer server.Close()

	client := &httpClient{
		url:     server.URL,
		headers: map[string]string{"X-Api-Key": "configured-key"},
		client:  &http.Client{Timeout: 60 * time.Second},
	}

	sessionVars := map[string]any{
		"x-hasura-user-id": "user-123",
	}

	clientHeaders := http.Header{
		"X-Api-Key": {"client-key-should-be-overridden"},
	}

	_, err := client.do(
		context.Background(),
		graphQLRequest{Query: "{ ok }", Variables: nil},
		sessionVars,
		clientHeaders,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Configured headers should take priority over client headers
	if receivedHeaders.Get("X-Api-Key") != "configured-key" {
		t.Errorf(
			"expected configured X-Api-Key, got %s",
			receivedHeaders.Get("X-Api-Key"),
		)
	}

	// Session variables should be set as headers
	if receivedHeaders.Get("X-Hasura-User-Id") != "user-123" {
		t.Errorf(
			"expected session variable header, got %s",
			receivedHeaders.Get("X-Hasura-User-Id"),
		)
	}
}

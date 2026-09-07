package tool

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/ai/agents/provider"
	"github.com/nhost/nhost/services/ai/internal/httpsafe"
)

func TestWebSearchDefinition(t *testing.T) {
	t.Parallel()

	ws := NewWebSearch(WebSearchConfig{Provider: "brave", APIKey: "key"})
	got := ws.Definition()

	want := provider.ToolDefinition{
		Name: "web_search",
		Description: "Search the web for current information. " +
			"Use this when you need up-to-date information that may not be in your training data.",
		Parameters: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"query": map[string]any{
					"type":        "string",
					"description": "The search query",
				},
			},
			"required": []string{"query"},
		},
	}

	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("Definition() mismatch (-want +got):\n%s", diff)
	}
}

// capturedRequest holds the HTTP request details captured by a test server.
type capturedRequest struct {
	Method  string
	Path    string
	Query   map[string]string
	Headers map[string]string
	Body    map[string]any
}

func newCaptureServer(t *testing.T) (*httptest.Server, *capturedRequest) {
	t.Helper()

	captured := &capturedRequest{}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		captured.Method = r.Method
		captured.Path = r.URL.Path
		captured.Query = make(map[string]string)

		for k, v := range r.URL.Query() {
			captured.Query[k] = v[0]
		}

		captured.Headers = make(map[string]string)
		for _, h := range []string{"Accept", "X-Subscription-Token", "Content-Type", "Authorization"} {
			if v := r.Header.Get(h); v != "" {
				captured.Headers[h] = v
			}
		}

		if r.Body != nil {
			body, _ := io.ReadAll(r.Body)
			if len(body) > 0 {
				captured.Body = make(map[string]any)
				_ = json.Unmarshal(body, &captured.Body)
			}
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"results":[]}`))
	}))

	t.Cleanup(srv.Close)

	return srv, captured
}

func newTestWebSearch(t *testing.T, config WebSearchConfig, serverURL string) *WebSearch {
	t.Helper()

	ws := NewWebSearch(config)
	ws.client = &http.Client{
		Transport: rewriteTransport{
			base:    http.DefaultTransport,
			testURL: serverURL,
		},
	}

	return ws
}

func TestWebSearchExecute(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name        string
		config      WebSearchConfig
		args        string
		wantRequest capturedRequest
		wantResult  string
		wantErr     bool
	}{
		{
			name:    "invalid JSON arguments",
			config:  WebSearchConfig{Provider: "brave", APIKey: "key"},
			args:    "not json",
			wantErr: true,
		},
		{
			name:    "unsupported provider",
			config:  WebSearchConfig{Provider: "unknown", APIKey: "key"},
			args:    `{"query":"test"}`,
			wantErr: true,
		},
		{
			name:   "brave search",
			config: WebSearchConfig{Provider: "brave", APIKey: "k"},
			args:   `{"query":"golang testing"}`,
			wantRequest: capturedRequest{
				Method: http.MethodGet,
				Path:   "/res/v1/web/search",
				Query: map[string]string{
					"q":     "golang testing",
					"count": "5",
				},
				Headers: map[string]string{
					"Accept":               "application/json",
					"X-Subscription-Token": "k",
				},
			},
			wantResult: `{"results":[]}`,
		},
		{
			name:   "tavily search",
			config: WebSearchConfig{Provider: "tavily", APIKey: "k"},
			args:   `{"query":"golang testing"}`,
			wantRequest: capturedRequest{
				Method: http.MethodPost,
				Path:   "/search",
				Headers: map[string]string{
					"Content-Type":  "application/json",
					"Authorization": "Bearer k",
				},
				Body: map[string]any{
					"query":       "golang testing",
					"max_results": float64(webSearchMaxResults),
				},
			},
			wantResult: `{"results":[]}`,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			srv, captured := newCaptureServer(t)
			ws := newTestWebSearch(t, tc.config, srv.URL)

			result, err := ws.Execute(context.Background(), tc.args, slog.Default())
			if tc.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if diff := cmp.Diff(tc.wantRequest.Method, captured.Method); diff != "" {
				t.Errorf("method mismatch (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff(tc.wantRequest.Path, captured.Path); diff != "" {
				t.Errorf("path mismatch (-want +got):\n%s", diff)
			}

			if tc.wantRequest.Query != nil {
				if diff := cmp.Diff(tc.wantRequest.Query, captured.Query); diff != "" {
					t.Errorf("query mismatch (-want +got):\n%s", diff)
				}
			}

			if diff := cmp.Diff(tc.wantRequest.Headers, captured.Headers); diff != "" {
				t.Errorf("headers mismatch (-want +got):\n%s", diff)
			}

			if tc.wantRequest.Body != nil {
				if diff := cmp.Diff(tc.wantRequest.Body, captured.Body); diff != "" {
					t.Errorf("body mismatch (-want +got):\n%s", diff)
				}
			}

			if diff := cmp.Diff(tc.wantResult, result); diff != "" {
				t.Errorf("result mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestWebSearchExecuteHTTPStatusErrors(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		provider string
		status   int
		body     string
	}{
		{
			name:     "brave 401 unauthorized",
			provider: "brave",
			status:   http.StatusUnauthorized,
			body:     `{"error":"unauthorized"}`,
		},
		{
			name:     "brave 429 rate limit",
			provider: "brave",
			status:   http.StatusTooManyRequests,
			body:     `{"error":"rate limited"}`,
		},
		{
			name:     "brave 500 upstream failure",
			provider: "brave",
			status:   http.StatusInternalServerError,
			body:     `{"error":"server error"}`,
		},
		{
			name:     "tavily 401 unauthorized",
			provider: "tavily",
			status:   http.StatusUnauthorized,
			body:     `{"error":"unauthorized"}`,
		},
		{
			name:     "tavily 429 rate limit",
			provider: "tavily",
			status:   http.StatusTooManyRequests,
			body:     `{"error":"rate limited"}`,
		},
		{
			name:     "tavily 500 upstream failure",
			provider: "tavily",
			status:   http.StatusInternalServerError,
			body:     `{"error":"server error"}`,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			srv := httptest.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(tc.status)
					_, _ = w.Write([]byte(tc.body))
				}),
			)
			t.Cleanup(srv.Close)

			ws := newTestWebSearch(
				t,
				WebSearchConfig{Provider: tc.provider, APIKey: "k"},
				srv.URL,
			)

			result, err := ws.Execute(
				context.Background(),
				`{"query":"golang testing"}`,
				slog.Default(),
			)
			if err == nil {
				t.Fatalf("expected error for status %d, got result: %q", tc.status, result)
			}

			if !errors.Is(err, errWebSearchHTTPStatus) {
				t.Errorf("expected errWebSearchHTTPStatus, got: %v", err)
			}

			if !strings.Contains(err.Error(), tc.provider) {
				t.Errorf("expected error to contain provider %q, got: %v", tc.provider, err)
			}

			if !strings.Contains(err.Error(), strconv.Itoa(tc.status)) {
				t.Errorf("expected error to contain status %d, got: %v", tc.status, err)
			}

			if !strings.Contains(err.Error(), tc.body) {
				t.Errorf("expected error to contain body %q, got: %v", tc.body, err)
			}

			if result != "" {
				t.Errorf("expected empty result on error, got: %q", result)
			}
		})
	}
}

// TestWebSearchSSRFProtection verifies that the default WebSearch client uses
// the SSRF-safe dialer — a redirect/rewrite that lands on a loopback host
// must be refused. We rewrite at the transport level (rather than redirect
// over the wire) so we exercise the dialer path that the SSRF protection
// hooks into.
func TestWebSearchSSRFProtection(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
		},
	))
	t.Cleanup(srv.Close)

	cases := []struct {
		name     string
		provider string
	}{
		{name: "brave", provider: "brave"},
		{name: "tavily", provider: "tavily"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ws := NewWebSearch(WebSearchConfig{Provider: tc.provider, APIKey: "k"})
			ws.client.Transport = rewriteTransport{
				base:    ws.client.Transport,
				testURL: srv.URL,
			}

			_, err := ws.Execute(
				context.Background(),
				`{"query":"x"}`,
				slog.Default(),
			)
			if err == nil {
				t.Fatal("expected error for loopback redirect, got nil")
			}

			var ssrfErr httpsafe.ErrPrivateIPAccessError
			if !errors.As(err, &ssrfErr) {
				t.Errorf("expected ErrPrivateIPAccessError, got %v", err)
			}
		})
	}
}

// rewriteTransport redirects all requests to a test server URL
// while preserving the original path and query.
type rewriteTransport struct {
	base    http.RoundTripper
	testURL string
}

func (t rewriteTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	req = req.Clone(req.Context())
	req.URL.Scheme = "http"
	req.URL.Host = t.testURL[len("http://"):]

	return t.base.RoundTrip(req) //nolint:wrapcheck
}

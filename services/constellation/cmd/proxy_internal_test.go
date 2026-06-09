package cmd

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestNewHasuraProxyRejectsInvalidURL(t *testing.T) {
	t.Parallel()

	logger := slog.New(slog.DiscardHandler)

	for _, raw := range []string{"", "not-a-url", "/relative/only"} {
		if _, err := newHasuraProxy(raw, logger); err == nil {
			t.Errorf("newHasuraProxy(%q) = nil error; want error", raw)
		}
	}
}

func TestNewHasuraProxyForwardsRequest(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)

	var (
		gotPath   string
		gotHeader string
		gotHost   string
	)

	upstream := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			gotPath = r.URL.Path
			gotHeader = r.Header.Get("X-Hasura-Admin-Secret")
			gotHost = r.Host

			w.Header().Set("X-From-Upstream", "yes")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"result":"ok"}`))
		},
	))
	defer upstream.Close()

	logger := slog.New(slog.DiscardHandler)

	proxy, err := newHasuraProxy(upstream.URL, logger)
	if err != nil {
		t.Fatalf("newHasuraProxy error: %v", err)
	}

	router := gin.New()
	router.NoRoute(func(c *gin.Context) {
		proxy.ServeHTTP(c.Writer, c.Request)
	})

	front := httptest.NewServer(router)
	defer front.Close()

	req, err := http.NewRequestWithContext(
		context.Background(), http.MethodPost, front.URL+"/v1/metadata", nil,
	)
	if err != nil {
		t.Fatalf("building request: %v", err)
	}

	req.Header.Set("X-Hasura-Admin-Secret", "secret")

	resp, err := front.Client().Do(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		t.Errorf("status = %d; want %d", resp.StatusCode, http.StatusOK)
	}

	if gotPath != "/v1/metadata" {
		t.Errorf("upstream path = %q; want %q", gotPath, "/v1/metadata")
	}

	if gotHeader != "secret" {
		t.Errorf("upstream X-Hasura-Admin-Secret = %q; want %q", gotHeader, "secret")
	}

	if resp.Header.Get("X-From-Upstream") != "yes" {
		t.Errorf("response missing upstream header X-From-Upstream")
	}

	if string(body) != `{"result":"ok"}` {
		t.Errorf("body = %q; want %q", string(body), `{"result":"ok"}`)
	}

	// the upstream must observe its own Host, not whatever
	// the client sent. httptest.Server URLs are http://127.0.0.1:<port>, so
	// the upstream Host equals the proxy target's Host.
	wantHost := strings.TrimPrefix(upstream.URL, "http://")
	if gotHost != wantHost {
		t.Errorf("upstream Host = %q; want %q", gotHost, wantHost)
	}
}

// TestNewHasuraProxyReturns413OnOversizedBody is the W6 regression: when
// MaxBytesReader trips on an oversized inbound body, ErrorHandler must
// return 413 (not 502) so clients and monitoring can distinguish "too big"
// from "upstream unreachable". The body must include the byte limit so a
// retry/UX path can surface it.
func TestNewHasuraProxyReturns413OnOversizedBody(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)

	upstream := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
		},
	))
	defer upstream.Close()

	logger := slog.New(slog.DiscardHandler)

	proxy, err := newHasuraProxy(upstream.URL, logger)
	if err != nil {
		t.Fatalf("newHasuraProxy: %v", err)
	}

	const limit int64 = 32

	router := gin.New()
	router.NoRoute(func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, limit)

		proxy.ServeHTTP(c.Writer, c.Request)
	})

	front := httptest.NewServer(router)
	defer front.Close()

	oversized := make([]byte, limit+1)
	for i := range oversized {
		oversized[i] = 'a'
	}

	req, err := http.NewRequestWithContext(
		context.Background(), http.MethodPost,
		front.URL+"/v2/query", bytes.NewReader(oversized),
	)
	if err != nil {
		t.Fatalf("building request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := front.Client().Do(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusRequestEntityTooLarge {
		t.Fatalf(
			"status = %d; want 413, body = %s",
			resp.StatusCode, body,
		)
	}

	if !strings.Contains(string(body), `"request-too-large"`) {
		t.Errorf(`body %q missing "request-too-large" error code`, body)
	}

	if !strings.Contains(string(body), "32") {
		t.Errorf("body %q does not surface the byte limit", body)
	}
}

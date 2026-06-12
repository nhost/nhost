package hasuraproxy_test

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/internal/hasuraproxy"
)

func TestNewRejectsInvalidURL(t *testing.T) {
	t.Parallel()

	logger := slog.New(slog.DiscardHandler)

	for _, raw := range []string{"", "not-a-url", "/relative/only", "ftp://hasura:8080"} {
		if _, err := hasuraproxy.New(raw, logger); err == nil {
			t.Errorf("New(%q) = nil error; want error", raw)
		}
	}
}

func TestNewForwardsRequest(t *testing.T) {
	t.Parallel()

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

	proxy, err := hasuraproxy.New(upstream.URL, slog.New(slog.DiscardHandler))
	if err != nil {
		t.Fatalf("New error: %v", err)
	}

	front := httptest.NewServer(proxy)
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

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("reading response body: %v", err)
	}

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

	// The upstream must observe its own Host, not whatever the client sent.
	// httptest.Server URLs are http://127.0.0.1:<port>, so the upstream Host
	// equals the proxy target's Host.
	wantHost := strings.TrimPrefix(upstream.URL, "http://")
	if gotHost != wantHost {
		t.Errorf("upstream Host = %q; want %q", gotHost, wantHost)
	}
}

func TestNewPreservesRawQuery(t *testing.T) {
	t.Parallel()

	const (
		targetRawQuery  = "target=1"
		inboundRawQuery = "ok=1&bad=%zz&next=2"
	)

	var gotRawQuery string

	upstream := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			gotRawQuery = r.URL.RawQuery

			w.WriteHeader(http.StatusNoContent)
		},
	))
	defer upstream.Close()

	proxy, err := hasuraproxy.New(
		upstream.URL+"?"+targetRawQuery,
		slog.New(slog.DiscardHandler),
	)
	if err != nil {
		t.Fatalf("New error: %v", err)
	}

	front := httptest.NewServer(proxy)
	defer front.Close()

	req, err := http.NewRequestWithContext(
		context.Background(), http.MethodGet, front.URL+"/v1/metadata", nil,
	)
	if err != nil {
		t.Fatalf("building request: %v", err)
	}

	req.URL.RawQuery = inboundRawQuery

	resp, err := front.Client().Do(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("status = %d; want %d", resp.StatusCode, http.StatusNoContent)
	}

	wantRawQuery := targetRawQuery + "&" + inboundRawQuery
	if gotRawQuery != wantRawQuery {
		t.Errorf("upstream raw query = %q; want %q", gotRawQuery, wantRawQuery)
	}
}

func TestNewPreservesForwardedHeaders(t *testing.T) {
	t.Parallel()

	const (
		forwarded       = `for=203.0.113.5;proto=https;host=api.example.com`
		xForwardedFor   = "203.0.113.10"
		xForwardedHost  = "graphql.example.com"
		xForwardedProto = "https"
	)

	type recorded struct {
		forwarded       []string
		xForwardedFor   []string
		xForwardedHost  []string
		xForwardedProto []string
	}

	hits := make(chan recorded, 1)

	upstream := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			hits <- recorded{
				forwarded:       r.Header.Values("Forwarded"),
				xForwardedFor:   r.Header.Values("X-Forwarded-For"),
				xForwardedHost:  r.Header.Values("X-Forwarded-Host"),
				xForwardedProto: r.Header.Values("X-Forwarded-Proto"),
			}

			w.WriteHeader(http.StatusNoContent)
		},
	))
	defer upstream.Close()

	proxy, err := hasuraproxy.New(upstream.URL, slog.New(slog.DiscardHandler))
	if err != nil {
		t.Fatalf("New error: %v", err)
	}

	front := httptest.NewServer(proxy)
	defer front.Close()

	req, err := http.NewRequestWithContext(
		context.Background(), http.MethodGet, front.URL+"/v1/metadata", nil,
	)
	if err != nil {
		t.Fatalf("building request: %v", err)
	}

	req.Header.Set("Forwarded", forwarded)
	req.Header.Set("X-Forwarded-For", xForwardedFor)
	req.Header.Set("X-Forwarded-Host", xForwardedHost)
	req.Header.Set("X-Forwarded-Proto", xForwardedProto)

	resp, err := front.Client().Do(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("status = %d; want %d", resp.StatusCode, http.StatusNoContent)
	}

	got := <-hits
	if len(got.forwarded) != 1 || got.forwarded[0] != forwarded {
		t.Errorf("Forwarded = %v; want [%q]", got.forwarded, forwarded)
	}

	if len(got.xForwardedFor) != 1 || !strings.HasPrefix(got.xForwardedFor[0], xForwardedFor+", ") {
		t.Errorf(
			"X-Forwarded-For = %v; want preserved chain starting with %q",
			got.xForwardedFor,
			xForwardedFor+", ",
		)
	}

	if len(got.xForwardedHost) != 1 || got.xForwardedHost[0] != xForwardedHost {
		t.Errorf("X-Forwarded-Host = %v; want [%q]", got.xForwardedHost, xForwardedHost)
	}

	if len(got.xForwardedProto) != 1 || got.xForwardedProto[0] != xForwardedProto {
		t.Errorf("X-Forwarded-Proto = %v; want [%q]", got.xForwardedProto, xForwardedProto)
	}
}

// TestNewReturns413OnOversizedBody is the W6 regression: when MaxBytesReader
// trips on an oversized inbound body, ErrorHandler must return 413 (not 502)
// so clients and monitoring can distinguish "too big" from "upstream
// unreachable". The body must include the byte limit so a retry/UX path can
// surface it.
func TestNewReturns413OnOversizedBody(t *testing.T) {
	t.Parallel()

	upstream := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
		},
	))
	defer upstream.Close()

	proxy, err := hasuraproxy.New(upstream.URL, slog.New(slog.DiscardHandler))
	if err != nil {
		t.Fatalf("New: %v", err)
	}

	const limit int64 = 32

	front := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			r.Body = http.MaxBytesReader(w, r.Body, limit)
			proxy.ServeHTTP(w, r)
		},
	))
	defer front.Close()

	oversized := make([]byte, limit+1)
	for i := range oversized {
		oversized[i] = 'a'
	}

	req, err := http.NewRequestWithContext(
		context.Background(),
		http.MethodPost,
		front.URL+"/v2/query",
		bytes.NewReader(oversized),
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

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("reading response body: %v", err)
	}

	if resp.StatusCode != http.StatusRequestEntityTooLarge {
		t.Fatalf(
			"status = %d; want 413, body = %s",
			resp.StatusCode,
			body,
		)
	}

	if !strings.Contains(string(body), `"request-too-large"`) {
		t.Errorf(`body %q missing "request-too-large" error code`, body)
	}

	if !strings.Contains(string(body), "32") {
		t.Errorf("body %q does not surface the byte limit", body)
	}
}

func TestNewStripsUpstreamCORSHeaders(t *testing.T) {
	t.Parallel()

	corsHeaders := []string{
		"Access-Control-Allow-Credentials",
		"Access-Control-Allow-Headers",
		"Access-Control-Allow-Methods",
		"Access-Control-Allow-Origin",
		"Access-Control-Allow-Private-Network",
		"Access-Control-Expose-Headers",
		"Access-Control-Max-Age",
	}

	upstream := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, _ *http.Request) {
			for _, header := range corsHeaders {
				w.Header().Set(header, "upstream")
			}

			w.Header().Set("X-Upstream-Header", "kept")
			w.WriteHeader(http.StatusAccepted)
		},
	))
	defer upstream.Close()

	proxy, err := hasuraproxy.New(upstream.URL, slog.New(slog.DiscardHandler))
	if err != nil {
		t.Fatalf("New: %v", err)
	}

	front := httptest.NewServer(proxy)
	defer front.Close()

	req, err := http.NewRequestWithContext(
		context.Background(), http.MethodGet, front.URL+"/v2/query", nil,
	)
	if err != nil {
		t.Fatalf("building request: %v", err)
	}

	req.Header.Set("Origin", "https://app.example.com")

	resp, err := front.Client().Do(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusAccepted {
		t.Fatalf("status = %d; want %d", resp.StatusCode, http.StatusAccepted)
	}

	for _, header := range corsHeaders {
		if got := resp.Header.Values(header); len(got) != 0 {
			t.Errorf("%s = %v; want stripped", header, got)
		}
	}

	if got := resp.Header.Get("X-Upstream-Header"); got != "kept" {
		t.Errorf("X-Upstream-Header = %q; want kept", got)
	}
}

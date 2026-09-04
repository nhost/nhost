package transport_test

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/nhost/nhost/packages/nhost-go/transport"
)

var errStopRedirect = errors.New("caller stopped redirect")

func TestIsLoopbackHost(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		hostname string
		want     bool
	}{
		{name: "localhost", hostname: "LOCALHOST", want: true},
		{name: "IPv4", hostname: "127.0.0.1", want: true},
		{name: "IPv6", hostname: "::1", want: true},
		{name: "remote IP", hostname: "192.0.2.1", want: false},
		{name: "remote hostname", hostname: "auth.example.com", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := transport.IsLoopbackHost(tt.hostname); got != tt.want {
				t.Fatalf("IsLoopbackHost(%q) = %t, want %t", tt.hostname, got, tt.want)
			}
		})
	}
}

func TestNormalizeServiceURL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		serviceURL string
		want       string
	}{
		{
			name:       "existing HTTPS",
			serviceURL: "https://auth.example.com/v1",
			want:       "https://auth.example.com/v1",
		},
		{
			name:       "loopback hostname",
			serviceURL: "localhost:1337/v1",
			want:       "http://localhost:1337/v1",
		},
		{name: "loopback IPv4", serviceURL: "127.0.0.1:1337/v1", want: "http://127.0.0.1:1337/v1"},
		{name: "loopback IPv6", serviceURL: "[::1]:1337/v1", want: "http://[::1]:1337/v1"},
		{name: "remote", serviceURL: "auth.example.com/v1", want: "https://auth.example.com/v1"},
		{name: "empty", serviceURL: "", want: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := transport.NormalizeServiceURL(tt.serviceURL); got != tt.want {
				t.Fatalf("NormalizeServiceURL(%q) = %q, want %q", tt.serviceURL, got, tt.want)
			}
		})
	}
}

func TestChainOrder(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	var order []string

	mk := func(name string) transport.Middleware {
		return func(next http.RoundTripper) http.RoundTripper {
			return transport.RoundTripFunc(func(req *http.Request) (*http.Response, error) {
				order = append(order, name)

				return next.RoundTrip(req)
			})
		}
	}

	rt := transport.Chain(srv.Client().Transport, mk("a"), mk("b"), mk("c"))

	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, srv.URL, nil)

	resp, err := rt.RoundTrip(req)
	if err != nil {
		t.Fatalf("round trip: %v", err)
	}
	defer resp.Body.Close()

	if got := strings.Join(order, ","); got != "a,b,c" {
		t.Fatalf("chain order = %q, want a,b,c", got)
	}
}

func TestChainNilBaseUsesDefaultTransport(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	request, err := http.NewRequestWithContext(
		context.Background(),
		http.MethodGet,
		server.URL,
		nil,
	)
	if err != nil {
		t.Fatalf("create request: %v", err)
	}

	response, err := transport.Chain(nil).RoundTrip(request)
	if err != nil {
		t.Fatalf("round trip with nil base: %v", err)
	}

	if response.StatusCode != http.StatusNoContent {
		t.Errorf("status = %d, want %d", response.StatusCode, http.StatusNoContent)
	}

	if err := response.Body.Close(); err != nil {
		t.Fatalf("close response body: %v", err)
	}
}

func TestNewHTTPClientDoesNotMutateBase(t *testing.T) {
	t.Parallel()

	const headerName = "X-Derived-Client"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if got := req.Header.Get(headerName); got != "yes" {
			t.Errorf("%s = %q, want yes", headerName, got)
		}

		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	sentinelTransport := server.Client().Transport
	base := &http.Client{
		Transport: sentinelTransport,
		Timeout:   5 * time.Second,
	}

	middleware := func(next http.RoundTripper) http.RoundTripper {
		return transport.RoundTripFunc(func(req *http.Request) (*http.Response, error) {
			req = req.Clone(req.Context())
			req.Header.Set(headerName, "yes")

			return next.RoundTrip(req)
		})
	}

	derived := transport.NewHTTPClient(base, middleware)
	if derived == base {
		t.Fatal("NewHTTPClient returned the base client")
	}

	if base.Transport != sentinelTransport {
		t.Fatal("NewHTTPClient mutated base.Transport")
	}

	if base.Timeout != 5*time.Second {
		t.Fatalf("base.Timeout = %s, want 5s", base.Timeout)
	}

	if derived.Timeout != base.Timeout {
		t.Fatalf("derived.Timeout = %s, want %s", derived.Timeout, base.Timeout)
	}

	request, err := http.NewRequestWithContext(
		context.Background(),
		http.MethodGet,
		server.URL,
		nil,
	)
	if err != nil {
		t.Fatalf("create request: %v", err)
	}

	response, err := derived.Do(request)
	if err != nil {
		t.Fatalf("derived client request: %v", err)
	}

	if err := response.Body.Close(); err != nil {
		t.Fatalf("close response body: %v", err)
	}
}

func TestNewHTTPClientDelegatesCheckRedirect(t *testing.T) {
	t.Parallel()

	var destinationRequests atomic.Int32

	destination := httptest.NewServer(
		http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			destinationRequests.Add(1)
			w.WriteHeader(http.StatusNoContent)
		}),
	)
	defer destination.Close()

	origin := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		http.Redirect(w, req, destination.URL, http.StatusFound)
	}))
	defer origin.Close()

	var callbackCalls atomic.Int32

	base := origin.Client()
	base.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		callbackCalls.Add(1)

		if req.URL.String() != destination.URL {
			t.Errorf("redirect URL = %q, want %q", req.URL, destination.URL)
		}

		if len(via) != 1 || via[0].URL.String() != origin.URL {
			t.Errorf("redirect history = %v, want [%s]", via, origin.URL)
		}

		return errStopRedirect
	}

	request, err := http.NewRequestWithContext(
		context.Background(),
		http.MethodGet,
		origin.URL,
		nil,
	)
	if err != nil {
		t.Fatalf("create request: %v", err)
	}

	response, err := transport.NewHTTPClient(base).Do(request)
	if response != nil {
		if closeErr := response.Body.Close(); closeErr != nil {
			t.Errorf("close redirect response body: %v", closeErr)
		}
	}

	if !errors.Is(err, errStopRedirect) {
		t.Fatalf("request error = %v, want %v", err, errStopRedirect)
	}

	if got := callbackCalls.Load(); got != 1 {
		t.Errorf("CheckRedirect calls = %d, want 1", got)
	}

	if got := destinationRequests.Load(); got != 0 {
		t.Errorf("destination requests = %d, want 0", got)
	}
}

func TestNewHTTPClientAppliesDefaultRedirectLimit(t *testing.T) {
	t.Parallel()

	var requests atomic.Int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		requests.Add(1)
		http.Redirect(w, req, "/again", http.StatusFound)
	}))
	defer server.Close()

	request, err := http.NewRequestWithContext(
		context.Background(),
		http.MethodGet,
		server.URL,
		nil,
	)
	if err != nil {
		t.Fatalf("create request: %v", err)
	}

	response, err := transport.NewHTTPClient(server.Client()).Do(request)
	if response != nil {
		if closeErr := response.Body.Close(); closeErr != nil {
			t.Errorf("close redirect response body: %v", closeErr)
		}
	}

	if err == nil || !strings.Contains(err.Error(), "stopped after 10 redirects") {
		t.Fatalf("request error = %v, want 10-redirect limit error", err)
	}

	if got := requests.Load(); got != 10 {
		t.Errorf("requests = %d, want 10", got)
	}
}

func TestNewHTTPClientStripsCallerCredentialsOnCrossHostRedirect(t *testing.T) {
	t.Parallel()

	type credentials struct {
		authorization string
		adminSecret   string
	}

	destinationCredentials := make(chan credentials, 1)

	destination := httptest.NewServer(
		http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			destinationCredentials <- credentials{
				authorization: req.Header.Get("Authorization"),
				adminSecret:   req.Header.Get("x-hasura-admin-secret"),
			}

			w.WriteHeader(http.StatusOK)
		}),
	)
	defer destination.Close()

	originCredentials := make(chan credentials, 1)

	origin := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		originCredentials <- credentials{
			authorization: req.Header.Get("Authorization"),
			adminSecret:   req.Header.Get("x-hasura-admin-secret"),
		}

		http.Redirect(w, req, destination.URL, http.StatusFound)
	}))
	defer origin.Close()

	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, origin.URL, nil)
	if err != nil {
		t.Fatalf("create request: %v", err)
	}

	req.Header.Set("Authorization", "Bearer caller-token")
	req.Header.Set("x-hasura-admin-secret", "caller-secret")

	resp, err := transport.NewHTTPClient(origin.Client()).Do(req)
	if err != nil {
		t.Fatalf("request through redirect: %v", err)
	}

	if err := resp.Body.Close(); err != nil {
		t.Fatalf("close response body: %v", err)
	}

	if got := <-originCredentials; got.authorization != "Bearer caller-token" ||
		got.adminSecret != "caller-secret" {
		t.Fatalf("origin credentials = %+v, want caller credentials", got)
	}

	if got := <-destinationCredentials; got.authorization != "" || got.adminSecret != "" {
		t.Fatalf("cross-host destination received credentials: %+v", got)
	}
}

func TestAPIErrorMessageExtraction(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		body any
		want string
	}{
		{
			name: "message",
			body: map[string]any{"message": "bad input"},
			want: "bad input",
		},
		{
			name: "storage error string",
			body: map[string]any{"error": "file not found"},
			want: "file not found",
		},
		{
			name: "storage nested error",
			body: map[string]any{"error": map[string]any{"message": "bucket not found"}},
			want: "bucket not found",
		},
		{
			name: "graphql errors",
			body: map[string]any{
				"errors": []any{
					map[string]any{"message": "field denied"},
					map[string]any{"message": "query failed"},
				},
			},
			want: "field denied, query failed",
		},
		{
			name: "raw string",
			body: "upstream unavailable",
			want: "upstream unavailable",
		},
		{
			name: "empty string fallback",
			body: "",
			want: "An unexpected error occurred",
		},
		{
			name: "malformed nested error fallback",
			body: map[string]any{
				"error":  map[string]any{"message": 42},
				"errors": []any{"bad", map[string]any{"message": 42}},
			},
			want: "An unexpected error occurred",
		},
		{
			name: "nil fallback",
			body: nil,
			want: "An unexpected error occurred",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := transport.NewAPIError(tt.body, http.StatusBadRequest, nil).Error()
			if got != tt.want {
				t.Fatalf("Error() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestNewAPIErrorFromResponseMessage(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = io.WriteString(w, `{"message":"bad input"}`)
	}))
	defer srv.Close()

	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, srv.URL, nil)

	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer resp.Body.Close()

	apiErr := transport.NewAPIErrorFromResponse(resp)
	if apiErr.Status != http.StatusBadRequest {
		t.Fatalf("status = %d", apiErr.Status)
	}

	if apiErr.Error() != "bad input" {
		t.Fatalf("message = %q, want %q", apiErr.Error(), "bad input")
	}
}

func TestDecodeJSON(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, `{"hello":"world"}`)
	}))
	defer srv.Close()

	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, srv.URL, nil)

	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer resp.Body.Close()

	var out map[string]string
	if err := transport.DecodeJSON(resp, &out); err != nil {
		t.Fatalf("decode: %v", err)
	}

	if out["hello"] != "world" {
		t.Fatalf("decoded = %v", out)
	}
}

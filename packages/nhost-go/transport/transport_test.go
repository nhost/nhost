package transport_test

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/nhost/nhost/packages/nhost-go/transport"
)

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

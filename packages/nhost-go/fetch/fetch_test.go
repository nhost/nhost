package fetch_test

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/nhost/nhost/packages/nhost-go/fetch"
)

func TestCreateEnhancedFetchChainOrder(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	var order []string

	mk := func(name string) fetch.ChainFunction {
		return func(next fetch.FetchFunc) fetch.FetchFunc {
			return func(req *http.Request) (*http.Response, error) {
				order = append(order, name)

				return next(req)
			}
		}
	}

	f := fetch.CreateEnhancedFetch(srv.Client(), []fetch.ChainFunction{mk("a"), mk("b"), mk("c")})

	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, srv.URL, nil)

	resp, err := f(req)
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}
	defer resp.Body.Close()

	if got := strings.Join(order, ","); got != "a,b,c" {
		t.Fatalf("chain order = %q, want a,b,c", got)
	}
}

func TestNewFetchErrorFromResponseMessage(t *testing.T) {
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

	ferr := fetch.NewFetchErrorFromResponse(resp)
	if ferr.Status != http.StatusBadRequest {
		t.Fatalf("status = %d", ferr.Status)
	}

	if ferr.Error() != "bad input" {
		t.Fatalf("message = %q, want %q", ferr.Error(), "bad input")
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
	if err := fetch.DecodeJSON(resp, &out); err != nil {
		t.Fatalf("decode: %v", err)
	}

	if out["hello"] != "world" {
		t.Fatalf("decoded = %v", out)
	}
}

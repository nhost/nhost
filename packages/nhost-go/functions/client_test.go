package functions_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/nhost/nhost/packages/nhost-go/fetch"
	"github.com/nhost/nhost/packages/nhost-go/functions"
)

func TestPostDecodesJSON(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)

		var parsed map[string]any

		_ = json.Unmarshal(body, &parsed)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"body": parsed, "method": r.Method})
	}))
	defer srv.Close()

	c := functions.NewClient(srv.URL, nil, srv.Client())

	resp, err := c.Post(context.Background(), "/echo", map[string]any{"message": "hello"}, nil)
	if err != nil {
		t.Fatalf("post: %v", err)
	}

	out, ok := resp.Body.(map[string]any)
	if !ok {
		t.Fatalf("body type = %T", resp.Body)
	}

	inner, ok := out["body"].(map[string]any)
	if !ok || inner["message"] != "hello" {
		t.Fatalf("echoed body = %v", out["body"])
	}

	if out["method"] != http.MethodPost {
		t.Fatalf("method = %v", out["method"])
	}
}

func TestFetchNon2xxReturnsFetchError(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = io.WriteString(w, `{"message":"boom"}`)
	}))
	defer srv.Close()

	c := functions.NewClient(srv.URL, nil, srv.Client())

	_, err := c.Fetch(context.Background(), "/fail", http.MethodGet, nil, nil)

	var ferr *fetch.FetchError
	if !errors.As(err, &ferr) {
		t.Fatalf("expected *fetch.FetchError, got %T (%v)", err, err)
	}

	if ferr.Status != http.StatusInternalServerError {
		t.Fatalf("status = %d", ferr.Status)
	}
}

func TestFetchDecodeBodyByContentType(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		contentType string
		payload     string
		check       func(t *testing.T, body any)
	}{
		{
			name:        "text",
			contentType: "text/plain",
			payload:     "hello world",
			check: func(t *testing.T, body any) {
				t.Helper()

				if s, ok := body.(string); !ok || s != "hello world" {
					t.Fatalf("text body = %#v", body)
				}
			},
		},
		{
			name:        "binary",
			contentType: "application/octet-stream",
			payload:     "\x00\x01\x02rawbytes",
			check: func(t *testing.T, body any) {
				t.Helper()

				b, ok := body.([]byte)
				if !ok || string(b) != "\x00\x01\x02rawbytes" {
					t.Fatalf("binary body = %#v", body)
				}
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", tc.contentType)
				_, _ = io.WriteString(w, tc.payload)
			}))
			defer srv.Close()

			c := functions.NewClient(srv.URL, nil, srv.Client())

			resp, err := c.Fetch(context.Background(), "/data", "", nil, nil)
			if err != nil {
				t.Fatalf("fetch: %v", err)
			}

			tc.check(t, resp.Body)
		})
	}
}

func TestFetchDefaultsToGET(t *testing.T) {
	t.Parallel()

	var gotMethod string

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method

		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{}`)
	}))
	defer srv.Close()

	c := functions.NewClient(srv.URL, nil, srv.Client())

	if _, err := c.Fetch(context.Background(), "/", "", nil, nil); err != nil {
		t.Fatalf("fetch: %v", err)
	}

	if gotMethod != http.MethodGet {
		t.Fatalf("method = %q, want GET", gotMethod)
	}
}

func TestPostDoesNotMutateCallerHeaders(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{}`)
	}))
	defer srv.Close()

	c := functions.NewClient(srv.URL, nil, srv.Client())

	headers := http.Header{"X-Trace": {"t1"}}

	if _, err := c.Post(context.Background(), "/echo", map[string]any{"a": 1}, headers); err != nil {
		t.Fatalf("post: %v", err)
	}

	if len(headers) != 1 || headers.Get("X-Trace") != "t1" {
		t.Fatalf("caller headers mutated: %v", headers)
	}

	if headers.Get("Content-Type") != "" {
		t.Fatalf("Content-Type leaked into caller headers: %v", headers)
	}
}

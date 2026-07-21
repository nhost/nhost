package main

import (
	"net/http"
	"net/http/httptest"
	"testing"

	serveutil "github.com/nhost/nhost/internal/lib/serve"
)

// echoService returns a serve.Service whose handler writes back the request
// path it received, so tests can assert what the service sees after prefix
// stripping.
func echoService() *serveutil.Service {
	return &serveutil.Service{
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(r.URL.Path))
		}),
		Background: nil,
		Close:      nil,
	}
}

func TestNewMuxStripsPrefixAndRoutes(t *testing.T) {
	t.Parallel()

	mux := newMux([]mounted{
		{name: "auth", prefix: "/auth", svc: echoService()},
		{name: "storage", prefix: "/storage", svc: echoService()},
		{name: "graphql", prefix: "/graphql", svc: echoService()},
	})

	tests := []struct {
		name     string
		path     string
		wantCode int
		wantBody string
	}{
		{
			name:     "auth request reaches auth with prefix stripped",
			path:     "/auth/v1/signin/email-password",
			wantCode: http.StatusOK,
			wantBody: "/v1/signin/email-password",
		},
		{
			name:     "storage request reaches storage with prefix stripped",
			path:     "/storage/v1/files",
			wantCode: http.StatusOK,
			wantBody: "/v1/files",
		},
		{
			name:     "graphql metadata request reaches constellation",
			path:     "/graphql/v1/metadata",
			wantCode: http.StatusOK,
			wantBody: "/v1/metadata",
		},
		{
			name:     "healthz is served by the engine",
			path:     "/healthz",
			wantCode: http.StatusOK,
			wantBody: "ok",
		},
		{
			name:     "unknown prefix is not found",
			path:     "/nope/v1",
			wantCode: http.StatusNotFound,
			wantBody: "",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, tc.path, nil)

			mux.ServeHTTP(rec, req)

			if rec.Code != tc.wantCode {
				t.Fatalf("status = %d, want %d", rec.Code, tc.wantCode)
			}

			if tc.wantBody != "" && rec.Body.String() != tc.wantBody {
				t.Fatalf("body = %q, want %q", rec.Body.String(), tc.wantBody)
			}
		})
	}
}

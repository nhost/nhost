package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/lib/oapi/middleware"
)

func TestCORS(t *testing.T) { //nolint:maintidx
	t.Parallel()

	gin.SetMode(gin.TestMode)

	cases := []struct {
		name           string
		opts           middleware.CORSOptions
		requestMethod  string
		requestOrigin  string
		requestHeaders map[string]string
		wantStatus     int
		wantHeaders    http.Header
		expectNext     bool
	}{
		{
			name: "OPTIONS request with allowed origin",
			opts: middleware.CORSOptions{ //nolint:exhaustruct
				AllowedOrigins: []string{"https://example.com"},
				AllowedMethods: []string{"GET", "POST"},
				AllowedHeaders: []string{"Content-Type", "Authorization"},
			},
			requestMethod:  "OPTIONS",
			requestHeaders: map[string]string{},
			requestOrigin:  "https://example.com",
			wantStatus:     http.StatusNoContent,
			wantHeaders: http.Header{
				"Access-Control-Allow-Origin":      []string{"https://example.com"},
				"Access-Control-Allow-Methods":     []string{"GET, POST"},
				"Access-Control-Allow-Headers":     []string{"Content-Type, Authorization"},
				"Access-Control-Allow-Credentials": []string{"false"},
				"Vary":                             []string{"Origin, Access-Control-Request-Method"},
				"Content-Length":                   []string{"0"},
			},
			expectNext: false,
		},
		{
			name: "OPTIONS request with wildcard origin",
			opts: middleware.CORSOptions{ //nolint:exhaustruct
				AllowedOrigins: []string{"*"},
				AllowedMethods: []string{"GET", "POST", "PUT", "DELETE"},
			},
			requestMethod:  "OPTIONS",
			requestHeaders: map[string]string{},
			requestOrigin:  "https://any-origin.com",
			wantStatus:     http.StatusNoContent,
			wantHeaders: http.Header{
				"Access-Control-Allow-Origin":  []string{"https://any-origin.com"},
				"Access-Control-Allow-Methods": []string{"GET, POST, PUT, DELETE"},
			},
			expectNext: false,
		},
		{
			name: "OPTIONS request with disallowed origin",
			opts: middleware.CORSOptions{ //nolint:exhaustruct
				AllowedOrigins: []string{"https://example.com"},
				AllowedMethods: []string{"GET", "POST"},
			},
			requestMethod:  "OPTIONS",
			requestHeaders: map[string]string{},
			requestOrigin:  "https://malicious.com",
			wantStatus:     http.StatusNoContent,
			wantHeaders:    http.Header{},
			expectNext:     false,
		},
		{
			name: "OPTIONS request with reflected headers (nil)",
			opts: middleware.CORSOptions{ //nolint:exhaustruct
				AllowedOrigins: []string{"https://example.com"},
				AllowedMethods: []string{"POST"},
				AllowedHeaders: nil,
			},
			requestMethod: "OPTIONS",
			requestOrigin: "https://example.com",
			requestHeaders: map[string]string{
				"Access-Control-Request-Headers": "X-Custom-Header, X-Another-Header",
			},
			wantStatus: http.StatusNoContent,
			wantHeaders: http.Header{
				"Access-Control-Allow-Headers": []string{"X-Custom-Header, X-Another-Header"},
			},
			expectNext: false,
		},
		{
			name: "OPTIONS request with denied headers (empty slice)",
			opts: middleware.CORSOptions{ //nolint:exhaustruct
				AllowedOrigins: []string{"https://example.com"},
				AllowedMethods: []string{"POST"},
				AllowedHeaders: []string{},
			},
			requestMethod: "OPTIONS",
			requestOrigin: "https://example.com",
			requestHeaders: map[string]string{
				"Access-Control-Request-Headers": "X-Custom-Header, X-Another-Header",
			},
			wantStatus:  http.StatusNoContent,
			wantHeaders: http.Header{},
			expectNext:  false,
		},
		{
			name: "OPTIONS request with nil headers and no request headers",
			opts: middleware.CORSOptions{ //nolint:exhaustruct
				AllowedOrigins: []string{"https://example.com"},
				AllowedMethods: []string{"GET"},
				AllowedHeaders: nil,
			},
			requestMethod:  "OPTIONS",
			requestOrigin:  "https://example.com",
			requestHeaders: map[string]string{},
			wantStatus:     http.StatusNoContent,
			wantHeaders:    http.Header{},
			expectNext:     false,
		},
		{
			name: "OPTIONS request with credentials enabled",
			opts: middleware.CORSOptions{ //nolint:exhaustruct
				AllowedOrigins:   []string{"https://example.com"},
				AllowedMethods:   []string{"GET"},
				AllowCredentials: true,
			},
			requestMethod:  "OPTIONS",
			requestOrigin:  "https://example.com",
			requestHeaders: map[string]string{},
			wantStatus:     http.StatusNoContent,
			wantHeaders: http.Header{
				"Access-Control-Allow-Credentials": []string{"true"},
			},
			expectNext: false,
		},
		{
			name: "OPTIONS request with MaxAge",
			opts: middleware.CORSOptions{ //nolint:exhaustruct
				AllowedOrigins: []string{"https://example.com"},
				AllowedMethods: []string{"GET"},
				MaxAge:         "3600",
			},
			requestMethod:  "OPTIONS",
			requestOrigin:  "https://example.com",
			requestHeaders: map[string]string{},
			wantStatus:     http.StatusNoContent,
			wantHeaders: http.Header{
				"Access-Control-Max-Age": []string{"3600"},
			},
			expectNext: false,
		},
		{
			name: "OPTIONS request with exposed headers",
			opts: middleware.CORSOptions{ //nolint:exhaustruct
				AllowedOrigins: []string{"https://example.com"},
				AllowedMethods: []string{"GET"},
				ExposedHeaders: []string{"X-Custom-Response", "X-Total-Count"},
			},
			requestMethod:  "OPTIONS",
			requestOrigin:  "https://example.com",
			requestHeaders: map[string]string{},
			wantStatus:     http.StatusNoContent,
			wantHeaders: http.Header{
				"Access-Control-Expose-Headers": []string{"X-Custom-Response, X-Total-Count"},
			},
			expectNext: false,
		},
		{
			name: "GET request with allowed origin",
			opts: middleware.CORSOptions{ //nolint:exhaustruct
				AllowedOrigins: []string{"https://example.com"},
				AllowedMethods: []string{"GET", "POST"},
				AllowedHeaders: []string{"Content-Type"},
			},
			requestMethod:  "GET",
			requestOrigin:  "https://example.com",
			requestHeaders: map[string]string{},
			wantStatus:     http.StatusOK,
			wantHeaders: http.Header{
				"Access-Control-Allow-Origin":  []string{"https://example.com"},
				"Access-Control-Allow-Methods": []string{"GET, POST"},
				"Access-Control-Allow-Headers": []string{"Content-Type"},
			},
			expectNext: true,
		},
		{
			name: "POST request with disallowed origin",
			opts: middleware.CORSOptions{ //nolint:exhaustruct
				AllowedOrigins: []string{"https://example.com"},
				AllowedMethods: []string{"GET", "POST"},
			},
			requestMethod:  "POST",
			requestOrigin:  "https://malicious.com",
			requestHeaders: map[string]string{},
			wantStatus:     http.StatusOK,
			wantHeaders:    http.Header{},
			expectNext:     true,
		},
		{
			name: "GET request without origin header",
			opts: middleware.CORSOptions{ //nolint:exhaustruct
				AllowedOrigins: []string{"https://example.com"},
				AllowedMethods: []string{"GET"},
			},
			requestMethod:  "GET",
			requestOrigin:  "",
			requestHeaders: map[string]string{},
			wantStatus:     http.StatusOK,
			wantHeaders:    http.Header{},
			expectNext:     true,
		},
		{
			name: "GET request with empty allowed origins (denies all)",
			opts: middleware.CORSOptions{ //nolint:exhaustruct
				AllowedOrigins: []string{},
				AllowedMethods: []string{"GET"},
			},
			requestMethod:  "GET",
			requestOrigin:  "https://any-origin.com",
			requestHeaders: map[string]string{},
			wantStatus:     http.StatusOK,
			wantHeaders:    http.Header{},
			expectNext:     true,
		},
		{
			name: "GET request with nil allowed origins (allows all)",
			opts: middleware.CORSOptions{ //nolint:exhaustruct
				AllowedOrigins: nil,
				AllowedMethods: []string{"GET"},
			},
			requestMethod:  "GET",
			requestOrigin:  "https://any-origin.com",
			requestHeaders: map[string]string{},
			wantStatus:     http.StatusOK,
			wantHeaders: http.Header{
				"Access-Control-Allow-Origin": []string{"https://any-origin.com"},
			},
			expectNext: true,
		},
		{
			name: "GET request with multiple allowed origins",
			opts: middleware.CORSOptions{ //nolint:exhaustruct
				AllowedOrigins: []string{
					"https://example.com",
					"https://another-example.com",
					"https://third-example.com",
				},
				AllowedMethods: []string{"GET"},
			},
			requestMethod:  "GET",
			requestHeaders: map[string]string{},
			requestOrigin:  "https://another-example.com",
			wantStatus:     http.StatusOK,
			wantHeaders: http.Header{
				"Access-Control-Allow-Origin": []string{"https://another-example.com"},
			},
			expectNext: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			// Setup router with CORS middleware
			router := gin.New()
			nextCalled := false

			router.Use(middleware.CORS(tc.opts))
			router.Any("/test", func(c *gin.Context) {
				nextCalled = true

				c.Status(http.StatusOK)
			})

			// Create request
			req := httptest.NewRequest(tc.requestMethod, "/test", nil)
			if tc.requestOrigin != "" {
				req.Header.Set("Origin", tc.requestOrigin)
			}

			// Add any additional request headers
			for key, value := range tc.requestHeaders {
				req.Header.Set(key, value)
			}

			// Record response
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// Check status code
			if w.Code != tc.wantStatus {
				t.Errorf("expected status %d, got %d", tc.wantStatus, w.Code)
			}

			// Check expected headers using cmp.Diff
			// Only compare headers that are expected
			gotHeaders := make(http.Header)
			for key := range tc.wantHeaders {
				if values := w.Header().Values(key); len(values) > 0 {
					gotHeaders[key] = values
				}
			}

			if diff := cmp.Diff(tc.wantHeaders, gotHeaders); diff != "" {
				t.Errorf("response headers mismatch (-want +got):\n%s", diff)
			}

			// Check if Next() was called
			if nextCalled != tc.expectNext {
				t.Errorf("expected Next() called to be %v, got %v", tc.expectNext, nextCalled)
			}
		})
	}
}

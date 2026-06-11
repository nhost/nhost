package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/internal/lib/oapi/middleware"
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
			opts: middleware.CORSOptions{
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
				"Vary": []string{
					"Origin, Access-Control-Request-Method",
				},
				"Content-Length": []string{"0"},
			},
			expectNext: false,
		},
		{
			name: "OPTIONS request with wildcard origin",
			opts: middleware.CORSOptions{
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
			opts: middleware.CORSOptions{
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
			opts: middleware.CORSOptions{
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
			opts: middleware.CORSOptions{
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
			opts: middleware.CORSOptions{
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
			opts: middleware.CORSOptions{
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
			opts: middleware.CORSOptions{
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
			opts: middleware.CORSOptions{
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
			opts: middleware.CORSOptions{
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
			opts: middleware.CORSOptions{
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
			opts: middleware.CORSOptions{
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
			opts: middleware.CORSOptions{
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
			opts: middleware.CORSOptions{
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
			opts: middleware.CORSOptions{
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
		{
			name: "AllowOriginFunc accepts matching origin",
			opts: middleware.CORSOptions{
				AllowOriginFunc: func(origin string) bool {
					return strings.HasSuffix(origin, ".example.com")
				},
				AllowedMethods: []string{"GET"},
			},
			requestMethod:  "GET",
			requestOrigin:  "https://app.example.com",
			requestHeaders: map[string]string{},
			wantStatus:     http.StatusOK,
			wantHeaders: http.Header{
				"Access-Control-Allow-Origin": []string{"https://app.example.com"},
			},
			expectNext: true,
		},
		{
			name: "AllowOriginFunc rejects non-matching origin",
			opts: middleware.CORSOptions{
				AllowOriginFunc: func(origin string) bool {
					return strings.HasSuffix(origin, ".example.com")
				},
				AllowedMethods: []string{"GET"},
			},
			requestMethod:  "GET",
			requestOrigin:  "https://malicious.com",
			requestHeaders: map[string]string{},
			wantStatus:     http.StatusOK,
			wantHeaders:    http.Header{},
			expectNext:     true,
		},
		{
			name: "AllowOriginFunc takes precedence over AllowedOrigins",
			opts: middleware.CORSOptions{
				// AllowedOrigins would deny everything, but AllowOriginFunc accepts.
				AllowedOrigins:  []string{"https://different.com"},
				AllowOriginFunc: func(_ string) bool { return true },
				AllowedMethods:  []string{"GET"},
			},
			requestMethod:  "GET",
			requestOrigin:  "https://anything.com",
			requestHeaders: map[string]string{},
			wantStatus:     http.StatusOK,
			wantHeaders: http.Header{
				"Access-Control-Allow-Origin": []string{"https://anything.com"},
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

func TestCORSOptionsValidate(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		opts    middleware.CORSOptions
		wantErr bool
	}{
		{
			name: "wildcard with credentials rejected",
			opts: middleware.CORSOptions{
				AllowedOrigins:   []string{"*"},
				AllowCredentials: true,
			},
			wantErr: true,
		},
		{
			name: "nil allow all with credentials rejected",
			opts: middleware.CORSOptions{
				AllowedOrigins:   nil,
				AllowCredentials: true,
			},
			wantErr: true,
		},
		{
			name: "unsafe migration flag allows legacy wildcard",
			opts: middleware.CORSOptions{
				AllowedOrigins:                       []string{"*"},
				AllowCredentials:                     true,
				UnsafeAllowAllOriginsWithCredentials: true,
			},
			wantErr: false,
		},
		{
			name: "anchored glob with credentials accepted",
			opts: middleware.CORSOptions{
				AllowedOrigins:   []string{"https://dashboard-*.example.com"},
				AllowCredentials: true,
			},
			wantErr: false,
		},
		{
			name: "allow origin function is caller responsibility",
			opts: middleware.CORSOptions{
				AllowOriginFunc:  func(string) bool { return true },
				AllowedOrigins:   nil,
				AllowCredentials: true,
			},
			wantErr: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			err := tc.opts.Validate()
			if tc.wantErr && err == nil {
				t.Fatal("Validate() error = nil; want error")
			}

			if !tc.wantErr && err != nil {
				t.Fatalf("Validate() error = %v; want nil", err)
			}
		})
	}
}

func TestCORSAllowHeadersFunc(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(middleware.CORS(middleware.CORSOptions{
		AllowedOrigins: []string{"https://example.com"},
		AllowedMethods: []string{"POST"},
		AllowHeadersFunc: func(name string) bool {
			lower := strings.ToLower(name)

			return lower == "authorization" || strings.HasPrefix(lower, "x-hasura-")
		},
	}))
	router.POST("/test", func(c *gin.Context) { c.Status(http.StatusOK) })

	req := httptest.NewRequest(http.MethodOptions, "/test", nil)
	req.Header.Set("Origin", "https://example.com")
	req.Header.Set(
		"Access-Control-Request-Headers",
		"Authorization, X-Hasura-Role, X-Random",
	)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if got, want := w.Header().Get("Access-Control-Allow-Headers"),
		"Authorization, X-Hasura-Role"; got != want {
		t.Fatalf("Access-Control-Allow-Headers = %q; want %q", got, want)
	}
}

func TestCORSWildcardOriginPattern(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(middleware.CORS(middleware.CORSOptions{
		AllowedOrigins: []string{"https://dashboard-*.example.com"},
		AllowedMethods: []string{"GET"},
	}))
	router.GET("/test", func(c *gin.Context) { c.Status(http.StatusOK) })

	allowed := httptest.NewRequest(http.MethodGet, "/test", nil)
	allowed.Header.Set("Origin", "https://dashboard-pr-42.example.com")

	allowedRec := httptest.NewRecorder()
	router.ServeHTTP(allowedRec, allowed)

	if got := allowedRec.Header().
		Get("Access-Control-Allow-Origin"); got != "https://dashboard-pr-42.example.com" {
		t.Fatalf("allowed origin header = %q", got)
	}

	denied := httptest.NewRequest(http.MethodGet, "/test", nil)
	denied.Header.Set("Origin", "https://dashboard-pr-42.example.com.evil.test")

	deniedRec := httptest.NewRecorder()
	router.ServeHTTP(deniedRec, denied)

	if got := deniedRec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("denied origin header = %q; want empty", got)
	}
}

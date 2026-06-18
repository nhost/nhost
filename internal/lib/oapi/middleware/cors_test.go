package middleware_test

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/internal/lib/oapi/middleware"
)

// runCORS dispatches a single request through the CORS middleware and an
// optional downstream handler. It returns the ResponseRecorder and a flag
// indicating whether the downstream handler was invoked. It fails the test if
// CORS returns a construction error, so callers exercising the fail-closed path
// must call middleware.CORS directly.
func runCORS(
	t *testing.T,
	opts middleware.CORSOptions,
	method, origin string,
	requestHeaders string,
) (*httptest.ResponseRecorder, bool) {
	t.Helper()

	gin.SetMode(gin.TestMode)

	rec := httptest.NewRecorder()
	_, engine := gin.CreateTestContext(rec)

	called := false

	handler, err := middleware.CORS(opts)
	if err != nil {
		t.Fatalf("middleware.CORS: unexpected error: %v", err)
	}

	engine.Use(handler)
	engine.Any("/", func(*gin.Context) {
		called = true
	})

	req := httptest.NewRequest(method, "/", nil)
	if origin != "" {
		req.Header.Set("Origin", origin)
	}

	if requestHeaders != "" {
		req.Header.Set("Access-Control-Request-Headers", requestHeaders)
	}

	engine.ServeHTTP(rec, req)

	return rec, called
}

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

			corsHandler, err := middleware.CORS(tc.opts)
			if err != nil {
				t.Fatalf("CORS() error = %v; want nil", err)
			}

			router.Use(corsHandler)
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
		wantErr error
	}{
		{
			name: "wildcard with credentials rejected",
			opts: middleware.CORSOptions{
				AllowedOrigins:   []string{"*"},
				AllowCredentials: true,
			},
			wantErr: middleware.ErrWildcardWithCredentials,
		},
		{
			name: "wildcard among others with credentials rejected",
			opts: middleware.CORSOptions{
				AllowedOrigins:   []string{"https://example.com", "*"},
				AllowCredentials: true,
			},
			wantErr: middleware.ErrWildcardWithCredentials,
		},
		{
			name: "allow all glob with credentials rejected",
			opts: middleware.CORSOptions{
				AllowedOrigins:   []string{"https://example.com", "**"},
				AllowCredentials: true,
			},
			wantErr: middleware.ErrWildcardWithCredentials,
		},
		{
			// The shared Validate rejects a nil allow-list combined with
			// credentials, which the constellation implementation did not. A nil
			// slice means "reflect any origin", so it is as dangerous as "*".
			name: "nil allow all with credentials rejected",
			opts: middleware.CORSOptions{
				AllowedOrigins:   nil,
				AllowCredentials: true,
			},
			wantErr: middleware.ErrWildcardWithCredentials,
		},
		{
			name: "unsafe migration flag allows legacy wildcard",
			opts: middleware.CORSOptions{
				AllowedOrigins:                       []string{"*"},
				AllowCredentials:                     true,
				UnsafeAllowAllOriginsWithCredentials: true,
			},
			wantErr: nil,
		},
		{
			name: "wildcard without credentials ok",
			opts: middleware.CORSOptions{
				AllowedOrigins:   []string{"*"},
				AllowCredentials: false,
			},
			wantErr: nil,
		},
		{
			name: "explicit origins with credentials ok",
			opts: middleware.CORSOptions{
				AllowedOrigins:   []string{"https://example.com"},
				AllowCredentials: true,
			},
			wantErr: nil,
		},
		{
			name: "anchored glob with credentials accepted",
			opts: middleware.CORSOptions{
				AllowedOrigins:   []string{"https://dashboard-*.example.com"},
				AllowCredentials: true,
			},
			wantErr: nil,
		},
		{
			name: "empty origins with credentials ok",
			opts: middleware.CORSOptions{
				AllowedOrigins:   []string{},
				AllowCredentials: true,
			},
			wantErr: nil,
		},
		{
			name: "allow origin function is caller responsibility",
			opts: middleware.CORSOptions{
				AllowOriginFunc:  func(string) bool { return true },
				AllowedOrigins:   nil,
				AllowCredentials: true,
			},
			wantErr: nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			err := tc.opts.Validate()
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("Validate() error = %v; want %v", err, tc.wantErr)
			}
		})
	}
}

func TestCORSFailClosed(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)

	cases := []struct {
		name    string
		opts    middleware.CORSOptions
		wantErr error
	}{
		{
			name: "wildcard with credentials rejected at construction",
			opts: middleware.CORSOptions{
				AllowedOrigins:   []string{"*"},
				AllowCredentials: true,
			},
			wantErr: middleware.ErrWildcardWithCredentials,
		},
		{
			name: "wildcard among others with credentials rejected at construction",
			opts: middleware.CORSOptions{
				AllowedOrigins:   []string{"https://example.com", "*"},
				AllowCredentials: true,
			},
			wantErr: middleware.ErrWildcardWithCredentials,
		},
		{
			name: "nil allow all with credentials rejected at construction",
			opts: middleware.CORSOptions{
				AllowedOrigins:   nil,
				AllowCredentials: true,
			},
			wantErr: middleware.ErrWildcardWithCredentials,
		},
		{
			name: "unsafe migration flag builds a handler",
			opts: middleware.CORSOptions{
				AllowedOrigins:                       []string{"*"},
				AllowCredentials:                     true,
				UnsafeAllowAllOriginsWithCredentials: true,
			},
			wantErr: nil,
		},
		{
			name: "anchored glob with credentials builds a handler",
			opts: middleware.CORSOptions{
				AllowedOrigins:   []string{"https://dashboard-*.example.com"},
				AllowCredentials: true,
			},
			wantErr: nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			handler, err := middleware.CORS(tc.opts)

			if tc.wantErr != nil {
				if !errors.Is(err, tc.wantErr) {
					t.Fatalf("CORS() error = %v; want wrapping %v", err, tc.wantErr)
				}

				if handler != nil {
					t.Fatal("CORS() returned a non-nil handler on the error path")
				}

				return
			}

			if err != nil {
				t.Fatalf("CORS() error = %v; want nil", err)
			}

			if handler == nil {
				t.Fatal("CORS() returned a nil handler without an error")
			}
		})
	}
}

func TestCORSAllowHeadersFunc(t *testing.T) {
	t.Parallel()

	hasuraOrNhostOrAuth := func(name string) bool {
		lower := strings.ToLower(name)

		return lower == "authorization" ||
			strings.HasPrefix(lower, "x-hasura-") ||
			strings.HasPrefix(lower, "x-nhost-")
	}

	cases := []struct {
		name          string
		allowFunc     func(name string) bool
		requestHeader string
		wantACAH      string
		wantPresent   bool
	}{
		{
			name:          "reflects_only_approved_headers",
			allowFunc:     hasuraOrNhostOrAuth,
			requestHeader: "Authorization, X-Hasura-User-Id, X-Random, X-Nhost-Webhook-Secret",
			wantACAH:      "Authorization, X-Hasura-User-Id, X-Nhost-Webhook-Secret",
			wantPresent:   true,
		},
		{
			name:          "case_insensitive_match_preserves_client_casing",
			allowFunc:     hasuraOrNhostOrAuth,
			requestHeader: "x-HASURA-Role, authorization",
			wantACAH:      "x-HASURA-Role, authorization",
			wantPresent:   true,
		},
		{
			name:          "all_denied_omits_header",
			allowFunc:     func(string) bool { return false },
			requestHeader: "X-Foo, X-Bar",
			wantACAH:      "",
			wantPresent:   false,
		},
		{
			name:          "empty_request_headers_omits_header",
			allowFunc:     hasuraOrNhostOrAuth,
			requestHeader: "",
			wantACAH:      "",
			wantPresent:   false,
		},
		{
			name:          "skips_empty_entries_between_commas",
			allowFunc:     hasuraOrNhostOrAuth,
			requestHeader: "Authorization,, X-Hasura-Role",
			wantACAH:      "Authorization, X-Hasura-Role",
			wantPresent:   true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			opts := middleware.CORSOptions{
				AllowedOrigins:   []string{"https://example.com"},
				AllowedMethods:   []string{"GET"},
				AllowHeadersFunc: tc.allowFunc,
				// AllowedHeaders must be ignored when AllowHeadersFunc is set; a
				// non-nil value here proves the function takes precedence.
				AllowedHeaders: []string{"Should-Be-Ignored"},
			}

			rec, _ := runCORS(
				t,
				opts,
				http.MethodOptions,
				"https://example.com",
				tc.requestHeader,
			)

			got := rec.Header().Get("Access-Control-Allow-Headers")

			_, present := rec.Header()["Access-Control-Allow-Headers"]
			if present != tc.wantPresent {
				t.Errorf(
					"ACAH presence: got %v, want %v (value %q)",
					present,
					tc.wantPresent,
					got,
				)
			}

			if got != tc.wantACAH {
				t.Errorf("ACAH: got %q, want %q", got, tc.wantACAH)
			}
		})
	}
}

// TestCORSWildcardOrigins exercises glob matching of AllowedOrigins entries. It
// covers both legitimate matches and the security-critical property that a glob
// is anchored at BOTH ends (and that "*" never spans a "/"), so an attacker
// cannot satisfy it by appending, prepending, or path-smuggling a host they
// control — the canonical bypass being "*.acme.com" admitting
// "www.acme.com.evil.com". Each row supplies its own allow-list and a single
// origin; wantOrigin is the expected Access-Control-Allow-Origin, where "" means
// the origin must be denied and a non-empty value must equal the reflected
// origin. AllowCredentials stays on throughout to prove anchored globs are valid
// alongside credentials.
func TestCORSWildcardOrigins(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		allowed []string
		origin  string
		// wantOrigin is the expected Access-Control-Allow-Origin: "" denies,
		// otherwise the origin is reflected verbatim.
		wantOrigin string
	}{
		// Legitimate matches against a realistic mixed allow-list.
		{
			name:       "exact_literal_match",
			allowed:    []string{"http://localhost:3000"},
			origin:     "http://localhost:3000",
			wantOrigin: "http://localhost:3000",
		},
		{
			name:       "exact_with_port_match",
			allowed:    []string{"https://local.dashboard.local.nhost.run:8099"},
			origin:     "https://local.dashboard.local.nhost.run:8099",
			wantOrigin: "https://local.dashboard.local.nhost.run:8099",
		},
		{
			name:       "interior_wildcard_match",
			allowed:    []string{"https://dashboard-staging-*-nhost.vercel.app"},
			origin:     "https://dashboard-staging-pr42-nhost.vercel.app",
			wantOrigin: "https://dashboard-staging-pr42-nhost.vercel.app",
		},
		{
			name:       "interior_wildcard_empty_run_match",
			allowed:    []string{"https://dashboard-staging-*-nhost.vercel.app"},
			origin:     "https://dashboard-staging--nhost.vercel.app",
			wantOrigin: "https://dashboard-staging--nhost.vercel.app",
		},
		{
			name:       "leading_subdomain_wildcard_match",
			allowed:    []string{"https://*.preview.example.com"},
			origin:     "https://app.preview.example.com",
			wantOrigin: "https://app.preview.example.com",
		},
		{
			name:       "host_wildcard_matches_multi_label_subdomain",
			allowed:    []string{"*.acme.com"},
			origin:     "a.b.acme.com",
			wantOrigin: "a.b.acme.com",
		},
		{
			name:       "host_wildcard_matches_empty_run",
			allowed:    []string{"*.acme.com"},
			origin:     ".acme.com",
			wantOrigin: ".acme.com",
		},
		// Bypass attempts: appending an attacker-controlled host past the
		// anchored suffix.
		{
			name:       "append_after_suffix_denied",
			allowed:    []string{"*.acme.com"},
			origin:     "www.acme.com.evil.com",
			wantOrigin: "",
		},
		{
			name:       "suffix_not_at_end_denied",
			allowed:    []string{"*.acme.com"},
			origin:     "acme.com.evil.com",
			wantOrigin: "",
		},
		{
			name:       "append_with_port_denied",
			allowed:    []string{"*.acme.com"},
			origin:     "www.acme.com.evil.com:443",
			wantOrigin: "",
		},
		{
			name:       "missing_separator_dot_denied",
			allowed:    []string{"*.acme.com"},
			origin:     "evilacme.com",
			wantOrigin: "",
		},
		{
			name:       "unrelated_host_denied",
			allowed:    []string{"*.acme.com"},
			origin:     "evil.com",
			wantOrigin: "",
		},
		{
			name:       "newline_smuggling_denied",
			allowed:    []string{"*.acme.com"},
			origin:     "www.acme.com\n.evil.com",
			wantOrigin: "",
		},
		// Bypass attempts against a scheme-anchored host pattern.
		{
			name:       "scheme_anchored_append_denied",
			allowed:    []string{"https://*.acme.com"},
			origin:     "https://www.acme.com.evil.com",
			wantOrigin: "",
		},
		{
			name:       "scheme_mismatch_denied",
			allowed:    []string{"https://*.acme.com"},
			origin:     "http://www.acme.com",
			wantOrigin: "",
		},
		{
			name:       "path_smuggled_suffix_denied",
			allowed:    []string{"https://*.acme.com"},
			origin:     "https://evil.com/https://www.acme.com",
			wantOrigin: "",
		},
		{
			name:       "truncated_scheme_prefix_denied",
			allowed:    []string{"https://*.acme.com"},
			origin:     "ttps://www.acme.com",
			wantOrigin: "",
		},
		{
			name:       "scheme_anchored_legit_match",
			allowed:    []string{"https://*.acme.com"},
			origin:     "https://staging.app.acme.com",
			wantOrigin: "https://staging.app.acme.com",
		},
		// Bypass attempts against the interior-wildcard pattern.
		{
			name:       "interior_append_denied",
			allowed:    []string{"https://dashboard-staging-*-nhost.vercel.app"},
			origin:     "https://dashboard-staging-x-nhost.vercel.app.evil.com",
			wantOrigin: "",
		},
		{
			name:       "interior_prepend_denied",
			allowed:    []string{"https://dashboard-staging-*-nhost.vercel.app"},
			origin:     "https://evil.com-dashboard-staging-x-nhost.vercel.app",
			wantOrigin: "",
		},
		{
			name:       "interior_trailing_junk_denied",
			allowed:    []string{"https://dashboard-staging-*-nhost.vercel.app"},
			origin:     "https://dashboard-staging-x-nhost.vercel.app/../evil",
			wantOrigin: "",
		},
		{
			name:       "prefix_is_case_sensitive_denied",
			allowed:    []string{"https://dashboard-staging-*-nhost.vercel.app"},
			origin:     "https://DASHBOARD-staging-x-nhost.vercel.app",
			wantOrigin: "",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			opts := middleware.CORSOptions{
				AllowedOrigins:   tc.allowed,
				AllowedMethods:   []string{"GET"},
				AllowCredentials: true,
			}

			rec, _ := runCORS(t, opts, http.MethodGet, tc.origin, "")
			if got := rec.Header().Get("Access-Control-Allow-Origin"); got != tc.wantOrigin {
				t.Errorf("Access-Control-Allow-Origin: got %q, want %q", got, tc.wantOrigin)
			}
		})
	}
}

func TestCORSEmptyOriginsDenyAllCrossOrigin(t *testing.T) {
	t.Parallel()

	opts := middleware.CORSOptions{
		AllowedOrigins:   []string{},
		AllowedMethods:   []string{"GET"},
		AllowCredentials: true,
	}

	rec, called := runCORS(t, opts, http.MethodGet, "https://evil.example", "")

	if !called {
		t.Fatal("downstream handler should still run for a same-method actual request")
	}

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Access-Control-Allow-Origin must be empty for an empty allow-list, got %q", got)
	}

	if got := rec.Header().Get("Access-Control-Allow-Credentials"); got != "" {
		t.Errorf(
			"Access-Control-Allow-Credentials must not be set when origin is denied, got %q",
			got,
		)
	}
}

func TestCORSVaryHeaderOnBothPaths(t *testing.T) {
	t.Parallel()

	opts := middleware.CORSOptions{
		AllowedOrigins: []string{"https://example.com"},
		AllowedMethods: []string{"GET"},
	}

	// Preflight.
	rec, _ := runCORS(t, opts, http.MethodOptions, "https://example.com", "")
	if got := rec.Header().Get("Vary"); !strings.Contains(got, "Origin") ||
		!strings.Contains(got, "Access-Control-Request-Method") {
		t.Errorf("preflight Vary: got %q", got)
	}

	// Actual request.
	rec, _ = runCORS(t, opts, http.MethodGet, "https://example.com", "")
	if got := rec.Header().Get("Vary"); !strings.Contains(got, "Origin") ||
		!strings.Contains(got, "Access-Control-Request-Method") {
		t.Errorf("actual-request Vary: got %q", got)
	}
}

// TestCORSPreflightWithoutOriginEmitsNoCORSHeaders pins the origin != "" guard
// in CORS: a preflight that omits the Origin header must not receive any
// Access-Control-* response headers, even under an allow-all configuration where
// originAllowed("") would otherwise return true. The allow-all row fails if that
// guard is removed; Allow-Methods and Allow-Credentials are non-empty and would
// leak, whereas an empty Allow-Origin is dropped by Gin and would not surface.
func TestCORSPreflightWithoutOriginEmitsNoCORSHeaders(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name             string
		opts             middleware.CORSOptions
		wantHeadersEmpty []string
	}{
		{
			name: "explicit_allow_list",
			opts: middleware.CORSOptions{
				AllowedOrigins: []string{"https://example.com"},
				AllowedMethods: []string{"GET"},
			},
			wantHeadersEmpty: []string{"Access-Control-Allow-Origin"},
		},
		{
			name: "allow_all_nil_origins",
			opts: middleware.CORSOptions{
				AllowedOrigins: nil,
				AllowedMethods: []string{"GET"},
			},
			wantHeadersEmpty: []string{
				"Access-Control-Allow-Origin",
				"Access-Control-Allow-Methods",
				"Access-Control-Allow-Credentials",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			rec, called := runCORS(t, tc.opts, http.MethodOptions, "", "")

			if called {
				t.Fatal("downstream handler must not run for a preflight request")
			}

			if rec.Code != http.StatusNoContent {
				t.Errorf("status: got %d, want %d", rec.Code, http.StatusNoContent)
			}

			for _, header := range tc.wantHeadersEmpty {
				if got := rec.Header().Get(header); got != "" {
					t.Errorf("%s must be empty, got %q", header, got)
				}
			}
		})
	}
}

// TestCORSMaxAge pins the cfg.maxAge != "" guard in applyHeaders: an empty MaxAge
// must omit the Access-Control-Max-Age header entirely rather than emit it with
// an empty value. The "set" row is duplicated from TestCORS to keep the absence
// assertion self-contained; the "unset" row is the one TestCORS cannot express,
// because its subset header comparison never asserts a header is absent.
func TestCORSMaxAge(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		maxAge  string
		wantSet bool
	}{
		{name: "set", maxAge: "600", wantSet: true},
		{name: "unset", maxAge: "", wantSet: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			opts := middleware.CORSOptions{
				AllowedOrigins: []string{"https://example.com"},
				AllowedMethods: []string{"GET"},
				MaxAge:         tc.maxAge,
			}

			rec, _ := runCORS(t, opts, http.MethodOptions, "https://example.com", "")

			_, present := rec.Header()["Access-Control-Max-Age"]
			if present != tc.wantSet {
				t.Errorf("Max-Age presence: got %v, want %v", present, tc.wantSet)
			}

			if tc.wantSet {
				if got := rec.Header().Get("Access-Control-Max-Age"); got != tc.maxAge {
					t.Errorf("Max-Age: got %q, want %q", got, tc.maxAge)
				}
			}
		})
	}
}

// TestCORSExposedHeaders pins the cfg.exposedHeaders != "" guard in applyHeaders.
// Both a nil and an empty non-nil ExposedHeaders join to "" and must omit
// Access-Control-Expose-Headers; only a non-empty list emits it. The two absence
// rows are unpinned by TestCORS, whose subset comparison cannot assert a header
// is missing.
func TestCORSExposedHeaders(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		exposed []string
		want    string
		wantSet bool
	}{
		{name: "set", exposed: []string{"X-One", "X-Two"}, want: "X-One, X-Two", wantSet: true},
		{name: "unset_nil", exposed: nil, want: "", wantSet: false},
		{name: "unset_empty", exposed: []string{}, want: "", wantSet: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			opts := middleware.CORSOptions{
				AllowedOrigins: []string{"https://example.com"},
				AllowedMethods: []string{"GET"},
				ExposedHeaders: tc.exposed,
			}

			rec, _ := runCORS(t, opts, http.MethodGet, "https://example.com", "")

			_, present := rec.Header()["Access-Control-Expose-Headers"]
			if present != tc.wantSet {
				t.Errorf("Expose-Headers presence: got %v, want %v", present, tc.wantSet)
			}

			if got := rec.Header().Get("Access-Control-Expose-Headers"); got != tc.want {
				t.Errorf("Expose-Headers: got %q, want %q", got, tc.want)
			}
		})
	}
}

// TestCORSHeaderStrategyReflect pins the reflect strategy (AllowedHeaders nil,
// no AllowHeadersFunc): it reflects Access-Control-Request-Headers when present
// but must omit Access-Control-Allow-Headers when that request header is empty or
// missing, exercising the headers != "" guard in the headerReflect branch of
// applyHeaders. TestCORS exercises the populated-request case but cannot pin the
// empty-request absence under subset comparison, and TestCORSAllowHeadersFunc
// covers only the headerFiltered branch.
func TestCORSHeaderStrategyReflect(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name          string
		requestHeader string
		wantACAH      string
		wantPresent   bool
	}{
		{
			name:          "reflect_nil_populated_request_header",
			requestHeader: "X-Foo, X-Bar",
			wantACAH:      "X-Foo, X-Bar",
			wantPresent:   true,
		},
		{
			name:          "reflect_nil_empty_request_header",
			requestHeader: "",
			wantACAH:      "",
			wantPresent:   false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			opts := middleware.CORSOptions{
				AllowedOrigins: []string{"https://example.com"},
				AllowedMethods: []string{"GET"},
				AllowedHeaders: nil,
			}

			rec, _ := runCORS(
				t,
				opts,
				http.MethodOptions,
				"https://example.com",
				tc.requestHeader,
			)

			got := rec.Header().Get("Access-Control-Allow-Headers")

			_, present := rec.Header()["Access-Control-Allow-Headers"]
			if present != tc.wantPresent {
				t.Errorf("ACAH presence: got %v, want %v (value %q)", present, tc.wantPresent, got)
			}

			if got != tc.wantACAH {
				t.Errorf("ACAH: got %q, want %q", got, tc.wantACAH)
			}
		})
	}
}

package cors_test

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/constellation/internal/lib/oapi/cors"
)

func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)
	os.Exit(m.Run())
}

// runCORS dispatches a single request through the CORS middleware and an
// optional downstream handler. It returns the ResponseRecorder and a flag
// indicating whether the downstream handler was invoked.
func runCORS(
	t *testing.T,
	opts cors.Options,
	method, origin string,
	requestHeaders string,
) (*httptest.ResponseRecorder, bool) {
	t.Helper()

	rec := httptest.NewRecorder()
	c, engine := gin.CreateTestContext(rec)

	called := false

	handler, err := cors.CORS(opts)
	if err != nil {
		t.Fatalf("cors.CORS: unexpected error: %v", err)
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

	c.Request = req
	engine.ServeHTTP(rec, req)

	return rec, called
}

func TestCORS(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name             string
		opts             cors.Options
		method           string
		origin           string
		wantCalled       bool
		wantStatus       int
		wantHeaders      map[string]string
		wantHeadersEmpty []string
		wantVaryContains string
	}{
		{
			name: "preflight",
			opts: cors.Options{
				AllowedOrigins:   []string{"https://example.com"},
				AllowedMethods:   []string{"GET", "POST"},
				AllowedHeaders:   []string{"Content-Type"},
				ExposedHeaders:   nil,
				AllowCredentials: true,
				MaxAge:           "3600",
			},
			method:     http.MethodOptions,
			origin:     "https://example.com",
			wantCalled: false,
			wantStatus: http.StatusNoContent,
			wantHeaders: map[string]string{
				"Access-Control-Allow-Origin":      "https://example.com",
				"Access-Control-Allow-Methods":     "GET, POST",
				"Access-Control-Allow-Headers":     "Content-Type",
				"Access-Control-Allow-Credentials": "true",
				"Access-Control-Max-Age":           "3600",
				"Content-Length":                   "0",
			},
			wantHeadersEmpty: nil,
			wantVaryContains: "Origin",
		},
		{
			name: "actual_request_allowed_origin",
			opts: cors.Options{
				AllowedOrigins:   []string{"https://example.com"},
				AllowedMethods:   []string{"GET"},
				AllowedHeaders:   []string{"X-Custom"},
				ExposedHeaders:   nil,
				AllowCredentials: false,
				MaxAge:           "",
			},
			method:     http.MethodGet,
			origin:     "https://example.com",
			wantCalled: true,
			wantStatus: http.StatusOK,
			wantHeaders: map[string]string{
				"Access-Control-Allow-Origin":      "https://example.com",
				"Access-Control-Allow-Credentials": "false",
			},
			wantHeadersEmpty: nil,
			wantVaryContains: "Origin",
		},
		{
			name: "disallowed_origin",
			opts: cors.Options{
				AllowedOrigins:   []string{"https://example.com"},
				AllowedMethods:   []string{"GET"},
				AllowedHeaders:   nil,
				ExposedHeaders:   nil,
				AllowCredentials: false,
				MaxAge:           "",
			},
			method:      http.MethodGet,
			origin:      "https://evil.com",
			wantCalled:  true,
			wantStatus:  http.StatusOK,
			wantHeaders: nil,
			wantHeadersEmpty: []string{
				"Access-Control-Allow-Origin",
				"Access-Control-Allow-Methods",
			},
			wantVaryContains: "",
		},
		{
			name: "wildcard_origin",
			opts: cors.Options{
				AllowedOrigins:   []string{"*"},
				AllowedMethods:   []string{"GET"},
				AllowedHeaders:   nil,
				ExposedHeaders:   nil,
				AllowCredentials: false,
				MaxAge:           "",
			},
			method:     http.MethodGet,
			origin:     "https://any.example",
			wantCalled: true,
			wantStatus: http.StatusOK,
			wantHeaders: map[string]string{
				"Access-Control-Allow-Origin": "https://any.example",
			},
			wantHeadersEmpty: nil,
			wantVaryContains: "Origin",
		},
		{
			name: "no_origin_actual_request",
			opts: cors.Options{
				AllowedOrigins:   []string{"https://example.com"},
				AllowedMethods:   []string{"GET"},
				AllowedHeaders:   nil,
				ExposedHeaders:   nil,
				AllowCredentials: false,
				MaxAge:           "",
			},
			method:      http.MethodGet,
			origin:      "",
			wantCalled:  true,
			wantStatus:  http.StatusOK,
			wantHeaders: nil,
			wantHeadersEmpty: []string{
				"Access-Control-Allow-Origin",
			},
			wantVaryContains: "",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			rec, called := runCORS(t, tc.opts, tc.method, tc.origin, "")

			if called != tc.wantCalled {
				t.Fatalf("downstream handler called: got %v, want %v", called, tc.wantCalled)
			}

			if tc.wantStatus != 0 && rec.Code != tc.wantStatus {
				t.Errorf("status: got %d, want %d", rec.Code, tc.wantStatus)
			}

			for header, want := range tc.wantHeaders {
				if got := rec.Header().Get(header); got != want {
					t.Errorf("%s: got %q, want %q", header, got, want)
				}
			}

			for _, header := range tc.wantHeadersEmpty {
				if got := rec.Header().Get(header); got != "" {
					t.Errorf("%s must be empty, got %q", header, got)
				}
			}

			if tc.wantVaryContains != "" {
				if got := rec.Header().Get("Vary"); !strings.Contains(got, tc.wantVaryContains) {
					t.Errorf("Vary missing %q: got %q", tc.wantVaryContains, got)
				}
			}
		})
	}
}

func TestCORSHeaderStrategies(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name           string
		allowedHeaders []string
		requestHeader  string
		wantACAH       string
		wantPresent    bool
	}{
		{
			name:           "reflect_nil",
			allowedHeaders: nil,
			requestHeader:  "X-Foo, X-Bar",
			wantACAH:       "X-Foo, X-Bar",
			wantPresent:    true,
		},
		{
			name:           "reflect_nil_empty_request_header",
			allowedHeaders: nil,
			requestHeader:  "",
			wantACAH:       "",
			wantPresent:    false,
		},
		{
			name:           "deny_empty",
			allowedHeaders: []string{},
			requestHeader:  "X-Foo",
			wantACAH:       "",
			wantPresent:    false,
		},
		{
			name:           "specific",
			allowedHeaders: []string{"X-Allowed", "Content-Type"},
			requestHeader:  "X-Foo",
			wantACAH:       "X-Allowed, Content-Type",
			wantPresent:    true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			opts := cors.Options{
				AllowedOrigins:   []string{"https://example.com"},
				AllowedMethods:   []string{"GET"},
				AllowedHeaders:   tc.allowedHeaders,
				ExposedHeaders:   nil,
				AllowCredentials: false,
				MaxAge:           "",
			}

			rec, _ := runCORS(t, opts, http.MethodOptions, "https://example.com", tc.requestHeader)

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

func TestCORSAllowCredentials(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name  string
		creds bool
		want  string
	}{
		{name: "true", creds: true, want: "true"},
		{name: "false", creds: false, want: "false"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			opts := cors.Options{
				AllowedOrigins:   []string{"https://example.com"},
				AllowedMethods:   []string{"GET"},
				AllowedHeaders:   nil,
				ExposedHeaders:   nil,
				AllowCredentials: tc.creds,
				MaxAge:           "",
			}

			rec, _ := runCORS(t, opts, http.MethodGet, "https://example.com", "")
			if got := rec.Header().Get("Access-Control-Allow-Credentials"); got != tc.want {
				t.Errorf("ACAC: got %q, want %q", got, tc.want)
			}
		})
	}
}

func TestCORSMaxAge(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name    string
		maxAge  string
		wantSet bool
	}{
		{name: "set", maxAge: "600", wantSet: true},
		{name: "unset", maxAge: "", wantSet: false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			opts := cors.Options{
				AllowedOrigins:   []string{"https://example.com"},
				AllowedMethods:   []string{"GET"},
				AllowedHeaders:   nil,
				ExposedHeaders:   nil,
				AllowCredentials: false,
				MaxAge:           tc.maxAge,
			}

			rec, _ := runCORS(t, opts, http.MethodOptions, "https://example.com", "")

			_, present := rec.Header()["Access-Control-Max-Age"]
			if present != tc.wantSet {
				t.Errorf("Max-Age presence: got %v, want %v", present, tc.wantSet)
			}

			if tc.wantSet && rec.Header().Get("Access-Control-Max-Age") != tc.maxAge {
				t.Errorf(
					"Max-Age: got %q, want %q",
					rec.Header().Get("Access-Control-Max-Age"),
					tc.maxAge,
				)
			}
		})
	}
}

func TestCORSExposedHeaders(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name    string
		exposed []string
		want    string
		wantSet bool
	}{
		{name: "set", exposed: []string{"X-One", "X-Two"}, want: "X-One, X-Two", wantSet: true},
		{name: "unset_nil", exposed: nil, want: "", wantSet: false},
		{name: "unset_empty", exposed: []string{}, want: "", wantSet: false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			opts := cors.Options{
				AllowedOrigins:   []string{"https://example.com"},
				AllowedMethods:   []string{"GET"},
				AllowedHeaders:   nil,
				ExposedHeaders:   tc.exposed,
				AllowCredentials: false,
				MaxAge:           "",
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

func TestCORSAllowOriginFunc(t *testing.T) {
	t.Parallel()

	suffixAllowed := func(origin string) bool {
		return strings.HasSuffix(origin, ".example.com")
	}

	for _, tc := range []struct {
		name       string
		opts       cors.Options
		origin     string
		wantOrigin string
	}{
		{
			name: "func_accepts_matching_origin",
			opts: cors.Options{
				AllowOriginFunc:  suffixAllowed,
				AllowedOrigins:   nil,
				AllowedMethods:   []string{"GET"},
				AllowedHeaders:   nil,
				ExposedHeaders:   nil,
				AllowCredentials: false,
				MaxAge:           "",
			},
			origin:     "https://app.example.com",
			wantOrigin: "https://app.example.com",
		},
		{
			name: "func_rejects_non_matching_origin",
			opts: cors.Options{
				AllowOriginFunc:  suffixAllowed,
				AllowedOrigins:   nil,
				AllowedMethods:   []string{"GET"},
				AllowedHeaders:   nil,
				ExposedHeaders:   nil,
				AllowCredentials: false,
				MaxAge:           "",
			},
			origin:     "https://malicious.com",
			wantOrigin: "",
		},
		{
			name: "func_takes_precedence_over_allowed_origins",
			opts: cors.Options{
				// AllowedOrigins would deny everything, but AllowOriginFunc accepts.
				AllowOriginFunc:  func(string) bool { return true },
				AllowedOrigins:   []string{"https://different.com"},
				AllowedMethods:   []string{"GET"},
				AllowedHeaders:   nil,
				ExposedHeaders:   nil,
				AllowCredentials: false,
				MaxAge:           "",
			},
			origin:     "https://anything.com",
			wantOrigin: "https://anything.com",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			rec, _ := runCORS(t, tc.opts, http.MethodGet, tc.origin, "")
			if got := rec.Header().Get("Access-Control-Allow-Origin"); got != tc.wantOrigin {
				t.Errorf("Access-Control-Allow-Origin: got %q, want %q", got, tc.wantOrigin)
			}
		})
	}
}

func TestCORSOptionsValidate(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name    string
		opts    cors.Options
		wantErr error
	}{
		{
			name: "wildcard_with_credentials_rejected",
			opts: cors.Options{
				AllowedOrigins:   []string{"*"},
				AllowedMethods:   []string{"GET"},
				AllowedHeaders:   nil,
				ExposedHeaders:   nil,
				AllowCredentials: true,
				MaxAge:           "",
			},
			wantErr: cors.ErrWildcardWithCredentials,
		},
		{
			name: "wildcard_among_others_with_credentials_rejected",
			opts: cors.Options{
				AllowedOrigins:   []string{"https://example.com", "*"},
				AllowedMethods:   []string{"GET"},
				AllowedHeaders:   nil,
				ExposedHeaders:   nil,
				AllowCredentials: true,
				MaxAge:           "",
			},
			wantErr: cors.ErrWildcardWithCredentials,
		},
		{
			name: "wildcard_without_credentials_ok",
			opts: cors.Options{
				AllowedOrigins:   []string{"*"},
				AllowedMethods:   []string{"GET"},
				AllowedHeaders:   nil,
				ExposedHeaders:   nil,
				AllowCredentials: false,
				MaxAge:           "",
			},
			wantErr: nil,
		},
		{
			name: "explicit_origins_with_credentials_ok",
			opts: cors.Options{
				AllowedOrigins:   []string{"https://example.com"},
				AllowedMethods:   []string{"GET"},
				AllowedHeaders:   nil,
				ExposedHeaders:   nil,
				AllowCredentials: true,
				MaxAge:           "",
			},
			wantErr: nil,
		},
		{
			name: "empty_origins_with_credentials_ok",
			opts: cors.Options{
				AllowedOrigins:   []string{},
				AllowedMethods:   []string{"GET"},
				AllowedHeaders:   nil,
				ExposedHeaders:   nil,
				AllowCredentials: true,
				MaxAge:           "",
			},
			wantErr: nil,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			err := tc.opts.Validate()
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("Validate: got %v, want %v", err, tc.wantErr)
			}
		})
	}
}

func TestCORSFailsClosedOnWildcardWithCredentials(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name    string
		opts    cors.Options
		wantErr error
	}{
		{
			name: "wildcard_with_credentials_rejected",
			opts: cors.Options{
				AllowOriginFunc:  nil,
				AllowedOrigins:   []string{"*"},
				AllowedMethods:   []string{"GET"},
				AllowedHeaders:   nil,
				ExposedHeaders:   nil,
				AllowCredentials: true,
				MaxAge:           "",
			},
			wantErr: cors.ErrWildcardWithCredentials,
		},
		{
			name: "wildcard_among_others_with_credentials_rejected",
			opts: cors.Options{
				AllowOriginFunc:  nil,
				AllowedOrigins:   []string{"https://example.com", "*"},
				AllowedMethods:   []string{"GET"},
				AllowedHeaders:   nil,
				ExposedHeaders:   nil,
				AllowCredentials: true,
				MaxAge:           "",
			},
			wantErr: cors.ErrWildcardWithCredentials,
		},
		{
			name: "explicit_origins_with_credentials_ok",
			opts: cors.Options{
				AllowOriginFunc:  nil,
				AllowedOrigins:   []string{"https://example.com"},
				AllowedMethods:   []string{"GET"},
				AllowedHeaders:   nil,
				ExposedHeaders:   nil,
				AllowCredentials: true,
				MaxAge:           "",
			},
			wantErr: nil,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			handler, err := cors.CORS(tc.opts)
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("cors.CORS error: got %v, want %v", err, tc.wantErr)
			}

			if tc.wantErr != nil && handler != nil {
				t.Fatal("cors.CORS must return a nil handler when it fails closed")
			}

			if tc.wantErr == nil && handler == nil {
				t.Fatal("cors.CORS must return a handler for a valid configuration")
			}
		})
	}
}

func TestCORSEmptyOriginsDenyAllCrossOrigin(t *testing.T) {
	t.Parallel()

	opts := cors.Options{
		AllowedOrigins:   []string{},
		AllowedMethods:   []string{"GET"},
		AllowedHeaders:   nil,
		ExposedHeaders:   nil,
		AllowCredentials: true,
		MaxAge:           "",
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

	opts := cors.Options{
		AllowedOrigins:   []string{"https://example.com"},
		AllowedMethods:   []string{"GET"},
		AllowedHeaders:   nil,
		ExposedHeaders:   nil,
		AllowCredentials: false,
		MaxAge:           "",
	}

	// Preflight
	rec, _ := runCORS(t, opts, http.MethodOptions, "https://example.com", "")
	if got := rec.Header().Get("Vary"); !strings.Contains(got, "Origin") ||
		!strings.Contains(got, "Access-Control-Request-Method") {
		t.Errorf("preflight Vary: got %q", got)
	}

	// Actual
	rec, _ = runCORS(t, opts, http.MethodGet, "https://example.com", "")
	if got := rec.Header().Get("Vary"); !strings.Contains(got, "Origin") ||
		!strings.Contains(got, "Access-Control-Request-Method") {
		t.Errorf("actual-request Vary: got %q", got)
	}
}

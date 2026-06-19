package controller

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/gin-gonic/gin"
	gojwt "github.com/golang-jwt/jwt/v5"
	sharedoapi "github.com/nhost/nhost/internal/lib/oapi"
	"github.com/nhost/nhost/services/constellation/api"
	"github.com/nhost/nhost/services/constellation/controller/middleware"
	"github.com/nhost/nhost/services/constellation/internal/jwt"
	"github.com/nhost/nhost/services/constellation/internal/jwt/jwtconfig"
	"github.com/nhost/nhost/services/constellation/metadata"
)

const testHMACKey = "test-secret-key-for-security-tests-32b"

func buildMetadataRouterWithJWTAuth(
	t *testing.T,
	proxy http.Handler,
	source metadata.Source,
	jwtAuth middleware.JWTAuthenticator,
) http.Handler {
	t.Helper()
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.ContextWithFallback = true

	router.Use(middleware.Session(testAdminSecret, jwtAuth))

	ctrl := &Controller{
		adminSecret: testAdminSecret,
		hasuraProxy: proxy,
		source:      source,
		version:     "test",
	}

	spec, err := api.GetSpec()
	if err != nil {
		t.Fatalf("loading embedded spec: %v", err)
	}

	validatorMW := testOpenAPIValidator(t, spec)

	handler := api.NewStrictHandler(ctrl, nil)
	api.RegisterHandlersWithOptions(router, handler, api.GinServerOptions{
		BaseURL: "",
		Middlewares: []api.MiddlewareFunc{
			api.MiddlewareFunc(NewCaptureRawBody(testMetadataBodyCap)),
			api.MiddlewareFunc(validatorMW),
		},
		ErrorHandler: nil,
	})

	return router
}

func testJWTAuthenticator(t *testing.T) *jwt.Authenticator {
	t.Helper()

	cfg := jwtconfig.Config{
		Secrets: []jwtconfig.Secret{
			{Type: jwtconfig.AlgorithmHS256, Key: testHMACKey},
		},
	}

	auth, err := jwt.NewAuthenticator(context.Background(), cfg, slog.Default())
	if err != nil {
		t.Fatalf("creating JWT authenticator: %v", err)
	}

	t.Cleanup(auth.Close)

	return auth
}

func signAdminJWT(t *testing.T) string {
	t.Helper()

	claims := gojwt.MapClaims{
		"sub": "user-1",
		"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
		"https://hasura.io/jwt/claims": map[string]any{
			"x-hasura-allowed-roles": []any{"admin"},
			"x-hasura-default-role":  "admin",
		},
	}

	tok := gojwt.NewWithClaims(gojwt.SigningMethodHS256, claims)

	signed, err := tok.SignedString([]byte(testHMACKey))
	if err != nil {
		t.Fatalf("signing JWT: %v", err)
	}

	return signed
}

// TestAdminSecretSchemeRejectsJWTWithAdminDefaultRole is the regression for B1:
// a JWT whose default-role claim is "admin" resolves to Role="admin" but
// must NOT satisfy the AdminSecret OpenAPI security scheme. The credential
// source matters, not the resolved role.
func TestAdminSecretSchemeRejectsJWTWithAdminDefaultRole(t *testing.T) {
	t.Parallel()

	router := buildMetadataRouterWithJWTAuth(
		t, nil,
		&stubMetadataSource{hasura: []byte(`{"version":3,"sources":[]}`), version: 1},
		testJWTAuthenticator(t),
	)

	req := httptest.NewRequest(
		http.MethodPost, "/v1/metadata",
		strings.NewReader(`{"type":"export_metadata","args":{}}`),
	)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+signAdminJWT(t))

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf(
			"JWT with default-role=admin must not satisfy AdminSecret scheme: status = %d, body = %s",
			rec.Code,
			rec.Body.String(),
		)
	}
}

// TestAdminSecretSchemeAcceptsAdminSecretWithRoleOverride is the second leg
// of B1: a valid admin secret + X-Hasura-Role: user resolves to a non-admin
// role, but the AdminSecret scheme must still pass because the credential
// presented was the admin secret. (Admin-secret holders may impersonate any
// role via X-Hasura-Role; that's a documented Hasura behaviour.)
func TestAdminSecretSchemeAcceptsAdminSecretWithRoleOverride(t *testing.T) {
	t.Parallel()

	router := buildMetadataRouterWithJWTAuth(
		t, nil,
		&stubMetadataSource{hasura: []byte(`{"version":3,"sources":[]}`), version: 1},
		middleware.NewNoOpJWTAuthenticator(),
	)

	req := httptest.NewRequest(
		http.MethodPost, "/v1/metadata",
		strings.NewReader(`{"type":"export_metadata","args":{}}`),
	)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)
	req.Header.Set("X-Hasura-Role", "user")

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf(
			"admin secret + role override must satisfy AdminSecret scheme: status = %d, body = %s",
			rec.Code, rec.Body.String(),
		)
	}
}

// TestMetadataAcceptsBulkArrayArgs is the regression for B2a: the metadata
// `bulk` op sends args as a JSON array, not an object. Spec-level validation
// of args as `type: object` would reject this before the proxy could forward.
func TestMetadataAcceptsBulkArrayArgs(t *testing.T) {
	t.Parallel()

	var gotBody []byte

	upstream := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			gotBody, _ = io.ReadAll(r.Body)

			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`[]`))
		},
	))
	defer upstream.Close()

	router := buildMetadataRouterWithJWTAuth(
		t, testReverseProxy(t, upstream.URL), nil,
		middleware.NewNoOpJWTAuthenticator(),
	)

	front := httptest.NewServer(router)
	defer front.Close()

	body := `{"type":"bulk","args":[]}`

	req, err := http.NewRequestWithContext(
		context.Background(), http.MethodPost,
		front.URL+"/v1/metadata", strings.NewReader(body),
	)
	if err != nil {
		t.Fatalf("building request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

	resp, err := front.Client().Do(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		t.Fatalf("status = %d; want 200, body = %s", resp.StatusCode, respBody)
	}

	if string(gotBody) != body {
		t.Errorf("upstream body = %q; want %q", gotBody, body)
	}
}

// TestMetadataExportProxiesWhenUpstreamConfigured is the regression for B3:
// when a Hasura upstream is configured, export_metadata must be proxied like
// every other op so the response reflects writes made through the proxy.
// Serving export_metadata from the cached snapshot here would return a
// stale resource_version, breaking the export→edit→replace cycle.
func TestMetadataExportProxiesWhenUpstreamConfigured(t *testing.T) {
	t.Parallel()

	var gotBody []byte

	upstream := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			gotBody, _ = io.ReadAll(r.Body)

			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write(
				[]byte(`{"resource_version":42,"metadata":{"version":3,"sources":[]}}`),
			)
		},
	))
	defer upstream.Close()

	// Source is also wired with an old snapshot to prove the proxy result is
	// returned, not the cached one.
	router := buildMetadataRouterWithJWTAuth(
		t, testReverseProxy(t, upstream.URL),
		&stubMetadataSource{
			hasura:  []byte(`{"version":3,"sources":[]}`),
			version: 1,
		},
		middleware.NewNoOpJWTAuthenticator(),
	)

	front := httptest.NewServer(router)
	defer front.Close()

	body := `{"type":"export_metadata","args":{}}`

	req, err := http.NewRequestWithContext(
		context.Background(), http.MethodPost,
		front.URL+"/v1/metadata", strings.NewReader(body),
	)
	if err != nil {
		t.Fatalf("building request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

	resp, err := front.Client().Do(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d; want 200, body = %s", resp.StatusCode, respBody)
	}

	if !strings.Contains(string(respBody), `"resource_version":42`) {
		t.Errorf(
			"export_metadata served stale snapshot instead of proxying: body = %s",
			respBody,
		)
	}

	if string(gotBody) != body {
		t.Errorf("upstream body = %q; want %q", gotBody, body)
	}
}

// TestMetadataAcceptsExportWithoutArgs is the regression for B2b: Hasura's
// `export_metadata` accepts a request with no `args` field. Requiring `args`
// in the schema rejected `{"type":"export_metadata"}` before the native
// handler could serve it.
func TestMetadataAcceptsExportWithoutArgs(t *testing.T) {
	t.Parallel()

	router := buildMetadataRouterWithJWTAuth(
		t, nil,
		&stubMetadataSource{
			hasura:  []byte(`{"version":3,"sources":[]}`),
			version: 1,
		},
		middleware.NewNoOpJWTAuthenticator(),
	)

	req := httptest.NewRequest(
		http.MethodPost, "/v1/metadata",
		strings.NewReader(`{"type":"export_metadata"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d; want 200, body = %s", rec.Code, rec.Body.String())
	}

	if !strings.Contains(rec.Body.String(), `"resource_version":1`) {
		t.Errorf("body %q missing resource_version", rec.Body.String())
	}
}

// sessionContext runs the production Session middleware on a synthetic
// request with the given headers and returns the resulting context.Context
// (which carries the resolved *SessionVariables under the unexported session
// key) wrapped with a *gin.Context under the sharedoapi.GinContextKey, the
// exact shape NewAuthFunc consumes in production.
func sessionContext(
	t *testing.T,
	adminSecret string,
	jwtAuth middleware.JWTAuthenticator,
	headers http.Header,
) context.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)

	req := httptest.NewRequest(http.MethodPost, "/v1/metadata", strings.NewReader("{}"))
	for k, vs := range headers {
		for _, v := range vs {
			req.Header.Add(k, v)
		}
	}

	rec := httptest.NewRecorder()
	ginCtx, _ := gin.CreateTestContext(rec)
	ginCtx.Request = req

	middleware.Session(adminSecret, jwtAuth)(ginCtx)

	if ginCtx.IsAborted() {
		t.Fatalf("Session middleware aborted unexpectedly (status %d)", rec.Code)
	}

	return context.WithValue(
		ginCtx.Request.Context(), sharedoapi.GinContextKey, ginCtx,
	)
}

// emptyGinContext returns a context that has a *gin.Context but no resolved
// session — i.e. NewAuthFunc was invoked without middleware.Session running
// first. Used to exercise the "no session resolved" branch.
func emptyGinContext(t *testing.T) context.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)

	rec := httptest.NewRecorder()
	ginCtx, _ := gin.CreateTestContext(rec)
	ginCtx.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	return context.WithValue(context.Background(), sharedoapi.GinContextKey, ginCtx)
}

// TestNewAuthFunc is a white-box unit test of the per-scheme decision the
// auth function makes. It calls NewAuthFunc() directly with hand-built
// *AuthenticationInput so each branch (AdminSecret, BearerAuth, unknown,
// nil-context, nil-session) is exercised without a full HTTP round-trip.
// Together with the existing integration-style tests, this completes B4's
// coverage requirement.
func TestNewAuthFunc(t *testing.T) {
	t.Parallel()

	const secret = "unit-admin-secret" //nolint:gosec // test-only constant, not a credential

	jwtAuth := testJWTAuthenticator(t)
	// signed once; the token claims default-role: admin so it would satisfy
	// the old role-based AdminSecret check (the B1 bug) and must NOT satisfy
	// the new credential-based one.
	adminJWT := signAdminJWT(t)

	cases := []struct {
		name       string
		scheme     string
		ctxFn      func(*testing.T) context.Context
		wantCode   string // "" = expect nil error
		wantMsgSub string // substring of AuthenticatorError.Message
	}{
		{
			name:       "nil gin context",
			scheme:     "AdminSecret",
			ctxFn:      func(*testing.T) context.Context { return context.Background() },
			wantCode:   "unauthorized",
			wantMsgSub: "no gin context",
		},
		{
			name:       "no session resolved",
			scheme:     "AdminSecret",
			ctxFn:      emptyGinContext,
			wantCode:   "unauthorized",
			wantMsgSub: "no session resolved",
		},
		{
			name:   "AdminSecret accepts admin-secret session",
			scheme: "AdminSecret",
			ctxFn: func(t *testing.T) context.Context {
				t.Helper()

				return sessionContext(t, secret, middleware.NewNoOpJWTAuthenticator(), http.Header{
					"X-Hasura-Admin-Secret": {secret},
				})
			},
			wantCode: "",
		},
		{
			name:   "AdminSecret accepts admin-secret + role override",
			scheme: "AdminSecret",
			ctxFn: func(t *testing.T) context.Context {
				t.Helper()

				return sessionContext(t, secret, middleware.NewNoOpJWTAuthenticator(), http.Header{
					"X-Hasura-Admin-Secret": {secret},
					"X-Hasura-Role":         {"user"},
				})
			},
			wantCode: "",
		},
		{
			name:   "AdminSecret rejects JWT with default-role admin",
			scheme: "AdminSecret",
			ctxFn: func(t *testing.T) context.Context {
				t.Helper()

				return sessionContext(t, secret, jwtAuth, http.Header{
					"Authorization": {"Bearer " + adminJWT},
				})
			},
			wantCode:   "unauthorized",
			wantMsgSub: "admin secret required",
		},
		{
			name:   "AdminSecret rejects public session",
			scheme: "AdminSecret",
			ctxFn: func(t *testing.T) context.Context {
				t.Helper()

				return sessionContext(
					t,
					secret,
					middleware.NewNoOpJWTAuthenticator(),
					http.Header{},
				)
			},
			wantCode:   "unauthorized",
			wantMsgSub: "admin secret required",
		},
		{
			name:   "BearerAuth accepts JWT-authenticated session",
			scheme: "BearerAuth",
			ctxFn: func(t *testing.T) context.Context {
				t.Helper()

				return sessionContext(t, "", jwtAuth, http.Header{
					"Authorization": {"Bearer " + adminJWT},
				})
			},
			wantCode: "",
		},
		{
			name:   "BearerAuth accepts admin-secret session",
			scheme: "BearerAuth",
			ctxFn: func(t *testing.T) context.Context {
				t.Helper()

				return sessionContext(t, secret, middleware.NewNoOpJWTAuthenticator(), http.Header{
					"X-Hasura-Admin-Secret": {secret},
				})
			},
			wantCode: "",
		},
		{
			name:   "BearerAuth rejects public session",
			scheme: "BearerAuth",
			ctxFn: func(t *testing.T) context.Context {
				t.Helper()

				return sessionContext(
					t,
					secret,
					middleware.NewNoOpJWTAuthenticator(),
					http.Header{},
				)
			},
			wantCode:   "unauthorized",
			wantMsgSub: "authenticated session required",
		},
		{
			name:   "unknown scheme denies",
			scheme: "MysteryScheme",
			ctxFn: func(t *testing.T) context.Context {
				t.Helper()

				return sessionContext(t, secret, middleware.NewNoOpJWTAuthenticator(), http.Header{
					"X-Hasura-Admin-Secret": {secret},
				})
			},
			wantCode:   "unauthorized",
			wantMsgSub: "unsupported security scheme",
		},
	}

	auth := NewAuthFunc()

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			input := &openapi3filter.AuthenticationInput{
				SecuritySchemeName: tc.scheme,
			}

			err := auth(tc.ctxFn(t), input)

			if tc.wantCode == "" {
				if err != nil {
					t.Fatalf("expected nil error, got %v", err)
				}

				return
			}

			var authErr *sharedoapi.AuthenticatorError
			if !errors.As(err, &authErr) {
				t.Fatalf("expected *AuthenticatorError, got %T: %v", err, err)
			}

			if authErr.Code != tc.wantCode {
				t.Errorf("Code = %q; want %q", authErr.Code, tc.wantCode)
			}

			if authErr.Scheme != tc.scheme {
				t.Errorf("Scheme = %q; want %q", authErr.Scheme, tc.scheme)
			}

			if !strings.Contains(authErr.Message, tc.wantMsgSub) {
				t.Errorf("Message = %q; want substring %q", authErr.Message, tc.wantMsgSub)
			}
		})
	}
}

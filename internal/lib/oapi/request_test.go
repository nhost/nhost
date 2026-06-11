package oapi_test

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/internal/lib/oapi"
	"github.com/nhost/nhost/internal/lib/oapi/middleware"
)

// minimalSpec exercises every validator branch the unit tests below probe: a
// path with no security (validation-only), a path requiring the FakeAuth scheme
// (auth-only), a path requiring a JSON body with a required field (body-shape
// error), and an anonymous-allowed path.
const minimalSpec = `
openapi: 3.0.0
info:
  title: test
  version: "0"
paths:
  /ping:
    get:
      operationId: ping
      responses:
        "200": { description: ok }
  /admin:
    get:
      operationId: admin
      security:
        - FakeAuth: []
      responses:
        "200": { description: ok }
  /anon-or-admin:
    get:
      operationId: anonOrAdmin
      security:
        - FakeAuth: []
        - {}
      responses:
        "200": { description: ok }
  /echo:
    post:
      operationId: echo
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name]
              properties:
                name: { type: string }
      responses:
        "200": { description: ok }
components:
  securitySchemes:
    FakeAuth:
      type: apiKey
      in: header
      name: X-Fake-Auth
`

func loadSpec(t *testing.T) *openapi3.T {
	t.Helper()

	doc, err := openapi3.NewLoader().LoadFromData([]byte(minimalSpec))
	if err != nil {
		t.Fatalf("loading spec: %v", err)
	}

	if err := doc.Validate(t.Context()); err != nil {
		t.Fatalf("validating spec: %v", err)
	}

	return doc
}

// newRouter mounts NewRouter's returned validator on every operation in the
// spec via a catch-all gin route, returning the engine and a handler that
// records that the downstream was reached. The validator runs first (engine
// middleware order), so a passing request triggers the recorder while a failing
// one short-circuits with the canonical error body before it.
func newRouter(
	t *testing.T,
	authFn openapi3filter.AuthenticationFunc,
) (*gin.Engine, *bool) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	router, validator, err := oapi.NewRouter(
		loadSpec(t),
		"",
		authFn,
		middleware.CORSOptions{
			AllowOriginFunc:                      nil,
			AllowedOrigins:                       []string{},
			AllowedMethods:                       []string{http.MethodGet, http.MethodPost},
			AllowHeadersFunc:                     nil,
			AllowedHeaders:                       nil,
			ExposedHeaders:                       nil,
			AllowCredentials:                     false,
			MaxAge:                               "",
			UnsafeAllowAllOriginsWithCredentials: false,
		},
		slog.Default(),
	)
	if err != nil {
		t.Fatalf("NewRouter: %v", err)
	}

	reached := false

	router.Use(validator)
	router.NoRoute(func(c *gin.Context) {
		reached = true

		c.Status(http.StatusOK)
	})

	return router, &reached
}

func do(
	t *testing.T,
	router http.Handler,
	method, path string,
	headers http.Header,
	body string,
) *httptest.ResponseRecorder {
	t.Helper()

	var bodyReader *strings.Reader
	if body != "" {
		bodyReader = strings.NewReader(body)
	}

	var req *http.Request
	if bodyReader != nil {
		req = httptest.NewRequest(method, path, bodyReader)
	} else {
		req = httptest.NewRequest(method, path, http.NoBody)
	}

	for k, vs := range headers {
		for _, v := range vs {
			req.Header.Add(k, v)
		}
	}

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	return rec
}

// TestNewRouterValidator_AllowsValidRequest is the happy path: a spec-valid
// request passes validation and reaches the downstream handler.
func TestNewRouterValidator_AllowsValidRequest(t *testing.T) {
	t.Parallel()

	// /ping has no security block, so the AuthenticationFunc is never invoked.
	router, reached := newRouter(t, nil)

	rec := do(t, router, http.MethodGet, "/ping", nil, "")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d; want 200, body = %s", rec.Code, rec.Body.String())
	}

	if !*reached {
		t.Fatal("downstream handler was not reached")
	}
}

// TestNewRouterValidator_AuthErrorShape is the auth-failure shape contract:
// when the AuthenticationFunc returns an *AuthenticatorError, the response must
// be 401 with {error, reason, securityScheme}.
func TestNewRouterValidator_AuthErrorShape(t *testing.T) {
	t.Parallel()

	authFn := func(_ context.Context, input *openapi3filter.AuthenticationInput) error {
		return &oapi.AuthenticatorError{
			Scheme:  input.SecuritySchemeName,
			Code:    "bad-credentials",
			Message: "key is wrong",
		}
	}

	router, reached := newRouter(t, authFn)

	rec := do(t, router, http.MethodGet, "/admin", nil, "")

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d; want 401, body = %s", rec.Code, rec.Body.String())
	}

	if *reached {
		t.Fatal("downstream handler must not be reached on auth failure")
	}

	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decoding response: %v (body = %s)", err, rec.Body.String())
	}

	if body["error"] != "bad-credentials" {
		t.Errorf(`body["error"] = %q; want "bad-credentials"`, body["error"])
	}

	if body["reason"] != "key is wrong" {
		t.Errorf(`body["reason"] = %q; want "key is wrong"`, body["reason"])
	}

	if body["securityScheme"] != "FakeAuth" {
		t.Errorf(`body["securityScheme"] = %q; want "FakeAuth"`, body["securityScheme"])
	}
}

// TestNewRouterValidator_AuthAllows lets the AuthenticationFunc pass and
// confirms the request reaches the handler with the canonical 200.
func TestNewRouterValidator_AuthAllows(t *testing.T) {
	t.Parallel()

	authFn := func(context.Context, *openapi3filter.AuthenticationInput) error {
		return nil
	}

	router, reached := newRouter(t, authFn)

	rec := do(t, router, http.MethodGet, "/admin", nil, "")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d; want 200, body = %s", rec.Code, rec.Body.String())
	}

	if !*reached {
		t.Fatal("downstream handler was not reached")
	}
}

// TestNewRouterValidator_AnonymousOption verifies that an anonymous-allowed
// operation ({} in the security block) lets a request through even when the
// AuthenticationFunc would deny the named scheme.
func TestNewRouterValidator_AnonymousOption(t *testing.T) {
	t.Parallel()

	denyAll := func(_ context.Context, input *openapi3filter.AuthenticationInput) error {
		return &oapi.AuthenticatorError{
			Scheme: input.SecuritySchemeName, Code: "denied", Message: "no",
		}
	}

	router, reached := newRouter(t, denyAll)

	rec := do(t, router, http.MethodGet, "/anon-or-admin", nil, "")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d; want 200, body = %s", rec.Code, rec.Body.String())
	}

	if !*reached {
		t.Fatal("downstream handler was not reached for anonymous-allowed op")
	}
}

// TestNewRouterValidator_BodySchemaError is the body-validation shape contract:
// missing required field → 400 with {error: schema-validation-error, reason}.
func TestNewRouterValidator_BodySchemaError(t *testing.T) {
	t.Parallel()

	router, reached := newRouter(t, nil)

	rec := do(
		t, router, http.MethodPost, "/echo",
		http.Header{"Content-Type": {"application/json"}},
		`{}`,
	)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d; want 400, body = %s", rec.Code, rec.Body.String())
	}

	if *reached {
		t.Fatal("downstream handler must not be reached on validation failure")
	}

	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decoding response: %v (body = %s)", err, rec.Body.String())
	}

	if body["error"] != "schema-validation-error" {
		t.Errorf(`body["error"] = %q; want "schema-validation-error"`, body["error"])
	}

	if body["reason"] == "" {
		t.Error(`body["reason"] is empty; expected a schema-error reason`)
	}
}

// TestNewRouterValidator_RouteNotFoundPasses documents how the returned
// validator behaves under non-production wiring where it is mounted engine-wide
// via router.Use. In that configuration the validator runs on every request, so
// an unknown path is surfaced as a validator/router error rather than falling
// through cleanly. We assert only the response shape without locking in a
// specific status, since kin-openapi wrapping has shifted between versions.
func TestNewRouterValidator_RouteNotFoundPasses(t *testing.T) {
	t.Parallel()

	denyAll := func(_ context.Context, input *openapi3filter.AuthenticationInput) error {
		return &oapi.AuthenticatorError{
			Scheme: input.SecuritySchemeName, Code: "denied", Message: "no",
		}
	}

	router, reached := newRouter(t, denyAll)

	rec := do(t, router, http.MethodGet, "/not-in-spec", nil, "")

	if rec.Code != http.StatusBadRequest && rec.Code != http.StatusNotFound {
		t.Fatalf(
			"status = %d; want 400 or 404 for unknown path, body = %s",
			rec.Code, rec.Body.String(),
		)
	}

	if rec.Code == http.StatusBadRequest && *reached {
		t.Fatal("downstream handler must not be reached when validator errored")
	}

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decoding response: %v (body = %s)", err, rec.Body.String())
	}

	if _, ok := body["error"]; !ok {
		t.Errorf(`body has no "error" key: %s`, rec.Body.String())
	}
}

var (
	errBoom    = errors.New("boom")
	errInvalid = errors.New("invalid param")
)

// surfaceRouter builds a router with the shared middleware stack (so
// surfaceErrorsMiddleWare is mounted) but without the request validator, so a
// test can register a route that records an error and observe how the shared
// stack renders it.
func surfaceRouter(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)

	router, _, err := oapi.NewRouter(
		loadSpec(t),
		"",
		nil,
		middleware.CORSOptions{
			AllowOriginFunc:                      nil,
			AllowedOrigins:                       []string{},
			AllowedMethods:                       []string{http.MethodGet},
			AllowHeadersFunc:                     nil,
			AllowedHeaders:                       nil,
			ExposedHeaders:                       nil,
			AllowCredentials:                     false,
			MaxAge:                               "",
			UnsafeAllowAllOriginsWithCredentials: false,
		},
		slog.Default(),
	)
	if err != nil {
		t.Fatalf("NewRouter: %v", err)
	}

	return router
}

// TestSurfaceErrors_RecordedErrorWithoutStatus is the multipart-decode quirk
// fix: an error recorded with no error status (gin defaults to 200) must be
// surfaced as a 500, never an error body under a success code.
func TestSurfaceErrors_RecordedErrorWithoutStatus(t *testing.T) {
	t.Parallel()

	router := surfaceRouter(t)
	router.GET("/boom", func(c *gin.Context) {
		_ = c.Error(errBoom)
	})

	rec := do(t, router, http.MethodGet, "/boom", nil, "")

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d; want 500, body = %s", rec.Code, rec.Body.String())
	}

	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decoding response: %v (body = %s)", err, rec.Body.String())
	}

	if body["errors"] != "internal-server-error" {
		t.Errorf(`body["errors"] = %q; want "internal-server-error"`, body["errors"])
	}

	if body["message"] != "boom" {
		t.Errorf(`body["message"] = %q; want "boom"`, body["message"])
	}
}

// TestSurfaceErrors_RecordError is the bind-error funnel: RecordError (wired as
// the generated GinServerOptions.ErrorHandler) records the status and error,
// and surfaceErrorsMiddleWare renders the same shape used for handler errors —
// not the codegen default ({"msg": ...}).
func TestSurfaceErrors_RecordError(t *testing.T) {
	t.Parallel()

	router := surfaceRouter(t)
	router.GET("/bind", func(c *gin.Context) {
		oapi.RecordError(c, errInvalid, http.StatusBadRequest)
	})

	rec := do(t, router, http.MethodGet, "/bind", nil, "")

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d; want 400, body = %s", rec.Code, rec.Body.String())
	}

	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decoding response: %v (body = %s)", err, rec.Body.String())
	}

	if body["errors"] != "bad-request" {
		t.Errorf(`body["errors"] = %q; want "bad-request"`, body["errors"])
	}

	if body["message"] != "invalid param" {
		t.Errorf(`body["message"] = %q; want "invalid param"`, body["message"])
	}
}

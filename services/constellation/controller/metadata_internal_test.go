package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/gin-gonic/gin"
	sharedoapi "github.com/nhost/nhost/internal/lib/oapi"
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/constellation/api"
	"github.com/nhost/nhost/services/constellation/controller/middleware"
	"github.com/nhost/nhost/services/constellation/internal/hasuraproxy"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/nhost/nhost/services/constellation/metadata/source"
)

// testOpenAPIValidator returns the per-route validator middleware produced by
// sharedoapi.NewRouter, the only exported path to newRequestValidator. The
// returned *gin.Engine is discarded — the helper handlers below mount the
// validator on a router they build directly so each test controls the
// middleware order.
func testOpenAPIValidator(t *testing.T, spec *openapi3.T) gin.HandlerFunc {
	t.Helper()

	_, validatorMW, err := sharedoapi.NewRouter(
		spec,
		"",
		NewAuthFunc(),
		oapimw.CORSOptions{
			AllowOriginFunc:                      nil,
			AllowedOrigins:                       []string{},
			AllowedMethods:                       []string{http.MethodPost},
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
		t.Fatalf("building shared OpenAPI validator: %v", err)
	}

	return validatorMW
}

func testReverseProxy(t *testing.T, upstream string) http.Handler {
	t.Helper()

	proxy, err := hasuraproxy.New(upstream, slog.New(slog.DiscardHandler))
	if err != nil {
		t.Fatalf("creating test proxy: %v", err)
	}

	return proxy
}

// stubMetadataSource is a minimal metadata.Source for the metadata handler
// tests. Only HasuraSnapshotJSON is exercised; the rest panic so a misuse is
// loud rather than silent.
type stubMetadataSource struct {
	hasura  []byte
	version int64
}

func (s *stubMetadataSource) InitialLoad(context.Context) (*metadata.Metadata, error) {
	panic("InitialLoad not used in metadata handler tests")
}

func (s *stubMetadataSource) Watch(context.Context) <-chan metadata.Update {
	panic("Watch not used in metadata handler tests")
}

func (s *stubMetadataSource) Close() {}

func (s *stubMetadataSource) HasuraSnapshotJSON() ([]byte, int64) {
	return s.hasura, s.version
}

const testAdminSecret = "test-admin-secret" //nolint:gosec // test-only constant, not a credential

// testMetadataBodyCap is the body cap used by every metadata test router.
// It exists only so the oversized-body tests can exceed it cheaply; the
// production cap is sourced from --hasura-proxy-request-body-limit-bytes.
const testMetadataBodyCap int64 = 1 * 1024 * 1024

// buildMetadataRouter mirrors the production wiring for the metadata endpoint
// in a test harness: gin engine + ClientHeadersToContext middleware (so the
// handler can read X-Hasura-Admin-Secret out of the request context) + the
// registered strict handler, with middleware.Session in front so that the
// security middleware (which consumes SessionFromContext) has a resolved
// session to inspect. A nil proxy means the "no upstream configured" branch
// is exercised (unknown ops return not-supported instead of proxying).
func buildMetadataRouter(
	t *testing.T,
	proxy http.Handler,
) http.Handler {
	t.Helper()

	return buildMetadataRouterWithSource(t, proxy, nil)
}

func buildMetadataRouterWithSource(
	t *testing.T,
	proxy http.Handler,
	source metadata.Source,
) http.Handler {
	t.Helper()
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.ContextWithFallback = true

	router.Use(
		middleware.Session(testAdminSecret, middleware.NewNoOpJWTAuthenticator()),
	)

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

// buildStoreAndProxyRouter wires a Controller with BOTH a non-nil Store and a
// non-nil Hasura proxy — the production DB-mode shape where --metadata-database-url
// (the Store) and --hasura-upstream-url (the proxy) are configured together. The
// Store doubles as the metadata.Source (mirroring dbStoreSource in cmd/serve.go,
// which embeds *source.Store), so export_metadata reads the Store's live snapshot.
// The proxy is only the per-op fallback for ops with no native handler.
func buildStoreAndProxyRouter(
	t *testing.T,
	store *source.Store,
	proxy http.Handler,
) http.Handler {
	t.Helper()
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.ContextWithFallback = true
	router.Use(middleware.Session(testAdminSecret, middleware.NewNoOpJWTAuthenticator()))

	ctrl := &Controller{
		adminSecret: testAdminSecret,
		hasuraProxy: proxy,
		store:       store,
		source:      store,
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

func postMetadata(
	t *testing.T, router http.Handler, adminSecret, body string,
) (int, api.MetadataError) {
	t.Helper()

	req := httptest.NewRequest(http.MethodPost, "/v1/metadata", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	if adminSecret != "" {
		req.Header.Set("X-Hasura-Admin-Secret", adminSecret)
	}

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	raw, _ := io.ReadAll(rec.Body)

	var err api.MetadataError

	_ = json.Unmarshal(raw, &err)

	return rec.Code, err
}

// Auth-rejection tests assert status only. The response body shape is owned
// by the security middleware (spec-wide) and is not part of MetadataError;
// per-op error shapes only apply to errors the handler itself produces.

func TestMetadataRejectsMissingAdminSecret(t *testing.T) {
	t.Parallel()

	router := buildMetadataRouter(t, nil)

	status, _ := postMetadata(
		t, router, "", `{"type":"export_metadata","args":{}}`,
	)

	if status != http.StatusUnauthorized {
		t.Errorf("status = %d; want %d", status, http.StatusUnauthorized)
	}
}

func TestMetadataRejectsWrongAdminSecret(t *testing.T) {
	t.Parallel()

	router := buildMetadataRouter(t, nil)

	status, _ := postMetadata(
		t, router, "wrong-secret", `{"type":"export_metadata","args":{}}`,
	)

	if status != http.StatusUnauthorized {
		t.Errorf("status = %d; want %d", status, http.StatusUnauthorized)
	}
}

// readTrackingBody records whether its Read was ever called, so a test can
// prove the request body is never consumed before the admin-secret check.
type readTrackingBody struct {
	read bool
}

func (b *readTrackingBody) Read([]byte) (int, error) {
	b.read = true

	return 0, io.EOF
}

func (*readTrackingBody) Close() error { return nil }

// TestMetadataRejectsMissingAdminSecretBeforeReadingBody guards the DoS-avoidance
// invariant documented on NewCaptureRawBody: an unauthenticated /v1/metadata
// request must be rejected with 401 before any byte of its body is read or
// allocated. A status-only assertion is insufficient — this asserts the body
// was left entirely unread.
func TestMetadataRejectsMissingAdminSecretBeforeReadingBody(t *testing.T) {
	t.Parallel()

	router := buildMetadataRouter(t, nil)
	body := &readTrackingBody{}

	req := httptest.NewRequest(http.MethodPost, "/v1/metadata", nil)
	req.Header.Set("Content-Type", "application/json")
	req.ContentLength = -1
	req.Body = body

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d; want %d", rec.Code, http.StatusUnauthorized)
	}

	if body.read {
		t.Errorf("unauthenticated metadata request body was read before rejection")
	}
}

func TestMetadataUnknownOpReturnsNotSupportedWhenNoUpstream(t *testing.T) {
	t.Parallel()

	router := buildMetadataRouter(t, nil)

	status, errBody := postMetadata(
		t, router, testAdminSecret, `{"type":"pg_track_table","args":{}}`,
	)

	if status != http.StatusBadRequest {
		t.Errorf("status = %d; want %d", status, http.StatusBadRequest)
	}

	if errBody.Code != "not-supported" {
		t.Errorf("code = %q; want %q", errBody.Code, "not-supported")
	}

	// Pin the exact error message and the $.args path, not just a substring,
	// so a regression in either field is caught.
	wantErr := `metadata operation "pg_track_table" is not yet implemented and no Hasura upstream is configured`
	if errBody.Error != wantErr {
		t.Errorf("error = %q; want %q", errBody.Error, wantErr)
	}

	if errBody.Path == nil || *errBody.Path != "$.args" {
		t.Errorf("path = %v; want %q", errBody.Path, "$.args")
	}
}

func TestMetadataMalformedBodyReturns400(t *testing.T) {
	t.Parallel()

	router := buildMetadataRouter(t, nil)

	// Missing the required `args` field; the generated wrapper still binds
	// successfully (no schema validation at the wrapper level), so this lands
	// in our handler with an empty `args` map and falls into the
	// `not-supported` branch — same as the unknown-op case above.
	//
	// We're testing here that *truly* unparseable JSON is rejected by the
	// wrapper itself with a 400 before reaching the handler.
	req := httptest.NewRequest(
		http.MethodPost, "/v1/metadata", bytes.NewReader([]byte("not json")),
	)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("malformed JSON: status = %d; want %d", rec.Code, http.StatusBadRequest)
	}

	// The shared OpenAPI request validator (not our handler) rejects this, so
	// the body is the request-validation-error envelope rather than a
	// MetadataError. Pin both fields so a regression in the validator's
	// response shape is caught at the metadata endpoint.
	var gotBody map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &gotBody); err != nil {
		t.Fatalf("decoding response body: %v", err)
	}

	if gotBody["error"] != "request-validation-error" {
		t.Errorf("error = %q; want %q", gotBody["error"], "request-validation-error")
	}

	wantReason := "request body has an error: failed to decode request body: " +
		"invalid character 'o' in literal null (expecting 'u')"
	if gotBody["reason"] != wantReason {
		t.Errorf("reason = %q; want %q", gotBody["reason"], wantReason)
	}
}

func TestMetadataProxiesUnknownOpWhenUpstreamConfigured(t *testing.T) {
	t.Parallel()

	var (
		gotPath        string
		gotAdminSecret string
		gotBody        []byte
	)

	upstream := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			gotPath = r.URL.Path
			gotAdminSecret = r.Header.Get("X-Hasura-Admin-Secret")
			gotBody, _ = io.ReadAll(r.Body)

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"resource_version":1,"metadata":{}}`))
		},
	))
	defer upstream.Close()

	proxy := testReverseProxy(t, upstream.URL)

	router := buildMetadataRouter(t, proxy)

	front := httptest.NewServer(router)
	defer front.Close()

	reqBody := `{"type":"pg_track_table","args":{}}`

	req, err := http.NewRequestWithContext(
		context.Background(), http.MethodPost, front.URL+"/v1/metadata",
		strings.NewReader(reqBody),
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

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		t.Errorf("status = %d; want %d (body: %s)", resp.StatusCode, http.StatusOK, body)
	}

	if gotPath != "/v1/metadata" {
		t.Errorf("upstream path = %q; want %q", gotPath, "/v1/metadata")
	}

	if gotAdminSecret != testAdminSecret {
		t.Errorf("upstream admin secret = %q; want %q", gotAdminSecret, testAdminSecret)
	}

	if !strings.Contains(string(gotBody), `"type":"pg_track_table"`) {
		t.Errorf("upstream body %q does not preserve the op type", string(gotBody))
	}

	if !strings.Contains(string(body), `"resource_version":1`) {
		t.Errorf("response body %q does not contain the upstream payload", string(body))
	}
}

// TestMetadataProxyPreservesUnknownFieldsAndQueryString proves the proxy
// forwards the original request bytes (so unknown top-level fields the
// MetadataRequest model does not capture survive) and the original URL,
// including query string, reaches Hasura. Both were regressions in the
// previous re-marshal-via-json.Marshal implementation.
func TestMetadataProxyPreservesUnknownFieldsAndQueryString(t *testing.T) {
	t.Parallel()

	var (
		gotURL  string
		gotBody []byte
	)

	upstream := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			gotURL = r.URL.RequestURI()
			gotBody, _ = io.ReadAll(r.Body)

			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{}`))
		},
	))
	defer upstream.Close()

	proxy := testReverseProxy(t, upstream.URL)

	router := buildMetadataRouter(t, proxy)

	front := httptest.NewServer(router)
	defer front.Close()

	// Unknown top-level keys ("future_field", numeric escape "42.000") are
	// not in the MetadataRequest model. The proxy must forward the bytes
	// verbatim so Hasura sees the original payload.
	reqBody := `{"type":"pg_track_table","future_field":{"a":42.000},"args":{}}`

	req, err := http.NewRequestWithContext(
		context.Background(),
		http.MethodPost,
		front.URL+"/v1/metadata?some_param=42",
		strings.NewReader(reqBody),
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

	if gotURL != "/v1/metadata?some_param=42" {
		t.Errorf("upstream URL = %q; want %q", gotURL, "/v1/metadata?some_param=42")
	}

	if string(gotBody) != reqBody {
		t.Errorf("upstream body = %q; want %q (byte-for-byte forwarding)",
			string(gotBody), reqBody)
	}
}

func TestMetadataExportReturnsSnapshot(t *testing.T) {
	t.Parallel()

	snapshot := []byte(`{"version":3,"sources":[{"name":"default"}],"remote_schemas":[]}`)
	router := buildMetadataRouterWithSource(t, nil, &stubMetadataSource{
		hasura:  snapshot,
		version: 42,
	})

	req := httptest.NewRequest(
		http.MethodPost, "/v1/metadata",
		strings.NewReader(`{"type":"export_metadata","args":{}}`),
	)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d; want %d (body: %s)", rec.Code, http.StatusOK, rec.Body.String())
	}

	var resp struct {
		ResourceVersion int64           `json:"resource_version"`
		Metadata        json.RawMessage `json:"metadata"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decoding response: %v", err)
	}

	if resp.ResourceVersion != 42 {
		t.Errorf("resource_version = %d; want 42", resp.ResourceVersion)
	}

	if !bytes.Equal(resp.Metadata, snapshot) {
		t.Errorf("metadata body = %s; want %s", string(resp.Metadata), string(snapshot))
	}
}

func TestMetadataExportEmptySnapshot(t *testing.T) {
	t.Parallel()

	// No snapshot configured (TOML-source case, or pre-InitialLoad). The
	// handler should fall back to an empty v3 envelope rather than 5xx.
	router := buildMetadataRouterWithSource(t, nil, &stubMetadataSource{})

	req := httptest.NewRequest(
		http.MethodPost, "/v1/metadata",
		strings.NewReader(`{"type":"export_metadata","args":{}}`),
	)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d; want %d (body: %s)", rec.Code, http.StatusOK, rec.Body.String())
	}

	if !strings.Contains(rec.Body.String(), `"sources":[]`) {
		t.Errorf(
			"empty-snapshot body %q does not contain empty sources fallback",
			rec.Body.String(),
		)
	}
}

func TestMetadataExportRejectsBadAuth(t *testing.T) {
	t.Parallel()

	// export_metadata is admin-only even when a snapshot is available.
	router := buildMetadataRouterWithSource(t, nil, &stubMetadataSource{
		hasura:  []byte(`{"version":3,"sources":[]}`),
		version: 1,
	})

	status, _ := postMetadata(
		t, router, "", `{"type":"export_metadata","args":{}}`,
	)

	if status != http.StatusUnauthorized {
		t.Errorf("status = %d; want %d", status, http.StatusUnauthorized)
	}
}

func TestMetadataRejectsOversizedBody(t *testing.T) {
	t.Parallel()

	router := buildMetadataRouter(t, nil)

	// Authenticated caller posts a body just over the cap. The admin-secret
	// check runs first (an unauthenticated caller would get 401 and never
	// learn the limit); once it passes, the ContentLength fast-fail returns
	// 413.
	oversized := bytes.Repeat([]byte("a"), int(testMetadataBodyCap)+1)

	req := httptest.NewRequest(http.MethodPost, "/v1/metadata", bytes.NewReader(oversized))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("status = %d; want %d", rec.Code, http.StatusRequestEntityTooLarge)
	}
}

func TestMetadataRejectsOversizedChunkedBody(t *testing.T) {
	t.Parallel()

	router := buildMetadataRouter(t, nil)

	// Same payload but with ContentLength stripped, forcing the MaxBytesReader
	// path inside io.ReadAll rather than the ContentLength fast-fail. Caller
	// is authenticated so the upfront admin-secret check passes.
	oversized := bytes.Repeat([]byte("a"), int(testMetadataBodyCap)+1)

	req := httptest.NewRequest(http.MethodPost, "/v1/metadata", bytes.NewReader(oversized))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)
	req.ContentLength = -1

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("status = %d; want %d", rec.Code, http.StatusRequestEntityTooLarge)
	}
}

// TestMetadataOversizedBodyRequiresAuth verifies CTO's security fix: an
// unauthenticated caller posting an oversized body sees 401, never 413, so
// the configured body limit cannot be probed without an admin secret.
func TestMetadataOversizedBodyRequiresAuth(t *testing.T) {
	t.Parallel()

	router := buildMetadataRouter(t, nil)

	oversized := bytes.Repeat([]byte("a"), int(testMetadataBodyCap)+1)

	req := httptest.NewRequest(http.MethodPost, "/v1/metadata", bytes.NewReader(oversized))
	req.Header.Set("Content-Type", "application/json")

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d; want %d", rec.Code, http.StatusUnauthorized)
	}
}

// postViaFront drives a request through a front httptest.Server fronting the
// router so the reverse proxy's outbound request resolves correctly (the proxy
// forwards the inbound *http.Request, which needs a real client connection).
// Returns the response status and decoded JSON body.
func postViaFront(t *testing.T, router http.Handler, body string) (int, map[string]any) {
	t.Helper()

	front := httptest.NewServer(router)
	defer front.Close()

	req, err := http.NewRequestWithContext(
		context.Background(), http.MethodPost, front.URL+"/v1/metadata",
		strings.NewReader(body),
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

	raw, _ := io.ReadAll(resp.Body)

	out := make(map[string]any)
	_ = json.Unmarshal(raw, &out)

	return resp.StatusCode, out
}

// TestMetadataStoreAndProxy_NativeFirstWithProxyFallback is the regression for
// the dead-native-mutation bug: when BOTH a Store and a Hasura proxy are
// configured, native ops must be applied by the in-process Store (never
// forwarded), export_metadata must be served from the Store's live snapshot,
// and only ops with no native handler may fall through to the proxy.
func TestMetadataStoreAndProxy_NativeFirstWithProxyFallback(t *testing.T) {
	t.Parallel()

	var proxyHit bool

	upstream := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, _ *http.Request) {
			proxyHit = true

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"resource_version":99,"from":"proxy"}`))
		},
	))
	defer upstream.Close()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	proxy := testReverseProxy(t, upstream.URL)
	router := buildStoreAndProxyRouter(t, store, proxy)

	// (a) A native op (pg_track_table) is applied by the Store, not proxied.
	proxyHit = false

	code, body := postViaFront(t, router,
		`{"type":"pg_track_table","args":{"source":"default",`+
			`"table":{"schema":"public","name":"users"}}}`)
	if code != http.StatusOK {
		t.Fatalf("native op status = %d, want 200; body = %v", code, body)
	}

	if got, _ := body["message"].(string); got != "success" {
		t.Errorf("native op message = %v, want %q", body["message"], "success")
	}

	if got, _ := body["resource_version"].(float64); int64(got) != 12 {
		t.Errorf("native op resource_version = %v, want 12 (bumped from seed 11)",
			body["resource_version"])
	}

	if w.callCount() != 1 {
		t.Errorf("native op writer calls = %d, want 1 (Store applied the write)",
			w.callCount())
	}

	if proxyHit {
		t.Error("native op was forwarded to the proxy; it must be applied by the Store")
	}

	// (b) An op with no native handler IS forwarded to the proxy.
	proxyHit = false

	code, body = postViaFront(t, router, `{"type":"get_catalog_state","args":{}}`)
	if code != http.StatusOK {
		t.Fatalf("fallback op status = %d, want 200; body = %v", code, body)
	}

	if !proxyHit {
		t.Error("op with no native handler was not forwarded to the proxy")
	}

	if got, _ := body["from"].(string); got != "proxy" {
		t.Errorf("fallback op body = %v, want the proxy's response", body)
	}

	// (c) export_metadata is served locally from the Store, not proxied.
	proxyHit = false

	code, body = postViaFront(t, router, `{"type":"export_metadata","args":{}}`)
	if code != http.StatusOK {
		t.Fatalf("export status = %d, want 200; body = %v", code, body)
	}

	if proxyHit {
		t.Error("export_metadata was forwarded to the proxy; it must be served from the Store")
	}

	wantRV := store.ResourceVersion()

	if got, _ := body["resource_version"].(float64); int64(got) != wantRV {
		t.Errorf("export resource_version = %v, want %d (the Store's live version)",
			body["resource_version"], wantRV)
	}
}

// TestMetadataStoreAndProxy_EventRuntimeNeverProxied locks the README
// guarantee that the four event-runtime ops are always handled natively
// (returning not-supported) and are NEVER forwarded to the proxy, even with
// an upstream configured. The store!=nil && proxy!=nil shape is required:
// buildMutationRouter (proxy==nil) cannot prove the "not forwarded" half,
// because the no-proxy fallback would also return not-supported.
func TestMetadataStoreAndProxy_EventRuntimeNeverProxied(t *testing.T) {
	t.Parallel()

	var proxyHit bool

	upstream := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, _ *http.Request) {
			proxyHit = true

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"from":"proxy"}`))
		},
	))
	defer upstream.Close()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	proxy := testReverseProxy(t, upstream.URL)
	router := buildStoreAndProxyRouter(t, store, proxy)

	for _, op := range []string{
		"pg_redeliver_event",
		"pg_invoke_event_trigger",
		"pg_get_event_logs",
		"pg_get_event_by_id",
	} {
		proxyHit = false

		code, body := postViaFront(t, router, `{"type":"`+op+`","args":{}}`)
		if code != http.StatusBadRequest {
			t.Fatalf("%s status = %d, want 400; body = %v", op, code, body)
		}

		if got, _ := body["code"].(string); got != "not-supported" {
			t.Errorf("%s code = %v, want not-supported", op, body["code"])
		}

		if proxyHit {
			t.Errorf("%s was forwarded to the proxy; runtime ops must never be proxied", op)
		}
	}
}

// TestMutationOpDispatchParity is a drift guard over the two duplicated
// op-dispatch tables: source.BuildMutation and the switch in dispatchMutation.
// For every canonical mutation op it asserts the op is registered in BOTH —
// source.BuildMutation does not return ErrUnknownMutationOp, and
// dispatchMutation reports the op as handled. A parse/validation error from
// BuildMutation or dispatchMutation on empty args is fine — only an
// unregistered op (ErrUnknownMutationOp / handled==false) fails the guard.
// (The bulk path no longer has a third table: source.ApplyBulk routes children
// through BuildMutation and the same handlers the single-op path uses.)
func TestMutationOpDispatchParity(t *testing.T) {
	t.Parallel()

	// canonicalMutationOps is the single source of truth for the set of mutation
	// ops routed to a Store mutator. The controller's storeOpFor switch, the
	// dispatchMutation switch, and source.BuildMutation MUST all enumerate exactly
	// these — this test guards against an op being added to one table but missed
	// in another.
	//
	// Read/snapshot/bulk ops (pg_suggest_relationships, pg_get_viewdef,
	// replace_metadata, bulk*) are intentionally excluded: those are
	// dispatchMutation-only by design and have no BuildMutation entry.
	// introspect_remote_schema / reload_remote_schema are likewise excluded —
	// they are read ops with no BuildMutation entry.
	canonicalMutationOps := []string{
		opPgTrackTable,
		opPgSetTableCustomization,
		opPgCreateObjectRelationship,
		opPgCreateArrayRelationship,
		opPgCreateSelectPermission,
		opPgDropSelectPermission,
		opPgCreateInsertPermission,
		opPgDropInsertPermission,
		opPgCreateUpdatePermission,
		opPgDropUpdatePermission,
		opPgCreateDeletePermission,
		opPgDropDeletePermission,
		opPgUntrackTable,
		opPgSetTableIsEnum,
		opPgDropRelationship,
		opPgRenameRelationship,
		opPgTrackFunction,
		opPgUntrackFunction,
		opPgSetFunctionCustomization,
		opPgCreateFunctionPermission,
		opPgDropFunctionPermission,
		opPgCreateEventTrigger,
		opPgDeleteEventTrigger,
		opPgCreateRemoteRelationship,
		opPgDeleteRemoteRelationship,
		opAddRemoteSchema,
		opRemoveRemoteSchema,
		opUpdateRemoteSchema,
		opAddRemoteSchemaPermissions,
		opDropRemoteSchemaPermissions,
		opCreateRemoteSchemaRemoteRelationship,
		opUpdateRemoteSchemaRemoteRelationship,
		opDeleteRemoteSchemaRemoteRelationship,
		opCreateAction,
		opDropAction,
		opUpdateAction,
		opCreateActionPermission,
		opDropActionPermission,
		opSetCustomTypes,
		opAddInheritedRole,
		opDropInheritedRole,
	}

	// dispatchMutation dereferences c.store, so a bootstrapped Store is required.
	store := newBootstrappedStore(t, &writerStub{})
	ctrl := &Controller{store: store}

	for _, op := range canonicalMutationOps {
		t.Run(op, func(t *testing.T) {
			t.Parallel()

			if _, err := source.BuildMutation(op, []byte(`{}`)); errors.Is(
				err, source.ErrUnknownMutationOp,
			) {
				t.Errorf("source.BuildMutation(%q) returned ErrUnknownMutationOp; "+
					"op missing from BuildMutation dispatch table", op)
			}

			// dispatchMutation must also recognize the op. Empty args make
			// every handler fail validation, but dispatchMutation still
			// reports handled==true for a registered op; a missing switch arm
			// returns handled==false (and would silently fall through to the
			// proxy / not-supported on the single-op path).
			req := api.MetadataRequestRequestObject{
				Body: &api.MetadataRequestJSONRequestBody{Type: op, Args: map[string]any{}},
			}
			if _, handled, _ := ctrl.dispatchMutation(t.Context(), req); !handled {
				t.Errorf("dispatchMutation(%q) handled = false; "+
					"op missing from dispatchMutation switch", op)
			}
		})
	}
}

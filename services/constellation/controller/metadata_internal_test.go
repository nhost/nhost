package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/gin-gonic/gin"
	"github.com/google/go-cmp/cmp"
	sharedoapi "github.com/nhost/nhost/internal/lib/oapi"
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/constellation/api"
	"github.com/nhost/nhost/services/constellation/controller/middleware"
	"github.com/nhost/nhost/services/constellation/internal/hasuraproxy"
	"github.com/nhost/nhost/services/constellation/metadata"
)

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

func postMetadata(
	t *testing.T, router http.Handler, adminSecret, body string,
) (int, []byte) {
	t.Helper()

	req := httptest.NewRequest(http.MethodPost, "/v1/metadata", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	if adminSecret != "" {
		req.Header.Set("X-Hasura-Admin-Secret", adminSecret)
	}

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	raw, _ := io.ReadAll(rec.Body)

	return rec.Code, raw
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

type readTrackingBody struct {
	read bool
}

func (b *readTrackingBody) Read([]byte) (int, error) {
	b.read = true

	return 0, io.EOF
}

func (*readTrackingBody) Close() error { return nil }

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

func TestMetadataBadRequestResponses(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		requestBody string
		wantStatus  int
		wantBody    map[string]string
	}{
		{
			name:        "handler metadata error",
			requestBody: `{"type":"pg_track_table","args":{}}`,
			wantStatus:  http.StatusBadRequest,
			wantBody: map[string]string{
				"code":  "not-supported",
				"error": `metadata operation "pg_track_table" is not yet implemented and no Hasura upstream is configured`,
				"path":  "$.args",
			},
		},
		{
			name:        "validator error",
			requestBody: "not json",
			wantStatus:  http.StatusBadRequest,
			wantBody: map[string]string{
				"error":  "request-validation-error",
				"reason": "request body has an error: failed to decode request body: invalid character 'o' in literal null (expecting 'u')",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			router := buildMetadataRouter(t, nil)

			status, raw := postMetadata(t, router, testAdminSecret, tt.requestBody)
			if status != tt.wantStatus {
				t.Fatalf("status = %d; want %d (body: %s)", status, tt.wantStatus, raw)
			}

			var gotBody map[string]string
			if err := json.Unmarshal(raw, &gotBody); err != nil {
				t.Fatalf("decoding response body: %v", err)
			}

			if diff := cmp.Diff(tt.wantBody, gotBody); diff != "" {
				t.Errorf("response body mismatch (-want +got):\n%s", diff)
			}
		})
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

func TestMetadataChecksAuthBeforeSizeCap(t *testing.T) {
	t.Parallel()

	router := buildMetadataRouter(t, nil)

	// Build a body just over the cap and send it with NO admin secret. Auth is
	// checked before the ContentLength cap, so an unauthenticated caller must
	// get 401 (auth wins) and never observe 413 — otherwise the configured
	// limit could be probed (413-vs-401) on this admin-only endpoint.
	oversized := bytes.Repeat([]byte("a"), int(testMetadataBodyCap)+1)

	req := httptest.NewRequest(http.MethodPost, "/v1/metadata", bytes.NewReader(oversized))
	req.Header.Set("Content-Type", "application/json")

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d; want %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestMetadataRejectsOversizedBodyWhenAuthenticated(t *testing.T) {
	t.Parallel()

	router := buildMetadataRouter(t, nil)

	// Same oversized body, but with a valid admin secret. The DoS cap must
	// still fire for authenticated admins: the ContentLength fast-fail rejects
	// it with 413 before the body is read.
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

	// Same payload but with ContentLength stripped and a valid admin secret,
	// forcing the authenticated MaxBytesReader path inside io.ReadAll rather
	// than the ContentLength fast-fail.
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

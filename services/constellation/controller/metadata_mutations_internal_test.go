package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/constellation/api"
	"github.com/nhost/nhost/services/constellation/controller/middleware"
	"github.com/nhost/nhost/services/constellation/metadata/source"
)

// writerStub records WriteMetadata calls (including the verbatim bytes of the
// most recent successful write) and can inject a fixed error.
type writerStub struct {
	mu      sync.Mutex
	calls   int
	lastRaw []byte
	err     error
}

func (w *writerStub) WriteMetadata(
	_ context.Context, newRaw []byte, _, _ int64,
) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.calls++

	if w.err == nil {
		w.lastRaw = append([]byte(nil), newRaw...)
	}

	return w.err
}

func (w *writerStub) callCount() int {
	w.mu.Lock()
	defer w.mu.Unlock()

	return w.calls
}

func (w *writerStub) lastWritten() []byte {
	w.mu.Lock()
	defer w.mu.Unlock()

	return w.lastRaw
}

func buildMutationRouter(t *testing.T, store *source.Store) http.Handler {
	t.Helper()
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.ContextWithFallback = true
	router.Use(middleware.Session(testAdminSecret, middleware.NewNoOpJWTAuthenticator()))

	ctrl := &Controller{
		adminSecret: testAdminSecret,
		hasuraProxy: nil,
		store:       store,
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

func newBootstrappedStore(t *testing.T, w source.MetadataWriter) *source.Store {
	t.Helper()

	return newBootstrappedStoreWithQueryer(t, w, nil)
}

// newBootstrappedStoreWithQueryer builds a bootstrapped Store with a read-op
// Queryer wired in at construction. Mirrors production, where NewStore /
// NewDatabaseBackedStore take the Queryer, so tests inject a fake through the
// constructor rather than a post-construction setter.
func newBootstrappedStoreWithQueryer(
	t *testing.T, w source.MetadataWriter, q source.Queryer,
) *source.Store {
	t.Helper()

	const seed = `{"version":3,"sources":[{"name":"default","kind":"postgres",` +
		`"tables":[],"configuration":{"connection_info":{"database_url":` +
		`{"from_env":"PG"},"isolation_level":"read-committed",` +
		`"use_prepared_statements":true}}}]}`

	s := source.NewStore(w, q, nil)
	if err := s.BootstrapFromJSON([]byte(seed), 11); err != nil {
		t.Fatalf("BootstrapFromJSON: %v", err)
	}

	return s
}

func postJSON(t *testing.T, router http.Handler, body string) (int, map[string]any) {
	t.Helper()

	req := httptest.NewRequest(http.MethodPost, "/v1/metadata", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	raw, _ := io.ReadAll(rec.Body)

	out := make(map[string]any)
	_ = json.Unmarshal(raw, &out)

	return rec.Code, out
}

// postJSONArray is postJSON for endpoints that return a bare top-level JSON
// array (the `bulk` / `bulk_keep_going` success shape). Returns the raw bytes
// too so a caller can fall back to decoding an error object on a non-200.
func postJSONArray(t *testing.T, router http.Handler, body string) (int, []any, []byte) {
	t.Helper()

	req := httptest.NewRequest(http.MethodPost, "/v1/metadata", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	raw, _ := io.ReadAll(rec.Body)

	var out []any
	_ = json.Unmarshal(raw, &out)

	return rec.Code, out, raw
}

func TestDispatch_PgTrackTable_Success(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	code, body := postJSON(t, router,
		`{"type":"pg_track_table","args":{"source":"default",`+
			`"table":{"schema":"public","name":"users"}}}`)

	if code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %v", code, body)
	}

	if got, _ := body["resource_version"].(float64); int64(got) != 12 {
		t.Errorf("resource_version = %v, want 12", body["resource_version"])
	}

	if w.callCount() != 1 {
		t.Errorf("writer calls = %d, want 1", w.callCount())
	}
}

func TestDispatch_PgTrackTable_AlreadyTracked(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	body := `{"type":"pg_track_table","args":{"source":"default",` +
		`"table":{"schema":"public","name":"users"}}}`

	if code, _ := postJSON(t, router, body); code != http.StatusOK {
		t.Fatalf("first call status = %d", code)
	}

	code, resp := postJSON(t, router, body)
	if code != http.StatusOK {
		t.Fatalf("idempotent call status = %d, want 200", code)
	}

	if got, _ := resp["message"].(string); got != string(source.CodeAlreadyTracked) {
		t.Errorf("message = %q, want %q", resp["message"], source.CodeAlreadyTracked)
	}
}

func TestDispatch_ConflictMappedToConflictCode(t *testing.T) {
	t.Parallel()

	w := &writerStub{err: source.ErrResourceVersionConflict}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	code, resp := postJSON(t, router,
		`{"type":"pg_track_table","args":{"source":"default",`+
			`"table":{"schema":"public","name":"users"}}}`)

	if code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body = %v", code, resp)
	}

	if got, _ := resp["code"].(string); got != "conflict" {
		t.Errorf("code = %q, want conflict", resp["code"])
	}
}

func TestDispatch_UnknownSourceMappedToNotExists(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	code, resp := postJSON(t, router,
		`{"type":"pg_track_table","args":{"source":"missing",`+
			`"table":{"schema":"public","name":"users"}}}`)

	if code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body = %v", code, resp)
	}

	if got, _ := resp["code"].(string); got != "not-exists" {
		t.Errorf("code = %q, want not-exists", resp["code"])
	}
}

// TestDispatch_PreservesLargeIntegerLiteral pins the >2^53 precision guarantee
// of metadataArgsJSON end to end. The OpenAPI bind path decodes req.Body.Args
// through encoding/json v1 into interface{} (every number becomes a float64, so
// 9007199254740993 would round to 9007199254740992); metadataArgsJSON sidesteps
// that by forwarding the raw captured request body verbatim. PermissionExpression
// then preserves the literal as a json.Number, so the only way the exact digits
// reach the stored metadata is the verbatim branch. A refactor that always
// re-marshals the decoded args fails this test.
func TestDispatch_PreservesLargeIntegerLiteral(t *testing.T) {
	t.Parallel()

	const bigInt = "9007199254740993" // 2^53 + 1, not representable as float64

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	if code, body := postJSON(t, router,
		`{"type":"pg_track_table","args":{"source":"default",`+
			`"table":{"schema":"public","name":"users"}}}`); code != http.StatusOK {
		t.Fatalf("track table status = %d; body = %v", code, body)
	}

	code, body := postJSON(t, router,
		`{"type":"pg_create_select_permission","args":{"source":"default",`+
			`"table":{"schema":"public","name":"users"},"role":"user",`+
			`"permission":{"columns":["id"],"filter":{"id":{"_eq":`+bigInt+`}}}}}`)
	if code != http.StatusOK {
		t.Fatalf("create permission status = %d; body = %v", code, body)
	}

	written := w.lastWritten()
	if written == nil {
		t.Fatal("writer captured no metadata")
	}

	if !bytes.Contains(written, []byte(bigInt)) {
		t.Errorf("stored metadata lost large-integer precision: %q not found in\n%s",
			bigInt, written)
	}
}

// TestMetadataArgsJSON covers both branches of the helper directly: the
// verbatim raw-body branch (which must return the args bytes untouched, keeping
// large integer literals intact) and the fallback branch (no captured body),
// which re-marshals the already-decoded req.Body.Args.
func TestMetadataArgsJSON(t *testing.T) {
	t.Parallel()

	t.Run("verbatim raw body preserves large integer", func(t *testing.T) {
		t.Parallel()

		raw := []byte(
			`{"type":"pg_create_select_permission",` +
				`"args":{"filter":{"id":{"_eq":9007199254740993}}}}`,
		)
		ctx := context.WithValue(t.Context(), rawBodyCtxKey{}, raw)

		got, err := metadataArgsJSON(ctx, api.MetadataRequestRequestObject{})
		if err != nil {
			t.Fatalf("metadataArgsJSON: %v", err)
		}

		if !bytes.Contains(got, []byte("9007199254740993")) {
			t.Errorf("verbatim args lost precision: got %s", got)
		}
	})

	t.Run("fallback re-marshals decoded args", func(t *testing.T) {
		t.Parallel()

		req := api.MetadataRequestRequestObject{
			Body: &api.MetadataRequestJSONRequestBody{
				Type: "pg_track_table",
				Args: map[string]any{"source": "default"},
			},
		}

		got, err := metadataArgsJSON(t.Context(), req)
		if err != nil {
			t.Fatalf("metadataArgsJSON: %v", err)
		}

		want, err := json.Marshal(req.Body.Args)
		if err != nil {
			t.Fatalf("marshal want: %v", err)
		}

		if !bytes.Equal(got, want) {
			t.Errorf("fallback args = %s, want %s", got, want)
		}
	})
}

func TestDispatch_NoStoreFallsThroughToNotSupported(t *testing.T) {
	t.Parallel()

	router := buildMutationRouter(t, nil)

	code, resp := postJSON(t, router,
		`{"type":"pg_track_table","args":{"source":"default",`+
			`"table":{"schema":"public","name":"users"}}}`)

	if code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body = %v", code, resp)
	}

	if got, _ := resp["code"].(string); got != "not-supported" {
		t.Errorf("code = %q, want not-supported", resp["code"])
	}
}

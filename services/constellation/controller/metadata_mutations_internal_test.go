package controller

import (
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

// writerStub records WriteMetadata calls and can inject a fixed error.
type writerStub struct {
	mu    sync.Mutex
	calls int
	err   error
}

func (w *writerStub) WriteMetadata(
	_ context.Context, _ []byte, _, _ int64,
) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.calls++

	return w.err
}

func (w *writerStub) callCount() int {
	w.mu.Lock()
	defer w.mu.Unlock()

	return w.calls
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

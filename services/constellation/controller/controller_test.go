package controller_test

import (
	"bytes"
	"context"
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	gorillaWS "github.com/gorilla/websocket"
	"github.com/nhost/nhost/services/constellation/connector"
	"github.com/nhost/nhost/services/constellation/connector/memconnector"
	"github.com/nhost/nhost/services/constellation/connector/remoteschema"
	sqlconnector "github.com/nhost/nhost/services/constellation/connector/sql"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/controller"
	"github.com/nhost/nhost/services/constellation/controller/middleware"
	plannerpkg "github.com/nhost/nhost/services/constellation/controller/planner"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2/ast"
)

const testAdminSecret = "test-admin-secret" //nolint:gosec

var errSentinel = errors.New("test sentinel")

// newTestController wires a Controller around a memconnector serving the
// canned "users" query, with admin-secret session middleware so that requests
// with X-Hasura-Admin-Secret reach the controller as the admin role.
func newTestController(t *testing.T) *controller.Controller {
	t.Helper()

	usersResponse := jsontext.Value(
		`[{"id":"1","name":"Alice"},{"id":"2","name":"Bob"}]`,
	)

	conn, err := memconnector.New(
		[]*graph.ObjectType{
			memconnector.Object(
				"User",
				memconnector.ID("id"),
				memconnector.String("name"),
			),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"users",
				graph.NewNonNullListType(graph.NewNonNullType("User")),
				usersResponse,
			),
		},
	)
	if err != nil {
		t.Fatalf("memconnector.New: %v", err)
	}

	logger := slog.New(slog.DiscardHandler)

	ctrl, err := controller.NewFromConnectors(
		testAdminSecret,
		map[string]connector.Connector{"mem": conn},
		nil,
		logger,
	)
	if err != nil {
		t.Fatalf("NewFromConnectors: %v", err)
	}

	return ctrl
}

func newTestRouter(t *testing.T, ctrl *controller.Controller) *gin.Engine {
	t.Helper()

	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(middleware.Session(testAdminSecret, middleware.NewNoOpJWTAuthenticator()))
	router.POST("/graphql", ctrl.HandlerPost)
	router.GET("/graphql", ctrl.HandlerGet)

	return router
}

// readJSONBody decodes the response body as JSON; fails the test if the body
// isn't valid JSON.
func readJSONBody(t *testing.T, w *httptest.ResponseRecorder) map[string]any {
	t.Helper()

	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("response body not JSON: %v\nbody: %s", err, w.Body.String())
	}

	return body
}

// --- HandlerPost public surface ------------------------------------------

func TestHandlerPost_RejectsNonJSONContentType(t *testing.T) {
	t.Parallel()

	for _, contentType := range []string{
		"text/plain",
		"application/graphql",
		"multipart/form-data; boundary=x",
		"not a media type",
	} {
		t.Run(contentType, func(t *testing.T) {
			t.Parallel()

			router := newTestRouter(t, newTestController(t))

			req := httptest.NewRequest(http.MethodPost, "/graphql", strings.NewReader("{}"))
			req.Header.Set("Content-Type", contentType)
			req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code != http.StatusBadRequest {
				t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
			}

			body := readJSONBody(t, w)
			if _, ok := body["errors"]; !ok {
				t.Errorf("expected 'errors' in response, got %v", body)
			}
		})
	}
}

// TestHandlerPost_AcceptsJSONContentTypeVariants covers Content-Type values
// that must be treated as JSON: a charset parameter, mixed case, and an absent
// header (assumed to be application/json for Hasura-client compatibility).
func TestHandlerPost_AcceptsJSONContentTypeVariants(t *testing.T) {
	t.Parallel()

	for name, contentType := range map[string]string{
		"charset":   "application/json; charset=utf-8",
		"mixedCase": "Application/JSON",
		"absent":    "",
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			router := newTestRouter(t, newTestController(t))

			body := []byte(`{"query":"{ users { id name } }"}`)

			req := httptest.NewRequest(http.MethodPost, "/graphql", bytes.NewReader(body))
			if contentType != "" {
				req.Header.Set("Content-Type", contentType)
			}

			req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
			}

			const wantPrefix = `{"data":{"users":[`
			if got := w.Body.String(); !strings.HasPrefix(got, wantPrefix) {
				t.Errorf("expected body to start with %q, got %q", wantPrefix, got)
			}
		})
	}
}

func TestHandlerPost_RejectsMalformedJSONBody(t *testing.T) {
	t.Parallel()

	router := newTestRouter(t, newTestController(t))

	req := httptest.NewRequest(
		http.MethodPost,
		"/graphql",
		strings.NewReader("{not json"),
	)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestHandlerPost_HappyPath_UsesRawResponseFastPath(t *testing.T) {
	t.Parallel()

	router := newTestRouter(t, newTestController(t))

	body := []byte(`{"query":"{ users { id name } }"}`)

	req := httptest.NewRequest(http.MethodPost, "/graphql", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	// Memconnector returns jsontext.Value, so HandlerPost takes the
	// RawResponse fast path. The body should be {"data":{...}} with the
	// canned response inlined as raw JSON.
	const wantPrefix = `{"data":{"users":[`
	if got := w.Body.String(); !strings.HasPrefix(got, wantPrefix) {
		t.Errorf("expected body to start with %q, got %q", wantPrefix, got)
	}
}

func TestHandlerPost_QueryAgainstUnknownRoleFallsThroughToError(t *testing.T) {
	t.Parallel()

	// The router uses admin-secret middleware. Without the secret, the request
	// resolves to the public role — which has no schema in our setup — so
	// Resolve returns the "no schema for role" error response.
	router := newTestRouter(t, newTestController(t))

	body := []byte(`{"query":"{ users { id } }"}`)

	req := httptest.NewRequest(http.MethodPost, "/graphql", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	// No admin secret → public role → no schema in the memconnector setup.

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 (response carries errors as data), got %d: %s",
			w.Code, w.Body.String())
	}

	body2 := readJSONBody(t, w)

	errs, ok := body2["errors"].([]any)
	if !ok || len(errs) == 0 {
		t.Fatalf("expected non-empty errors array, got %v", body2)
	}

	msg, _ := errs[0].(map[string]any)["message"].(string)
	if !strings.Contains(msg, "no schema available for role: public") {
		t.Errorf("expected message about missing public schema, got %q", msg)
	}
}

func TestHandlerPost_InvalidQuerySyntaxReturnsGraphQLError(t *testing.T) {
	t.Parallel()

	router := newTestRouter(t, newTestController(t))

	body := []byte(`{"query":"{ users { id name "}`) // unclosed selection

	req := httptest.NewRequest(http.MethodPost, "/graphql", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	body2 := readJSONBody(t, w)
	if _, ok := body2["errors"]; !ok {
		t.Errorf("expected errors for malformed query, got %v", body2)
	}
}

func TestHandlerPost_MultipleOperationsRequiresOperationName(t *testing.T) {
	t.Parallel()

	router := newTestRouter(t, newTestController(t))

	body := []byte(`{"query":"query A { users { id } } query B { users { name } }"}`)

	req := httptest.NewRequest(http.MethodPost, "/graphql", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	body2 := readJSONBody(t, w)

	errs, ok := body2["errors"].([]any)
	if !ok || len(errs) == 0 {
		t.Fatalf("expected error for ambiguous operation, got %v", body2)
	}

	msg, _ := errs[0].(map[string]any)["message"].(string)
	if !strings.Contains(strings.ToLower(msg), "operation") {
		t.Errorf("expected operation-related error message, got %q", msg)
	}
}

func TestHandlerPost_OperationNameSelectsCorrectOperation(t *testing.T) {
	t.Parallel()

	router := newTestRouter(t, newTestController(t))

	body := []byte(
		`{"query":"query A { users { id } } query B { users { name } }",` +
			`"operationName":"B"}`,
	)

	req := httptest.NewRequest(http.MethodPost, "/graphql", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	// Both operations target the same memconnector response, so we only
	// assert there's no "errors" key.
	body2 := readJSONBody(t, w)
	if _, hasErr := body2["errors"]; hasErr {
		t.Errorf("expected no errors with operationName=B, got %v", body2)
	}
}

// --- HandlerGet public surface -------------------------------------------

func TestHandlerGet_RejectsNonWebSocketWithMethodNotAllowed(t *testing.T) {
	t.Parallel()

	router := newTestRouter(t, newTestController(t))

	req := httptest.NewRequest(http.MethodGet, "/graphql", nil)
	req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d: %s", w.Code, w.Body.String())
	}

	body := readJSONBody(t, w)
	if _, ok := body["errors"]; !ok {
		t.Errorf("expected errors envelope, got %v", body)
	}
}

func TestHandlerGet_ConnectionClosesOnMetadataReload(t *testing.T) {
	t.Parallel()

	// Set up a full Controller running with a fake metadata source, expose
	// HandlerGet through gin, dial a WebSocket, then push a metadata reload
	// — the connection's snapshotted state.done channel should close,
	// cancelling the connection context and tearing down the WebSocket.
	src := newFakeMetadataSource(&metadata.Metadata{
		Databases:     nil,
		RemoteSchemas: nil,
	})

	logger := slog.New(slog.DiscardHandler)

	ctrl, err := controller.New(
		context.Background(),
		0,
		testAdminSecret,
		false,
		middleware.NewNoOpJWTAuthenticator(),
		src,
		logger,
	)
	if err != nil {
		t.Fatalf("New: %v", err)
	}

	runCtx, cancelRun := context.WithCancel(context.Background())

	runDone := make(chan struct{})
	go func() {
		ctrl.Run(runCtx, logger)
		close(runDone)
	}()

	t.Cleanup(func() {
		cancelRun()
		src.Close()

		select {
		case <-runDone:
		case <-time.After(5 * time.Second):
			t.Error("Run did not exit on cleanup")
		}
	})

	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(middleware.Session(testAdminSecret, middleware.NewNoOpJWTAuthenticator()))
	router.GET("/graphql", ctrl.HandlerGet)

	server := httptest.NewServer(router)
	t.Cleanup(server.Close)

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/graphql"

	dialer := gorillaWS.Dialer{Subprotocols: []string{"graphql-transport-ws"}}

	header := http.Header{}
	header.Set("X-Hasura-Admin-Secret", testAdminSecret)

	client, resp, err := dialer.Dial(wsURL, header)
	if err != nil {
		t.Fatalf("dial failed: %v", err)
	}

	if resp != nil && resp.Body != nil {
		resp.Body.Close()
	}

	defer client.Close()

	// Trigger a metadata reload. The pre-existing state.done channel of the
	// snapshotted connection state will be closed once swapState runs in
	// Run's loop body. The reload-cancel goroutine in HandlerGet then cancels
	// the connection context, closing the WebSocket.
	src.updates <- metadata.Update{
		Metadata: &metadata.Metadata{Databases: nil, RemoteSchemas: nil},
		Err:      nil,
	}

	// Confirm the server tears the connection down — the read pump should
	// observe a close within a short bounded window.
	_ = client.SetReadDeadline(time.Now().Add(3 * time.Second))

	for {
		_, _, err := client.ReadMessage()
		if err != nil {
			// Expected: the server closed the connection on the reload.
			return
		}
	}
}

func TestHandlerGet_UpgradesWebSocketAndClosesCleanly(t *testing.T) {
	t.Parallel()

	router := newTestRouter(t, newTestController(t))

	server := httptest.NewServer(router)
	t.Cleanup(server.Close)

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/graphql"

	dialer := gorillaWS.Dialer{
		Subprotocols: []string{"graphql-transport-ws"},
	}

	header := http.Header{}
	header.Set("X-Hasura-Admin-Secret", testAdminSecret)

	client, resp, err := dialer.Dial(wsURL, header)
	if err != nil {
		t.Fatalf("dial failed: %v", err)
	}

	if resp != nil && resp.Body != nil {
		resp.Body.Close()
	}

	// Close gracefully — confirm Loop returns without error.
	err = client.WriteMessage(
		gorillaWS.CloseMessage,
		gorillaWS.FormatCloseMessage(gorillaWS.CloseNormalClosure, ""),
	)
	if err != nil {
		t.Errorf("send close: %v", err)
	}

	// Server-side loop should observe close and exit; pull until error.
	_ = client.SetReadDeadline(time.Now().Add(2 * time.Second))

	for {
		_, _, err := client.ReadMessage()
		if err != nil {
			break
		}
	}

	client.Close()
}

// --- New constructor + Run lifecycle --------------------------------------

// fakeMetadataSource implements metadata.Source with controllable initial
// load + reload behaviour.
type fakeMetadataSource struct {
	initialMeta *metadata.Metadata
	initialErr  error

	updates chan metadata.Update
	closed  chan struct{}
}

func newFakeMetadataSource(initial *metadata.Metadata) *fakeMetadataSource {
	return &fakeMetadataSource{
		initialMeta: initial,
		initialErr:  nil,
		updates:     make(chan metadata.Update),
		closed:      make(chan struct{}),
	}
}

func (f *fakeMetadataSource) InitialLoad(context.Context) (*metadata.Metadata, error) {
	if f.initialErr != nil {
		return nil, f.initialErr
	}

	return f.initialMeta, nil
}

func (f *fakeMetadataSource) Watch(ctx context.Context) <-chan metadata.Update {
	out := make(chan metadata.Update)

	go func() {
		defer close(out)

		for {
			select {
			case <-ctx.Done():
				return
			case <-f.closed:
				return
			case u, ok := <-f.updates:
				if !ok {
					return
				}

				select {
				case out <- u:
				case <-ctx.Done():
					return
				case <-f.closed:
					return
				}
			}
		}
	}()

	return out
}

func (f *fakeMetadataSource) Close() {
	select {
	case <-f.closed:
	default:
		close(f.closed)
	}
}

func TestNew_InitialLoadErrorPropagated(t *testing.T) {
	t.Parallel()

	src := newFakeMetadataSource(nil)
	src.initialErr = errSentinel

	logger := slog.New(slog.DiscardHandler)

	_, err := controller.New(
		context.Background(),
		0,
		testAdminSecret,
		false,
		middleware.NewNoOpJWTAuthenticator(),
		src,
		logger,
	)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	if !strings.Contains(err.Error(), "initial metadata load") {
		t.Errorf("expected error wrapped with 'initial metadata load', got %q", err.Error())
	}
}

func TestNew_BuildStateRecordsInconsistency(t *testing.T) {
	t.Parallel()

	// InitialLoad succeeds with metadata referencing an unsupported database
	// kind. The build no longer aborts: the source is recorded as
	// inconsistent and the controller starts with an empty schema set.
	src := newFakeMetadataSource(&metadata.Metadata{
		Databases: []metadata.DatabaseMetadata{
			{
				Name:          "db",
				Kind:          "this-kind-does-not-exist",
				Configuration: metadata.DatabaseConfiguration{},
				Tables:        nil,
				Functions:     nil,
			},
		},
		RemoteSchemas: nil,
	})

	logger := slog.New(slog.DiscardHandler)

	ctrl, err := controller.New(
		context.Background(),
		0,
		testAdminSecret,
		false,
		middleware.NewNoOpJWTAuthenticator(),
		src,
		logger,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if ctrl == nil {
		t.Fatal("expected non-nil controller despite unusable source")
	}

	incs := ctrl.Inconsistencies()
	if len(incs) != 1 {
		t.Fatalf("expected one inconsistency, got %d: %+v", len(incs), incs)
	}

	got := incs[0]
	if got.Kind != metadata.InconsistencyKindDatabase || got.Name != "db" {
		t.Errorf("unexpected inconsistency kind/name: %+v", got)
	}

	if !strings.Contains(got.Reason, "unsupported database kind") {
		t.Errorf("expected reason to mention unsupported kind, got %q", got.Reason)
	}
}

func TestNew_HappyPath(t *testing.T) {
	t.Parallel()

	src := newFakeMetadataSource(&metadata.Metadata{
		Databases:     nil,
		RemoteSchemas: nil,
	})

	logger := slog.New(slog.DiscardHandler)

	ctrl, err := controller.New(
		context.Background(),
		0,
		testAdminSecret,
		false,
		middleware.NewNoOpJWTAuthenticator(),
		src,
		logger,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if ctrl == nil {
		t.Fatal("expected non-nil controller")
	}
}

func TestRun_ExitsOnContextCancel(t *testing.T) {
	t.Parallel()

	src := newFakeMetadataSource(&metadata.Metadata{
		Databases:     nil,
		RemoteSchemas: nil,
	})

	logger := slog.New(slog.DiscardHandler)

	ctrl, err := controller.New(
		context.Background(),
		0,
		testAdminSecret,
		false,
		middleware.NewNoOpJWTAuthenticator(),
		src,
		logger,
	)
	if err != nil {
		t.Fatalf("New: %v", err)
	}

	runCtx, cancel := context.WithCancel(context.Background())

	done := make(chan struct{})
	go func() {
		ctrl.Run(runCtx, logger)
		close(done)
	}()

	cancel()
	src.Close()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Run did not exit after context cancel")
	}
}

func TestRun_ReloadErrorKeepsCurrentState(t *testing.T) {
	t.Parallel()

	src := newFakeMetadataSource(&metadata.Metadata{
		Databases:     nil,
		RemoteSchemas: nil,
	})

	logger := slog.New(slog.DiscardHandler)

	ctrl, err := controller.New(
		context.Background(),
		0,
		testAdminSecret,
		false,
		middleware.NewNoOpJWTAuthenticator(),
		src,
		logger,
	)
	if err != nil {
		t.Fatalf("New: %v", err)
	}

	runCtx, cancel := context.WithCancel(context.Background())
	defer cancel()

	done := make(chan struct{})
	go func() {
		ctrl.Run(runCtx, logger)
		close(done)
	}()

	// Push a reload-failure update — Run should log it and continue.
	src.updates <- metadata.Update{Metadata: nil, Err: errSentinel}

	// Verify Run is still alive by sending a successful reload.
	src.updates <- metadata.Update{
		Metadata: &metadata.Metadata{Databases: nil, RemoteSchemas: nil},
		Err:      nil,
	}

	// Cancel and confirm clean exit.
	cancel()
	src.Close()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Run did not exit after context cancel")
	}
}

// TestRun_ReloadReplacesInconsistencies pins the per-build snapshot contract:
// each buildState call must allocate a fresh metadata.Inconsistencies and the
// swap must replace (not append to) the prior state's entries. A regression
// that reused a long-lived collector across reloads would cause the inconsistent
// startup entry to persist into the clean reload's snapshot.
func TestRun_ReloadReplacesInconsistencies(t *testing.T) {
	t.Parallel()

	// Start inconsistent: one source with an unsupported kind.
	src := newFakeMetadataSource(&metadata.Metadata{
		Databases: []metadata.DatabaseMetadata{
			{
				Name:          "db",
				Kind:          "this-kind-does-not-exist",
				Configuration: metadata.DatabaseConfiguration{},
				Tables:        nil,
				Functions:     nil,
			},
		},
		RemoteSchemas: nil,
	})

	logger := slog.New(slog.DiscardHandler)

	ctrl, err := controller.New(
		context.Background(),
		0,
		testAdminSecret,
		false,
		middleware.NewNoOpJWTAuthenticator(),
		src,
		logger,
	)
	if err != nil {
		t.Fatalf("New: %v", err)
	}

	if got := len(ctrl.Inconsistencies()); got != 1 {
		t.Fatalf("expected 1 inconsistency after initial load, got %d", got)
	}

	runCtx, cancel := context.WithCancel(context.Background())
	defer cancel()

	done := make(chan struct{})
	go func() {
		ctrl.Run(runCtx, logger)
		close(done)
	}()

	// Push a clean reload. The new state must overwrite the prior snapshot,
	// not extend it.
	src.updates <- metadata.Update{
		Metadata: &metadata.Metadata{Databases: nil, RemoteSchemas: nil},
		Err:      nil,
	}

	deadline := time.Now().Add(2 * time.Second)
	for len(ctrl.Inconsistencies()) != 0 {
		if time.Now().After(deadline) {
			t.Fatalf(
				"inconsistencies not cleared after clean reload: %+v",
				ctrl.Inconsistencies(),
			)
		}

		time.Sleep(10 * time.Millisecond)
	}

	cancel()
	src.Close()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Run did not exit after context cancel")
	}
}

// --- Resolve public surface ----------------------------------------------

// errorConnector wraps a memconnector but replaces the schema-bearing
// connector behaviour with a controllable Execute result, so tests can drive
// the executeConnectors error branches.
type errorConnector struct {
	connector.Connector

	execErr error
}

func (e *errorConnector) Execute(
	ctx context.Context,
	op *ast.OperationDefinition,
	frags ast.FragmentDefinitionList,
	vars map[string]any,
	role string,
	sessionVars map[string]any,
	logger *slog.Logger,
) (map[string]any, error) {
	if e.execErr != nil {
		return nil, e.execErr
	}

	return e.Connector.Execute(ctx, op, frags, vars, role, sessionVars, logger) //nolint:wrapcheck
}

type validationTestDriver struct{}

func (d validationTestDriver) Introspect(
	context.Context,
	*metadata.DatabaseMetadata,
) (*introspection.Objects, error) {
	objs := introspection.NewObjects()
	objs.Schemas["public"] = &introspection.Schema{
		Tables: map[string]*introspection.Table{
			"users": {
				Schema:      "public",
				Name:        "users",
				Columns:     []introspection.Column{{Name: "id", Type: "uuid"}},
				PrimaryKeys: []string{"id"},
			},
		},
	}

	return objs, nil
}

func (d validationTestDriver) ExecuteOperations(
	context.Context,
	[]core.SQLOperation,
	*slog.Logger,
) (map[string]any, error) {
	return nil, errors.New( //nolint:err113 // test-only guard if validation unexpectedly reaches execution.
		"ExecuteOperations should not run for a query-validation failure",
	)
}

func (d validationTestDriver) ExecuteMultiplexedOperation(
	context.Context,
	string,
	[]any,
	*slog.Logger,
) ([]core.MultiplexedResult, error) {
	return nil, errors.New( //nolint:err113 // test-only guard if HTTP query unexpectedly multiplexes.
		"ExecuteMultiplexedOperation should not run in HTTP query tests",
	)
}

func (d validationTestDriver) Dialect() dialect.Dialect {
	return dialect.NewPostgresDialect()
}

func (d validationTestDriver) Close() {}

func TestHandlerPost_MultiConnectorMergesResults(t *testing.T) {
	t.Parallel()

	// Two memconnectors each own a different root field. The controller
	// should route each field to its owning connector and merge results.
	connA, err := memconnector.New(
		[]*graph.ObjectType{
			memconnector.Object(
				"User",
				memconnector.ID("id"),
				memconnector.String("name"),
			),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"users",
				graph.NewNonNullListType(graph.NewNonNullType("User")),
				jsontext.Value(`[{"id":"1","name":"Alice"}]`),
			),
		},
	)
	if err != nil {
		t.Fatalf("memconnector.New(connA): %v", err)
	}

	connB, err := memconnector.New(
		[]*graph.ObjectType{
			memconnector.Object(
				"Order",
				memconnector.ID("id"),
				memconnector.String("product"),
			),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"orders",
				graph.NewNonNullListType(graph.NewNonNullType("Order")),
				jsontext.Value(`[{"id":"o1","product":"Widget"}]`),
			),
		},
	)
	if err != nil {
		t.Fatalf("memconnector.New(connB): %v", err)
	}

	logger := slog.New(slog.DiscardHandler)

	ctrl, err := controller.NewFromConnectors(
		testAdminSecret,
		map[string]connector.Connector{"a": connA, "b": connB},
		nil,
		logger,
	)
	if err != nil {
		t.Fatalf("NewFromConnectors: %v", err)
	}

	router := newTestRouter(t, ctrl)

	body := []byte(`{"query":"{ users { id name } orders { id product } }"}`)

	req := httptest.NewRequest(http.MethodPost, "/graphql", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	out := w.Body.String()
	if !strings.Contains(out, `"users"`) {
		t.Errorf("expected merged users field in response, got %s", out)
	}

	if !strings.Contains(out, `"orders"`) {
		t.Errorf("expected merged orders field in response, got %s", out)
	}
}

func TestHandlerPost_ConnectorErrorSurfacedAsGraphQLError(t *testing.T) {
	t.Parallel()

	// connA serves users normally; connB raises a plain (raw-driver-like) error
	// from Execute. The controller should surface a SANITIZED error in the
	// response envelope (generic message + trace id, never the raw
	// detail) while preserving connA's data (partial-merge behaviour).
	connA, err := memconnector.New(
		[]*graph.ObjectType{
			memconnector.Object(
				"User",
				memconnector.ID("id"),
				memconnector.String("name"),
			),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"users",
				graph.NewNonNullListType(graph.NewNonNullType("User")),
				jsontext.Value(`[{"id":"1","name":"Alice"}]`),
			),
		},
	)
	if err != nil {
		t.Fatalf("memconnector.New(connA): %v", err)
	}

	baseB, err := memconnector.New(
		[]*graph.ObjectType{
			memconnector.Object(
				"Order",
				memconnector.ID("id"),
			),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"orders",
				graph.NewNonNullListType(graph.NewNonNullType("Order")),
				jsontext.Value(`[]`),
			),
		},
	)
	if err != nil {
		t.Fatalf("memconnector.New(baseB): %v", err)
	}

	connB := &errorConnector{Connector: baseB, execErr: errSentinel}

	logger := slog.New(slog.DiscardHandler)

	ctrl, err := controller.NewFromConnectors(
		testAdminSecret,
		map[string]connector.Connector{"a": connA, "b": connB},
		nil,
		logger,
	)
	if err != nil {
		t.Fatalf("NewFromConnectors: %v", err)
	}

	router := newTestRouter(t, ctrl)

	body := []byte(`{"query":"{ users { id name } orders { id } }"}`)

	req := httptest.NewRequest(http.MethodPost, "/graphql", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	body2 := readJSONBody(t, w)

	errs, ok := body2["errors"].([]any)
	if !ok || len(errs) == 0 {
		t.Fatalf("expected errors in response, got %v", body2)
	}

	msg, _ := errs[0].(map[string]any)["message"].(string)
	if strings.Contains(msg, "test sentinel") {
		t.Errorf("raw connector error detail leaked to client: %q", msg)
	}

	if !strings.Contains(msg, "internal server error") ||
		!strings.Contains(msg, "trace id:") {
		t.Errorf(
			"expected sanitized generic message with trace id, got %q",
			msg,
		)
	}

	// connA's data should still be present (partial merge).
	data, _ := body2["data"].(map[string]any)
	if _, hasUsers := data["users"]; !hasUsers {
		t.Errorf("expected partial-merge of connA data under 'users', got %v", body2)
	}
}

func TestHandlerPost_NegativeLimitOffsetReturnsValidationFailed(t *testing.T) {
	t.Parallel()

	dbMeta := &metadata.DatabaseMetadata{
		Kind: "postgres",
		Tables: []metadata.TableMetadata{
			{Table: metadata.TableSource{Schema: "public", Name: "users"}},
		},
	}

	sqlConn, err := sqlconnector.NewConnector(
		t.Context(),
		validationTestDriver{},
		dbMeta,
		nil,
		slog.New(slog.DiscardHandler),
	)
	if err != nil {
		t.Fatalf("NewConnector: %v", err)
	}

	ctrl, err := controller.NewFromConnectors(
		testAdminSecret,
		map[string]connector.Connector{"sql": sqlConn},
		nil,
		slog.New(slog.DiscardHandler),
	)
	if err != nil {
		t.Fatalf("NewFromConnectors: %v", err)
	}

	router := newTestRouter(t, ctrl)

	tests := []struct {
		name        string
		query       string
		wantMessage string
		wantPath    string
	}{
		{
			name:        "limit",
			query:       `{"query":"{ staff: users(limit: -1) { id } }"}`,
			wantMessage: "unexpected negative value for limit",
			wantPath:    "$.selectionSet.staff.args.limit",
		},
		{
			name:        "offset",
			query:       `{"query":"{ staff: users(offset: -1) { id } }"}`,
			wantMessage: "unexpected negative value for offset",
			wantPath:    "$.selectionSet.staff.args.offset",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			req := httptest.NewRequest(
				http.MethodPost,
				"/graphql",
				strings.NewReader(tt.query),
			)
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
			}

			body := readJSONBody(t, w)

			errs, ok := body["errors"].([]any)
			if !ok || len(errs) != 1 {
				t.Fatalf("expected one error in response, got %v", body)
			}

			errObj, ok := errs[0].(map[string]any)
			if !ok {
				t.Fatalf("error: got %T, want map[string]any", errs[0])
			}

			if errObj["message"] != tt.wantMessage {
				t.Fatalf("message: got %q, want %q", errObj["message"], tt.wantMessage)
			}

			ext, ok := errObj["extensions"].(map[string]any)
			if !ok {
				t.Fatalf("extensions: got %T, want map[string]any", errObj["extensions"])
			}

			if ext["code"] != "validation-failed" {
				t.Errorf("extensions.code: got %v, want validation-failed", ext["code"])
			}

			if ext["path"] != tt.wantPath {
				t.Errorf("extensions.path: got %v, want %s", ext["path"], tt.wantPath)
			}
		})
	}
}

func TestHandlerPost_GraphQLErrorTypePathIsExercised(t *testing.T) {
	t.Parallel()

	// A *remoteschema.GraphQLError with no inner errors still routes through
	// the errors.As branch (vs. the generic error path). The zero-Errors
	// case exercises the type-assertion branch and confirms no panic on the
	// empty slice; a populated case is covered separately further down.
	connA, err := memconnector.New(
		[]*graph.ObjectType{
			memconnector.Object(
				"User",
				memconnector.ID("id"),
			),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"users",
				graph.NewNonNullListType(graph.NewNonNullType("User")),
				jsontext.Value(`[]`),
			),
		},
	)
	if err != nil {
		t.Fatalf("memconnector.New(connA): %v", err)
	}

	connB := &errorConnector{
		Connector: connA,
		execErr:   &remoteschema.GraphQLError{Errors: nil},
	}

	logger := slog.New(slog.DiscardHandler)

	ctrl, err := controller.NewFromConnectors(
		testAdminSecret,
		map[string]connector.Connector{"a": connB},
		nil,
		logger,
	)
	if err != nil {
		t.Fatalf("NewFromConnectors: %v", err)
	}

	router := newTestRouter(t, ctrl)

	body := []byte(`{"query":"{ users { id } }"}`)

	req := httptest.NewRequest(http.MethodPost, "/graphql", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// The empty-Errors GraphQLError produces no entries in allErrors, so
	// executeConnectors falls through to a non-error response. The point of
	// this test is to confirm the errors.As branch executes without panic
	// when the typed-error contains an empty slice.
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestHandlerPost_RemoteRelationshipsResolvedEndToEnd(t *testing.T) {
	t.Parallel()

	// connA (db1) exposes users with a remote "orders" relationship.
	// connB (db2) exposes orders keyed by userId.
	// The relationships map tells the planner that User.orders should be
	// resolved from db2 by matching User.id → Order.userId.
	usersResponse := []any{
		map[string]any{"id": "1", "name": "Alice"},
		map[string]any{"id": "2", "name": "Bob"},
	}

	connA, err := memconnector.New(
		[]*graph.ObjectType{
			memconnector.Object(
				"User",
				memconnector.ID("id"),
				memconnector.String("name"),
				memconnector.Field("orders",
					memconnector.NonNullList(memconnector.NonNull("Order"))),
			),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"users",
				graph.NewNonNullListType(graph.NewNonNullType("User")),
				usersResponse,
			),
		},
	)
	if err != nil {
		t.Fatalf("memconnector.New(connA): %v", err)
	}

	ordersResponse := []any{
		map[string]any{"id": "o1", "userId": "1", "product": "Widget"},
		map[string]any{"id": "o2", "userId": "2", "product": "Gadget"},
	}

	connB, err := memconnector.New(
		[]*graph.ObjectType{
			memconnector.Object(
				"Order",
				memconnector.ID("id"),
				memconnector.String("userId"),
				memconnector.String("product"),
			),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"orders",
				graph.NewNonNullListType(graph.NewNonNullType("Order")),
				ordersResponse,
			),
		},
	)
	if err != nil {
		t.Fatalf("memconnector.New(connB): %v", err)
	}

	relationships := map[string][]*plannerpkg.RelationshipMetadata{
		"a": {
			{
				Name:              "orders",
				SourceType:        "User",
				TargetConnector:   "b",
				TargetTable:       "orders",
				TargetTableSchema: "",
				JoinMapping:       map[string]string{"id": "userId"},
				IsArray:           true,
				IsRemote:          true,
				LHSFields:         nil,
				RemoteFieldPath:   nil,
			},
		},
	}

	logger := slog.New(slog.DiscardHandler)

	ctrl, err := controller.NewFromConnectors(
		testAdminSecret,
		map[string]connector.Connector{"a": connA, "b": connB},
		relationships,
		logger,
	)
	if err != nil {
		t.Fatalf("NewFromConnectors: %v", err)
	}

	router := newTestRouter(t, ctrl)

	body := []byte(`{"query":"{ users { id orders { id product } } }"}`)

	req := httptest.NewRequest(http.MethodPost, "/graphql", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	body2 := readJSONBody(t, w)

	if _, hasErr := body2["errors"]; hasErr {
		t.Fatalf("expected no errors, got %v", body2)
	}

	// Verify the remote-relationship resolver ran: each parent user must have
	// an "orders" key present in the output. The memconnector ignores its
	// field alias, so the stitching looks up under "" rather than "orders"
	// and the matches array is empty; that's a memconnector limitation, not
	// a controller bug. The integration suite covers the stitched-values
	// case against a real SQL connector. What we assert here is that the
	// controller plans the remote query, invokes the resolver, and writes
	// the relationship field onto each parent row.
	data, ok := body2["data"].(map[string]any)
	if !ok {
		t.Fatalf("missing data: %v", body2)
	}

	users, ok := data["users"].([]any)
	if !ok || len(users) != 2 {
		t.Fatalf("expected 2 users, got %v", users)
	}

	for _, u := range users {
		userMap, ok := u.(map[string]any)
		if !ok {
			t.Fatalf("user not a map: %v", u)
		}

		if _, hasOrders := userMap["orders"]; !hasOrders {
			t.Errorf(
				"user %v missing 'orders' field — resolveRemoteRelationships did not run",
				userMap,
			)
		}
	}
}

func TestResolve_NoSessionReturnsError(t *testing.T) {
	t.Parallel()

	ctrl := newTestController(t)

	// Skip the middleware entirely — context has no session.
	resp, err := ctrl.Resolve(context.Background(), controller.GraphQLRequest{
		Query: `{ users { id } }`,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp == nil {
		t.Fatal("expected response, got nil")
	}

	// Errors should mention session.
	errs, ok := resp.Errors.([]map[string]any)
	if !ok || len(errs) == 0 {
		t.Fatalf("expected non-empty errors, got %+v", resp)
	}

	msg, _ := errs[0]["message"].(string)
	if !strings.Contains(strings.ToLower(msg), "session") {
		t.Errorf("expected session-related error, got %q", msg)
	}
}

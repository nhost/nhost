package action_test

import (
	"bytes"
	"context"
	json "encoding/json/v2"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	"github.com/nhost/nhost/services/constellation/connector/action"
	"github.com/nhost/nhost/services/constellation/connector/action/store"
	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/internal/requestcontext"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/validator"
	"github.com/vektah/gqlparser/v2/validator/rules"
)

type asyncDoer struct {
	t *testing.T
}

type blockingDoer struct {
	started chan struct{}
}

type deadlineDoer struct{}

type failContextStore struct {
	inner        *store.MemoryStore
	failCtxErrCh chan error
}

func (d asyncDoer) Do(req *http.Request) (*http.Response, error) {
	d.t.Helper()

	var payload struct {
		Action struct {
			Name string `json:"name"`
		} `json:"action"`
		Input            map[string]any `json:"input"`
		SessionVariables map[string]any `json:"session_variables"`
	}
	if err := json.UnmarshalRead(req.Body, &payload); err != nil {
		d.t.Fatalf("decoding async action payload: %v", err)
	}

	body, err := json.Marshal(map[string]any{
		"message": payload.Input["message"],
		"role":    payload.SessionVariables["x-hasura-role"],
	})
	if err != nil {
		d.t.Fatalf("marshaling async response: %v", err)
	}

	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader(body)),
		Header:     make(http.Header),
	}, nil
}

func (d blockingDoer) Do(req *http.Request) (*http.Response, error) {
	select {
	case <-d.started:
	default:
		close(d.started)
	}

	<-req.Context().Done()

	return nil, fmt.Errorf("blocked action request canceled: %w", req.Context().Err())
}

func (d deadlineDoer) Do(req *http.Request) (*http.Response, error) {
	<-req.Context().Done()

	return nil, fmt.Errorf("deadline action request stopped: %w", req.Context().Err())
}

func (s *failContextStore) Insert(
	ctx context.Context,
	entry action.ActionLogInsert,
) (action.ActionLogEntry, error) {
	stored, err := s.inner.Insert(ctx, entry)
	if err != nil {
		return action.ActionLogEntry{}, fmt.Errorf("inserting into wrapped memory store: %w", err)
	}

	return stored, nil
}

func (s *failContextStore) ClaimPending(
	ctx context.Context,
	limit int,
) ([]action.ActionLogEntry, error) {
	entries, err := s.inner.ClaimPending(ctx, limit)
	if err != nil {
		return nil, fmt.Errorf("claiming from wrapped memory store: %w", err)
	}

	return entries, nil
}

func (s *failContextStore) Complete(
	ctx context.Context,
	id uuid.UUID,
	responsePayload []byte,
) error {
	if err := s.inner.Complete(ctx, id, responsePayload); err != nil {
		return fmt.Errorf("completing wrapped memory store entry: %w", err)
	}

	return nil
}

func (s *failContextStore) Fail(
	ctx context.Context,
	id uuid.UUID,
	errorsPayload []byte,
) error {
	s.failCtxErrCh <- ctx.Err()

	if err := s.inner.Fail(ctx, id, errorsPayload); err != nil {
		return fmt.Errorf("failing wrapped memory store entry: %w", err)
	}

	return nil
}

func (s *failContextStore) Get(
	ctx context.Context,
	id uuid.UUID,
) (action.ActionLogEntry, bool, error) {
	entry, ok, err := s.inner.Get(ctx, id)
	if err != nil {
		return action.ActionLogEntry{}, false, fmt.Errorf(
			"getting from wrapped memory store: %w",
			err,
		)
	}

	return entry, ok, nil
}

func (s *failContextStore) RequeueProcessing(ctx context.Context, ids []uuid.UUID) error {
	if err := s.inner.RequeueProcessing(ctx, ids); err != nil {
		return fmt.Errorf("requeueing wrapped memory store entries: %w", err)
	}

	return nil
}

func (s *failContextStore) Close() {
	s.inner.Close()
}

func TestAsyncActionMutationQueryAndAuthorization(t *testing.T) {
	t.Parallel()

	logStore := store.NewMemory()
	conn := action.New(
		t.Context(),
		asyncMetadata(),
		metadata.NewInconsistencies(),
		slog.Default(),
		asyncDoer{t: t},
		nil,
		nil,
		nil,
		action.WithAsyncConfig(action.AsyncConfig{
			Store:           logStore,
			WorkerEnabled:   true,
			PollInterval:    5 * time.Millisecond,
			BatchSize:       1,
			MaxConcurrency:  1,
			ShutdownTimeout: time.Second,
		}),
	)
	t.Cleanup(conn.Close)

	ctx := requestcontext.GraphQLQueryToContext(
		t.Context(),
		`mutation { asyncEcho(message: "hello") }`,
	)

	mutationResult, err := executeActionQuery(
		ctx,
		t,
		conn,
		"user",
		`mutation { asyncEcho(message: "hello") }`,
		nil,
		map[string]any{
			"x-hasura-role":    "user",
			"x-hasura-user-id": "user-1",
		},
	)
	if err != nil {
		t.Fatalf("async mutation Execute: %v", err)
	}

	id := actionResultString(t, mutationResult, "asyncEcho")
	if id == "" {
		t.Fatal("async mutation id is empty")
	}

	query := `query AsyncResult($id: uuid!) {
		asyncEcho(id: $id) { id errors output { message role } }
	}`
	variables := map[string]any{"id": id}

	var result map[string]any

	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		result, err = executeActionQuery(
			t.Context(),
			t,
			conn,
			"user",
			query,
			variables,
			map[string]any{
				"x-hasura-role":    "user",
				"x-hasura-user-id": "user-1",
			},
		)
		if err != nil {
			t.Fatalf("async result Execute: %v", err)
		}

		payload := actionResultMap(t, result, "asyncEcho")
		if output, _ := payload["output"].(map[string]any); output != nil {
			break
		}

		time.Sleep(10 * time.Millisecond)
	}

	want := map[string]any{
		"asyncEcho": map[string]any{
			"id":     id,
			"errors": nil,
			"output": map[string]any{
				"message": "hello",
				"role":    "user",
			},
		},
	}
	if diff := cmp.Diff(want, result); diff != "" {
		t.Fatalf("async query result mismatch (-want +got):\n%s", diff)
	}

	crossSessionResult, err := executeActionQuery(
		t.Context(),
		t,
		conn,
		"user",
		query,
		variables,
		map[string]any{
			"x-hasura-role":    "user",
			"x-hasura-user-id": "user-2",
		},
	)
	if err != nil {
		t.Fatalf("cross-session async result Execute: %v", err)
	}

	if got := crossSessionResult["asyncEcho"]; got != nil {
		t.Fatalf("cross-session async result = %#v, want nil", got)
	}

	adminResult, err := executeActionQuery(
		t.Context(),
		t,
		conn,
		metadata.RoleAdmin,
		query,
		variables,
		map[string]any{"x-hasura-role": metadata.RoleAdmin},
	)
	if err != nil {
		t.Fatalf("admin async result Execute: %v", err)
	}

	if got := adminResult["asyncEcho"]; got == nil {
		t.Fatalf("admin async result = nil, want row")
	}
}

func TestAsyncWorkerPersistsDeadlineErrorsWithFreshStoreContext(t *testing.T) {
	t.Parallel()

	logStore := &failContextStore{
		inner:        store.NewMemory(),
		failCtxErrCh: make(chan error, 1),
	}
	meta := asyncMetadata()
	meta.Actions[0].Definition.Timeout = 1
	conn := action.New(
		t.Context(),
		meta,
		metadata.NewInconsistencies(),
		slog.Default(),
		deadlineDoer{},
		nil,
		nil,
		nil,
		action.WithAsyncConfig(action.AsyncConfig{
			Store:           logStore,
			WorkerEnabled:   true,
			PollInterval:    time.Millisecond,
			BatchSize:       1,
			MaxConcurrency:  1,
			ShutdownTimeout: time.Second,
		}),
	)
	t.Cleanup(conn.Close)

	_, err := executeActionQuery(
		t.Context(),
		t,
		conn,
		"user",
		`mutation { asyncEcho(message: "hello") }`,
		nil,
		map[string]any{
			"x-hasura-role":    "user",
			"x-hasura-user-id": "user-1",
		},
	)
	if err != nil {
		t.Fatalf("async mutation Execute: %v", err)
	}

	select {
	case err := <-logStore.failCtxErrCh:
		if err != nil {
			t.Fatalf("Fail context error = %v, want nil", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("async worker did not persist deadline failure")
	}
}

func TestAsyncWorkerCloseRequeuesUnstartedBatchEntries(t *testing.T) {
	t.Parallel()

	logStore := store.NewMemory()
	for range 2 {
		if _, err := logStore.Insert(t.Context(), action.ActionLogInsert{
			ActionName:     "asyncEcho",
			InputPayload:   map[string]any{"message": "hello"},
			RequestHeaders: http.Header{},
			SessionVariables: map[string]any{
				"x-hasura-role":    "user",
				"x-hasura-user-id": "user-1",
			},
		}); err != nil {
			t.Fatalf("Insert pending async action: %v", err)
		}
	}

	started := make(chan struct{})
	conn := action.New(
		t.Context(),
		asyncMetadata(),
		metadata.NewInconsistencies(),
		slog.Default(),
		blockingDoer{started: started},
		nil,
		nil,
		nil,
		action.WithAsyncConfig(action.AsyncConfig{
			Store:           logStore,
			WorkerEnabled:   true,
			PollInterval:    time.Hour,
			BatchSize:       2,
			MaxConcurrency:  1,
			ShutdownTimeout: time.Millisecond,
		}),
	)

	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("async worker did not start processing action")
	}

	conn.Close()

	claimed, err := logStore.ClaimPending(t.Context(), 2)
	if err != nil {
		t.Fatalf("ClaimPending after Close: %v", err)
	}

	if len(claimed) != 2 {
		t.Fatalf("claimed after Close = %+v, want in-flight and unstarted actions", claimed)
	}
}

func TestAsyncWorkerCloseRequeuesInFlightAction(t *testing.T) {
	t.Parallel()

	logStore := store.NewMemory()
	started := make(chan struct{})
	conn := action.New(
		t.Context(),
		asyncMetadata(),
		metadata.NewInconsistencies(),
		slog.Default(),
		blockingDoer{started: started},
		nil,
		nil,
		nil,
		action.WithAsyncConfig(action.AsyncConfig{
			Store:           logStore,
			WorkerEnabled:   true,
			PollInterval:    time.Millisecond,
			BatchSize:       1,
			MaxConcurrency:  1,
			ShutdownTimeout: time.Millisecond,
		}),
	)

	mutationResult, err := executeActionQuery(
		t.Context(),
		t,
		conn,
		"user",
		`mutation { asyncEcho(message: "hello") }`,
		nil,
		map[string]any{
			"x-hasura-role":    "user",
			"x-hasura-user-id": "user-1",
		},
	)
	if err != nil {
		t.Fatalf("async mutation Execute: %v", err)
	}

	id := actionResultString(t, mutationResult, "asyncEcho")
	if id == "" {
		t.Fatal("async mutation id is empty")
	}

	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("async worker did not start processing action")
	}

	conn.Close()

	claimed, err := logStore.ClaimPending(t.Context(), 1)
	if err != nil {
		t.Fatalf("ClaimPending after Close: %v", err)
	}

	if len(claimed) != 1 {
		t.Fatalf("claimed after Close = %+v, want requeued action", claimed)
	}
}

// requeueCtxStore wraps a MemoryStore and records the context error observed by
// every RequeueProcessing call, so a test can assert the worker requeues on a
// non-canceled context even when its run context has already been canceled.
type requeueCtxStore struct {
	inner       *store.MemoryStore
	requeueErrs chan error
}

func (s *requeueCtxStore) Insert(
	ctx context.Context,
	entry action.ActionLogInsert,
) (action.ActionLogEntry, error) {
	stored, err := s.inner.Insert(ctx, entry)
	if err != nil {
		return action.ActionLogEntry{}, fmt.Errorf("inserting into wrapped memory store: %w", err)
	}

	return stored, nil
}

func (s *requeueCtxStore) ClaimPending(
	ctx context.Context,
	limit int,
) ([]action.ActionLogEntry, error) {
	entries, err := s.inner.ClaimPending(ctx, limit)
	if err != nil {
		return nil, fmt.Errorf("claiming from wrapped memory store: %w", err)
	}

	return entries, nil
}

func (s *requeueCtxStore) Complete(
	ctx context.Context,
	id uuid.UUID,
	responsePayload []byte,
) error {
	if err := s.inner.Complete(ctx, id, responsePayload); err != nil {
		return fmt.Errorf("completing wrapped memory store entry: %w", err)
	}

	return nil
}

func (s *requeueCtxStore) Fail(ctx context.Context, id uuid.UUID, errorsPayload []byte) error {
	if err := s.inner.Fail(ctx, id, errorsPayload); err != nil {
		return fmt.Errorf("failing wrapped memory store entry: %w", err)
	}

	return nil
}

func (s *requeueCtxStore) Get(
	ctx context.Context,
	id uuid.UUID,
) (action.ActionLogEntry, bool, error) {
	entry, ok, err := s.inner.Get(ctx, id)
	if err != nil {
		return action.ActionLogEntry{}, false, fmt.Errorf("getting from wrapped memory store: %w", err)
	}

	return entry, ok, nil
}

func (s *requeueCtxStore) RequeueProcessing(ctx context.Context, ids []uuid.UUID) error {
	s.requeueErrs <- ctx.Err()

	if err := s.inner.RequeueProcessing(ctx, ids); err != nil {
		return fmt.Errorf("requeueing wrapped memory store entries: %w", err)
	}

	return nil
}

func (s *requeueCtxStore) Close() {
	s.inner.Close()
}

// TestAsyncWorkerContextCancelRequeuesWithFreshContext exercises the hard-
// shutdown path: when the worker's run context is canceled while a batch has
// been claimed but not fully dispatched, the claimed-not-dispatched entries
// must be requeued on a fresh (non-canceled) context. Otherwise
// RequeueProcessing fails and the rows are stranded in 'processing' forever,
// since ClaimPending only reclaims status='created'.
func TestAsyncWorkerContextCancelRequeuesWithFreshContext(t *testing.T) {
	t.Parallel()

	logStore := &requeueCtxStore{
		inner:       store.NewMemory(),
		requeueErrs: make(chan error, 8),
	}

	for range 2 {
		if _, err := logStore.Insert(t.Context(), action.ActionLogInsert{
			ActionName:     "asyncEcho",
			InputPayload:   map[string]any{"message": "hello"},
			RequestHeaders: http.Header{},
			SessionVariables: map[string]any{
				"x-hasura-role":    "user",
				"x-hasura-user-id": "user-1",
			},
		}); err != nil {
			t.Fatalf("Insert pending async action: %v", err)
		}
	}

	started := make(chan struct{})
	ctx, cancel := context.WithCancel(t.Context())
	conn := action.New(
		ctx,
		asyncMetadata(),
		metadata.NewInconsistencies(),
		slog.Default(),
		blockingDoer{started: started},
		nil,
		nil,
		nil,
		action.WithAsyncConfig(action.AsyncConfig{
			Store:           logStore,
			WorkerEnabled:   true,
			PollInterval:    time.Hour,
			BatchSize:       2,
			MaxConcurrency:  1,
			ShutdownTimeout: time.Second,
		}),
	)
	t.Cleanup(conn.Close)

	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("async worker did not start processing action")
	}

	// Cancel the run context: one entry is in-flight (blocked in the doer) and
	// one is claimed but parked waiting for a worker slot. The parked entry hits
	// the ctx.Done branch of claimAndDispatch.
	cancel()

	select {
	case err := <-logStore.requeueErrs:
		if err != nil {
			t.Fatalf(
				"RequeueProcessing context error = %v, want nil "+
					"(canceled run context must not abort the shutdown requeue)",
				err,
			)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("async worker did not requeue claimed entries after context cancel")
	}
}

func actionResultMap(t *testing.T, result map[string]any, field string) map[string]any {
	t.Helper()

	payload, ok := result[field].(map[string]any)
	if !ok {
		t.Fatalf("%s result has type %T, want map[string]any", field, result[field])
	}

	return payload
}

func actionResultString(t *testing.T, result map[string]any, field string) string {
	t.Helper()

	value, ok := result[field].(string)
	if !ok {
		t.Fatalf("%s = %#v, want string", field, result[field])
	}

	return value
}

func asyncMetadata() *metadata.Metadata {
	return &metadata.Metadata{
		Databases:     nil,
		RemoteSchemas: nil,
		Actions: []metadata.ActionMetadata{
			{
				Name: "asyncEcho",
				Definition: metadata.ActionDefinition{
					Kind: metadata.ActionKindAsynchronous,
					Handler: metadata.EnvString(
						"https://actions.example.test/asyncEcho",
					),
					ForwardClientHeaders: false,
					Headers:              nil,
					Timeout:              30,
					Type:                 metadata.ActionOperationMutation,
					Arguments: []metadata.ActionArgument{
						{Name: "message", Type: "String!", Description: ""},
					},
					OutputType:        "AsyncEchoOutput!",
					RequestTransform:  nil,
					ResponseTransform: nil,
				},
				Permissions: []metadata.ActionPermission{{Role: "user"}},
				Comment:     "",
			},
		},
		CustomTypes: metadata.CustomTypes{
			InputObjects: nil,
			Objects: []metadata.CustomObjectType{
				{
					Name:        "AsyncEchoOutput",
					Description: "",
					Fields: []metadata.CustomTypeField{
						{Name: "message", Type: "String!", Description: ""},
						{Name: "role", Type: "String!", Description: ""},
					},
					Relationships: nil,
				},
			},
			Scalars: nil,
			Enums:   nil,
		},
		LoadDiagnostics: nil,
	}
}

func executeActionQuery(
	ctx context.Context,
	t *testing.T,
	conn *action.Connector,
	role string,
	query string,
	variables map[string]any,
	sessionVariables map[string]any,
) (map[string]any, error) {
	t.Helper()

	operation, fragments, validatedVariables := validatedActionOperation(
		t,
		conn,
		role,
		query,
		variables,
	)

	result, err := conn.Execute(
		ctx,
		operation,
		fragments,
		validatedVariables,
		role,
		sessionVariables,
		slog.Default(),
	)
	if err != nil {
		return nil, fmt.Errorf("executing action query: %w", err)
	}

	return result, nil
}

func validatedActionOperation(
	t *testing.T,
	conn *action.Connector,
	role string,
	query string,
	variables map[string]any,
) (*ast.OperationDefinition, ast.FragmentDefinitionList, map[string]any) {
	t.Helper()

	schemas, err := conn.GetSchema()
	if err != nil {
		t.Fatalf("GetSchema: %v", err)
	}

	schema := schemas[role]
	if schema == nil {
		t.Fatalf("schema for role %q not found", role)
	}

	_, validatedSchema, err := schemamerge.BuildValidatedSchema(schema, role)
	if err != nil {
		t.Fatalf("BuildValidatedSchema: %v", err)
	}

	doc, gqlErrs := gqlparser.LoadQueryWithRules(validatedSchema, query, rules.NewDefaultRules())
	if gqlErrs != nil {
		t.Fatalf("LoadQuery: %v", gqlErrs)
	}

	operation := doc.Operations[0]

	validatedVariables, err := validator.VariableValues(validatedSchema, operation, variables)
	if err != nil {
		t.Fatalf("VariableValues: %v", err)
	}

	return operation, doc.Fragments, validatedVariables
}

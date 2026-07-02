package store_test

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/nhost/nhost/services/constellation/connector/action"
	"github.com/nhost/nhost/services/constellation/connector/action/store"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
)

const defaultTestAdminDBURL = "postgresql://postgres:postgres@localhost:5433/postgres"

// actionLogTestDDL provisions the action-log schema/table the store expects.
// NewPostgres no longer issues DDL (schema is managed via migrations), so the
// integration tests create the table themselves via the test-db setup hook.
const actionLogTestDDL = `CREATE SCHEMA IF NOT EXISTS constellation_action_log_test;
CREATE TABLE constellation_action_log_test.hdb_action_log (
	id uuid PRIMARY KEY,
	action_name text NOT NULL,
	input_payload jsonb NOT NULL,
	request_headers jsonb NOT NULL,
	session_variables jsonb NOT NULL,
	response_payload jsonb,
	errors jsonb,
	created_at timestamptz NOT NULL DEFAULT now(),
	response_received_at timestamptz,
	status text NOT NULL DEFAULT 'created'
);
CREATE INDEX hdb_action_log_status_created_at_idx ON constellation_action_log_test.hdb_action_log (status, created_at);`

func TestPostgresStoreLifecycle(t *testing.T) { //nolint:paralleltest
	adminURL := os.Getenv("DATABASE_URL")
	if adminURL == "" {
		adminURL = defaultTestAdminDBURL
	}

	ctx, cancel := context.WithTimeout(t.Context(), 2*time.Second)
	defer cancel()

	probe, err := pgx.Connect(ctx, adminURL)
	if err != nil {
		t.Skipf("PostgreSQL unavailable for action log store integration test: %v", err)
	}

	probe.Close(ctx)

	pool := testdb.NewPostgres(t, actionLogTestDDL)

	logStore, err := store.NewPostgres(t.Context(), store.PostgresConfig{
		DatabaseURL: pool.Config().ConnConfig.ConnString(),
		Schema:      "constellation_action_log_test",
		Table:       "hdb_action_log",
	})
	if err != nil {
		t.Fatalf("NewPostgres: %v", err)
	}

	t.Cleanup(logStore.Close)

	entry, err := logStore.Insert(t.Context(), action.ActionLogInsert{
		ActionName:       "asyncEcho",
		InputPayload:     map[string]any{"message": "hello"},
		RequestHeaders:   nil,
		SessionVariables: map[string]any{"x-hasura-role": "user"},
	})
	if err != nil {
		t.Fatalf("Insert: %v", err)
	}

	claimed, err := logStore.ClaimPending(t.Context(), 1)
	if err != nil {
		t.Fatalf("ClaimPending: %v", err)
	}

	if len(claimed) != 1 || claimed[0].ID != entry.ID {
		t.Fatalf("claimed = %+v, want only %s", claimed, entry.ID)
	}

	if err := logStore.Complete(t.Context(), entry.ID, []byte(`{"ok":true}`)); err != nil {
		t.Fatalf("Complete: %v", err)
	}

	stored, ok, err := logStore.Get(t.Context(), entry.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}

	if !ok {
		t.Fatal("Get ok = false, want true")
	}

	if stored.Status != action.LogStatusCompleted {
		t.Fatalf("status = %s, want completed", stored.Status)
	}
}

// requirePostgres skips the test when no PostgreSQL is reachable.
func requirePostgres(t *testing.T) {
	t.Helper()

	adminURL := os.Getenv("DATABASE_URL")
	if adminURL == "" {
		adminURL = defaultTestAdminDBURL
	}

	ctx, cancel := context.WithTimeout(t.Context(), 2*time.Second)
	defer cancel()

	probe, err := pgx.Connect(ctx, adminURL)
	if err != nil {
		t.Skipf("PostgreSQL unavailable for action log store integration test: %v", err)
	}

	probe.Close(ctx)
}

// newActionLogStore returns a PostgresStore backed by a fresh isolated test DB.
func newActionLogStore(t *testing.T) *store.PostgresStore {
	t.Helper()

	requirePostgres(t)

	pool := testdb.NewPostgres(t, actionLogTestDDL)

	logStore, err := store.NewPostgres(t.Context(), store.PostgresConfig{
		DatabaseURL: pool.Config().ConnConfig.ConnString(),
		Schema:      "constellation_action_log_test",
		Table:       "hdb_action_log",
	})
	if err != nil {
		t.Fatalf("NewPostgres: %v", err)
	}

	t.Cleanup(logStore.Close)

	return logStore
}

func insertAndClaim(t *testing.T, s *store.PostgresStore) action.ActionLogEntry {
	t.Helper()

	entry, err := s.Insert(t.Context(), action.ActionLogInsert{
		ActionName:       "asyncEcho",
		InputPayload:     map[string]any{"message": "hello"},
		RequestHeaders:   nil,
		SessionVariables: map[string]any{"x-hasura-role": "user"},
	})
	if err != nil {
		t.Fatalf("Insert: %v", err)
	}

	claimed, err := s.ClaimPending(t.Context(), 1)
	if err != nil {
		t.Fatalf("ClaimPending: %v", err)
	}

	if len(claimed) != 1 || claimed[0].ID != entry.ID {
		t.Fatalf("claimed = %+v, want only %s", claimed, entry.ID)
	}

	return entry
}

func TestPostgresStoreFail(t *testing.T) { //nolint:paralleltest
	s := newActionLogStore(t)
	entry := insertAndClaim(t, s)

	if err := s.Fail(t.Context(), entry.ID, []byte(`[{"message":"boom"}]`)); err != nil {
		t.Fatalf("Fail: %v", err)
	}

	stored, ok, err := s.Get(t.Context(), entry.ID)
	if err != nil || !ok {
		t.Fatalf("Get: ok=%v err=%v", ok, err)
	}

	if stored.Status != action.LogStatusError {
		t.Fatalf("status = %s, want error", stored.Status)
	}

	// Failing a row that is no longer 'processing' is a stale claim.
	if err := s.Fail(
		t.Context(),
		entry.ID,
		[]byte(`[]`),
	); !errors.Is(err, action.ErrActionLogStaleClaim) {
		t.Fatalf("second Fail err = %v, want ErrActionLogStaleClaim", err)
	}
}

func TestPostgresStoreRequeueProcessing(t *testing.T) { //nolint:paralleltest
	s := newActionLogStore(t)
	entry := insertAndClaim(t, s)

	if err := s.RequeueProcessing(t.Context(), []uuid.UUID{entry.ID}); err != nil {
		t.Fatalf("RequeueProcessing: %v", err)
	}

	// After requeue the row is back to 'created' and claimable again.
	claimed, err := s.ClaimPending(t.Context(), 1)
	if err != nil {
		t.Fatalf("ClaimPending after requeue: %v", err)
	}

	if len(claimed) != 1 || claimed[0].ID != entry.ID {
		t.Fatalf("claimed after requeue = %+v, want %s", claimed, entry.ID)
	}
}

func TestPostgresStoreGetNotFound(t *testing.T) { //nolint:paralleltest
	s := newActionLogStore(t)

	_, ok, err := s.Get(t.Context(), uuid.New())
	if err != nil {
		t.Fatalf("Get: %v", err)
	}

	if ok {
		t.Fatal("Get ok = true for missing id, want false")
	}
}

func TestPostgresStoreCompleteEmptyAndNonJSONBody(t *testing.T) { //nolint:paralleltest
	tests := []struct {
		name string
		body []byte
	}{
		{"empty body", []byte("")},
		{"non-JSON body", []byte("OK")},
		{"nil body", nil},
	}

	//nolint:paralleltest // integration test shares one DB; subtests must stay serial
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := newActionLogStore(t)
			entry := insertAndClaim(t, s)

			// An empty / non-JSON 2xx body must not fail the ::jsonb cast and
			// strand the row in 'processing'.
			if err := s.Complete(t.Context(), entry.ID, tt.body); err != nil {
				t.Fatalf("Complete(%q): %v", tt.body, err)
			}

			stored, ok, err := s.Get(t.Context(), entry.ID)
			if err != nil || !ok {
				t.Fatalf("Get: ok=%v err=%v", ok, err)
			}

			if stored.Status != action.LogStatusCompleted {
				t.Fatalf("status = %s, want completed", stored.Status)
			}
		})
	}
}

func TestPostgresStoreValidateSchemaMissingColumns(t *testing.T) { //nolint:paralleltest
	requirePostgres(t)

	// A table missing the required "errors" column.
	const ddl = `CREATE SCHEMA bad_log;
CREATE TABLE bad_log.hdb_action_log (
	id uuid PRIMARY KEY,
	action_name text NOT NULL,
	input_payload jsonb NOT NULL,
	request_headers jsonb NOT NULL,
	session_variables jsonb NOT NULL,
	response_payload jsonb,
	created_at timestamptz NOT NULL DEFAULT now(),
	response_received_at timestamptz,
	status text NOT NULL DEFAULT 'created'
);`

	pool := testdb.NewPostgres(t, ddl)

	_, err := store.NewPostgres(t.Context(), store.PostgresConfig{
		DatabaseURL: pool.Config().ConnConfig.ConnString(),
		Schema:      "bad_log",
		Table:       "hdb_action_log",
	})
	if err == nil {
		t.Fatal("NewPostgres err = nil, want missing-required-columns error")
	}

	if !strings.Contains(err.Error(), "missing required columns") ||
		!strings.Contains(err.Error(), "errors") {
		t.Fatalf("err = %v, want missing required columns mentioning 'errors'", err)
	}
}

// TestPostgresStoreWithPoolDoesNotOwnPool verifies the shared-catalog-pool
// contract: a store built with NewPostgresWithPool operates on the injected
// pool but never closes it, so the pool stays usable after the store is closed
// (the serving process, not the connector, owns the catalog pool).
func TestPostgresStoreWithPoolDoesNotOwnPool(t *testing.T) { //nolint:paralleltest
	requirePostgres(t)

	pool := testdb.NewPostgres(t, actionLogTestDDL)

	logStore, err := store.NewPostgresWithPool(t.Context(), pool, store.PostgresConfig{
		DatabaseURL: "",
		Schema:      "constellation_action_log_test",
		Table:       "hdb_action_log",
	})
	if err != nil {
		t.Fatalf("NewPostgresWithPool: %v", err)
	}

	if _, err := logStore.Insert(t.Context(), action.ActionLogInsert{
		ActionName:       "asyncEcho",
		InputPayload:     map[string]any{"message": "hello"},
		RequestHeaders:   nil,
		SessionVariables: map[string]any{"x-hasura-role": "user"},
	}); err != nil {
		t.Fatalf("Insert: %v", err)
	}

	// Closing the store must be a no-op for the injected pool.
	logStore.Close()

	if err := pool.Ping(t.Context()); err != nil {
		t.Fatalf("pool unusable after store Close (store closed a pool it does not own): %v", err)
	}
}

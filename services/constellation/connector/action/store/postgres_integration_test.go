package store_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/nhost/nhost/services/constellation/connector/action"
	"github.com/nhost/nhost/services/constellation/connector/action/store"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
)

const defaultTestAdminDBURL = "postgresql://postgres:postgres@localhost:5433/postgres"

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

	pool := testdb.NewPostgres(t, "")

	logStore, err := store.NewPostgres(t.Context(), store.PostgresConfig{
		DatabaseURL:       pool.Config().ConnConfig.ConnString(),
		Schema:            "constellation_action_log_test",
		Table:             "hdb_action_log",
		CreateIfNotExists: true,
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

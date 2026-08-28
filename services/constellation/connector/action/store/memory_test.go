package store_test

import (
	json "encoding/json/v2"
	"errors"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/nhost/nhost/services/constellation/connector/action"
	"github.com/nhost/nhost/services/constellation/connector/action/store"
)

func TestMemoryStoreLifecycle(t *testing.T) {
	t.Parallel()

	logStore := store.NewMemory()

	entry, err := logStore.Insert(t.Context(), action.ActionLogInsert{
		ActionName:     "asyncEcho",
		InputPayload:   map[string]any{"message": "hello"},
		RequestHeaders: http.Header{"X-Test": []string{"one"}},
		SessionVariables: map[string]any{
			"x-hasura-role":    "user",
			"x-hasura-user-id": "user-1",
		},
	})
	if err != nil {
		t.Fatalf("Insert: %v", err)
	}

	claimed, err := logStore.ClaimPending(t.Context(), 10)
	if err != nil {
		t.Fatalf("ClaimPending: %v", err)
	}

	if len(claimed) != 1 || claimed[0].ID != entry.ID {
		t.Fatalf("claimed = %+v, want only %s", claimed, entry.ID)
	}

	response, err := json.Marshal(map[string]any{"message": "hello"})
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}

	if err := logStore.Complete(t.Context(), entry.ID, response); err != nil {
		t.Fatalf("Complete: %v", err)
	}

	stored, ok, err := logStore.Get(t.Context(), entry.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}

	if !ok {
		t.Fatalf("Get ok = false, want true")
	}

	if stored.Status != action.LogStatusCompleted {
		t.Fatalf("status = %s, want completed", stored.Status)
	}

	if string(stored.ResponsePayload) != string(response) {
		t.Fatalf("response payload = %s, want %s", stored.ResponsePayload, response)
	}

	if stored.ResponseReceivedAt == nil {
		t.Fatalf("ResponseReceivedAt = nil, want timestamp")
	}

	if err := logStore.Complete(
		t.Context(),
		entry.ID,
		response,
	); !errors.Is(err, action.ErrActionLogStaleClaim) {
		t.Fatalf("second Complete err = %v, want stale claim", err)
	}
}

func TestMemoryStoreRequeue(t *testing.T) {
	t.Parallel()

	logStore := store.NewMemory()

	entry, err := logStore.Insert(t.Context(), action.ActionLogInsert{
		ActionName:       "asyncEcho",
		InputPayload:     nil,
		RequestHeaders:   nil,
		SessionVariables: nil,
	})
	if err != nil {
		t.Fatalf("Insert: %v", err)
	}

	if _, err := logStore.ClaimPending(t.Context(), 1); err != nil {
		t.Fatalf("ClaimPending: %v", err)
	}

	if err := logStore.RequeueProcessing(t.Context(), []uuid.UUID{entry.ID}); err != nil {
		t.Fatalf("RequeueProcessing: %v", err)
	}

	claimed, err := logStore.ClaimPending(t.Context(), 1)
	if err != nil {
		t.Fatalf("ClaimPending after requeue: %v", err)
	}

	if len(claimed) != 1 || claimed[0].ID != entry.ID {
		t.Fatalf("claimed after requeue = %+v, want %s", claimed, entry.ID)
	}
}

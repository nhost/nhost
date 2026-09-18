package controller

import (
	"net/http"
	"testing"
)

const createRemoteRel = `{"type":"pg_create_remote_relationship","args":{` +
	`"source":"default",` +
	`"table":{"schema":"public","name":"users"},` +
	`"name":"profile",` +
	`"definition":{"to_source":{"source":"other","table":{"schema":"public","name":"profiles"},` +
	`"relationship_type":"object","field_mapping":{"id":"user_id"}}}}}`

func TestDispatch_PgCreateRemoteRelationship(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)
	trackUsers(t, router)

	code, body := postJSON(t, router, createRemoteRel)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v", code, body)
	}

	if body["message"] != "success" {
		t.Errorf("message=%v, want success", body["message"])
	}

	// Re-create → already-exists.
	code, body = postJSON(t, router, createRemoteRel)
	if code != http.StatusOK {
		t.Fatalf("re-create: %d %v", code, body)
	}

	if body["message"] != "already-exists" {
		t.Errorf("re-create message=%v, want already-exists", body["message"])
	}
}

func TestDispatch_PgDeleteRemoteRelationship(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)
	trackUsers(t, router)

	if code, _ := postJSON(t, router, createRemoteRel); code != http.StatusOK {
		t.Fatal("seed")
	}

	deleteBody := `{"type":"pg_delete_remote_relationship","args":{"source":"default",` +
		`"table":{"schema":"public","name":"users"},"name":"profile"}}`

	code, body := postJSON(t, router, deleteBody)
	if code != http.StatusOK {
		t.Fatalf("delete: %d %v", code, body)
	}

	if body["message"] != "success" {
		t.Errorf("delete message=%v, want success", body["message"])
	}

	// Delete missing → not-exists.
	code, body = postJSON(t, router, deleteBody)
	if code != http.StatusBadRequest {
		t.Fatalf("delete-missing: %d %v", code, body)
	}

	if body["code"] != "not-exists" {
		t.Errorf("delete-missing code=%v, want not-exists", body["code"])
	}
}

package controller

import (
	"net/http"
	"testing"
)

func trackHello(t *testing.T, router http.Handler) {
	t.Helper()

	code, body := postJSON(t, router,
		`{"type":"pg_track_function","args":{"source":"default",`+
			`"function":{"schema":"public","name":"hello"}}}`)
	if code != http.StatusOK {
		t.Fatalf("seed pg_track_function: %d %v", code, body)
	}
}

func TestDispatch_PgTrackFunction(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	body := `{"type":"pg_track_function","args":{"source":"default",` +
		`"function":{"schema":"public","name":"hello"}}}`

	if code, _ := postJSON(t, router, body); code != http.StatusOK {
		t.Fatal("first track")
	}

	// Idempotent re-track.
	code, resp := postJSON(t, router, body)
	if code != http.StatusOK {
		t.Fatalf("re-track: %d %v", code, resp)
	}

	if resp["message"] != "already-tracked" {
		t.Errorf("re-track message=%v, want already-tracked", resp["message"])
	}
}

func TestDispatch_PgUntrackFunction(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)
	trackHello(t, router)

	code, body := postJSON(t, router,
		`{"type":"pg_untrack_function","args":{"source":"default",`+
			`"function":{"schema":"public","name":"hello"}}}`)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v", code, body)
	}

	if body["message"] != "success" {
		t.Errorf("message=%v, want success", body["message"])
	}

	// Untrack missing → not-exists.
	code, body = postJSON(t, router,
		`{"type":"pg_untrack_function","args":{"source":"default",`+
			`"function":{"schema":"public","name":"hello"}}}`)
	if code != http.StatusBadRequest {
		t.Fatalf("missing: status=%d body=%v", code, body)
	}

	if body["code"] != "not-exists" {
		t.Errorf("missing code=%v, want not-exists", body["code"])
	}
}

func TestDispatch_PgSetFunctionCustomization(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)
	trackHello(t, router)

	code, body := postJSON(t, router,
		`{"type":"pg_set_function_customization","args":{"source":"default",`+
			`"function":{"schema":"public","name":"hello"},`+
			`"configuration":{"custom_name":"sayHello"}}}`)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v", code, body)
	}

	if body["message"] != "success" {
		t.Errorf("message=%v, want success", body["message"])
	}
}

func TestDispatch_PgFunctionPermissionCRUD(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)
	trackHello(t, router)

	createBody := `{"type":"pg_create_function_permission","args":{"source":"default",` +
		`"function":{"schema":"public","name":"hello"},"role":"user"}}`

	if code, _ := postJSON(t, router, createBody); code != http.StatusOK {
		t.Fatal("create")
	}

	code, body := postJSON(t, router, createBody)
	if code != http.StatusOK {
		t.Fatalf("re-create: %d %v", code, body)
	}

	if body["message"] != "already-exists" {
		t.Errorf("re-create message=%v, want already-exists", body["message"])
	}

	dropBody := `{"type":"pg_drop_function_permission","args":{"source":"default",` +
		`"function":{"schema":"public","name":"hello"},"role":"user"}}`

	code, body = postJSON(t, router, dropBody)
	if code != http.StatusOK {
		t.Fatalf("drop: %d %v", code, body)
	}

	code, body = postJSON(t, router, dropBody)
	if code != http.StatusBadRequest {
		t.Fatalf("drop-missing: %d %v", code, body)
	}

	if body["code"] != "not-exists" {
		t.Errorf("drop-missing code=%v, want not-exists", body["code"])
	}
}

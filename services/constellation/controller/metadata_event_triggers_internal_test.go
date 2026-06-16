package controller

import (
	"net/http"
	"testing"
)

const trackEventTrigger = `{"type":"pg_create_event_trigger","args":{` +
	`"source":"default",` +
	`"table":{"schema":"public","name":"users"},` +
	`"name":"on_user_change",` +
	`"definition":{"insert":{"columns":"*"}},` +
	`"webhook":"https://example.com/hook",` +
	`"retry_conf":{"num_retries":3,"interval_sec":10}}}`

func TestDispatch_PgCreateEventTrigger(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)
	trackUsers(t, router)

	code, body := postJSON(t, router, trackEventTrigger)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v", code, body)
	}

	if body["message"] != "success" {
		t.Errorf("message=%v, want success", body["message"])
	}

	// Re-create without replace → already-exists.
	code, body = postJSON(t, router, trackEventTrigger)
	if code != http.StatusOK {
		t.Fatalf("re-create: %d %v", code, body)
	}

	if body["message"] != "already-exists" {
		t.Errorf("re-create message=%v, want already-exists", body["message"])
	}
}

func TestDispatch_PgCreateEventTrigger_Replace(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)
	trackUsers(t, router)

	if code, _ := postJSON(t, router, trackEventTrigger); code != http.StatusOK {
		t.Fatal("seed")
	}

	// Same trigger name with replace=true → overwrites.
	code, body := postJSON(t, router, `{"type":"pg_create_event_trigger","args":{`+
		`"source":"default",`+
		`"table":{"schema":"public","name":"users"},`+
		`"name":"on_user_change",`+
		`"replace":true,`+
		`"definition":{"update":{"columns":"*"}},`+
		`"webhook":"https://example.com/hook2",`+
		`"retry_conf":{"num_retries":5,"interval_sec":20}}}`)
	if code != http.StatusOK {
		t.Fatalf("replace: %d %v", code, body)
	}

	if body["message"] != "success" {
		t.Errorf("replace message=%v, want success", body["message"])
	}
}

func TestDispatch_PgDeleteEventTrigger(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)
	trackUsers(t, router)

	if code, _ := postJSON(t, router, trackEventTrigger); code != http.StatusOK {
		t.Fatal("seed")
	}

	code, body := postJSON(t, router,
		`{"type":"pg_delete_event_trigger","args":{"source":"default",`+
			`"table":{"schema":"public","name":"users"},"name":"on_user_change"}}`)
	if code != http.StatusOK {
		t.Fatalf("delete: %d %v", code, body)
	}

	if body["message"] != "success" {
		t.Errorf("delete message=%v, want success", body["message"])
	}

	// Delete missing → not-exists.
	code, body = postJSON(t, router,
		`{"type":"pg_delete_event_trigger","args":{"source":"default",`+
			`"table":{"schema":"public","name":"users"},"name":"on_user_change"}}`)
	if code != http.StatusBadRequest {
		t.Fatalf("delete-missing: %d %v", code, body)
	}

	if body["code"] != "not-exists" {
		t.Errorf("delete-missing code=%v, want not-exists", body["code"])
	}
}

func TestDispatch_EventRuntime_NotSupported(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	runtimeOps := []string{
		"pg_redeliver_event",
		"pg_invoke_event_trigger",
		"pg_get_event_logs",
		"pg_get_event_by_id",
	}

	for _, op := range runtimeOps {
		t.Run(op, func(t *testing.T) {
			t.Parallel()

			code, body := postJSON(t, router,
				`{"type":"`+op+`","args":{"name":"x"}}`)
			if code != http.StatusBadRequest {
				t.Fatalf("status=%d body=%v", code, body)
			}

			if body["code"] != "not-supported" {
				t.Errorf("code=%v, want not-supported", body["code"])
			}
		})
	}
}

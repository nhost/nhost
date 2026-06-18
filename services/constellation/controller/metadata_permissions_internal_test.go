package controller

import (
	"net/http"
	"testing"
)

// trackUsers seeds the store with a public.users table the permission
// tests can attach to. Uses the dispatcher path so it mirrors a real
// request lifecycle (incidentally checking pg_track_table still works
// after the Phase 2 changes).
func trackUsers(t *testing.T, router http.Handler) {
	t.Helper()

	code, body := postJSON(t, router,
		`{"type":"pg_track_table","args":{"source":"default",`+
			`"table":{"schema":"public","name":"users"}}}`)
	if code != http.StatusOK {
		t.Fatalf("seed pg_track_table: status=%d body=%v", code, body)
	}
}

// assertPermissionCRUD drives the create/re-create/drop/drop-missing
// lifecycle for a single permission verb (op) against a freshly tracked
// public.users table, asserting the dispatcher's response and the
// store's resource-version/writer side effects at each step.
func assertPermissionCRUD(t *testing.T, op string) {
	t.Helper()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)
	trackUsers(t, router)

	createBody := `{"type":"pg_create_` + op + `_permission","args":{` +
		`"source":"default",` +
		`"table":{"schema":"public","name":"users"},` +
		`"role":"user",` +
		`"permission":{"columns":["id"],"filter":{}}}}`

	// First create → success.
	code, body := postJSON(t, router, createBody)
	if code != http.StatusOK {
		t.Fatalf("create: status=%d body=%v", code, body)
	}

	if body["message"] != "success" {
		t.Errorf("create message=%v, want success", body["message"])
	}

	// Second create → already-exists, no RV bump.
	rvBefore := store.ResourceVersion()
	callsBefore := w.callCount()

	code, body = postJSON(t, router, createBody)
	if code != http.StatusOK {
		t.Fatalf("re-create: status=%d body=%v", code, body)
	}

	if body["message"] != "already-exists" {
		t.Errorf("re-create message=%v, want already-exists", body["message"])
	}

	if store.ResourceVersion() != rvBefore {
		t.Errorf("RV bumped on idempotent re-create")
	}

	if w.callCount() != callsBefore {
		t.Errorf("writer called on idempotent re-create")
	}

	// Drop → success.
	dropBody := `{"type":"pg_drop_` + op + `_permission","args":{` +
		`"source":"default",` +
		`"table":{"schema":"public","name":"users"},` +
		`"role":"user"}}`

	code, body = postJSON(t, router, dropBody)
	if code != http.StatusOK {
		t.Fatalf("drop: status=%d body=%v", code, body)
	}

	if body["message"] != "success" {
		t.Errorf("drop message=%v, want success", body["message"])
	}

	// Drop missing → 400 not-exists.
	code, body = postJSON(t, router, dropBody)
	if code != http.StatusBadRequest {
		t.Fatalf("drop-missing: status=%d body=%v", code, body)
	}

	if body["code"] != "not-exists" {
		t.Errorf("drop-missing code=%v, want not-exists", body["code"])
	}
}

func TestDispatch_PermissionCRUD(t *testing.T) {
	t.Parallel()

	// permActions enumerates the 4 verbs the permission dispatcher routes
	// over. Each action gets its own (create, drop) pair so the table
	// covers all 8 ops without test duplication.
	permActions := []struct {
		name string
		op   string
	}{
		{"select", "select"},
		{"insert", "insert"},
		{"update", "update"},
		{"delete", "delete"},
	}

	for _, a := range permActions {
		t.Run(a.name, func(t *testing.T) {
			t.Parallel()

			assertPermissionCRUD(t, a.op)
		})
	}
}

func TestDispatch_PermissionsInBulkAtomicRejected(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)
	trackUsers(t, router)

	callsBefore := w.callCount()

	// Permission ops are outside Hasura's bulk_atomic whitelist, so a
	// permission inside bulk_atomic is rejected (strict parity) with no write.
	code, body := postJSON(t, router, `{
        "type": "bulk_atomic",
        "args": [
            {"type":"pg_create_select_permission","args":{"source":"default","table":{"schema":"public","name":"users"},"role":"user","permission":{"columns":["id"],"filter":{}}}}
        ]
    }`)
	if code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%v", code, body)
	}

	if got, _ := body["code"].(string); got != "not-supported" {
		t.Errorf("code = %q, want not-supported", body["code"])
	}

	if got := w.callCount() - callsBefore; got != 0 {
		t.Errorf("writer calls = %d, want 0", got)
	}
}

func TestDispatch_PermissionsInBulkSingleWrite(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)
	trackUsers(t, router)

	// The non-atomic bulk path accepts permissions and lands all four in a
	// single write (one resource_version bump).
	callsBefore := w.callCount()

	code, results, raw := postJSONArray(t, router, `{
        "type": "bulk",
        "args": [
            {"type":"pg_create_select_permission","args":{"source":"default","table":{"schema":"public","name":"users"},"role":"user","permission":{"columns":["id"],"filter":{}}}},
            {"type":"pg_create_insert_permission","args":{"source":"default","table":{"schema":"public","name":"users"},"role":"user","permission":{"columns":["id"],"check":{}}}},
            {"type":"pg_create_update_permission","args":{"source":"default","table":{"schema":"public","name":"users"},"role":"user","permission":{"columns":["id"],"filter":{}}}},
            {"type":"pg_create_delete_permission","args":{"source":"default","table":{"schema":"public","name":"users"},"role":"user","permission":{"filter":{}}}}
        ]
    }`)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%s", code, raw)
	}

	if len(results) != 4 {
		t.Fatalf("results = %d, want 4; body = %s", len(results), raw)
	}

	if got := w.callCount() - callsBefore; got != 1 {
		t.Errorf("writer calls in bulk = %d, want 1 (single write)", got)
	}
}

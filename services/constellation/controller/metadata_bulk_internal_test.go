package controller

import (
	"net/http"
	"strings"
	"testing"
)

func TestDispatch_Bulk_Success(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	code, body := postJSON(t, router, `{
        "type": "bulk",
        "args": [
            {"type": "pg_track_table", "args": {"source": "default", "table": {"schema": "public", "name": "users"}}},
            {"type": "pg_track_table", "args": {"source": "default", "table": {"schema": "public", "name": "orgs"}}}
        ]
    }`)
	if code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %v", code, body)
	}

	results, _ := body["bulk"].([]any)
	if len(results) != 2 {
		t.Fatalf("bulk results = %d, want 2", len(results))
	}

	// Two writes (one per child); RV bumped twice (11 → 12 → 13).
	if w.callCount() != 2 {
		t.Errorf("writer calls = %d, want 2", w.callCount())
	}

	for i, r := range results {
		m, _ := r.(map[string]any)
		if m["message"] != "success" {
			t.Errorf("child %d message = %v, want success", i, m["message"])
		}
	}
}

func TestDispatch_Bulk_FailFast(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	// Second child targets an unknown source → bulk aborts; third child never runs.
	code, body := postJSON(t, router, `{
        "type": "bulk",
        "args": [
            {"type": "pg_track_table", "args": {"source": "default", "table": {"schema": "public", "name": "users"}}},
            {"type": "pg_track_table", "args": {"source": "missing", "table": {"schema": "public", "name": "x"}}},
            {"type": "pg_track_table", "args": {"source": "default", "table": {"schema": "public", "name": "orgs"}}}
        ]
    }`)
	if code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body = %v", code, body)
	}

	if got, _ := body["code"].(string); got != "not-exists" {
		t.Errorf("code = %q, want not-exists", body["code"])
	}

	// First child succeeded (1 write). Third never ran. bulk is NOT atomic —
	// first child's mutation stays persisted.
	if w.callCount() != 1 {
		t.Errorf("writer calls = %d, want 1 (only first child wrote)", w.callCount())
	}
}

func TestDispatch_BulkKeepGoing_CollectsAll(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	code, body := postJSON(t, router, `{
        "type": "bulk_keep_going",
        "args": [
            {"type": "pg_track_table", "args": {"source": "default", "table": {"schema": "public", "name": "users"}}},
            {"type": "pg_track_table", "args": {"source": "missing", "table": {"schema": "public", "name": "x"}}},
            {"type": "pg_track_table", "args": {"source": "default", "table": {"schema": "public", "name": "orgs"}}}
        ]
    }`)
	if code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %v", code, body)
	}

	results, _ := body["bulk"].([]any)
	if len(results) != 3 {
		t.Fatalf("bulk results = %d, want 3", len(results))
	}

	// First & third succeeded; second has an error slot.
	if got, _ := results[0].(map[string]any)["message"].(string); got != "success" {
		t.Errorf("child 0 = %v, want success", results[0])
	}

	if got, _ := results[1].(map[string]any)["code"].(string); got != "not-exists" {
		t.Errorf("child 1 code = %v, want not-exists", results[1])
	}

	if got, _ := results[2].(map[string]any)["message"].(string); got != "success" {
		t.Errorf("child 2 = %v, want success", results[2])
	}

	if w.callCount() != 2 {
		t.Errorf("writer calls = %d, want 2 (two successes)", w.callCount())
	}
}

func TestDispatch_BulkAtomic_Success_OneRVBump(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	code, body := postJSON(t, router, `{
        "type": "bulk_atomic",
        "args": [
            {"type": "pg_track_table", "args": {"source": "default", "table": {"schema": "public", "name": "users"}}},
            {"type": "pg_track_table", "args": {"source": "default", "table": {"schema": "public", "name": "orgs"}}}
        ]
    }`)
	if code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %v", code, body)
	}

	results, _ := body["bulk"].([]any)
	if len(results) != 2 {
		t.Fatalf("bulk results = %d, want 2", len(results))
	}

	// Exactly one write for the whole atomic bulk → RV bumped once (11 → 12).
	if w.callCount() != 1 {
		t.Errorf("writer calls = %d, want 1 (atomic = single write)", w.callCount())
	}

	for i, r := range results {
		m, _ := r.(map[string]any)
		if m["message"] != "success" {
			t.Errorf("child %d message = %v, want success", i, m["message"])
		}

		if rv, _ := m["resource_version"].(float64); int64(rv) != 12 {
			t.Errorf("child %d rv = %v, want 12 (shared)", i, m["resource_version"])
		}
	}
}

func TestDispatch_BulkAtomic_Rollback(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	// First child would mutate; second child fails validation. Whole bulk
	// rolls back — writer is never called, RV unchanged, snapshot intact.
	code, body := postJSON(t, router, `{
        "type": "bulk_atomic",
        "args": [
            {"type": "pg_track_table", "args": {"source": "default", "table": {"schema": "public", "name": "users"}}},
            {"type": "pg_track_table", "args": {"source": "missing", "table": {"schema": "public", "name": "x"}}}
        ]
    }`)
	if code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body = %v", code, body)
	}

	if w.callCount() != 0 {
		t.Errorf("writer calls = %d, want 0 (atomic rollback)", w.callCount())
	}

	if got := store.ResourceVersion(); got != 11 {
		t.Errorf("ResourceVersion = %d, want 11 (unchanged on rollback)", got)
	}

	// Snapshot must not contain the first child's would-be mutation.
	raw, _ := store.HasuraSnapshotJSON()
	if got := string(raw); strings.Contains(got, `"name":"users"`) {
		t.Errorf("snapshot contains 'users' table — rollback failed; raw = %s", got)
	}
}

func TestDispatch_BulkAtomic_AllIdempotent_NoBump(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	// Seed: track users.
	if _, _, err := store.PgTrackTable(t.Context(), []byte(
		`{"source":"default","table":{"schema":"public","name":"users"}}`,
	)); err != nil {
		t.Fatalf("seed PgTrackTable: %v", err)
	}

	seedCalls := w.callCount()
	seedRV := store.ResourceVersion()

	// Now re-track the same table twice in an atomic bulk: both children
	// are no-ops, the whole bulk should also be a no-op.
	code, body := postJSON(t, router, `{
        "type": "bulk_atomic",
        "args": [
            {"type": "pg_track_table", "args": {"source": "default", "table": {"schema": "public", "name": "users"}}},
            {"type": "pg_track_table", "args": {"source": "default", "table": {"schema": "public", "name": "users"}}}
        ]
    }`)
	if code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %v", code, body)
	}

	if w.callCount() != seedCalls {
		t.Errorf(
			"writer calls = %d, want %d (no write on all-idempotent)",
			w.callCount(),
			seedCalls,
		)
	}

	if store.ResourceVersion() != seedRV {
		t.Errorf("RV = %d, want %d (unchanged on all-idempotent)", store.ResourceVersion(), seedRV)
	}

	results, _ := body["bulk"].([]any)
	if len(results) != 2 {
		t.Fatalf("bulk results = %d, want 2", len(results))
	}

	for i, r := range results {
		m, _ := r.(map[string]any)
		if m["message"] != "already-tracked" {
			t.Errorf("child %d message = %v, want already-tracked", i, m["message"])
		}
	}
}

func TestDispatch_BulkAtomic_NestedRejected(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	code, body := postJSON(t, router, `{
        "type": "bulk_atomic",
        "args": [
            {"type": "bulk", "args": []}
        ]
    }`)
	if code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body = %v", code, body)
	}

	if got, _ := body["code"].(string); got != "not-supported" {
		t.Errorf("code = %q, want not-supported", body["code"])
	}
}

func TestDispatch_Bulk_NestedRejected(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	// A nested bulk child must abort a fail-fast bulk with not-supported.
	// This guards dispatchBulkChild's nested check, which is a distinct code
	// path from the bulk_atomic guard (TestDispatch_BulkAtomic_NestedRejected).
	code, body := postJSON(t, router, `{
        "type": "bulk",
        "args": [
            {"type": "bulk", "args": []}
        ]
    }`)
	if code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body = %v", code, body)
	}

	if got, _ := body["code"].(string); got != "not-supported" {
		t.Errorf("code = %q, want not-supported", body["code"])
	}

	// Assert the guard-specific message, not just the not-supported code:
	// without dispatchBulkChild's nested check, the op would still be rejected
	// via the unknown-op fallthrough ("op %q is not natively supported"), so
	// checking only the code would not actually guard the nested branch.
	if msg, _ := body["error"].(string); !strings.Contains(msg, "nested") {
		t.Errorf("error = %q, want the nested-bulk guard message", msg)
	}

	if w.callCount() != 0 {
		t.Errorf("writer calls = %d, want 0 (nested child aborts before any write)", w.callCount())
	}
}

func TestDispatch_BulkKeepGoing_NestedRejected(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	// bulk_keep_going records the nested child as a per-slot not-supported
	// error and still runs the remaining children.
	code, body := postJSON(t, router, `{
        "type": "bulk_keep_going",
        "args": [
            {"type": "bulk_atomic", "args": []},
            {"type": "pg_track_table", "args": {"source": "default", "table": {"schema": "public", "name": "users"}}}
        ]
    }`)
	if code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %v", code, body)
	}

	results, _ := body["bulk"].([]any)
	if len(results) != 2 {
		t.Fatalf("bulk results = %d, want 2", len(results))
	}

	if got, _ := results[0].(map[string]any)["code"].(string); got != "not-supported" {
		t.Errorf("child 0 code = %v, want not-supported", results[0])
	}

	// Guard-specific message (see TestDispatch_Bulk_NestedRejected): only the
	// dispatchBulkChild nested check emits "nested ... in bulk is not supported";
	// the unknown-op fallthrough would not, so this is what guards the branch.
	if msg, _ := results[0].(map[string]any)["error"].(string); !strings.Contains(msg, "nested") {
		t.Errorf("child 0 error = %q, want the nested-bulk guard message", msg)
	}

	if got, _ := results[1].(map[string]any)["message"].(string); got != "success" {
		t.Errorf("child 1 = %v, want success", results[1])
	}

	// Only the valid second child wrote; the nested child never reached the store.
	if w.callCount() != 1 {
		t.Errorf("writer calls = %d, want 1 (only the valid child wrote)", w.callCount())
	}
}

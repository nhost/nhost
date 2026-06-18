package controller

import (
	"net/http"
	"strings"
	"testing"
)

// bulkMessage returns the "message" field of bulk result entry i, or "".
func bulkMessage(results []any, i int) string {
	if i >= len(results) {
		return ""
	}

	m, _ := results[i].(map[string]any)
	s, _ := m["message"].(string)

	return s
}

func TestDispatch_Bulk_Success_SingleWriteBareArray(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	code, results, raw := postJSONArray(t, router, `{
        "type": "bulk",
        "args": [
            {"type": "pg_track_table", "args": {"source": "default", "table": {"schema": "public", "name": "users"}}},
            {"type": "pg_track_table", "args": {"source": "default", "table": {"schema": "public", "name": "orgs"}}}
        ]
    }`)
	if code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", code, raw)
	}

	// Bare top-level array, not a {"bulk": [...]} wrapper.
	if strings.HasPrefix(strings.TrimSpace(string(raw)), "{") {
		t.Errorf("body is an object, want a bare array; body = %s", raw)
	}

	if len(results) != 2 {
		t.Fatalf("bulk results = %d, want 2; body = %s", len(results), raw)
	}

	// Single write for the whole bulk → RV bumped once.
	if w.callCount() != 1 {
		t.Errorf("writer calls = %d, want 1 (single write per bulk)", w.callCount())
	}

	if got := store.ResourceVersion(); got != 12 {
		t.Errorf("ResourceVersion = %d, want 12 (one bump)", got)
	}

	for i := range results {
		if bulkMessage(results, i) != "success" {
			t.Errorf("child %d = %v, want success", i, results[i])
		}

		// Per-child entries carry no resource_version (matches Hasura).
		if m, _ := results[i].(map[string]any); m["resource_version"] != nil {
			t.Errorf(
				"child %d unexpectedly carries resource_version = %v",
				i,
				m["resource_version"],
			)
		}
	}
}

func TestDispatch_Bulk_FailFast_NoPartialWrite(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	// Second child targets a missing source and fails. Fail-fast aborts the
	// whole batch with NO write — not even the first (valid) child persists.
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

	if path, _ := body["path"].(string); path != "$.args[1]" {
		t.Errorf("path = %q, want $.args[1]", path)
	}

	if w.callCount() != 0 {
		t.Errorf("writer calls = %d, want 0 (fail-fast aborts before any write)", w.callCount())
	}

	if got := store.ResourceVersion(); got != 11 {
		t.Errorf("ResourceVersion = %d, want 11 (unchanged on abort)", got)
	}
}

func TestDispatch_BulkKeepGoing_CollectsAll_SingleWrite(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	code, results, raw := postJSONArray(t, router, `{
        "type": "bulk_keep_going",
        "args": [
            {"type": "pg_track_table", "args": {"source": "default", "table": {"schema": "public", "name": "users"}}},
            {"type": "pg_track_table", "args": {"source": "missing", "table": {"schema": "public", "name": "x"}}},
            {"type": "pg_track_table", "args": {"source": "default", "table": {"schema": "public", "name": "orgs"}}}
        ]
    }`)
	if code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", code, raw)
	}

	if len(results) != 3 {
		t.Fatalf("bulk results = %d, want 3; body = %s", len(results), raw)
	}

	if bulkMessage(results, 0) != "success" {
		t.Errorf("child 0 = %v, want success", results[0])
	}

	if got, _ := results[1].(map[string]any)["code"].(string); got != "not-exists" {
		t.Errorf("child 1 code = %v, want not-exists", results[1])
	}

	if bulkMessage(results, 2) != "success" {
		t.Errorf("child 2 = %v, want success", results[2])
	}

	// The two surviving children are persisted by a single write (one RV bump),
	// not one write per success.
	if w.callCount() != 1 {
		t.Errorf("writer calls = %d, want 1 (single write of survivors)", w.callCount())
	}

	if got := store.ResourceVersion(); got != 12 {
		t.Errorf("ResourceVersion = %d, want 12 (one bump)", got)
	}
}

func TestDispatch_BulkKeepGoing_AllFail_NoWrite(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	code, results, raw := postJSONArray(t, router, `{
        "type": "bulk_keep_going",
        "args": [
            {"type": "pg_track_table", "args": {"source": "missing", "table": {"schema": "public", "name": "a"}}},
            {"type": "pg_track_table", "args": {"source": "missing", "table": {"schema": "public", "name": "b"}}}
        ]
    }`)
	if code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", code, raw)
	}

	if len(results) != 2 {
		t.Fatalf("bulk results = %d, want 2; body = %s", len(results), raw)
	}

	// No child mutated → no write, RV unchanged.
	if w.callCount() != 0 {
		t.Errorf("writer calls = %d, want 0 (every child failed)", w.callCount())
	}

	if got := store.ResourceVersion(); got != 11 {
		t.Errorf("ResourceVersion = %d, want 11 (unchanged)", got)
	}
}

func TestDispatch_Bulk_ReadChild_NoWrite(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStoreWithQueryer(t, w, &fakeQueryer{viewdef: "SELECT 1;"})
	router := buildMutationRouter(t, store)

	// A read op (pg_get_viewdef) is now a valid bulk child. It returns its
	// payload in-band and triggers no write.
	code, results, raw := postJSONArray(t, router, `{
        "type": "bulk",
        "args": [
            {"type": "pg_get_viewdef", "args": {"source": "default", "table": {"schema": "public", "name": "v"}}}
        ]
    }`)
	if code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", code, raw)
	}

	if len(results) != 1 {
		t.Fatalf("bulk results = %d, want 1; body = %s", len(results), raw)
	}

	if got, _ := results[0].(map[string]any)["viewdef"].(string); got != "SELECT 1;" {
		t.Errorf("child 0 viewdef = %v, want 'SELECT 1;'", results[0])
	}

	if w.callCount() != 0 {
		t.Errorf("writer calls = %d, want 0 (read-only bulk)", w.callCount())
	}
}

func TestDispatch_Bulk_WholeMetadataChild(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	// Whole-metadata ops are now valid bulk children: track a table, then
	// clear_metadata, in one batch. The single composed write reflects the
	// final (cleared) state.
	code, results, raw := postJSONArray(t, router, `{
        "type": "bulk",
        "args": [
            {"type": "pg_track_table", "args": {"source": "default", "table": {"schema": "public", "name": "users"}}},
            {"type": "clear_metadata", "args": {}}
        ]
    }`)
	if code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", code, raw)
	}

	if len(results) != 2 || bulkMessage(results, 0) != "success" ||
		bulkMessage(results, 1) != "success" {
		t.Fatalf("results = %v, want two successes", results)
	}

	if w.callCount() != 1 {
		t.Errorf("writer calls = %d, want 1 (single composed write)", w.callCount())
	}

	// Final state is the cleared metadata (no sources), not the intermediate
	// tracked-table state.
	snap, _ := store.HasuraSnapshotJSON()
	if strings.Contains(string(snap), `"name":"users"`) {
		t.Errorf("snapshot still contains users after clear_metadata; snap = %s", snap)
	}
}

func TestDispatch_Bulk_NestedRejected(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	// A nested bulk child aborts a fail-fast bulk with not-supported.
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

	if msg, _ := body["error"].(string); !strings.Contains(msg, "nested") {
		t.Errorf("error = %q, want the nested-bulk guard message", msg)
	}

	if w.callCount() != 0 {
		t.Errorf("writer calls = %d, want 0 (nested child aborts before any write)", w.callCount())
	}
}

func TestDispatch_Bulk_MalformedObjectRejected(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	// A bulk whose args is an object with no "args" array is malformed and must
	// not degrade into an empty (silently successful) bulk.
	code, body := postJSON(t, router, `{
        "type": "bulk",
        "args": {}
    }`)
	if code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body = %v", code, body)
	}

	if got, _ := body["code"].(string); got != "parse-failed" {
		t.Errorf("code = %q, want parse-failed", body["code"])
	}

	if w.callCount() != 0 {
		t.Errorf(
			"writer calls = %d, want 0 (malformed bulk aborts before any write)",
			w.callCount(),
		)
	}
}

func TestDispatch_BulkKeepGoing_NestedRejected(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	// bulk_keep_going records the nested child as a per-slot not-supported error
	// and still runs the remaining children.
	code, results, raw := postJSONArray(t, router, `{
        "type": "bulk_keep_going",
        "args": [
            {"type": "bulk_atomic", "args": []},
            {"type": "pg_track_table", "args": {"source": "default", "table": {"schema": "public", "name": "users"}}}
        ]
    }`)
	if code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", code, raw)
	}

	if len(results) != 2 {
		t.Fatalf("bulk results = %d, want 2; body = %s", len(results), raw)
	}

	if got, _ := results[0].(map[string]any)["code"].(string); got != "not-supported" {
		t.Errorf("child 0 code = %v, want not-supported", results[0])
	}

	if msg, _ := results[0].(map[string]any)["error"].(string); !strings.Contains(msg, "nested") {
		t.Errorf("child 0 error = %q, want the nested-bulk guard message", msg)
	}

	if bulkMessage(results, 1) != "success" {
		t.Errorf("child 1 = %v, want success", results[1])
	}

	if w.callCount() != 1 {
		t.Errorf("writer calls = %d, want 1 (only the valid child wrote)", w.callCount())
	}
}

// --- bulk_atomic: strict Hasura whitelist + single-object response ---

func TestDispatch_BulkAtomic_Success_SingleObject(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	// Seed two tracked tables (the whitelist is relationship ops, which need
	// tracked tables to attach to).
	for _, tbl := range []string{"users", "orgs"} {
		if _, _, err := store.PgTrackTable(
			t.Context(),
			[]byte(`{"source":"default","table":{"schema":"public","name":"`+tbl+`"}}`),
		); err != nil {
			t.Fatalf("seed PgTrackTable(%s): %v", tbl, err)
		}
	}

	seedCalls := w.callCount()

	code, body := postJSON(t, router, `{
        "type": "bulk_atomic",
        "args": [
            {"type": "pg_create_object_relationship", "args": {"source":"default","table":{"schema":"public","name":"orgs"},"name":"owner","using":{"manual_configuration":{"remote_table":{"schema":"public","name":"users"},"column_mapping":{"owner_id":"id"}}}}},
            {"type": "pg_create_array_relationship", "args": {"source":"default","table":{"schema":"public","name":"users"},"name":"orgs","using":{"manual_configuration":{"remote_table":{"schema":"public","name":"orgs"},"column_mapping":{"id":"owner_id"}}}}}
        ]
    }`)
	if code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %v", code, body)
	}

	// bulk_atomic returns a single success object, not a per-child array.
	if got, _ := body["message"].(string); got != "success" {
		t.Errorf("message = %v, want success (single-object response)", body["message"])
	}

	if body["bulk"] != nil {
		t.Errorf("body has a 'bulk' array; want a single-object response: %v", body)
	}

	// One write for the whole atomic bulk.
	if w.callCount() != seedCalls+1 {
		t.Errorf("writer calls = %d, want %d (atomic = single write)", w.callCount(), seedCalls+1)
	}
}

func TestDispatch_BulkAtomic_Rollback(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	if _, _, err := store.PgTrackTable(
		t.Context(),
		[]byte(`{"source":"default","table":{"schema":"public","name":"users"}}`),
	); err != nil {
		t.Fatalf("seed PgTrackTable: %v", err)
	}

	seedCalls := w.callCount()
	seedRV := store.ResourceVersion()

	// First child is valid; second targets an untracked table and fails. The
	// whole atomic bulk rolls back — no write, RV unchanged.
	code, body := postJSON(t, router, `{
        "type": "bulk_atomic",
        "args": [
            {"type": "pg_create_object_relationship", "args": {"source":"default","table":{"schema":"public","name":"users"},"name":"self","using":{"manual_configuration":{"remote_table":{"schema":"public","name":"users"},"column_mapping":{"id":"id"}}}}},
            {"type": "pg_create_object_relationship", "args": {"source":"default","table":{"schema":"public","name":"ghost"},"name":"x","using":{"manual_configuration":{"remote_table":{"schema":"public","name":"users"},"column_mapping":{"id":"id"}}}}}
        ]
    }`)
	if code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body = %v", code, body)
	}

	if w.callCount() != seedCalls {
		t.Errorf("writer calls = %d, want %d (atomic rollback)", w.callCount(), seedCalls)
	}

	if got := store.ResourceVersion(); got != seedRV {
		t.Errorf("ResourceVersion = %d, want %d (unchanged on rollback)", got, seedRV)
	}

	// The first child's relationship must not have leaked into the snapshot.
	snap, _ := store.HasuraSnapshotJSON()
	if strings.Contains(string(snap), `"self"`) {
		t.Errorf("snapshot contains rolled-back relationship 'self'; snap = %s", snap)
	}
}

func TestDispatch_BulkAtomic_UnsupportedChildRejected(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	// pg_track_table is outside Hasura's bulk_atomic whitelist and must be
	// rejected (the deliberate strict-parity regression), with no write.
	code, body := postJSON(t, router, `{
        "type": "bulk_atomic",
        "args": [
            {"type": "pg_track_table", "args": {"source": "default", "table": {"schema": "public", "name": "users"}}}
        ]
    }`)
	if code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body = %v", code, body)
	}

	if got, _ := body["code"].(string); got != "not-supported" {
		t.Errorf("code = %q, want not-supported", body["code"])
	}

	if msg, _ := body["error"].(string); !strings.Contains(msg, "does not support") {
		t.Errorf("error = %q, want the bulk_atomic-unsupported message", msg)
	}

	if w.callCount() != 0 {
		t.Errorf("writer calls = %d, want 0", w.callCount())
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

func TestDispatch_BulkAtomic_Empty_SingleObject(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	code, body := postJSON(t, router, `{"type": "bulk_atomic", "args": []}`)
	if code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %v", code, body)
	}

	if got, _ := body["message"].(string); got != "success" {
		t.Errorf("message = %v, want success", body["message"])
	}

	if w.callCount() != 0 {
		t.Errorf("writer calls = %d, want 0 (empty atomic bulk)", w.callCount())
	}
}

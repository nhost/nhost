package controller

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
)

func TestDispatch_ReplaceMetadata_Bare(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	// Bare envelope shape.
	code, body := postJSON(t, router, `{"type":"replace_metadata","args":{`+
		`"version":3,"sources":[]}}`)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v", code, body)
	}

	if body["message"] != "success" {
		t.Errorf("message=%v, want success", body["message"])
	}

	if rv, _ := body["resource_version"].(float64); int64(rv) != 12 {
		t.Errorf("rv=%v, want 12", body["resource_version"])
	}

	// Snapshot must reflect the cleared sources.
	raw, _ := store.HasuraSnapshotJSON()
	if strings.Contains(string(raw), `"name":"default"`) {
		t.Errorf("snapshot still contains old 'default' source after replace; raw=%s", raw)
	}
}

func TestDispatch_ReplaceMetadata_Wrapper(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	// {metadata: ...} wrapper shape.
	code, body := postJSON(t, router, `{"type":"replace_metadata","args":{`+
		`"metadata":{"version":3,"sources":[]},`+
		`"allow_inconsistent_metadata":true}}`)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v", code, body)
	}

	if body["message"] != "success" {
		t.Errorf("message=%v, want success", body["message"])
	}
}

func TestDispatch_ReplaceMetadata_Malformed(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	code, body := postJSON(t, router, `{"type":"replace_metadata","args":{`+
		`"version":999,"sources":[]}}`)
	if code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%v", code, body)
	}

	if got, _ := body["code"].(string); got == "" {
		t.Errorf("expected an error code, body=%v", body)
	}

	if w.callCount() != 0 {
		t.Errorf("writer should not be called on parse failure")
	}
}

func TestDispatch_ClearMetadata(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	code, body := postJSON(t, router, `{"type":"clear_metadata","args":{}}`)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v", code, body)
	}

	if body["message"] != "success" {
		t.Errorf("message=%v, want success", body["message"])
	}

	raw, _ := store.HasuraSnapshotJSON()
	if strings.Contains(string(raw), `"name":"default"`) {
		t.Errorf("snapshot still contains 'default' source after clear; raw=%s", raw)
	}
}

// fakeReloadQueryer returns a fixed (metadata, rv) on QueryRow for the
// reload_metadata test. Distinct from fakeQueryer in metadata_tables_internal_test.go
// because that one returns viewdef strings — reload needs (bytes, int64).
type fakeReloadQueryer struct {
	metadata []byte
	rv       int64
}

func (f *fakeReloadQueryer) QueryRow(
	_ context.Context, _ string, _ ...any,
) pgx.Row {
	return fakeReloadRow{metadata: f.metadata, rv: f.rv}
}

func (f *fakeReloadQueryer) Query(
	_ context.Context, _ string, _ ...any,
) (pgx.Rows, error) {
	return nil, pgx.ErrNoRows
}

type fakeReloadRow struct {
	metadata []byte
	rv       int64
}

func (r fakeReloadRow) Scan(dest ...any) error {
	if len(dest) >= 1 {
		if p, ok := dest[0].(*[]byte); ok {
			*p = r.metadata
		}
	}

	if len(dest) >= 2 {
		if p, ok := dest[1].(*int64); ok {
			*p = r.rv
		}
	}

	return nil
}

func TestDispatch_ReloadMetadata(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStoreWithQueryer(t, w, &fakeReloadQueryer{
		metadata: []byte(`{"version":3,"sources":[]}`),
		rv:       42,
	})
	router := buildMutationRouter(t, store)

	code, body := postJSON(t, router, `{"type":"reload_metadata","args":{}}`)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v", code, body)
	}

	if rv, _ := body["resource_version"].(float64); int64(rv) != 42 {
		t.Errorf("rv=%v, want 42", body["resource_version"])
	}

	if got := store.ResourceVersion(); got != 42 {
		t.Errorf("store rv=%d, want 42", got)
	}

	if w.callCount() != 0 {
		t.Errorf("reload should not write (got %d writes)", w.callCount())
	}
}

func TestDispatch_ReloadMetadata_NoDB(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	code, body := postJSON(t, router, `{"type":"reload_metadata","args":{}}`)
	if code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%v", code, body)
	}

	if body["code"] != "not-supported" {
		t.Errorf("code=%v, want not-supported", body["code"])
	}
}

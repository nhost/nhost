package controller

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/remoteschema"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/nhost/nhost/services/constellation/metadata/source"
)

// newRemoteSchemaStore builds a bootstrapped Store seeded with one remote
// schema "rs" (one "user" permission) and a no-op remote-schema validator, so
// dispatch tests exercise the full controller→store path without real network
// introspection.
func newRemoteSchemaStore(t *testing.T, w source.MetadataWriter) *source.Store {
	t.Helper()

	const seed = `{"version":3,"sources":[{"name":"default","kind":"postgres",` +
		`"tables":[],"configuration":{"connection_info":{"database_url":` +
		`{"from_env":"PG"},"isolation_level":"read-committed",` +
		`"use_prepared_statements":true}}}],"remote_schemas":[{"name":"rs",` +
		`"definition":{"url":"http://example.test/graphql","customization":{}},` +
		`"comment":"","permissions":[{"role":"user","definition":` +
		`{"schema":"type Query { ping: String }"}}]}]}`

	s := source.NewStore(w, nil, nil)
	if err := s.BootstrapFromJSON([]byte(seed), 11); err != nil {
		t.Fatalf("BootstrapFromJSON: %v", err)
	}

	s.SetRemoteSchemaValidator(
		func(_ context.Context, _ *metadata.RemoteSchemaMetadata) error { return nil },
	)

	return s
}

func TestDispatch_AddRemoteSchema_Success(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	store.SetRemoteSchemaValidator(
		func(_ context.Context, _ *metadata.RemoteSchemaMetadata) error { return nil },
	)
	router := buildMutationRouter(t, store)

	code, body := postJSON(t, router,
		`{"type":"add_remote_schema","args":{"name":"rs",`+
			`"definition":{"url":"http://example.test/graphql"}}}`)

	if code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %v", code, body)
	}

	if got, _ := body["resource_version"].(float64); int64(got) != 12 {
		t.Errorf("resource_version = %v, want 12", body["resource_version"])
	}
}

func TestDispatch_AddRemoteSchema_UnreachableMapsToRemoteSchemaError(t *testing.T) {
	t.Parallel()

	store := newBootstrappedStore(t, &writerStub{})
	// Simulate the production validator failing on a synchronous introspection
	// against an unreachable upstream: the error carries remoteschema.ErrIntrospection.
	store.SetRemoteSchemaValidator(
		func(_ context.Context, _ *metadata.RemoteSchemaMetadata) error {
			return fmt.Errorf("%w: dial tcp: connection refused", remoteschema.ErrIntrospection)
		},
	)
	router := buildMutationRouter(t, store)

	code, resp := postJSON(t, router,
		`{"type":"add_remote_schema","args":{"name":"rs",`+
			`"definition":{"url":"http://unreachable.test/graphql"}}}`)

	if code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body = %v", code, resp)
	}

	if got, _ := resp["code"].(string); got != "remote-schema-error" {
		t.Errorf("code = %q, want remote-schema-error", resp["code"])
	}
}

// TestDispatch_BulkAtomic_AddRemoteSchema_Rejected pins Hasura parity: Hasura's
// runBulkAtomic accepts only a narrow whitelist (create/drop relationship,
// delete remote relationship, and native-query/logical-model/stored-procedure
// track-untrack) and answers "Bulk atomic does not support this command" for
// everything else (server/src-lib/Hasura/Server/API/Metadata.hs). add_remote_schema
// is therefore not a valid bulk_atomic child; the store never builds it, so the
// failing validator below is never reached. Constellation reports the rejection
// as not-supported (see TestDispatch_BulkAtomic_UnsupportedChildRejected).
func TestDispatch_BulkAtomic_AddRemoteSchema_Rejected(t *testing.T) {
	t.Parallel()

	store := newBootstrappedStore(t, &writerStub{})
	store.SetRemoteSchemaValidator(
		func(_ context.Context, _ *metadata.RemoteSchemaMetadata) error {
			return fmt.Errorf("%w: dial tcp: connection refused", remoteschema.ErrIntrospection)
		},
	)
	router := buildMutationRouter(t, store)

	code, body := postJSON(t, router,
		`{"type":"bulk_atomic","args":[{"type":"add_remote_schema","args":`+
			`{"name":"rs","definition":{"url":"http://unreachable.test/graphql"}}}]}`)

	if code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (add_remote_schema not in bulk_atomic whitelist); body = %v",
			code, body)
	}

	if got, _ := body["code"].(string); got != "not-supported" {
		t.Errorf("code = %q, want not-supported", body["code"])
	}
}

// TestDispatch_Bulk_AddRemoteSchema_ValidatesUpstream pins that the `bulk` path
// runs the same synchronous upstream introspection as the single-op path: the
// bulk pre-pass (planAddRemoteSchema) consults the validator off the write lock,
// so an unreachable upstream fails the child with remote-schema-error rather
// than being silently accepted.
func TestDispatch_Bulk_AddRemoteSchema_ValidatesUpstream(t *testing.T) {
	t.Parallel()

	store := newBootstrappedStore(t, &writerStub{})
	store.SetRemoteSchemaValidator(
		func(_ context.Context, _ *metadata.RemoteSchemaMetadata) error {
			return fmt.Errorf("%w: dial tcp: connection refused", remoteschema.ErrIntrospection)
		},
	)
	router := buildMutationRouter(t, store)

	code, resp := postJSON(t, router,
		`{"type":"bulk","args":[{"type":"add_remote_schema","args":`+
			`{"name":"rs","definition":{"url":"http://unreachable.test/graphql"}}}]}`)

	if code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (bulk validates the upstream); body = %v", code, resp)
	}

	if got, _ := resp["code"].(string); got != "remote-schema-error" {
		t.Errorf("code = %q, want remote-schema-error", resp["code"])
	}
}

// TestDispatch_Bulk_AddRemoteSchemaPermissions_ValidatesUpstream is the
// permission-op counterpart: re-introspection runs on the bulk path too, so a
// failing upstream surfaces as remote-schema-error.
func TestDispatch_Bulk_AddRemoteSchemaPermissions_ValidatesUpstream(t *testing.T) {
	t.Parallel()

	store := newRemoteSchemaStore(t, &writerStub{})
	store.SetRemoteSchemaValidator(
		func(_ context.Context, _ *metadata.RemoteSchemaMetadata) error {
			return fmt.Errorf("%w: dial tcp: connection refused", remoteschema.ErrIntrospection)
		},
	)
	router := buildMutationRouter(t, store)

	code, resp := postJSON(t, router,
		`{"type":"bulk","args":[{"type":"add_remote_schema_permissions","args":`+
			`{"remote_schema":"rs","role":"manager","definition":`+
			`{"schema":"type Query { ping: String }"}}}]}`)

	if code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (bulk validates the upstream); body = %v", code, resp)
	}

	if got, _ := resp["code"].(string); got != "remote-schema-error" {
		t.Errorf("code = %q, want remote-schema-error", resp["code"])
	}
}

func TestDispatch_DropRemoteSchemaPermissions_NotExists(t *testing.T) {
	t.Parallel()

	store := newRemoteSchemaStore(t, &writerStub{})
	router := buildMutationRouter(t, store)

	code, resp := postJSON(t, router,
		`{"type":"drop_remote_schema_permissions","args":`+
			`{"remote_schema":"rs","role":"ghost"}}`)

	if code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body = %v", code, resp)
	}

	if got, _ := resp["code"].(string); got != "not-exists" {
		t.Errorf("code = %q, want not-exists", resp["code"])
	}
}

// TestDispatch_Bulk_AddRemoteSchemaPermissions covers the dashboard's wire path:
// add_remote_schema_permissions sent wrapped in a `bulk` envelope. `bulk` runs
// every child through source.ApplyBulk → BuildMutation (one in-flight metadata
// copy, single write/RV) and returns a bare top-level array of per-child
// results. The upstream is introspected in the bulk pre-pass just like the
// single-op path (here the seeded validator is a no-op, so it succeeds); a
// failing upstream is covered by TestDispatch_Bulk_AddRemoteSchemaPermissions_ValidatesUpstream.
func TestDispatch_Bulk_AddRemoteSchemaPermissions(t *testing.T) {
	t.Parallel()

	store := newRemoteSchemaStore(t, &writerStub{})
	router := buildMutationRouter(t, store)

	code, results, raw := postJSONArray(t, router,
		`{"type":"bulk","args":[{"type":"add_remote_schema_permissions","args":`+
			`{"remote_schema":"rs","role":"manager","definition":`+
			`{"schema":"type Query { ping: String }"}}}]}`)

	if code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", code, raw)
	}

	if len(results) != 1 {
		t.Fatalf("bulk results = %v, want one entry", results)
	}

	entry, _ := results[0].(map[string]any)
	if got, _ := entry["message"].(string); got != "success" {
		t.Errorf("bulk[0].message = %v, want success", entry["message"])
	}
}

func TestDispatch_IntrospectRemoteSchema(t *testing.T) {
	t.Parallel()

	store := newRemoteSchemaStore(t, &writerStub{})
	store.SetRemoteSchemaIntrospector(
		func(_ context.Context, _ *metadata.RemoteSchemaMetadata) ([]byte, error) {
			return []byte(`{"__schema":{"queryType":{"name":"Query"}}}`), nil
		},
	)
	router := buildMutationRouter(t, store)

	code, body := postJSON(t, router,
		`{"type":"introspect_remote_schema","args":{"name":"rs"}}`)

	if code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %v", code, body)
	}

	// The raw introspection document must be echoed verbatim under "data".
	data, ok := body["data"].(map[string]any)
	if !ok {
		t.Fatalf("data = %T, want object; body = %v", body["data"], body)
	}

	if _, ok := data["__schema"]; !ok {
		t.Errorf("data has no __schema key; got %v", data)
	}
}

func TestDispatch_ReloadRemoteSchema(t *testing.T) {
	t.Parallel()

	store := newRemoteSchemaStore(t, &writerStub{})
	store.SetRemoteSchemaIntrospector(
		func(_ context.Context, _ *metadata.RemoteSchemaMetadata) ([]byte, error) {
			return []byte(`{"__schema":{}}`), nil
		},
	)
	router := buildMutationRouter(t, store)

	code, body := postJSON(t, router,
		`{"type":"reload_remote_schema","args":{"name":"rs"}}`)

	if code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %v", code, body)
	}

	if got, _ := body["message"].(string); got != "success" {
		t.Errorf("message = %v, want success", body["message"])
	}
}

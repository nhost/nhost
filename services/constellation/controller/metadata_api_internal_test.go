package controller

import (
	"bytes"
	"context"
	json "encoding/json/v2"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/nhost/nhost/services/constellation/metadata"
)

type metadataAPITestSource struct {
	meta *metadata.Metadata
}

func newMetadataAPITestController(t *testing.T) (*Controller, *metadataAPITestSource) {
	t.Helper()

	meta := emptyMetadataAPITestMetadata()
	src := &metadataAPITestSource{meta: cloneMetadataForTest(t, meta)}
	logger := slog.Default()

	state, err := buildState(t.Context(), meta, time.Millisecond, logger, nil)
	if err != nil {
		t.Fatalf("buildState: %v", err)
	}

	ctrl := &Controller{
		state:            atomic.Pointer[controllerState]{},
		metadataAPIMu:    sync.Mutex{},
		adminSecret:      "admin-secret",
		jwtAuth:          nil,
		pollingInterval:  time.Millisecond,
		logger:           logger,
		connectorOptions: nil,
		devMode:          false,
		source:           src,
	}
	ctrl.state.Store(state)

	return ctrl, src
}

func TestMetadataAPIRequiresAdminSecret(t *testing.T) {
	t.Parallel()

	ctrl, _ := newMetadataAPITestController(t)

	req := httptest.NewRequest(http.MethodPost, "/v1/metadata", bytes.NewReader(
		[]byte(`{"type":"export_metadata","args":{}}`),
	))
	rec := httptest.NewRecorder()

	ctrl.HandlerMetadataAPI("admin-secret").ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d; body: %s", rec.Code, http.StatusUnauthorized, rec.Body)
	}
}

func TestMetadataAPIBulkWritesActionsAndReloadsState(t *testing.T) {
	t.Parallel()

	ctrl, src := newMetadataAPITestController(t)

	body := map[string]any{
		"type": "bulk",
		"args": []map[string]any{
			{
				"type": "set_custom_types",
				"args": map[string]any{
					"custom_types": map[string]any{
						"objects": []map[string]any{
							{
								"name": "HelloOutput",
								"fields": []map[string]any{
									{"name": "message", "type": "String!"},
								},
							},
						},
					},
				},
			},
			{
				"type": "create_action",
				"args": map[string]any{
					"name": "hello",
					"definition": map[string]any{
						"kind":        "synchronous",
						"handler":     "https://actions.example.test/hello",
						"timeout":     30,
						"type":        "query",
						"output_type": "HelloOutput!",
					},
				},
			},
		},
	}

	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("Marshal request: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/v1/metadata", bytes.NewReader(payload))
	req.Header.Set("X-Hasura-Admin-Secret", "admin-secret")

	rec := httptest.NewRecorder()

	ctrl.HandlerMetadataAPI("admin-secret").ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body: %s", rec.Code, http.StatusOK, rec.Body)
	}

	if len(src.meta.Actions) != 1 || src.meta.Actions[0].Name != "hello" {
		t.Fatalf("persisted actions = %+v, want hello action", src.meta.Actions)
	}

	state := ctrl.state.Load()
	if state == nil || state.validatedSchemas[metadata.RoleAdmin] == nil {
		t.Fatal("controller state was not rebuilt")
	}

	queryType := state.validatedSchemas[metadata.RoleAdmin].Types["query_root"]
	if queryType == nil || queryType.Fields.ForName("hello") == nil {
		t.Fatalf("reloaded admin schema missing hello action")
	}
}

func TestMetadataAPIConcurrentWritesAreSerialized(t *testing.T) {
	t.Parallel()

	ctrl, src := newMetadataAPITestController(t)
	setHelloOutputCustomTypes(t, ctrl)

	var wg sync.WaitGroup
	for _, actionName := range []string{"helloOne", "helloTwo"} {
		wg.Go(func() {
			createHelloAction(t, ctrl, actionName)
		})
	}

	wg.Wait()

	if got := len(src.meta.Actions); got != 2 {
		t.Fatalf("persisted actions = %+v, want 2 actions", src.meta.Actions)
	}

	for _, actionName := range []string{"helloOne", "helloTwo"} {
		if _, ok := findAction(src.meta.Actions, actionName); !ok {
			t.Fatalf("persisted actions = %+v, missing %s", src.meta.Actions, actionName)
		}
	}
}

func setHelloOutputCustomTypes(t *testing.T, ctrl *Controller) {
	t.Helper()

	sendMetadataAPIRequest(t, ctrl, map[string]any{
		"type": "set_custom_types",
		"args": map[string]any{
			"custom_types": map[string]any{
				"objects": []map[string]any{
					{
						"name": "HelloOutput",
						"fields": []map[string]any{
							{"name": "message", "type": "String!"},
						},
					},
				},
			},
		},
	})
}

func createHelloAction(t *testing.T, ctrl *Controller, actionName string) {
	t.Helper()

	sendMetadataAPIRequest(t, ctrl, map[string]any{
		"type": "create_action",
		"args": map[string]any{
			"name": actionName,
			"definition": map[string]any{
				"kind":        "synchronous",
				"handler":     "https://actions.example.test/hello",
				"timeout":     30,
				"type":        "query",
				"output_type": "HelloOutput!",
			},
		},
	})
}

func sendMetadataAPIRequest(t *testing.T, ctrl *Controller, body map[string]any) {
	t.Helper()

	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("Marshal request: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/v1/metadata", bytes.NewReader(payload))
	req.Header.Set("X-Hasura-Admin-Secret", "admin-secret")

	rec := httptest.NewRecorder()

	ctrl.HandlerMetadataAPI("admin-secret").ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body: %s", rec.Code, http.StatusOK, rec.Body)
	}
}

func (s *metadataAPITestSource) InitialLoad(
	context.Context,
) (*metadata.Metadata, error) {
	return cloneMetadataNoTest(s.meta), nil
}

func (s *metadataAPITestSource) Watch(context.Context) <-chan metadata.Update {
	return make(chan metadata.Update)
}

func (s *metadataAPITestSource) Close() {}

func (s *metadataAPITestSource) ReplaceMetadata(
	_ context.Context,
	meta *metadata.Metadata,
) error {
	s.meta = cloneMetadataNoTest(meta)

	return nil
}

func emptyMetadataAPITestMetadata() *metadata.Metadata {
	return &metadata.Metadata{
		Databases:     nil,
		RemoteSchemas: nil,
		Actions:       nil,
		CustomTypes: metadata.CustomTypes{
			InputObjects: nil,
			Objects:      nil,
			Scalars:      nil,
			Enums:        nil,
		},
		LoadDiagnostics: nil,
	}
}

func cloneMetadataForTest(t *testing.T, meta *metadata.Metadata) *metadata.Metadata {
	t.Helper()

	clone := cloneMetadataNoTest(meta)
	if clone == nil {
		t.Fatal("cloneMetadataNoTest returned nil")
	}

	return clone
}

func cloneMetadataNoTest(meta *metadata.Metadata) *metadata.Metadata {
	data, err := json.Marshal(meta)
	if err != nil {
		return nil
	}

	var clone metadata.Metadata
	if err := json.Unmarshal(data, &clone); err != nil {
		return nil
	}

	return &clone
}

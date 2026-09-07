package migrations

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/Yamashou/gqlgenc/clientv2"
	"github.com/nhost/nhost/services/ai/hasura"
)

func TestApplyHasuraMetadataUsesAIPrefix(t *testing.T) {
	t.Parallel()

	var (
		mu       sync.Mutex
		requests []map[string]any
	)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/metadata" {
			t.Errorf("metadata request path = %q, want /v1/metadata", r.URL.Path)
		}

		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("failed to read metadata request: %v", err)
			w.WriteHeader(http.StatusInternalServerError)

			return
		}

		var request map[string]any
		if err := json.Unmarshal(body, &request); err != nil {
			t.Errorf("failed to decode metadata request: %v", err)
			w.WriteHeader(http.StatusBadRequest)

			return
		}

		mu.Lock()

		requests = append(requests, request)
		mu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{}`))
	}))
	t.Cleanup(server.Close)

	client := hasura.NewClient(
		server.Client(),
		server.URL+"/v1/graphql",
		&clientv2.Options{ParseDataAlongWithErrors: false},
	)

	if err := ApplyHasuraMetadata(
		context.Background(),
		client,
		"http://ai:8090",
		slog.New(slog.DiscardHandler),
	); err != nil {
		t.Fatalf("ApplyHasuraMetadata() error = %v", err)
	}

	mu.Lock()

	captured := append([]map[string]any(nil), requests...)
	mu.Unlock()

	trackedTables := 0
	eventTriggers := 0

	for _, request := range captured {
		typeName, _ := request["type"].(string)
		switch typeName {
		case "pg_track_table":
			trackedTables++

			assertAITableCustomization(t, request)
		case "pg_create_event_trigger":
			eventTriggers++

			assertAIEventTrigger(t, request)
		}
	}

	if trackedTables != 5 {
		t.Errorf("tracked table requests = %d, want 5", trackedTables)
	}

	if eventTriggers != 1 {
		t.Errorf("event trigger requests = %d, want 1", eventTriggers)
	}
}

func assertAITableCustomization(t *testing.T, request map[string]any) {
	t.Helper()

	args := requiredMap(t, request, "args")
	configuration := requiredMap(t, args, "configuration")

	customName := requiredString(t, configuration, "custom_name")
	if !strings.HasPrefix(customName, "ai") {
		t.Errorf("custom_name = %q, want ai prefix", customName)
	}

	rootFields := requiredMap(t, configuration, "custom_root_fields")

	expectedPrefixes := map[string]string{
		"select":           "ai",
		"select_by_pk":     "ai",
		"select_aggregate": "ai",
		"select_stream":    "ai",
		"insert":           "insertAi",
		"insert_one":       "insertAi",
		"update":           "updateAi",
		"update_by_pk":     "updateAi",
		"update_many":      "updateManyAi",
		"delete":           "deleteAi",
		"delete_by_pk":     "deleteAi",
	}
	for field, prefix := range expectedPrefixes {
		rootField := requiredString(t, rootFields, field)
		if !strings.HasPrefix(rootField, prefix) {
			t.Errorf("custom_root_fields.%s = %q, want %q prefix", field, rootField, prefix)
		}
	}
}

func assertAIEventTrigger(t *testing.T, request map[string]any) {
	t.Helper()

	args := requiredMap(t, request, "args")
	if name := requiredString(t, args, "name"); !strings.HasPrefix(name, "ai_") {
		t.Errorf("event trigger name = %q, want ai_ prefix", name)
	}

	headers, ok := args["headers"].([]any)
	if !ok || len(headers) != 1 {
		t.Fatalf("event trigger headers = %#v, want one header", args["headers"])
	}

	header, ok := headers[0].(map[string]any)
	if !ok {
		t.Fatalf("event trigger header type = %T, want object", headers[0])
	}

	if got := requiredString(t, header, "name"); got != "X-AI-Webhook-Secret" {
		t.Errorf("event trigger header name = %q, want X-AI-Webhook-Secret", got)
	}

	if got := requiredString(t, header, "value_from_env"); got != "AI_WEBHOOK_SECRET" {
		t.Errorf("event trigger header env = %q, want AI_WEBHOOK_SECRET", got)
	}
}

func requiredMap(t *testing.T, object map[string]any, field string) map[string]any {
	t.Helper()

	value, ok := object[field].(map[string]any)
	if !ok {
		t.Fatalf("%s = %#v, want object", field, object[field])
	}

	return value
}

func requiredString(t *testing.T, object map[string]any, field string) string {
	t.Helper()

	value, ok := object[field].(string)
	if !ok {
		t.Fatalf("%s = %#v, want string", field, object[field])
	}

	return value
}

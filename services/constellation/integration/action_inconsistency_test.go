package integration_test

import (
	json "encoding/json/v2"
	"testing"
	"time"
)

// TestActionGetInconsistentMetadata exercises get_inconsistent_metadata for
// actions. This is constellation-specific (not a parity-diff): Hasura rejects an
// action with an undefined output type at WRITE time, whereas constellation
// accepts the write and records the failure as a build-time inconsistency
// (matching its general metadata model), which get_inconsistent_metadata now
// surfaces.
func TestActionGetInconsistentMetadata(t *testing.T) {
	setupActionEnv(t)

	// Baseline: a freshly-restored instance is consistent.
	if !isConsistent(t) {
		t.Fatalf("expected is_consistent=true at baseline; got %v", inconsistentObjects(t))
	}

	// An action whose output_type does not exist is accepted by the write but
	// becomes a build-time inconsistency.
	mustMetadataOK(t, `{"type":"create_action","args":{"name":"badAction","definition":{`+
		`"kind":"synchronous","type":"mutation",`+
		`"handler":"`+actionWebhookURL+`","output_type":"NoSuchType",`+
		`"arguments":[{"name":"x","type":"String!"}]}}}`)

	// The rebuild is asynchronous, so poll get_inconsistent_metadata until the
	// action shows up as inconsistent.
	var found map[string]any

	for range 40 {
		for _, obj := range inconsistentObjects(t) {
			if obj["name"] == "badAction" {
				found = obj

				break
			}
		}

		if found != nil {
			break
		}

		time.Sleep(250 * time.Millisecond)
	}

	if found == nil {
		t.Fatalf("badAction not reported by get_inconsistent_metadata; objects=%v", inconsistentObjects(t))
	}

	if found["type"] != "action" {
		t.Errorf("inconsistency type = %v, want %q", found["type"], "action")
	}

	if reason, _ := found["reason"].(string); reason == "" {
		t.Errorf("inconsistency reason is empty: %v", found)
	}
}

func getInconsistentMetadata(t *testing.T) map[string]any {
	t.Helper()

	status, body := postMetadata(t, constellationMetadataURL, `{"type":"get_inconsistent_metadata","args":{}}`)
	if status/100 != 2 {
		t.Fatalf("get_inconsistent_metadata: status=%d body=%s", status, body)
	}

	var resp map[string]any
	if err := json.Unmarshal(body, &resp); err != nil {
		t.Fatalf("decoding get_inconsistent_metadata response: %v; body=%s", err, body)
	}

	return resp
}

func isConsistent(t *testing.T) bool {
	t.Helper()

	c, _ := getInconsistentMetadata(t)["is_consistent"].(bool)

	return c
}

func inconsistentObjects(t *testing.T) []map[string]any {
	t.Helper()

	raw, _ := getInconsistentMetadata(t)["inconsistent_objects"].([]any)

	out := make([]map[string]any, 0, len(raw))

	for _, o := range raw {
		if m, ok := o.(map[string]any); ok {
			out = append(out, m)
		}
	}

	return out
}

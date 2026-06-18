package source

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"testing"
)

type storedEventTriggerCase struct {
	name           string
	triggerName    string
	conf           string
	wantDefOps     []string
	wantTopPresent []string
	wantTopAbsent  []string
}

// TestBuildStoredEventTrigger covers the pg_create_event_trigger request-shape
// translation (C1): Hasura sends op specs at the top level, the stored form
// nests them under "definition". A pre-nested "definition" is kept as-is, and
// unmodeled keys are preserved verbatim (the event-trigger fidelity guarantee).
func TestBuildStoredEventTrigger(t *testing.T) {
	t.Parallel()

	tests := []storedEventTriggerCase{
		{
			name:           "flat request shape nests op specs under definition",
			triggerName:    "on_user_change",
			conf:           `{"insert":{"columns":"*"},"webhook":"https://x","retry_conf":{"num_retries":3,"interval_sec":10}}`,
			wantDefOps:     []string{"insert"},
			wantTopPresent: []string{"name", "definition", "webhook", "retry_conf"},
			wantTopAbsent:  []string{"insert"},
		},
		{
			name:           "multiple flat op specs all move under definition",
			triggerName:    "on_user_change",
			conf:           `{"insert":{"columns":"*"},"delete":{"columns":"*"},"enable_manual":true,"webhook":"https://x"}`,
			wantDefOps:     []string{"insert", "delete", "enable_manual"},
			wantTopPresent: []string{"name", "definition", "webhook"},
			wantTopAbsent:  []string{"insert", "delete", "enable_manual"},
		},
		{
			name:           "pre-nested definition is preserved",
			triggerName:    "on_user_change",
			conf:           `{"definition":{"update":{"columns":"*"}},"webhook":"https://x"}`,
			wantDefOps:     []string{"update"},
			wantTopPresent: []string{"name", "definition", "webhook"},
			wantTopAbsent:  []string{"update"},
		},
		{
			name:           "unmodeled keys are preserved verbatim",
			triggerName:    "on_user_change",
			conf:           `{"insert":{"columns":"*"},"comment":"hi","request_transform":{"version":2}}`,
			wantDefOps:     []string{"insert"},
			wantTopPresent: []string{"name", "definition", "comment", "request_transform"},
			wantTopAbsent:  []string{"insert"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			assertStoredEventTrigger(t, tt)
		})
	}
}

func assertStoredEventTrigger(t *testing.T, tt storedEventTriggerCase) {
	t.Helper()

	stored, err := buildStoredEventTrigger(tt.triggerName, []byte(tt.conf))
	if err != nil {
		t.Fatalf("buildStoredEventTrigger: %v", err)
	}

	top := decodeJSONObject(t, stored)

	for _, key := range tt.wantTopPresent {
		if _, ok := top[key]; !ok {
			t.Errorf("stored trigger missing top-level key %q; got %s", key, stored)
		}
	}

	for _, key := range tt.wantTopAbsent {
		if _, ok := top[key]; ok {
			t.Errorf("stored trigger should not carry top-level key %q; got %s", key, stored)
		}
	}

	var name string
	if err := json.Unmarshal(top["name"], &name); err != nil {
		t.Fatalf("unmarshaling name: %v", err)
	}

	if name != tt.triggerName {
		t.Errorf("name = %q, want %q", name, tt.triggerName)
	}

	definition := decodeJSONObject(t, top["definition"])
	for _, op := range tt.wantDefOps {
		if _, ok := definition[op]; !ok {
			t.Errorf("definition missing op %q; got %s", op, top["definition"])
		}
	}

	// The stored entry must round-trip its name through eventTriggerName, which
	// create/delete rely on for identity.
	gotName, err := eventTriggerName(stored)
	if err != nil {
		t.Fatalf("eventTriggerName: %v", err)
	}

	if gotName != tt.triggerName {
		t.Errorf("eventTriggerName = %q, want %q", gotName, tt.triggerName)
	}
}

// TestBuildStoredEventTrigger_NoOpSpecLeak asserts a flat op spec is moved under
// "definition" and never left at the top level.
func TestBuildStoredEventTrigger_NoOpSpecLeak(t *testing.T) {
	t.Parallel()

	stored, err := buildStoredEventTrigger("t", []byte(`{"insert":{"columns":"*"}}`))
	if err != nil {
		t.Fatalf("buildStoredEventTrigger: %v", err)
	}

	if _, leaked := decodeJSONObject(t, stored)["insert"]; leaked {
		t.Errorf("op spec leaked to top level: %s", stored)
	}
}

func decodeJSONObject(t *testing.T, raw jsontext.Value) map[string]jsontext.Value {
	t.Helper()

	var obj map[string]jsontext.Value
	if err := json.Unmarshal(raw, &obj); err != nil {
		t.Fatalf("unmarshaling JSON object: %v", err)
	}

	return obj
}

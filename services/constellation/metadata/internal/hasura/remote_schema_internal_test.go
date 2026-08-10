package hasura

import (
	json "encoding/json/v2"
	"strings"
	"testing"

	"github.com/goccy/go-yaml"
)

// remoteSchemaHeaderCase is one input/output expectation pair used by both
// the YAML and JSON test tables.
type remoteSchemaHeaderCase struct {
	name            string
	input           string
	wantName        string
	wantValue       string
	wantFromEnv     string
	wantErr         bool
	wantWrapContext string
}

func runRemoteSchemaHeaderTest(
	t *testing.T,
	tc remoteSchemaHeaderCase,
	unmarshal func([]byte, any) error,
) {
	t.Helper()

	var h RemoteSchemaHeader

	err := unmarshal([]byte(tc.input), &h)
	if (err != nil) != tc.wantErr {
		t.Fatalf("unmarshal err = %v, wantErr=%v", err, tc.wantErr)
	}

	if tc.wantErr {
		if err != nil && !strings.Contains(err.Error(), tc.wantWrapContext) {
			t.Errorf("expected wrap context %q, got %v", tc.wantWrapContext, err)
		}

		return
	}

	if h.Name != tc.wantName {
		t.Errorf("Name = %q, want %q", h.Name, tc.wantName)
	}

	if h.Value.Value != tc.wantValue {
		t.Errorf("Value.Value = %q, want %q", h.Value.Value, tc.wantValue)
	}

	if h.Value.FromEnv != tc.wantFromEnv {
		t.Errorf("Value.FromEnv = %q, want %q", h.Value.FromEnv, tc.wantFromEnv)
	}
}

// TestRemoteSchemaHeader_UnmarshalYAML exercises both shapes (literal value and
// value_from_env) and a malformed-input case.
func TestRemoteSchemaHeader_UnmarshalYAML(t *testing.T) {
	t.Parallel()

	tests := []remoteSchemaHeaderCase{
		{
			name:            "literal value",
			input:           "name: Authorization\nvalue: Bearer token123",
			wantName:        "Authorization",
			wantValue:       "Bearer token123",
			wantFromEnv:     "",
			wantErr:         false,
			wantWrapContext: "",
		},
		{
			name:            "value_from_env",
			input:           "name: X-Api-Key\nvalue_from_env: REMOTE_API_KEY",
			wantName:        "X-Api-Key",
			wantValue:       "",
			wantFromEnv:     "REMOTE_API_KEY",
			wantErr:         false,
			wantWrapContext: "",
		},
		{
			name:            "both empty",
			input:           "name: X-Test",
			wantName:        "X-Test",
			wantValue:       "",
			wantFromEnv:     "",
			wantErr:         false,
			wantWrapContext: "",
		},
		{
			name:            "malformed yaml type",
			input:           "[not a map]",
			wantName:        "",
			wantValue:       "",
			wantFromEnv:     "",
			wantErr:         true,
			wantWrapContext: "unmarshaling remote schema header",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			runRemoteSchemaHeaderTest(t, tt, yaml.Unmarshal)
		})
	}
}

// TestRemoteSchemaHeader_UnmarshalJSON exercises both shapes (literal value and
// value_from_env) and a malformed-input case.
func TestRemoteSchemaHeader_UnmarshalJSON(t *testing.T) {
	t.Parallel()

	tests := []remoteSchemaHeaderCase{
		{
			name:            "literal value",
			input:           `{"name":"Authorization","value":"Bearer token123"}`,
			wantName:        "Authorization",
			wantValue:       "Bearer token123",
			wantFromEnv:     "",
			wantErr:         false,
			wantWrapContext: "",
		},
		{
			name:            "value_from_env",
			input:           `{"name":"X-Api-Key","value_from_env":"REMOTE_API_KEY"}`,
			wantName:        "X-Api-Key",
			wantValue:       "",
			wantFromEnv:     "REMOTE_API_KEY",
			wantErr:         false,
			wantWrapContext: "",
		},
		{
			name:            "both empty",
			input:           `{"name":"X-Test"}`,
			wantName:        "X-Test",
			wantValue:       "",
			wantFromEnv:     "",
			wantErr:         false,
			wantWrapContext: "",
		},
		{
			// Valid JSON but the type is wrong (array, not object), so the
			// inner json.Unmarshal call inside UnmarshalJSON returns a typed
			// error that the wrap context captures.
			name:            "type mismatch array",
			input:           `["not an object"]`,
			wantName:        "",
			wantValue:       "",
			wantFromEnv:     "",
			wantErr:         true,
			wantWrapContext: "unmarshaling remote schema header",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			runRemoteSchemaHeaderTest(t, tt, func(data []byte, v any) error {
				return json.Unmarshal(data, v)
			})
		})
	}
}

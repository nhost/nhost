package hasura

import (
	json "encoding/json/v2"
	"strings"
	"testing"

	"github.com/goccy/go-yaml"
)

// envValueCase is one input/output expectation pair used by both the YAML
// and JSON test tables. wantWrapContext is checked only when wantErr is true.
type envValueCase struct {
	name            string
	input           string
	wantValue       string
	wantFromEnv     string
	wantErr         bool
	wantWrapContext string
}

func runEnvValueTest(
	t *testing.T,
	tc envValueCase,
	unmarshal func([]byte, any) error,
) {
	t.Helper()

	var v EnvValue

	err := unmarshal([]byte(tc.input), &v)
	if (err != nil) != tc.wantErr {
		t.Fatalf("unmarshal err = %v, wantErr=%v", err, tc.wantErr)
	}

	if tc.wantErr {
		if err != nil && !strings.Contains(err.Error(), tc.wantWrapContext) {
			t.Errorf("expected wrap context %q, got %v", tc.wantWrapContext, err)
		}

		return
	}

	if v.Value != tc.wantValue {
		t.Errorf("Value = %q, want %q", v.Value, tc.wantValue)
	}

	if v.FromEnv != tc.wantFromEnv {
		t.Errorf("FromEnv = %q, want %q", v.FromEnv, tc.wantFromEnv)
	}
}

// TestEnvValue_UnmarshalYAML exercises both shapes (plain string and
// {from_env: VAR}) and a malformed-input case.
func TestEnvValue_UnmarshalYAML(t *testing.T) {
	t.Parallel()

	tests := []envValueCase{
		{
			name:            "plain string",
			input:           `"literal-value"`,
			wantValue:       "literal-value",
			wantFromEnv:     "",
			wantErr:         false,
			wantWrapContext: "",
		},
		{
			name:            "from env mapping",
			input:           "from_env: MY_VAR",
			wantValue:       "",
			wantFromEnv:     "MY_VAR",
			wantErr:         false,
			wantWrapContext: "",
		},
		{
			name:            "empty string",
			input:           `""`,
			wantValue:       "",
			wantFromEnv:     "",
			wantErr:         false,
			wantWrapContext: "",
		},
		{
			name:            "malformed mapping with wrong type",
			input:           "from_env: [a, b, c]",
			wantValue:       "",
			wantFromEnv:     "",
			wantErr:         true,
			wantWrapContext: "unmarshaling env value mapping",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			runEnvValueTest(t, tt, yaml.Unmarshal)
		})
	}
}

// TestEnvValue_UnmarshalJSON exercises both shapes (plain string and
// {from_env: VAR}) and a malformed-input case.
func TestEnvValue_UnmarshalJSON(t *testing.T) {
	t.Parallel()

	tests := []envValueCase{
		{
			name:            "plain string",
			input:           `"literal-value"`,
			wantValue:       "literal-value",
			wantFromEnv:     "",
			wantErr:         false,
			wantWrapContext: "",
		},
		{
			name:            "from env mapping",
			input:           `{"from_env": "MY_VAR"}`,
			wantValue:       "",
			wantFromEnv:     "MY_VAR",
			wantErr:         false,
			wantWrapContext: "",
		},
		{
			name:            "empty string",
			input:           `""`,
			wantValue:       "",
			wantFromEnv:     "",
			wantErr:         false,
			wantWrapContext: "",
		},
		{
			name:            "malformed input",
			input:           `[1, 2, 3]`,
			wantValue:       "",
			wantFromEnv:     "",
			wantErr:         true,
			wantWrapContext: "unmarshaling env value",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			runEnvValueTest(t, tt, func(data []byte, v any) error {
				return json.Unmarshal(data, v)
			})
		})
	}
}

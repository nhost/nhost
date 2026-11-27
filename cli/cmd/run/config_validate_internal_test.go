package run

import (
	"bytes"
	"errors"
	"testing"

	"github.com/google/go-cmp/cmp"
)

var errTestInvalidConfig = errors.New("failed to validate config: bad value")

func TestPrintValidationJSON(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		configPath    string
		validationErr error
		want          string
	}{
		{
			name:          "valid",
			configPath:    "nhost-run-service.toml",
			validationErr: nil,
			want:          "{\n  \"config\": \"nhost-run-service.toml\",\n  \"valid\": true\n}\n",
		},
		{
			name:          "invalid",
			configPath:    "run-api.toml",
			validationErr: errTestInvalidConfig,
			want: "{\n  \"config\": \"run-api.toml\",\n  \"valid\": false,\n" +
				"  \"error\": \"failed to validate config: bad value\"\n}\n",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var buf bytes.Buffer
			if err := printValidationJSON(&buf, tt.configPath, tt.validationErr); err != nil {
				t.Fatalf("printValidationJSON() error = %v", err)
			}

			if diff := cmp.Diff(tt.want, buf.String()); diff != "" {
				t.Errorf("printValidationJSON() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

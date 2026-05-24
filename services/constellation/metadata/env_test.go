package metadata_test

import (
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestEnvString_Resolve(t *testing.T) {
	const (
		fooKey = "TEST_ENV_FOO"
		barKey = "TEST_ENV_BAR"
	)

	t.Setenv(fooKey, "foo-value")
	t.Setenv(barKey, "bar-value")

	tests := []struct {
		name      string
		in        metadata.EnvString
		want      string
		wantErr   bool
		wantInErr []string // substrings that must appear in error message
	}{
		{name: "no patterns", in: "plain string", want: "plain string"},
		{name: "single var", in: "{{TEST_ENV_FOO}}", want: "foo-value"},
		{
			name: "multiple vars",
			in:   "{{TEST_ENV_FOO}}/{{TEST_ENV_BAR}}",
			want: "foo-value/bar-value",
		},
		{
			name:      "unset var preserved with error",
			in:        "{{TEST_ENV_UNDEFINED_XYZ}}",
			want:      "{{TEST_ENV_UNDEFINED_XYZ}}",
			wantErr:   true,
			wantInErr: []string{"TEST_ENV_UNDEFINED_XYZ"},
		},
		{
			name: "embedded in larger string",
			in:   "prefix-{{TEST_ENV_FOO}}-suffix",
			want: "prefix-foo-value-suffix",
		},
		{
			name:      "mix of set and unset reports only unset",
			in:        "{{TEST_ENV_FOO}}/{{TEST_ENV_MISSING_A}}/{{TEST_ENV_MISSING_B}}",
			want:      "foo-value/{{TEST_ENV_MISSING_A}}/{{TEST_ENV_MISSING_B}}",
			wantErr:   true,
			wantInErr: []string{"TEST_ENV_MISSING_A", "TEST_ENV_MISSING_B"},
		},
		{name: "empty string", in: "", want: ""},
	}

	for _, tt := range tests { //nolint:paralleltest // t.Setenv forbids parallel subtests
		t.Run(tt.name, func(t *testing.T) {
			got, err := tt.in.Resolve()
			if got != tt.want {
				t.Errorf("Resolve value = %q, want %q", got, tt.want)
			}

			if (err != nil) != tt.wantErr {
				t.Errorf("Resolve err = %v, wantErr=%v", err, tt.wantErr)
			}

			if err != nil {
				for _, sub := range tt.wantInErr {
					if !strings.Contains(err.Error(), sub) {
						t.Errorf("err %q missing substring %q", err.Error(), sub)
					}
				}
			}
		})
	}
}

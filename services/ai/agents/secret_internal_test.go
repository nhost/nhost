package agents

import (
	"testing"
)

func TestResolveSecret(t *testing.T) {
	cases := []struct {
		name   string
		value  string
		envKey string
		envVal string
		setEnv bool
		want   string
		wantOK bool
	}{
		{
			name:   "plain string returned as-is",
			value:  "sk-my-api-key",
			want:   "sk-my-api-key",
			wantOK: true,
		},
		{
			name:   "empty string returned as-is",
			value:  "",
			want:   "",
			wantOK: true,
		},
		{
			name:   "env prefix resolves from prefixed environment variable",
			value:  "env:BRAVE_KEY",
			envKey: "AI_AGENT_SECRET_BRAVE_KEY",
			envVal: "resolved-secret",
			setEnv: true,
			want:   "resolved-secret",
			wantOK: true,
		},
		{
			name:   "env prefix with unset var returns ok=false",
			value:  "env:UNSET_VAR",
			want:   "",
			wantOK: false,
		},
		{
			name:   "env prefix with empty value returns ok=true",
			value:  "env:EMPTY",
			envKey: "AI_AGENT_SECRET_EMPTY",
			envVal: "",
			setEnv: true,
			want:   "",
			wantOK: true,
		},
		{
			name:   "env prefix does not resolve without AI_AGENT_SECRET_ prefix",
			value:  "env:DATABASE_URL",
			envKey: "DATABASE_URL",
			envVal: "postgres://leaked",
			setEnv: true,
			want:   "",
			wantOK: false,
		},
		{
			name:   "env without colon is plain string",
			value:  "environment_key",
			want:   "environment_key",
			wantOK: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.setEnv {
				t.Setenv(tc.envKey, tc.envVal)
			}

			got, ok := resolveSecret(tc.value)
			if got != tc.want {
				t.Errorf("resolveSecret(%q) = %q, want %q", tc.value, got, tc.want)
			}

			if ok != tc.wantOK {
				t.Errorf("resolveSecret(%q) ok = %v, want %v", tc.value, ok, tc.wantOK)
			}
		})
	}
}

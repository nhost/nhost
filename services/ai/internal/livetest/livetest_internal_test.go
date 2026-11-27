package livetest

import "testing"

func TestEnvironment(t *testing.T) {
	tests := []struct{ name, value, want string }{
		{name: "default", value: "", want: "fallback"},
		{name: "override", value: "configured", want: "configured"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("AI_LIVETEST_ENV_UNIT", tt.value)

			if got := environment("AI_LIVETEST_ENV_UNIT", "fallback"); got != tt.want {
				t.Errorf("environment() = %q, want %q", got, tt.want)
			}
		})
	}
}

package cmd

import "testing"

func TestResolveVersion(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		injected string
		fallback string
		want     string
	}{
		{
			name:     "uses fallback without ldflags version",
			injected: "",
			fallback: "0.0.0-dev",
			want:     "0.0.0-dev",
		},
		{
			name:     "prefers ldflags version",
			injected: "1.2.3",
			fallback: "0.0.0-dev",
			want:     "1.2.3",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if got := resolveVersion(test.injected, test.fallback); got != test.want {
				t.Errorf("resolveVersion() = %q, want %q", got, test.want)
			}
		})
	}
}

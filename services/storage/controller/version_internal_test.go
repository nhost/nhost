package controller

import "testing"

// Not parallel: mutates the package-level buildVersion.
func TestSetBuildVersion(t *testing.T) { //nolint:paralleltest
	cases := []struct {
		name     string
		injected string
		fallback string
		want     string
	}{
		{
			name:     "fills empty build version from fallback",
			injected: "",
			fallback: "0.0.0-dev",
			want:     "0.0.0-dev",
		},
		{
			name:     "keeps ldflag-injected build version over fallback",
			injected: "1.2.3",
			fallback: "0.0.0-dev",
			want:     "1.2.3",
		},
	}

	for _, tc := range cases { //nolint:paralleltest
		t.Run(tc.name, func(t *testing.T) {
			orig := buildVersion
			t.Cleanup(func() { buildVersion = orig })

			buildVersion = tc.injected
			SetBuildVersion(tc.fallback)

			if got := Version(); got != tc.want {
				t.Errorf("Version() = %q, want %q", got, tc.want)
			}
		})
	}
}

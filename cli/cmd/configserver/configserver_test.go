package configserver //nolint:testpackage

import "testing"

func TestDashboardOriginRegex(t *testing.T) {
	t.Parallel()

	cases := []struct {
		origin string
		want   bool
	}{
		{"https://local.dashboard.local.nhost.run", true},
		{"http://local.dashboard.local.nhost.run", true},
		{"https://local.dashboard.local.nhost.run:1337", true},
		{"https://dev.dashboard.local.nhost.run", true},
		{"https://dev.dashboard.local.nhost.run:8443", true},
		{"https://local.dashboard.nhost.run", true},
		{"http://local.dashboard.nhost.run:443", true},

		// Foreign origins must be rejected.
		{"https://evil.com", false},
		{"https://attacker.local.nhost.run", false},
		{"https://dashboard.local.nhost.run", false},
		{"https://dashboard.local.nhost.run.evil.com", false},
		{"https://local.dashboard.local.nhost.run.evil.com", false},
		{"https://local.dashboard.local.nhost.run/foo", false},
		{"http://localhost:3000", false},
		{"", false},
	}

	for _, tc := range cases {
		t.Run(tc.origin, func(t *testing.T) {
			t.Parallel()

			got := dashboardOriginRe.MatchString(tc.origin)
			if got != tc.want {
				t.Errorf("origin %q: got %v, want %v", tc.origin, got, tc.want)
			}
		})
	}
}

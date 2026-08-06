package dockercompose //nolint:testpackage

import "testing"

func TestParseDaemonMapsHostUser(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		out  string
		want bool
	}{
		{
			name: "rootful native docker",
			out: `{"OperatingSystem":"Ubuntu 24.04.2 LTS",` +
				`"SecurityOptions":["name=apparmor","name=seccomp,profile=builtin"]}`,
			want: false,
		},
		{
			name: "rootless docker",
			out: `{"OperatingSystem":"Arch Linux","SecurityOptions":` +
				`["name=seccomp,profile=builtin","name=rootless","name=cgroupns"]}`,
			want: true,
		},
		{
			name: "docker desktop (linux or wsl2)",
			out: `{"OperatingSystem":"Docker Desktop",` +
				`"SecurityOptions":["name=seccomp,profile=builtin"]}`,
			want: true,
		},
		{
			name: "rootful podman via compat api",
			out: `{"OperatingSystem":"fedora",` +
				`"SecurityOptions":["name=seccomp,profile=default","name=selinux"]}`,
			want: false,
		},
		{
			name: "rootless podman via compat api",
			out: `{"OperatingSystem":"fedora","SecurityOptions":` +
				`["name=seccomp,profile=default","name=rootless","name=selinux"]}`,
			want: true,
		},
		{
			name: "rootful podman cli shim",
			out:  `{"host":{"security":{"rootless":false,"seccompEnabled":true}}}`,
			want: false,
		},
		{
			name: "rootless podman cli shim",
			out:  `{"host":{"security":{"rootless":true,"seccompEnabled":true}}}`,
			want: true,
		},
		{
			name: "unparseable output",
			out:  "not json",
			want: false,
		},
		{
			name: "empty object",
			out:  `{}`,
			want: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := parseDaemonMapsHostUser([]byte(tc.out)); got != tc.want {
				t.Errorf("parseDaemonMapsHostUser(%q) = %v, want %v", tc.out, got, tc.want)
			}
		})
	}
}

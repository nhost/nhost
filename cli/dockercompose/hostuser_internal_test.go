package dockercompose

import "testing"

func TestAutoUser(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		hostOS   string
		endpoint string
		want     string
	}{
		{
			name:     "linux with default rootful socket",
			hostOS:   "linux",
			endpoint: "unix:///var/run/docker.sock",
			want:     "1000:1000",
		},
		{
			name:     "linux with /run/docker.sock",
			hostOS:   "linux",
			endpoint: "unix:///run/docker.sock",
			want:     "1000:1000",
		},
		{
			name:     "macos",
			hostOS:   "darwin",
			endpoint: "unix:///var/run/docker.sock",
			want:     "",
		},
		{
			name:     "windows",
			hostOS:   "windows",
			endpoint: "npipe:////./pipe/docker_engine",
			want:     "",
		},
		{
			name:     "linux with rootless docker socket",
			hostOS:   "linux",
			endpoint: "unix:///run/user/1000/docker.sock",
			want:     "",
		},
		{
			name:     "linux with rootless podman socket",
			hostOS:   "linux",
			endpoint: "unix:///run/user/1000/podman/podman.sock",
			want:     "",
		},
		{
			name:     "linux with docker desktop socket",
			hostOS:   "linux",
			endpoint: "unix:///home/user/.docker/desktop/docker.sock",
			want:     "",
		},
		{
			name:     "linux with colima socket",
			hostOS:   "linux",
			endpoint: "unix:///home/user/.colima/default/docker.sock",
			want:     "",
		},
		{
			name:     "linux with ssh endpoint",
			hostOS:   "linux",
			endpoint: "ssh://user@remote",
			want:     "",
		},
		{
			name:     "linux with tcp endpoint",
			hostOS:   "linux",
			endpoint: "tcp://127.0.0.1:2375",
			want:     "",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := autoUser(tc.hostOS, tc.endpoint, 1000, 1000); got != tc.want {
				t.Errorf(
					"autoUser(%q, %q, 1000, 1000) = %q, want %q",
					tc.hostOS, tc.endpoint, got, tc.want,
				)
			}
		})
	}
}

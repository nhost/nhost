package dockercompose

import (
	"context"
	"errors"
	"net/url"
	"testing"
)

func TestResolveHostUserAutoEnvironment(t *testing.T) {
	t.Parallel()

	errDetect := context.Canceled

	cases := []struct {
		name      string
		value     string
		endpoint  string
		known     bool
		detectErr error
		want      string
		wantErr   error
	}{
		{
			name:      "auto uses injected identity",
			value:     HostUserAuto,
			endpoint:  defaultDockerEndpoint,
			known:     true,
			detectErr: nil,
			want:      "1234:5678",
			wantErr:   nil,
		},
		{
			name:      "empty defaults to auto",
			value:     "",
			endpoint:  defaultDockerEndpoint,
			known:     true,
			detectErr: nil,
			want:      "1234:5678",
			wantErr:   nil,
		},
		{
			name:      "unknown endpoint disables mapping",
			value:     HostUserAuto,
			endpoint:  defaultDockerEndpoint,
			known:     false,
			detectErr: nil,
			want:      "",
			wantErr:   nil,
		},
		{
			name:      "endpoint detection error",
			value:     HostUserAuto,
			endpoint:  "",
			known:     false,
			detectErr: errDetect,
			want:      "",
			wantErr:   errDetect,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			dockerURL, err := url.Parse(tc.endpoint)
			if err != nil {
				t.Fatalf("parse test Docker endpoint: %v", err)
			}

			environment := hostUserEnvironment{
				hostOS: "linux",
				uid:    1234,
				gid:    5678,
				detectDockerHost: func(context.Context) (dockerHostResolution, error) {
					return dockerHostResolution{
						dockerURL: dockerURL,
						known:     tc.known,
					}, tc.detectErr
				},
			}

			got, err := resolveHostUser(t.Context(), tc.value, environment)
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("resolveHostUser() error = %v, want %v", err, tc.wantErr)
			}

			if got != tc.want {
				t.Errorf("resolveHostUser() = %q, want %q", got, tc.want)
			}
		})
	}
}

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
			name:     "linux with rootful podman socket under /var/run",
			hostOS:   "linux",
			endpoint: "unix:///var/run/podman/podman.sock",
			want:     "1000:1000",
		},
		{
			name:     "linux with rootful podman socket under /run",
			hostOS:   "linux",
			endpoint: "unix:///run/podman/podman.sock",
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

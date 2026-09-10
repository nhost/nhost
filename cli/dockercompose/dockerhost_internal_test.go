package dockercompose

import (
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"testing"
)

func useDockerContextEndpoint(t *testing.T, endpoint string) {
	t.Helper()

	binDir := t.TempDir()

	dockerPath := filepath.Join(binDir, "docker")
	if err := os.WriteFile(
		dockerPath,
		[]byte("#!/bin/sh\nprintf '%s\\n' \"$TEST_DOCKER_ENDPOINT\"\n"),
		0o755,
	); err != nil {
		t.Fatalf("create docker command: %v", err)
	}

	t.Setenv("DOCKER_HOST", "")
	t.Setenv("TEST_DOCKER_ENDPOINT", endpoint)
	t.Setenv("PATH", binDir+string(os.PathListSeparator)+os.Getenv("PATH"))
}

func TestDetectDockerHost(t *testing.T) {
	cases := []struct {
		name                string
		dockerHost          string
		wantEndpoint        string
		wantKnown           bool
		wantFromEnvironment bool
		verifyUserMapping   bool
	}{
		{
			name:                "DOCKER_HOST takes precedence",
			dockerHost:          "unix:///run/user/1000/docker.sock",
			wantEndpoint:        "unix:///run/user/1000/docker.sock",
			wantKnown:           true,
			wantFromEnvironment: true,
			verifyUserMapping:   false,
		},
		{
			name:                "command failure uses unknown fallback",
			dockerHost:          "",
			wantEndpoint:        defaultDockerEndpoint,
			wantKnown:           false,
			wantFromEnvironment: false,
			verifyUserMapping:   true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("DOCKER_HOST", tc.dockerHost)
			t.Setenv("PATH", t.TempDir())

			resolution, err := detectDockerHost(t.Context())
			if err != nil {
				t.Fatalf("detectDockerHost failed: %v", err)
			}

			if got := resolution.dockerURL.String(); got != tc.wantEndpoint {
				t.Errorf("Docker endpoint = %q, want %q", got, tc.wantEndpoint)
			}

			if resolution.known != tc.wantKnown {
				t.Errorf("Docker endpoint known = %t, want %t", resolution.known, tc.wantKnown)
			}

			if resolution.fromEnvironment != tc.wantFromEnvironment {
				t.Errorf(
					"Docker endpoint from environment = %t, want %t",
					resolution.fromEnvironment,
					tc.wantFromEnvironment,
				)
			}

			if !tc.verifyUserMapping {
				return
			}

			hostUser, err := ResolveHostUser(t.Context(), HostUserAuto)
			if err != nil {
				t.Fatalf("resolveHostUser failed: %v", err)
			}

			if hostUser != "" {
				t.Errorf("resolveHostUser returned %q, want empty", hostUser)
			}
		})
	}
}

func requireDockerSocketMount(t *testing.T, service *Service, source string) {
	t.Helper()

	for i := range service.Volumes {
		volume := &service.Volumes[i]
		if volume.Target != "/var/run/docker.sock" {
			continue
		}

		if volume.Source != source {
			t.Errorf("Docker socket source = %q, want %q", volume.Source, source)
		}

		return
	}

	t.Fatal("Docker socket is not mounted")
}

func TestDockerSocketConsumersUseHostCompatibleEndpoint(
	t *testing.T,
) {
	if runtime.GOOS == "windows" {
		t.Skip("test helper uses a POSIX shell script")
	}

	cases := []struct {
		name            string
		hostOS          string
		contextEndpoint string
		dockerHost      string
		wantEndpoint    string
		wantSource      string
	}{
		{
			name:            "Linux rootless context",
			hostOS:          osLinux,
			contextEndpoint: "unix:///run/user/1000/docker.sock",
			dockerHost:      "",
			wantEndpoint:    "unix:///run/user/1000/docker.sock",
			wantSource:      "/run/user/1000/docker.sock",
		},
		{
			name:            "Docker Desktop context",
			hostOS:          "darwin",
			contextEndpoint: "unix:///Users/test/.docker/run/docker.sock",
			dockerHost:      "",
			wantEndpoint:    defaultDockerEndpoint,
			wantSource:      "/var/run/docker.sock",
		},
		{
			name:            "explicit non-Linux DOCKER_HOST",
			hostOS:          "darwin",
			contextEndpoint: "",
			dockerHost:      "unix:///Users/test/.colima/default/docker.sock",
			wantEndpoint:    "unix:///Users/test/.colima/default/docker.sock",
			wantSource:      "/Users/test/.colima/default/docker.sock",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.dockerHost == "" {
				useDockerContextEndpoint(t, tc.contextEndpoint)
			} else {
				t.Setenv("DOCKER_HOST", tc.dockerHost)
				t.Setenv("PATH", t.TempDir())
			}

			resolution, err := detectDockerHost(t.Context())
			if err != nil {
				t.Fatalf("detectDockerHost failed: %v", err)
			}

			wantDetectedEndpoint := tc.contextEndpoint
			if tc.dockerHost != "" {
				wantDetectedEndpoint = tc.dockerHost
			}

			if got := resolution.dockerURL.String(); got != wantDetectedEndpoint {
				t.Fatalf("detected Docker endpoint = %q, want %q", got, wantDetectedEndpoint)
			}

			dockerURL, err := dockerHostForSocketConsumers(resolution, tc.hostOS)
			if err != nil {
				t.Fatalf("resolve Docker host for socket consumers: %v", err)
			}

			if got := dockerURL.String(); got != tc.wantEndpoint {
				t.Fatalf("Docker endpoint = %q, want %q", got, tc.wantEndpoint)
			}

			traefikService, err := traefik("dev", "project", 1337, t.TempDir(), dockerURL)
			if err != nil {
				t.Fatalf("create traefik service: %v", err)
			}

			configserverService := configserver(
				dockerURL,
				"nhost/cli:test",
				"/project",
				"/project/nhost",
				"project",
				"app-id",
				false,
			)

			requireDockerSocketMount(t, traefikService, tc.wantSource)
			requireDockerSocketMount(t, configserverService, tc.wantSource)

			if want := "--providers.docker.endpoint=" + defaultDockerEndpoint; !slices.Contains(
				traefikService.Command,
				want,
			) {
				t.Errorf("traefik command does not contain %q", want)
			}

			if got := configserverService.Environment["DOCKER_HOST"]; got != defaultDockerEndpoint {
				t.Errorf("configserver DOCKER_HOST = %q, want %q", got, defaultDockerEndpoint)
			}
		})
	}
}

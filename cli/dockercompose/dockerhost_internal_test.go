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

func TestRootlessDockerContextIsUsedBySocketConsumers( //nolint:paralleltest // mutates process-wide Docker environment
	t *testing.T,
) {
	if runtime.GOOS == "windows" {
		t.Skip("test helper uses a POSIX shell script")
	}

	const rootlessEndpoint = "unix:///run/user/1000/docker.sock"

	useDockerContextEndpoint(t, rootlessEndpoint)

	ctx := t.Context()

	hostUser, err := ResolveHostUser(ctx, HostUserAuto)
	if err != nil {
		t.Fatalf("ResolveHostUser failed: %v", err)
	}

	if hostUser != "" {
		t.Fatalf("ResolveHostUser returned %q for a rootless Docker context, want empty", hostUser)
	}

	dockerURL, err := resolveDockerHost(ctx)
	if err != nil {
		t.Fatalf("resolveDockerHost failed: %v", err)
	}

	if got := dockerURL.String(); got != rootlessEndpoint {
		t.Fatalf("resolveDockerHost returned %q, want %q", got, rootlessEndpoint)
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

	requireDockerSocketMount(t, traefikService, "/run/user/1000/docker.sock")
	requireDockerSocketMount(t, configserverService, "/run/user/1000/docker.sock")

	if want := "--providers.docker.endpoint=" + defaultDockerEndpoint; !slices.Contains(
		traefikService.Command,
		want,
	) {
		t.Errorf("traefik command does not contain %q", want)
	}

	if got := configserverService.Environment["DOCKER_HOST"]; got != defaultDockerEndpoint {
		t.Errorf("configserver DOCKER_HOST = %q, want %q", got, defaultDockerEndpoint)
	}
}

package dockercompose_test

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/nhost/nhost/cli/dockercompose"
)

func TestHasuraCLIExitCode(t *testing.T) {
	binDir := t.TempDir()
	if err := os.WriteFile(
		filepath.Join(binDir, "docker"),
		[]byte("#!/bin/sh\necho hasura-cli output\nexit \"$TEST_DOCKER_EXIT_CODE\"\n"),
		0o755,
	); err != nil {
		t.Fatalf("create docker command: %v", err)
	}

	t.Setenv("PATH", binDir+string(os.PathListSeparator)+os.Getenv("PATH"))

	dc := dockercompose.New(t.TempDir(), "docker-compose.yaml", "test")
	docker := dockercompose.NewDocker()

	runs := map[string]func(context.Context) error{
		"ApplyMigrations": func(ctx context.Context) error {
			return dc.ApplyMigrations(ctx, "http://graphql:8080")
		},
		"ApplySeeds": func(ctx context.Context) error {
			return dc.ApplySeeds(ctx, "http://graphql:8080")
		},
		"ReloadMetadata": dc.ReloadMetadata,
		"HasuraWrapper": func(ctx context.Context) error {
			return docker.HasuraWrapper(ctx, "local", binDir, "v2.48.5", "", "version")
		},
	}

	tests := []struct {
		name     string
		exitCode string
		wantCode int
	}{
		{name: "success", exitCode: "0", wantCode: 0},
		{name: "failure", exitCode: "3", wantCode: 3},
	}

	for name, run := range runs {
		for _, tt := range tests {
			t.Run(name+"/"+tt.name, func(t *testing.T) {
				t.Setenv("TEST_DOCKER_EXIT_CODE", tt.exitCode)

				err := run(t.Context())

				var exitErr *exec.ExitError

				switch {
				case tt.wantCode == 0 && err != nil:
					t.Errorf("got error %v, want nil", err)
				case tt.wantCode != 0 && !errors.As(err, &exitErr):
					t.Errorf("got error %v, want exit status %d", err, tt.wantCode)
				case tt.wantCode != 0 && exitErr.ExitCode() != tt.wantCode:
					t.Errorf("got exit code %d, want %d", exitErr.ExitCode(), tt.wantCode)
				}
			})
		}
	}
}

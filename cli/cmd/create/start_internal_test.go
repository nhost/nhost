package create

import (
	"bytes"
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// stubStart restores the process seams after a test mutates them, and puts a
// preflight in place that never touches docker.
func stubStart(t *testing.T) {
	t.Helper()

	origBackend, origFrontend, origPreflight := runBackend, runFrontend, runPreflight

	t.Cleanup(func() {
		runBackend = origBackend
		runFrontend = origFrontend
		runPreflight = origPreflight
	})

	runPreflight = func(_ context.Context, _ string) []blocker {
		return nil
	}
}

//nolint:paralleltest // mutates package-level process seams
func TestStartServersRunsBackendThenFrontend(t *testing.T) {
	stubStart(t)

	var calls []string

	runBackend = func(_ context.Context, dir string) error {
		calls = append(calls, "backend "+dir)

		return nil
	}

	runFrontend = func(_ context.Context, pm, dir string) error {
		calls = append(calls, "frontend "+pm+" "+dir)

		return nil
	}

	var output bytes.Buffer

	resolved := choices{
		template:       defaultTemplate,
		name:           "demo",
		packageManager: "bun",
		installNow:     true,
		startNow:       true,
	}

	if err := startServers(
		context.Background(),
		newTestEnv(&output),
		devVersion,
		resolved,
		filepath.Join("/tmp", "demo"),
	); err != nil {
		t.Fatalf("startServers: %v", err)
	}

	want := []string{
		"backend " + filepath.Join("/tmp", "demo", "backend"),
		"frontend bun " + filepath.Join("/tmp", "demo", "frontend"),
	}

	if len(calls) != len(want) || calls[0] != want[0] || calls[1] != want[1] {
		t.Errorf("calls = %#v, want %#v", calls, want)
	}

	if !strings.Contains(output.String(), "bun run dev") {
		t.Errorf("output missing the dev command:\n%s", output.String())
	}
}

var errBackendFailed = errors.New("docker is not running")

// The project exists either way, so a backend that will not start is a warning
// plus the command to retry, not a failed create.
//
//nolint:paralleltest // mutates package-level process seams
func TestStartServersKeepsTheProjectWhenTheBackendFails(t *testing.T) {
	stubStart(t)

	runBackend = func(_ context.Context, _ string) error {
		return errBackendFailed
	}

	frontendStarted := false

	runFrontend = func(_ context.Context, _, _ string) error {
		frontendStarted = true

		return nil
	}

	var output bytes.Buffer

	err := startServers(context.Background(), newTestEnv(&output), devVersion, choices{
		template:       defaultTemplate,
		name:           "demo",
		packageManager: defaultPackageManager,
		installNow:     true,
		startNow:       true,
	}, filepath.Join("/tmp", "demo"))
	if err != nil {
		t.Fatalf("startServers() error = %v, want nil", err)
	}

	if frontendStarted {
		t.Error("frontend was started without a backend")
	}

	if !strings.Contains(output.String(), "cd demo/backend && nhost up") {
		t.Errorf("output missing the retry command:\n%s", output.String())
	}
}

// A machine that cannot run the backend must not be handed to docker compose
// only to fail there: the create explains itself and prints both commands.
//
//nolint:paralleltest // mutates package-level process seams
func TestStartServersStopsOnAPreflightBlocker(t *testing.T) {
	stubStart(t)

	runPreflight = func(_ context.Context, _ string) []blocker {
		return []blocker{{
			problem: "Port 443 is in use, and the backend's HTTPS gateway needs it.",
			fix:     "Stop what is listening on it.",
		}}
	}

	runBackend = func(_ context.Context, _ string) error {
		t.Error("backend was started despite a blocker")

		return nil
	}

	runFrontend = func(_ context.Context, _, _ string) error {
		t.Error("frontend was started despite a blocker")

		return nil
	}

	var output bytes.Buffer

	err := startServers(context.Background(), newTestEnv(&output), devVersion, choices{
		template:       defaultTemplate,
		name:           "demo",
		packageManager: defaultPackageManager,
		installNow:     true,
		startNow:       true,
	}, filepath.Join("/tmp", "demo"))
	if err != nil {
		t.Fatalf("startServers() error = %v, want nil", err)
	}

	for _, want := range []string{
		"Port 443 is in use",
		"Stop what is listening on it.",
		"cd demo/backend && nhost up",
		"cd demo/frontend && pnpm dev",
	} {
		if !strings.Contains(output.String(), want) {
			t.Errorf("output missing %q:\n%s", want, output.String())
		}
	}
}

// fakePackageManager puts an executable named pm on PATH, so startFrontend runs
// a real process and classifies how it exited.
func fakePackageManager(t *testing.T, pm, script string) {
	t.Helper()

	binDir := t.TempDir()

	if err := os.WriteFile(
		filepath.Join(binDir, pm), []byte("#!/bin/sh\n"+script+"\n"), 0o755,
	); err != nil {
		t.Fatalf("create %s command: %v", pm, err)
	}

	t.Setenv("PATH", binDir+string(os.PathListSeparator)+os.Getenv("PATH"))
}

//nolint:paralleltest // mutates PATH
func TestStartFrontendTreatsASignalAsTheUserStopping(t *testing.T) {
	fakePackageManager(t, "pnpm", "kill -INT $$")

	if err := startFrontend(context.Background(), "pnpm", t.TempDir()); err != nil {
		t.Errorf("startFrontend() error = %v, want nil", err)
	}
}

//nolint:paralleltest // mutates PATH
func TestStartFrontendReportsAFailedDevServer(t *testing.T) {
	fakePackageManager(t, "pnpm", "exit 1")

	err := startFrontend(context.Background(), "pnpm", t.TempDir())
	if err == nil {
		t.Fatal("startFrontend() error = nil, want a failure")
	}

	if !strings.Contains(err.Error(), "pnpm dev") {
		t.Errorf("error = %v, want it to name the dev command", err)
	}
}

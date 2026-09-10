package e2e_test

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

type envConfig struct {
	cliBin          string // path to the nhost CLI binary
	workdir         string // parent dir for the scratch project (must be docker-mountable)
	mode            string // "standalone" or "engine"
	httpPort        string
	postgresPort    string
	configserverImg string // optional NHOST_CONFIGSERVER_IMAGE override
	subdomain       string
	keep            bool // skip teardown for debugging
}

const commandWaitDelay = 5 * time.Second

func normalizeProjectDir(projectDir string) (string, error) {
	absolutePath, err := filepath.Abs(projectDir)
	if err != nil {
		return "", fmt.Errorf("resolving project directory %q: %w", projectDir, err)
	}

	return absolutePath, nil
}

func cliCmd(ctx context.Context, env envConfig, projectDir string, args ...string) *exec.Cmd {
	full := append([]string{"--branch", "e2e"}, args...)
	// test-controlled binary + args
	cmd := exec.CommandContext(
		ctx,
		env.cliBin,
		full...,
	)
	cmd.Dir = projectDir
	cmd.Stdin = nil // avoid interactive prompts blocking on stdin
	cmd.Env = isolatedCLIEnvironment(os.Environ(), env, projectDir)
	cmd.WaitDelay = commandWaitDelay

	return cmd
}

func isolatedCLIEnvironment(base []string, env envConfig, projectDir string) []string {
	result := make([]string, 0, len(base)+7)
	for _, entry := range base {
		name, _, _ := strings.Cut(entry, "=")
		if name == "BRANCH" || name == "XDG_STATE_HOME" || strings.HasPrefix(name, "NHOST_") {
			continue
		}

		result = append(result, entry)
	}

	result = append(
		result,
		"NHOST_ROOT_FOLDER="+projectDir,
		"NHOST_NHOST_FOLDER="+filepath.Join(projectDir, "nhost"),
		"NHOST_DOT_NHOST_FOLDER="+filepath.Join(projectDir, ".nhost"),
		"NHOST_PROJECT_NAME="+filepath.Base(projectDir),
		"NHOST_LOCAL_SUBDOMAIN="+env.subdomain,
		"XDG_STATE_HOME="+filepath.Join(projectDir, ".state"),
	)
	if env.configserverImg != "" {
		result = append(result, "NHOST_CONFIGSERVER_IMAGE="+env.configserverImg)
	}

	return result
}

const (
	isolationChildEnv    = "E2E_ISOLATION_TEST_CHILD"
	isolationExternalEnv = "E2E_ISOLATION_EXTERNAL_DIR"
)

func TestCLICommandEnvironmentIsolation(t *testing.T) {
	if os.Getenv(isolationChildEnv) == "1" {
		testCLICommandEnvironmentIsolation(t, os.Getenv(isolationExternalEnv))

		return
	}

	t.Parallel()

	externalDir := t.TempDir()
	cmd := exec.CommandContext(
		t.Context(),
		os.Args[0],
		"-test.run=^TestCLICommandEnvironmentIsolation$",
	)
	cmd.Env = environmentWithOverrides(os.Environ(), hostileEnvironment(externalDir))

	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("isolation test subprocess failed: %v\n%s", err, output)
	}
}

func testCLICommandEnvironmentIsolation(t *testing.T, externalDir string) {
	t.Helper()

	projectParent := t.TempDir()
	t.Chdir(projectParent)

	if err := os.Mkdir("project", 0o755); err != nil {
		t.Fatalf("create relative project directory: %v", err)
	}

	projectDir, err := normalizeProjectDir("project")
	if err != nil {
		t.Fatalf("normalize relative project directory: %v", err)
	}

	sentinels := []sentinel{
		{path: filepath.Join(externalDir, ".secrets"), content: "root sentinel"},
		{path: filepath.Join(externalDir, "nhost", "nhost.toml"), content: "nhost sentinel"},
		{path: filepath.Join(externalDir, ".nhost", "project.json"), content: "dot-nhost sentinel"},
		{path: filepath.Join(externalDir, "state", "nhost", "auth.json"), content: "auth sentinel"},
	}
	for _, sentinel := range sentinels {
		writeSentinel(t, sentinel)
	}

	env := envConfig{
		cliBin:          writeFakeCLI(t),
		workdir:         "",
		mode:            "",
		httpPort:        "",
		postgresPort:    "",
		configserverImg: "suite-image",
		subdomain:       "suite-subdomain",
		keep:            false,
	}
	cmd := cliCmd(t.Context(), env, projectDir, "init")
	output, commandErr := cmd.CombinedOutput()

	if _, err := os.Stat(filepath.Join(projectDir, ".secrets")); err != nil {
		t.Errorf("expected project root was not initialized: %v", err)
	}

	doubledProjectDir := filepath.Join(projectDir, filepath.Base(projectDir))
	if _, err := os.Stat(filepath.Join(doubledProjectDir, ".secrets")); err == nil {
		t.Errorf("project directory was resolved twice: %s", doubledProjectDir)
	} else if !errors.Is(err, os.ErrNotExist) {
		t.Errorf("inspect doubled project directory: %v", err)
	}

	for _, sentinel := range sentinels {
		assertSentinel(t, sentinel)
	}

	if commandErr != nil {
		t.Fatalf("fake CLI failed: %v\n%s", commandErr, output)
	}
}

func hostileEnvironment(externalDir string) map[string]string {
	return map[string]string{
		"BRANCH":                   "hostile-branch",
		"DOCKER_CONFIG":            filepath.Join(externalDir, "docker-config"),
		"DOCKER_HOST":              "unix:///preserved-docker.sock",
		"NHOST_CLI_AUTH_URL":       "https://hostile.invalid/auth",
		"NHOST_CLI_GRAPHQL_URL":    "https://hostile.invalid/graphql",
		"NHOST_CONFIGSERVER_IMAGE": "hostile-image",
		"NHOST_DOT_NHOST_FOLDER":   filepath.Join(externalDir, ".nhost"),
		"NHOST_LOCAL_SUBDOMAIN":    "hostile-subdomain",
		"NHOST_NHOST_FOLDER":       filepath.Join(externalDir, "nhost"),
		"NHOST_OAUTH2_CLIENT_ID":   "hostile-client",
		"NHOST_PAT":                "hostile-pat",
		"NHOST_PROJECT_NAME":       "hostile-project",
		"NHOST_REMOTE":             "true",
		"NHOST_ROOT_FOLDER":        externalDir,
		"NHOST_UNRECOGNIZED":       "hostile-future-override",
		"XDG_RUNTIME_DIR":          filepath.Join(externalDir, "runtime"),
		"XDG_STATE_HOME":           filepath.Join(externalDir, "state"),
		isolationChildEnv:          "1",
		isolationExternalEnv:       externalDir,
	}
}

func environmentWithOverrides(base []string, overrides map[string]string) []string {
	result := make([]string, 0, len(base)+len(overrides))
	for _, entry := range base {
		name, _, _ := strings.Cut(entry, "=")
		if _, overridden := overrides[name]; !overridden {
			result = append(result, entry)
		}
	}

	for name, value := range overrides {
		result = append(result, name+"="+value)
	}

	return result
}

type sentinel struct {
	path    string
	content string
}

func writeSentinel(t *testing.T, sentinel sentinel) {
	t.Helper()

	if err := os.MkdirAll(filepath.Dir(sentinel.path), 0o755); err != nil {
		t.Fatalf("create sentinel directory: %v", err)
	}

	if err := os.WriteFile(sentinel.path, []byte(sentinel.content), 0o600); err != nil {
		t.Fatalf("write sentinel: %v", err)
	}
}

func assertSentinel(t *testing.T, sentinel sentinel) {
	t.Helper()

	got, err := os.ReadFile(sentinel.path)
	if err != nil {
		t.Errorf("read sentinel %s: %v", sentinel.path, err)

		return
	}

	if string(got) != sentinel.content {
		t.Errorf("sentinel %s changed: got %q, want %q", sentinel.path, got, sentinel.content)
	}
}

func writeFakeCLI(t *testing.T) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), "fake-nhost")
	if err := os.WriteFile(path, []byte(fakeCLI), 0o700); err != nil {
		t.Fatalf("write fake CLI: %v", err)
	}

	return path
}

const fakeCLI = `#!/bin/sh
set -eu
mkdir -p "$NHOST_ROOT_FOLDER" "$NHOST_NHOST_FOLDER" "$NHOST_DOT_NHOST_FOLDER" "$XDG_STATE_HOME/nhost"
printf overwritten > "$NHOST_ROOT_FOLDER/.secrets"
printf overwritten > "$NHOST_NHOST_FOLDER/nhost.toml"
printf overwritten > "$NHOST_DOT_NHOST_FOLDER/project.json"
printf overwritten > "$XDG_STATE_HOME/nhost/auth.json"
test "$NHOST_ROOT_FOLDER" = "$PWD"
test "$NHOST_NHOST_FOLDER" = "$PWD/nhost"
test "$NHOST_DOT_NHOST_FOLDER" = "$PWD/.nhost"
test "$NHOST_PROJECT_NAME" = "${PWD##*/}"
test "$NHOST_LOCAL_SUBDOMAIN" = "suite-subdomain"
test "$NHOST_CONFIGSERVER_IMAGE" = "suite-image"
test "$XDG_STATE_HOME" = "$PWD/.state"
test "$DOCKER_HOST" = "unix:///preserved-docker.sock"
test -n "$DOCKER_CONFIG"
test -n "$XDG_RUNTIME_DIR"
test -z "${NHOST_CLI_AUTH_URL+x}"
test -z "${NHOST_CLI_GRAPHQL_URL+x}"
test -z "${NHOST_OAUTH2_CLIENT_ID+x}"
test -z "${NHOST_PAT+x}"
test -z "${NHOST_REMOTE+x}"
test -z "${NHOST_UNRECOGNIZED+x}"
test -z "${BRANCH+x}"
test "$1" = "--branch"
test "$2" = "e2e"
test "$3" = "init"
printf '%s\n' "environment isolated"
`

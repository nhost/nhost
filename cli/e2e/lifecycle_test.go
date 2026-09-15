//go:build e2e

package e2e_test

import (
	"bytes"
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"testing"
	"time"
)

const (
	composeProjectLabel = "com.docker.compose.project"
	upFailurePrompt     = "Do you want to stop Nhost's development environment? [y/N]"
	noMigrationsWarning = "No migrations found"
	noMetadataWarning   = "No metadata found"
	downFailureText     = "failed to stop Nhost development environment"
	logsFailureText     = "failed to show logs from docker compose"
)

var (
	errHarnessAlreadyRunning  = errors.New("another e2e run is active for this port pair")
	errHarnessLockUnavailable = errors.New("could not claim harness lock")
)

func requirePort(t *testing.T, name, value string) string {
	t.Helper()

	port, err := strconv.Atoi(value)
	if err != nil || port < 1 || port > 65535 {
		t.Fatalf("%s must be a TCP port between 1 and 65535, got %q", name, value)
	}

	return strconv.Itoa(port)
}

func composeProjectName(httpPort, postgresPort string) string {
	return fmt.Sprintf("nhost-cli-e2e-%s-%s", httpPort, postgresPort)
}

func keepRecoveryCommand(env envConfig, projectDir string) string {
	return fmt.Sprintf(
		"cd %s && NHOST_PROJECT_NAME=%s %s --branch e2e down --volumes",
		shellQuote(projectDir),
		shellQuote(env.projectName),
		shellQuote(env.cliBin),
	)
}

func shellQuote(value string) string {
	return "'" + strings.ReplaceAll(value, "'", `'"'"'`) + "'"
}

func requireSuiteDeadline(t *testing.T) {
	t.Helper()

	deadline, ok := t.Deadline()
	if !ok {
		return
	}

	remaining := time.Until(deadline)
	if remaining < suiteTimeoutBudget {
		t.Fatalf(
			"go test -timeout is too small for TestE2E: need at least %s of remaining time for the internal timeout budget, have %s; use -timeout %s or greater",
			suiteTimeoutBudget,
			remaining.Round(time.Second),
			suiteTestTimeout,
		)
	}
}

func prepareHarness(t *testing.T, env envConfig) (envConfig, string, func() error) {
	t.Helper()

	releaseLock, err := acquireHarnessLock(env.projectName)
	if err != nil {
		t.Fatalf("acquire harness lock for %s: %v", env.projectName, err)
	}

	t.Cleanup(func() {
		if err := releaseLock(); err != nil {
			t.Errorf("release harness lock for %s: %v", env.projectName, err)
		}
	})

	reclaimStaleComposeProject(t, env.projectName)

	releasePorts, err := reserveHostPorts(env.httpPort, env.postgresPort)
	if err != nil {
		t.Fatalf(
			"reserve e2e host ports (HTTP %s, Postgres %s): %v; choose distinct E2E_HTTP_PORT/E2E_POSTGRES_PORT values or stop the process using them",
			env.httpPort,
			env.postgresPort,
			err,
		)
	}

	t.Cleanup(func() {
		if err := releasePorts(); err != nil {
			t.Errorf("release reserved host ports: %v", err)
		}
	})

	env.workdir = prepareWorkdir(t, env)
	//nolint:usetesting // Must honor Docker-mountable E2E_WORKDIR.
	projectDir, err := os.MkdirTemp(env.workdir, "nhost-e2e-*")
	if err != nil {
		t.Fatalf("create project dir under %q: %v", env.workdir, err)
	}

	projectDir, err = normalizeProjectDir(projectDir)
	if err != nil {
		t.Fatalf("normalize project dir: %v", err)
	}

	t.Logf("project dir: %s (mode=%s, compose-project=%s)", projectDir, env.mode, env.projectName)

	if !env.keep {
		t.Cleanup(func() {
			if err := os.RemoveAll(projectDir); err != nil {
				t.Errorf("remove project directory %s: %v", projectDir, err)
			}
		})
	}

	return env, projectDir, releasePorts
}

func prepareWorkdir(t *testing.T, env envConfig) string {
	t.Helper()

	if env.workdir != "" {
		if err := os.MkdirAll(env.workdir, 0o755); err != nil {
			t.Fatalf("create E2E_WORKDIR %s: %v", env.workdir, err)
		}

		return env.workdir
	}

	//nolint:usetesting // E2E_KEEP may preserve the directory after the test exits.
	workdir, err := os.MkdirTemp("", "nhost-e2e-workdir-*")
	if err != nil {
		t.Fatalf("create default e2e workdir: %v", err)
	}

	if !env.keep {
		t.Cleanup(func() {
			if err := os.RemoveAll(workdir); err != nil {
				t.Errorf("remove default e2e workdir %s: %v", workdir, err)
			}
		})
	}

	return workdir
}

func acquireHarnessLock(projectName string) (func() error, error) {
	cacheDir, err := os.UserCacheDir()
	if err != nil {
		return nil, fmt.Errorf("locating user cache directory: %w", err)
	}

	lockDir := filepath.Join(cacheDir, "nhost", "e2e-locks")
	if err := os.MkdirAll(lockDir, 0o700); err != nil {
		return nil, fmt.Errorf("creating harness lock directory: %w", err)
	}

	hash := sha256.Sum256([]byte(projectName))
	lockPath := filepath.Join(lockDir, fmt.Sprintf("%x.lock", hash[:8]))

	return acquireHarnessLockAt(lockPath)
}

func acquireHarnessLockAt(lockPath string) (func() error, error) {
	lockFile, err := os.OpenFile(lockPath, os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return nil, fmt.Errorf(
			"%w %s: opening lock file: %w",
			errHarnessLockUnavailable,
			lockPath,
			err,
		)
	}

	if err := syscall.Flock(int(lockFile.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		closeErr := lockFile.Close()
		if errors.Is(err, syscall.EWOULDBLOCK) || errors.Is(err, syscall.EAGAIN) {
			return nil, errors.Join(errHarnessAlreadyRunning, closeErr)
		}

		return nil, errors.Join(
			fmt.Errorf("%w %s: locking file: %w", errHarnessLockUnavailable, lockPath, err),
			closeErr,
		)
	}

	var (
		once       sync.Once
		releaseErr error
	)

	return func() error {
		once.Do(func() {
			unlockErr := syscall.Flock(int(lockFile.Fd()), syscall.LOCK_UN)
			releaseErr = errors.Join(unlockErr, lockFile.Close())
		})

		return releaseErr
	}, nil
}

func reserveHostPorts(ports ...string) (func() error, error) {
	listeners := make([]net.Listener, 0, len(ports))
	for _, port := range ports {
		listener, err := net.Listen("tcp4", net.JoinHostPort("127.0.0.1", port))
		if err != nil {
			return nil, errors.Join(
				fmt.Errorf("port %s is unavailable: %w", port, err),
				closeListeners(listeners),
			)
		}

		listeners = append(listeners, listener)
	}

	var (
		once       sync.Once
		releaseErr error
	)

	return func() error {
		once.Do(func() {
			releaseErr = closeListeners(listeners)
		})

		return releaseErr
	}, nil
}

func closeListeners(listeners []net.Listener) error {
	var errs []error
	for _, listener := range listeners {
		if err := listener.Close(); err != nil && !errors.Is(err, net.ErrClosed) {
			errs = append(errs, fmt.Errorf("closing %s: %w", listener.Addr(), err))
		}
	}

	return errors.Join(errs...)
}

type composeResources struct {
	containers []string
	volumes    []string
	networks   []string
}

func (r composeResources) empty() bool {
	return len(r.containers) == 0 && len(r.volumes) == 0 && len(r.networks) == 0
}

func (r composeResources) String() string {
	return fmt.Sprintf("containers=%v volumes=%v networks=%v", r.containers, r.volumes, r.networks)
}

func reclaimStaleComposeProject(t *testing.T, projectName string) {
	t.Helper()

	ctx, cancel := context.WithTimeout(t.Context(), cleanupTimeout)
	defer cancel()

	resources, err := listComposeResources(ctx, projectName)
	if err != nil {
		t.Fatalf("inspect stale Compose project %s: %v", projectName, err)
	}

	if resources.empty() {
		return
	}

	t.Logf(
		"reclaiming stale Compose project %s (%s)",
		projectName,
		redactOutput([]byte(resources.String())),
	)

	if err := removeComposeResources(ctx, resources); err != nil {
		t.Fatalf("reclaim stale Compose project %s: %v", projectName, err)
	}

	remaining, err := listComposeResources(ctx, projectName)
	if err != nil {
		t.Fatalf("verify stale Compose project %s reclamation: %v", projectName, err)
	}

	if !remaining.empty() {
		t.Fatalf(
			"stale Compose project %s still has resources after reclamation: %s",
			projectName,
			redactOutput([]byte(remaining.String())),
		)
	}
}

func tearDownComposeProject(t *testing.T, env envConfig, projectDir string) {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), cleanupTimeout)
	defer cancel()

	downCtx, cancelDown := context.WithTimeout(ctx, downCommandTimeout)
	down := cliCmd(downCtx, env, projectDir, "down", "--volumes")
	out, downErr := down.CombinedOutput()

	cancelDown()

	reportedFailure := bytes.Contains(out, []byte(downFailureText))
	switch {
	case errors.Is(downCtx.Err(), context.DeadlineExceeded):
		t.Errorf("`nhost down` timed out after %s\n%s", downCommandTimeout, redactedTail(out, 20))
	case downErr != nil:
		t.Errorf("`nhost down` failed: %v\n%s", downErr, redactedTail(out, 20))
	case reportedFailure:
		t.Errorf("`nhost down` reported a swallowed Docker failure:\n%s", redactedTail(out, 20))
	}

	resources, inspectErr := listComposeResources(ctx, env.projectName)
	if inspectErr != nil {
		t.Errorf("verify Compose teardown for %s: %v", env.projectName, inspectErr)

		return
	}

	if resources.empty() {
		return
	}

	t.Errorf(
		"Compose teardown left resources for %s: %s",
		env.projectName,
		redactOutput([]byte(resources.String())),
	)

	if err := removeComposeResources(ctx, resources); err != nil {
		t.Errorf("force-remove leaked Compose resources for %s: %v", env.projectName, err)

		return
	}

	remaining, err := listComposeResources(ctx, env.projectName)
	if err != nil {
		t.Errorf("verify forced Compose cleanup for %s: %v", env.projectName, err)
	} else if !remaining.empty() {
		t.Errorf(
			"forced Compose cleanup left resources for %s: %s",
			env.projectName,
			redactOutput([]byte(remaining.String())),
		)
	}
}

func assertComposeProjectOwnsPorts(t *testing.T, projectName string, ports ...string) {
	t.Helper()

	ctx, cancel := context.WithTimeout(t.Context(), dockerInspectTimeout)
	defer cancel()

	for _, port := range ports {
		out, err := dockerOutput(
			ctx,
			"container",
			"ls",
			"--quiet",
			"--filter",
			"label="+composeProjectLabel+"="+projectName,
			"--filter",
			"publish="+port,
		)
		if err != nil {
			t.Fatalf("verify Compose project %s owns host port %s: %v", projectName, port, err)
		}

		if len(strings.Fields(string(out))) == 0 {
			t.Fatalf(
				"Compose project %s does not own a running container publishing host port %s; refusing to send HTTP traffic to an unrelated stack",
				projectName,
				port,
			)
		}
	}
}

func listComposeResources(ctx context.Context, projectName string) (composeResources, error) {
	label := "label=" + composeProjectLabel + "=" + projectName

	containers, err := dockerIDs(ctx, "container", "ls", "--all", "--quiet", "--filter", label)
	if err != nil {
		return composeResources{}, fmt.Errorf("listing containers: %w", err)
	}

	volumes, err := dockerIDs(ctx, "volume", "ls", "--quiet", "--filter", label)
	if err != nil {
		return composeResources{}, fmt.Errorf("listing volumes: %w", err)
	}

	networks, err := dockerIDs(ctx, "network", "ls", "--quiet", "--filter", label)
	if err != nil {
		return composeResources{}, fmt.Errorf("listing networks: %w", err)
	}

	return composeResources{containers: containers, volumes: volumes, networks: networks}, nil
}

func dockerIDs(ctx context.Context, args ...string) ([]string, error) {
	out, err := dockerOutput(ctx, args...)
	if err != nil {
		return nil, err
	}

	return strings.Fields(string(out)), nil
}

func removeComposeResources(ctx context.Context, resources composeResources) error {
	var errs []error
	if len(resources.containers) > 0 {
		args := append([]string{"container", "rm", "--force", "--volumes"}, resources.containers...)
		if _, err := dockerOutput(ctx, args...); err != nil {
			errs = append(errs, fmt.Errorf("removing containers: %w", err))
		}
	}

	if len(resources.networks) > 0 {
		args := append([]string{"network", "rm"}, resources.networks...)
		if _, err := dockerOutput(ctx, args...); err != nil {
			errs = append(errs, fmt.Errorf("removing networks: %w", err))
		}
	}

	if len(resources.volumes) > 0 {
		args := append([]string{"volume", "rm", "--force"}, resources.volumes...)
		if _, err := dockerOutput(ctx, args...); err != nil {
			errs = append(errs, fmt.Errorf("removing volumes: %w", err))
		}
	}

	return errors.Join(errs...)
}

func dockerOutput(ctx context.Context, args ...string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, "docker", args...)

	out, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf(
			"docker %s: %w\n%s",
			strings.Join(args, " "),
			err,
			redactedTail(out, 20),
		)
	}

	return out, nil
}

const (
	loadEnvFailureChildEnv       = "E2E_LOAD_ENV_FAILURE_TEST_CHILD"
	keepWorkdirChildEnv          = "E2E_KEEP_WORKDIR_TEST_CHILD"
	keepWorkdirResultEnv         = "E2E_KEEP_WORKDIR_TEST_RESULT"
	suiteDeadlineFailureChildEnv = "E2E_SUITE_DEADLINE_FAILURE_TEST_CHILD"
)

func TestSuiteTimeoutBudget(t *testing.T) {
	t.Parallel()

	if suiteTimeoutBudget != 27*time.Minute {
		t.Fatalf("suiteTimeoutBudget = %s, want 27m", suiteTimeoutBudget)
	}

	if got := suiteTestTimeout - suiteTimeoutBudget; got != 3*time.Minute {
		t.Fatalf("suite timeout headroom = %s, want 3m", got)
	}
}

func TestRequireSuiteDeadlineRejectsShortDeadline(t *testing.T) {
	if os.Getenv(suiteDeadlineFailureChildEnv) == "1" {
		requireSuiteDeadline(t)
		t.Fatal("requireSuiteDeadline accepted a deadline below suiteTimeoutBudget")
	}

	t.Parallel()

	shortTimeout := suiteTimeoutBudget - time.Second
	cmd := exec.CommandContext(
		t.Context(),
		os.Args[0],
		"-test.run=^TestRequireSuiteDeadlineRejectsShortDeadline$",
		"-test.timeout="+shortTimeout.String(),
	)
	cmd.Env = environmentWithOverrides(os.Environ(), map[string]string{
		suiteDeadlineFailureChildEnv: "1",
	})

	out, err := cmd.CombinedOutput()
	if err == nil {
		t.Fatalf("requireSuiteDeadline subprocess accepted %s timeout:\n%s", shortTimeout, out)
	}

	for _, want := range []string{
		"need at least 27m0s",
		"use -timeout 30m0s or greater",
	} {
		if !bytes.Contains(out, []byte(want)) {
			t.Fatalf("requireSuiteDeadline failure missing %q:\n%s", want, redactOutput(out))
		}
	}
}

func TestLoadEnvRequiresCLIBinary(t *testing.T) {
	if os.Getenv(loadEnvFailureChildEnv) == "1" {
		loadEnv(t)
		t.Fatal("loadEnv returned without E2E_CLI_BIN")
	}

	t.Parallel()

	cmd := exec.CommandContext(t.Context(), os.Args[0], "-test.run=^TestLoadEnvRequiresCLIBinary$")
	cmd.Env = environmentWithOverrides(os.Environ(), map[string]string{
		"E2E_CLI_BIN":          "",
		loadEnvFailureChildEnv: "1",
	})

	out, err := cmd.CombinedOutput()
	if err == nil {
		t.Fatalf("loadEnv subprocess succeeded without E2E_CLI_BIN:\n%s", redactOutput(out))
	}

	if !bytes.Contains(out, []byte("E2E_CLI_BIN not set")) {
		t.Fatalf(
			"loadEnv failure did not explain missing E2E_CLI_BIN:\n%s",
			redactOutput(out),
		)
	}
}

func TestKeepPreservesDefaultWorkdir(t *testing.T) {
	if os.Getenv(keepWorkdirChildEnv) == "1" {
		env := loadEnv(t)

		workdir := prepareWorkdir(t, env)
		if err := os.WriteFile(
			os.Getenv(keepWorkdirResultEnv),
			[]byte(workdir),
			0o600,
		); err != nil {
			t.Fatalf("record kept workdir: %v", err)
		}

		return
	}

	t.Parallel()

	resultPath := filepath.Join(t.TempDir(), "workdir")
	cmd := exec.CommandContext(
		t.Context(),
		os.Args[0],
		"-test.run=^TestKeepPreservesDefaultWorkdir$",
	)

	cmd.Env = environmentWithOverrides(os.Environ(), map[string]string{
		"E2E_CLI_BIN":        os.Args[0],
		"E2E_KEEP":           "1",
		"E2E_WORKDIR":        "",
		keepWorkdirChildEnv:  "1",
		keepWorkdirResultEnv: resultPath,
	})
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("kept-workdir subprocess failed: %v\n%s", err, redactOutput(out))
	}

	workdirRaw, err := os.ReadFile(resultPath)
	if err != nil {
		t.Fatalf("read kept workdir result: %v", err)
	}

	workdir := string(workdirRaw)
	if _, err := os.Stat(workdir); err != nil {
		t.Fatalf("E2E_KEEP workdir did not survive test cleanup: %v", err)
	}

	if err := os.RemoveAll(workdir); err != nil {
		t.Fatalf("remove kept test workdir: %v", err)
	}
}

func TestComposeProjectName(t *testing.T) {
	t.Parallel()

	got := composeProjectName("18443", "15434")
	if got != "nhost-cli-e2e-18443-15434" {
		t.Fatalf("unexpected Compose project name: %q", got)
	}
}

func TestReserveHostPortsRejectsDuplicate(t *testing.T) {
	t.Parallel()

	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("reserve test port: %v", err)
	}

	tcpAddress, ok := listener.Addr().(*net.TCPAddr)
	if !ok {
		t.Fatalf("unexpected listener address type %T", listener.Addr())
	}

	port := strconv.Itoa(tcpAddress.Port)

	if err := listener.Close(); err != nil {
		t.Fatalf("release test port: %v", err)
	}

	release, err := reserveHostPorts(port, port)
	if err == nil {
		if releaseErr := release(); releaseErr != nil {
			t.Errorf("release unexpectedly acquired duplicate ports: %v", releaseErr)
		}

		t.Fatal("reserveHostPorts accepted the same port twice")
	}
}

func TestHarnessLockExcludesConcurrentRunAndSurvivesStaleFile(t *testing.T) {
	t.Parallel()

	lockPath := filepath.Join(t.TempDir(), "harness.lock")
	if err := os.WriteFile(lockPath, []byte("stale"), 0o600); err != nil {
		t.Fatalf("create stale lock file: %v", err)
	}

	release, err := acquireHarnessLockAt(lockPath)
	if err != nil {
		t.Fatalf("acquire lock backed by stale file: %v", err)
	}

	if _, err := acquireHarnessLockAt(lockPath); !errors.Is(err, errHarnessAlreadyRunning) {
		t.Fatalf("concurrent lock acquisition error = %v, want %v", err, errHarnessAlreadyRunning)
	}

	if err := release(); err != nil {
		t.Fatalf("release harness lock: %v", err)
	}

	releaseAgain, err := acquireHarnessLockAt(lockPath)
	if err != nil {
		t.Fatalf("reacquire released harness lock: %v", err)
	}

	if err := releaseAgain(); err != nil {
		t.Fatalf("release reacquired harness lock: %v", err)
	}
}

func TestHarnessLockAcquisitionIsAtomic(t *testing.T) {
	t.Parallel()

	const contenders = 12

	lockPath := filepath.Join(t.TempDir(), "harness.lock")
	start := make(chan struct{})
	results := make(chan struct {
		release func() error
		err     error
	}, contenders)

	for range contenders {
		go func() {
			<-start

			release, err := acquireHarnessLockAt(lockPath)
			results <- struct {
				release func() error
				err     error
			}{release: release, err: err}
		}()
	}

	close(start)

	var winner func() error
	for range contenders {
		result := <-results
		if result.err == nil {
			if winner != nil {
				t.Fatal("more than one concurrent contender acquired the harness lock")
			}

			winner = result.release

			continue
		}

		if !errors.Is(result.err, errHarnessAlreadyRunning) {
			t.Errorf("lock contender failed with unexpected error: %v", result.err)
		}
	}

	if winner == nil {
		t.Fatal("no concurrent contender acquired the harness lock")
	}

	if err := winner(); err != nil {
		t.Fatalf("release winning harness lock: %v", err)
	}
}

func TestKeepRecoveryCommandUsesStableComposeProject(t *testing.T) {
	t.Parallel()

	env := envConfig{
		cliBin:      "/tmp/bin dir/nhost",
		projectName: "nhost-cli-e2e-18443-15434",
	}
	got := keepRecoveryCommand(env, "/tmp/project dir")

	want := "cd '/tmp/project dir' && " +
		"NHOST_PROJECT_NAME='nhost-cli-e2e-18443-15434' " +
		"'/tmp/bin dir/nhost' --branch e2e down --volumes"
	if got != want {
		t.Fatalf("keepRecoveryCommand() = %q, want %q", got, want)
	}
}

func TestSwallowedFailureMarkersMatchProductionSource(t *testing.T) {
	t.Parallel()

	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("locate lifecycle test source")
	}

	tests := []struct {
		name   string
		path   string
		marker string
	}{
		{
			name:   "up prompt",
			path:   filepath.Join(filepath.Dir(thisFile), "..", "cmd", "dev", "up.go"),
			marker: upFailurePrompt,
		},
		{
			name:   "missing migrations warning",
			path:   filepath.Join(filepath.Dir(thisFile), "..", "cmd", "dev", "up.go"),
			marker: noMigrationsWarning,
		},
		{
			name:   "missing metadata warning",
			path:   filepath.Join(filepath.Dir(thisFile), "..", "cmd", "dev", "up.go"),
			marker: noMetadataWarning,
		},
		{
			name:   "down warning",
			path:   filepath.Join(filepath.Dir(thisFile), "..", "cmd", "dev", "down.go"),
			marker: downFailureText,
		},
		{
			name: "logs error",
			path: filepath.Join(
				filepath.Dir(thisFile),
				"..",
				"dockercompose",
				"dockercompose.go",
			),
			marker: logsFailureText,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			source, err := os.ReadFile(tt.path)
			if err != nil {
				t.Fatalf("read production source %s: %v", tt.path, err)
			}

			if !bytes.Contains(source, []byte(tt.marker)) {
				t.Fatalf(
					"production marker %q is missing from %s; update the e2e swallowed-failure backstop before accepting this reword",
					tt.marker,
					tt.path,
				)
			}
		})
	}
}

const subtestLocationChildEnv = "E2E_SUBTEST_LOCATION_TEST_CHILD"

func TestSubtestFailureReportsAssertionLocation(t *testing.T) {
	if os.Getenv(subtestLocationChildEnv) == "1" {
		c := &client{
			http: &http.Client{
				Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
					return &http.Response{
						StatusCode: http.StatusInternalServerError,
						Header:     http.Header{"Content-Type": []string{"application/json"}},
						Body:       io.NopCloser(strings.NewReader(`{"error":"forced failure"}`)),
					}, nil
				}),
			},
			subdomain: "local",
			port:      "8443",
		}

		runAuthScenario(t, c)
		t.Fatal("runAuthScenario returned after a forced HTTP failure")
	}

	t.Parallel()

	cmd := exec.CommandContext(
		t.Context(),
		os.Args[0],
		"-test.run=^TestSubtestFailureReportsAssertionLocation$",
	)
	cmd.Env = environmentWithOverrides(os.Environ(), map[string]string{
		subtestLocationChildEnv: "1",
	})

	out, err := cmd.CombinedOutput()
	if err == nil {
		t.Fatalf("forced-failure subprocess unexpectedly succeeded:\n%s", redactOutput(out))
	}

	if !bytes.Contains(out, []byte("e2e_test.go:")) {
		t.Fatalf(
			"subtest failure did not report the assertion in e2e_test.go:\n%s",
			redactOutput(out),
		)
	}

	if bytes.Contains(out, []byte("lifecycle_test.go:")) {
		t.Fatalf(
			"subtest failure skipped past its assertion to the caller:\n%s",
			redactOutput(out),
		)
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestLooksLikeJWTAcceptsPadding(t *testing.T) {
	t.Parallel()

	const paddedJWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.SECRETSIG=="
	if !looksLikeJWT(paddedJWT) {
		t.Fatal("looksLikeJWT rejected a padded JWT")
	}
}

func TestByteMismatchSummary(t *testing.T) {
	t.Parallel()

	got := byteMismatchSummary([]byte("abcXef"), []byte("abcYef"))
	for _, want := range []string{
		"got-len=6",
		"want-len=6",
		"first-difference=3",
		"got-hex[0:6]=616263586566",
		"want-hex[0:6]=616263596566",
	} {
		if !strings.Contains(got, want) {
			t.Fatalf("byteMismatchSummary() = %q, missing %q", got, want)
		}
	}
}

// looksLikeJWT and isNotBase64URLCharacter live in this build-tagged file
// because every caller is tagged; defining them in an untagged file makes
// them unused for the default `golangci-lint run ./cli/...` that make check runs.
func looksLikeJWT(s string) bool {
	parts := strings.Split(s, ".")
	if len(parts) != 3 || len(s) <= 20 {
		return false
	}

	for _, part := range parts {
		unpadded := strings.TrimRight(part, "=")

		paddingLength := len(part) - len(unpadded)
		if unpadded == "" || paddingLength > 2 || strings.ContainsRune(unpadded, '=') ||
			strings.IndexFunc(unpadded, isNotBase64URLCharacter) >= 0 {
			return false
		}
	}

	return true
}

func isNotBase64URLCharacter(r rune) bool {
	const base64URLAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"

	return !strings.ContainsRune(base64URLAlphabet, r)
}

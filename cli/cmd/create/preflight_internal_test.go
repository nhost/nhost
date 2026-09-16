package create

import (
	"context"
	"net"
	"strings"
	"testing"
)

// stubDockerProbes restores the docker seams after a test mutates them, and
// puts a context probe in place that finds nothing, so a test that does not
// care about contexts gets the plain dead-daemon blocker.
func stubDockerProbes(t *testing.T) {
	t.Helper()

	origRunning, origImage, origContext := dockerIsRunning, dockerHasImage, dockerLiveContext

	t.Cleanup(func() {
		dockerIsRunning = origRunning
		dockerHasImage = origImage
		dockerLiveContext = origContext
	})

	dockerLiveContext = func(_ context.Context) string {
		return ""
	}
}

func TestEnvPort(t *testing.T) {
	tests := []struct {
		name  string
		value string
		want  uint
	}{
		{name: "unset", value: "", want: 443},
		{name: "override", value: "8443", want: 8443},
		{name: "not a number", value: "https", want: 443},
		{name: "out of range", value: "70000", want: 443},
		{name: "zero is not a port", value: "0", want: 443},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("NHOST_HTTP_PORT", tt.value)

			if got := envPort("NHOST_HTTP_PORT", defaultHTTPSPort); got != tt.want {
				t.Errorf("envPort() = %d, want %d", got, tt.want)
			}
		})
	}
}

// listenOnAFreePort holds a port for the duration of a test and reports which
// one it took.
func listenOnAFreePort(t *testing.T) uint {
	t.Helper()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}

	t.Cleanup(func() { listener.Close() })

	return uint(listener.Addr().(*net.TCPAddr).Port) //nolint:forcetypeassert
}

func TestPortInUse(t *testing.T) {
	t.Parallel()

	taken := listenOnAFreePort(t)

	if !portInUse(context.Background(), taken) {
		t.Errorf("portInUse(%d) = false, want true", taken)
	}
}

func TestPortInUseOnAFreePort(t *testing.T) {
	t.Parallel()

	// Taking a port and giving it straight back is how a port is known to be
	// free without racing another test for a fixed number.
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}

	free := uint(listener.Addr().(*net.TCPAddr).Port) //nolint:forcetypeassert

	listener.Close()

	if portInUse(context.Background(), free) {
		t.Errorf("portInUse(%d) = true, want false", free)
	}
}

func TestPortBlockers(t *testing.T) {
	t.Parallel()

	taken := listenOnAFreePort(t)

	blockers := portBlockers(context.Background(), []requiredPort{{
		port:  taken,
		owner: "the backend's HTTPS gateway",
		fix:   "Stop what is listening on it.",
	}})

	if len(blockers) != 1 {
		t.Fatalf("blockers = %#v, want one", blockers)
	}

	if !strings.Contains(blockers[0].problem, "the backend's HTTPS gateway") {
		t.Errorf("blocker does not name the owner: %q", blockers[0].problem)
	}
}

// A development build runs its config server from an image that was never
// published, which is the "manifest unknown" failure docker compose reports.
func TestConfigserverImageBlockers(t *testing.T) {
	tests := []struct {
		name        string
		version     string
		imageEnv    string
		imageExists bool
		wantBlocked bool
	}{
		{
			name:        "dev build without the image",
			version:     devVersion,
			imageEnv:    "",
			imageExists: false,
			wantBlocked: true,
		},
		{
			name:        "dev build that built the image",
			version:     devVersion,
			imageEnv:    "",
			imageExists: true,
			wantBlocked: false,
		},
		{
			name:        "dev build pointed at another image",
			version:     devVersion,
			imageEnv:    "nhost/cli:1.2.3",
			imageExists: false,
			wantBlocked: false,
		},
		// A released version is published, so docker pulls it.
		{
			name:        "released build",
			version:     "1.2.3",
			imageEnv:    "",
			imageExists: false,
			wantBlocked: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			stubDockerProbes(t)
			t.Setenv(configserverImageEnv, tt.imageEnv)

			dockerHasImage = func(_ context.Context, _ string) bool {
				return tt.imageExists
			}

			blockers := configserverImageBlockers(context.Background(), tt.version)

			if (len(blockers) > 0) != tt.wantBlocked {
				t.Fatalf("blockers = %#v, want blocked %v", blockers, tt.wantBlocked)
			}

			if tt.wantBlocked && !strings.Contains(blockers[0].fix, configserverImageEnv) {
				t.Errorf("blocker does not say how to fix it: %q", blockers[0].fix)
			}
		})
	}
}

// A daemon that is not answering is the whole story: the ports it would have
// bound say nothing useful until it is up.
//
//nolint:paralleltest // mutates package-level docker seams
func TestStartBlockersStopsAtDocker(t *testing.T) {
	stubDockerProbes(t)

	dockerIsRunning = func(_ context.Context) bool {
		return false
	}

	dockerHasImage = func(_ context.Context, _ string) bool {
		t.Error("the image was probed without a running daemon")

		return false
	}

	blockers := startBlockers(context.Background(), devVersion)

	if len(blockers) != 1 {
		t.Fatalf("blockers = %#v, want one", blockers)
	}

	if !strings.Contains(blockers[0].problem, "not answering") {
		t.Errorf("blocker = %q, want the daemon", blockers[0].problem)
	}
}

// OrbStack symlinks /var/run/docker.sock to its own socket, so "default"
// answers alongside "orbstack" and listing order alone would name the one that
// says nothing about which runtime is up.
func TestPickLiveContext(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		live []string
		want string
	}{
		{name: "nothing answered", live: nil, want: ""},
		{name: "only default", live: []string{"default"}, want: "default"},
		{
			name: "default first, named second",
			live: []string{"default", "orbstack"},
			want: "orbstack",
		},
		{name: "named only", live: []string{"colima"}, want: "colima"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := pickLiveContext(tt.live); got != tt.want {
				t.Errorf("pickLiveContext(%v) = %q, want %q", tt.live, got, tt.want)
			}
		})
	}
}

// Moving from Docker Desktop to OrbStack leaves the old context selected, so
// the daemon looks dead while a perfectly good one answers next door. Saying
// "start Docker" there sends you after the wrong thing.
//
//nolint:paralleltest // mutates package-level docker seams
func TestDockerBlockersNamesALiveContext(t *testing.T) {
	stubDockerProbes(t)

	dockerIsRunning = func(_ context.Context) bool {
		return false
	}

	dockerLiveContext = func(_ context.Context) string {
		return "orbstack"
	}

	blockers := dockerBlockers(context.Background())

	if len(blockers) != 1 {
		t.Fatalf("blockers = %#v, want one", blockers)
	}

	if !strings.Contains(blockers[0].problem, "orbstack") {
		t.Errorf("blocker does not name the live context: %q", blockers[0].problem)
	}

	if !strings.Contains(blockers[0].fix, "docker context use orbstack") {
		t.Errorf("blocker does not say how to switch: %q", blockers[0].fix)
	}
}

// With nothing answering anywhere, the fix has to cover the runtimes someone
// might actually have rather than naming only Docker Desktop.
//
//nolint:paralleltest // mutates package-level docker seams
func TestDockerBlockersWithNoLiveContext(t *testing.T) {
	stubDockerProbes(t)

	dockerIsRunning = func(_ context.Context) bool {
		return false
	}

	blockers := dockerBlockers(context.Background())

	if len(blockers) != 1 {
		t.Fatalf("blockers = %#v, want one", blockers)
	}

	for _, want := range []string{"Docker Desktop", "OrbStack"} {
		if !strings.Contains(blockers[0].fix, want) {
			t.Errorf("fix does not mention %s: %q", want, blockers[0].fix)
		}
	}
}

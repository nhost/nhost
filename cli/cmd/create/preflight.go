package create

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

const (
	// dockerProbeTimeout bounds each `docker` call the preflight makes, and
	// the context sweep as a whole. A daemon that is starting up can take a
	// few seconds to answer.
	dockerProbeTimeout = 10 * time.Second
	// portProbeTimeout is how long a connection to a local port is given
	// before it counts as nothing listening.
	portProbeTimeout = 300 * time.Millisecond

	defaultHTTPSPort    = 443
	defaultPostgresPort = 5432
	// frontendDevPort is where `next dev` serves the template, and the port
	// the scaffolded backend allows as its auth redirect target.
	frontendDevPort = 3000

	configserverImageEnv = "NHOST_CONFIGSERVER_IMAGE"

	// dockerDefaultContext is docker's built-in context, which points at
	// whoever holds /var/run/docker.sock rather than at a named runtime.
	dockerDefaultContext = "default"
)

//nolint:gochecknoglobals // Test seams for the docker probes.
var (
	dockerIsRunning   = probeDocker
	dockerHasImage    = probeImage
	dockerLiveContext = probeLiveContext
)

// blocker is one reason `nhost create` will not start the servers, paired with
// what to do about it.
type blocker struct {
	problem string
	fix     string
}

// requiredPort is a host port the project binds when it starts.
type requiredPort struct {
	port  uint
	owner string
	fix   string
}

// startBlockers reports everything on this machine that would make `nhost up`
// or the frontend dev server fail. Starting the servers is a convenience on
// top of a project that already exists on disk, so the failures worth catching
// are the ones that end in an opaque docker compose error: no daemon, a
// missing image, a port someone else already holds.
func startBlockers(ctx context.Context, version string) []blocker {
	if docker := dockerBlockers(ctx); len(docker) > 0 {
		return docker
	}

	blockers := configserverImageBlockers(ctx, version)

	return append(blockers, portBlockers(ctx, requiredPorts())...)
}

func dockerBlockers(ctx context.Context) []blocker {
	if _, err := exec.LookPath("docker"); err != nil {
		return []blocker{{
			problem: "Docker is not installed, and the backend runs in containers.",
			fix: "Install Docker Desktop from https://docs.docker.com/get-docker/, " +
				"or another runtime such as OrbStack, and try again.",
		}}
	}

	if dockerIsRunning(ctx) {
		return nil
	}

	// A machine with two runtimes installed looks exactly like a dead daemon
	// when the selected context points at the one that is off, which is what
	// happens after moving from Docker Desktop to OrbStack.
	if live := dockerLiveContext(ctx); live != "" {
		return []blocker{{
			problem: fmt.Sprintf(
				"Docker's selected context is not answering, but its %q context is.",
				live,
			),
			fix: fmt.Sprintf("Switch to it with `docker context use %s` and try again.", live),
		}}
	}

	return []blocker{{
		problem: "Docker is installed but its daemon is not answering.",
		fix:     "Start Docker Desktop, OrbStack, or your docker daemon and try again.",
	}}
}

// configserverImageBlockers catches the failure a development build of the CLI
// hits before anything else: `nhost up` runs its config server from
// nhost/cli:<version>, and a dev version was never published, so docker
// compose stops at "manifest unknown" unless that image was built locally.
func configserverImageBlockers(ctx context.Context, version string) []blocker {
	if version != devVersion || os.Getenv(configserverImageEnv) != "" {
		return nil
	}

	image := "nhost/cli:" + version
	if dockerHasImage(ctx, image) {
		return nil
	}

	return []blocker{{
		problem: fmt.Sprintf(
			"This CLI is a development build and its backend image %s is not on this machine.",
			image,
		),
		fix: fmt.Sprintf(
			"Run `make build-docker-image` in cli/ and `docker tag cli:%s %s`, "+
				"or set %s to a published nhost/cli image.",
			version, image, configserverImageEnv,
		),
	}}
}

// requiredPorts lists the host ports the project publishes, honouring the
// environment variables `nhost up` reads so that a machine configured off the
// defaults is not reported as blocked.
func requiredPorts() []requiredPort {
	return []requiredPort{
		{
			port:  envPort("NHOST_HTTP_PORT", defaultHTTPSPort),
			owner: "the backend's HTTPS gateway",
			fix:   "Stop what is listening on it; another Nhost project releases it with `nhost down`.",
		},
		{
			port:  envPort("NHOST_POSTGRES_PORT", defaultPostgresPort),
			owner: "the backend's Postgres",
			fix:   "Stop your local Postgres, or set NHOST_POSTGRES_PORT to a free port.",
		},
		{
			port:  frontendDevPort,
			owner: "the frontend dev server",
			fix:   "Stop what is listening on it; the backend expects the app on this port.",
		},
	}
}

func portBlockers(ctx context.Context, ports []requiredPort) []blocker {
	blockers := make([]blocker, 0, len(ports))

	for _, p := range ports {
		if !portInUse(ctx, p.port) {
			continue
		}

		blockers = append(blockers, blocker{
			problem: fmt.Sprintf("Port %d is in use, and %s needs it.", p.port, p.owner),
			fix:     p.fix,
		})
	}

	return blockers
}

// portInUse reports whether something already answers on a local port. It
// dials rather than listens because the ports that matter here include 443,
// which an unprivileged process cannot bind even when it is free.
func portInUse(ctx context.Context, port uint) bool {
	ctx, cancel := context.WithTimeout(ctx, portProbeTimeout)
	defer cancel()

	var dialer net.Dialer

	conn, err := dialer.DialContext(
		ctx, "tcp", net.JoinHostPort("127.0.0.1", strconv.FormatUint(uint64(port), 10)),
	)
	if err != nil {
		return false
	}

	_ = conn.Close()

	return true
}

// envPort reads a port `nhost up` would take from the environment, falling
// back to the default when it is unset or not a port.
func envPort(name string, fallback uint) uint {
	port, err := strconv.ParseUint(os.Getenv(name), 10, 16)
	if err != nil || port == 0 {
		return fallback
	}

	return uint(port)
}

func probeDocker(ctx context.Context) bool {
	ctx, cancel := context.WithTimeout(ctx, dockerProbeTimeout)
	defer cancel()

	return exec.CommandContext(
		ctx, "docker", "info", "--format", "{{.ServerVersion}}",
	).Run() == nil
}

func probeImage(ctx context.Context, image string) bool {
	ctx, cancel := context.WithTimeout(ctx, dockerProbeTimeout)
	defer cancel()

	return exec.CommandContext(ctx, "docker", "image", "inspect", image).Run() == nil
}

// probeLiveContext names a configured docker context whose daemon answers.
// Only reached once the selected one did not, so whatever it finds is a
// runtime that is running and simply not the one docker is pointed at.
func probeLiveContext(ctx context.Context) string {
	ctx, cancel := context.WithTimeout(ctx, dockerProbeTimeout)
	defer cancel()

	out, err := exec.CommandContext(
		ctx, "docker", "context", "ls", "--format", "{{.Name}}",
	).Output()
	if err != nil {
		return ""
	}

	names := strings.Fields(string(out))
	live := make([]string, 0, len(names))

	for _, name := range names {
		if exec.CommandContext(ctx, "docker", "--context", name, "info").Run() == nil {
			live = append(live, name)
		}
	}

	return pickLiveContext(live)
}

// pickLiveContext prefers a named context over "default", which is only ever
// whoever owns /var/run/docker.sock. OrbStack symlinks that to its own socket,
// so both answer and only the name tells you which runtime is running.
func pickLiveContext(live []string) string {
	for _, name := range live {
		if name != dockerDefaultContext {
			return name
		}
	}

	if len(live) > 0 {
		return live[0]
	}

	return ""
}

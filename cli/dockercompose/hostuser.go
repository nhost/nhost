package dockercompose

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"regexp"
	"runtime"
	"strings"
)

// Values accepted by the --user flag besides an explicit "<uid>:<gid>".
const (
	HostUserAuto = "auto"
	HostUserNone = "none"
)

// For rootful docker daemon.
const defaultDockerEndpoint = "unix:///var/run/docker.sock"

type dockerHostResolution struct {
	dockerURL *url.URL
	known     bool
}

func detectDockerHost(ctx context.Context) (dockerHostResolution, error) {
	endpoint := os.Getenv("DOCKER_HOST")
	known := endpoint != ""

	if !known {
		out, err := exec.CommandContext(ctx, "docker", "context", "inspect",
			"--format", "{{.Endpoints.docker.Host}}").Output()
		if err != nil {
			if ctxErr := ctx.Err(); ctxErr != nil {
				return dockerHostResolution{}, fmt.Errorf(
					"inspecting current Docker context: %w",
					ctxErr,
				)
			}

			endpoint = defaultDockerEndpoint
		} else {
			endpoint = strings.TrimSpace(string(out))
			known = endpoint != ""
		}
	}

	if endpoint == "" {
		endpoint = defaultDockerEndpoint
	}

	dockerURL, err := url.Parse(endpoint)
	if err != nil {
		return dockerHostResolution{}, fmt.Errorf("parsing Docker endpoint %q: %w", endpoint, err)
	}

	return dockerHostResolution{
		dockerURL: dockerURL,
		known:     known,
	}, nil
}

func resolveDockerHost(ctx context.Context) (*url.URL, error) {
	resolution, err := detectDockerHost(ctx)
	if err != nil {
		return nil, err
	}

	return resolution.dockerURL, nil
}

// The `auto` heuristic: map containers to the
// caller's uid:gid only on Linux hosts talking to the default rootful
// daemon socket, where container root would otherwise write root-owned
// files into bind mounts. Any other endpoint (rootless daemons, ssh://, tcp://, ...)
// already remaps or isolates ownership, so no user is forced.
func autoUser(hostOS, endpoint string, uid, gid int) string {
	if hostOS != osLinux {
		return ""
	}

	path, ok := strings.CutPrefix(endpoint, "unix://")
	if !ok {
		return "" // ssh://, tcp://, npipe://
	}

	if path != "/var/run/docker.sock" &&
		path != "/run/docker.sock" &&
		path != "/var/run/podman/podman.sock" &&
		path != "/run/podman/podman.sock" {
		return "" // $XDG_RUNTIME_DIR, ~/.docker/desktop, ~/.colima, ...
	}

	return fmt.Sprintf("%d:%d", uid, gid)
}

var (
	uidGidRegex = regexp.MustCompile(`^[0-9]+:[0-9]+$`)

	errInvalidHostUser = errors.New(
		`must be "` + HostUserAuto + `", "` + HostUserNone + `" or "<uid>:<gid>"`,
	)
)

type hostUserEnvironment struct {
	hostOS           string
	uid              int
	gid              int
	detectDockerHost func(context.Context) (dockerHostResolution, error)
}

func resolveHostUser(
	ctx context.Context,
	value string,
	environment hostUserEnvironment,
) (string, error) {
	switch value {
	case HostUserAuto, "":
		resolution, err := environment.detectDockerHost(ctx)
		if err != nil {
			return "", fmt.Errorf("resolving Docker endpoint: %w", err)
		}

		if !resolution.known {
			// The fallback socket does not prove that the daemon is rootful.
			return "", nil
		}

		return autoUser(
			environment.hostOS,
			resolution.dockerURL.String(),
			environment.uid,
			environment.gid,
		), nil
	case HostUserNone:
		return "", nil
	default:
		if !uidGidRegex.MatchString(value) {
			return "", fmt.Errorf("invalid user %q: %w", value, errInvalidHostUser)
		}

		return value, nil
	}
}

func ResolveHostUser(ctx context.Context, value string) (string, error) {
	return resolveHostUser(ctx, value, hostUserEnvironment{
		hostOS:           runtime.GOOS,
		uid:              os.Getuid(),
		gid:              os.Getgid(),
		detectDockerHost: detectDockerHost,
	})
}

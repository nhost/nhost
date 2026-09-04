package dockercompose

import (
	"context"
	"errors"
	"fmt"
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

// For rootful docker daemon
const defaultDockerEndpoint = "unix:///var/run/docker.sock"

func dockerEndpoint(ctx context.Context) string {
	if h := os.Getenv("DOCKER_HOST"); h != "" {
		return h
	}

	out, err := exec.CommandContext(ctx, "docker", "context", "inspect",
		"--format", "{{.Endpoints.docker.Host}}").Output()
	if err != nil {
	    // fallback
		return defaultDockerEndpoint
	}

	return strings.TrimSpace(string(out))
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

	if path != "/var/run/docker.sock" && path != "/run/docker.sock" {
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

func ResolveHostUser(ctx context.Context, value string) (string, error) {
	switch value {
	case HostUserAuto, "":
		return autoUser(runtime.GOOS, dockerEndpoint(ctx), os.Getuid(), os.Getgid()), nil
	case HostUserNone:
		return "", nil
	default:
		if !uidGidRegex.MatchString(value) {
			return "", fmt.Errorf("invalid user %q: %w", value, errInvalidHostUser)
		}

		return value, nil
	}
}

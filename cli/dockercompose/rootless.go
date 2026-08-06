package dockercompose

import (
	"context"
	"encoding/json"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

// Timeout for `docker info` probe so a hung daemon doesn't stall docker-compose file generation.
const daemonInfoTimeout = 10 * time.Second

// daemonInfo is the subset of `docker info --format '{{json .}}'` output
// used to detect rootless daemons
// - Docker (and Podman's compat API) reports "name=rootless" in SecurityOptions
// - The podman CLI reports host.security.rootless
// - Docker Desktop identifies itself through OperatingSystem.
type daemonInfo struct {
	OperatingSystem string   `json:"OperatingSystem"`
	SecurityOptions []string `json:"SecurityOptions"`
	Host            struct {
		Security struct {
			Rootless bool `json:"rootless"`
		} `json:"security"`
	} `json:"host"`
}

// Determine whether the given `docker info` JSON
// describes a daemon that already maps container-root writes to the
// host user (rootless Docker/Podman or Docker Desktop)
func parseDaemonMapsHostUser(out []byte) bool {
	var info daemonInfo
	if err := json.Unmarshal(out, &info); err != nil {
		return false
	}

	if info.OperatingSystem == "Docker Desktop" {
		return true
	}

	for _, opt := range info.SecurityOptions {
		if strings.Contains(opt, "rootless") {
			return true
		}
	}

	return info.Host.Security.Rootless
}

func daemonMapsHostUser(ctx context.Context) bool {
	ctx, cancel := context.WithTimeout(ctx, daemonInfoTimeout)
	defer cancel()

	out, err := exec.CommandContext(ctx, "docker", "info", "--format", "{{json .}}").Output()
	if err != nil {
		// No reachable daemon: assume rootful, the common native setup.
		return false
	}

	return parseDaemonMapsHostUser(out)
}

func hostOSForUserMapping(ctx context.Context) string {
	if runtime.GOOS == osLinux && daemonMapsHostUser(ctx) {
		return ""
	}

	return runtime.GOOS
}

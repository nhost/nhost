package dockercompose //nolint:testpackage

import (
	"fmt"
	"os"
	"runtime"
	"testing"
)

func TestApplyHostUserID(t *testing.T) {
	t.Parallel()

	if runtime.GOOS != "linux" {
		t.Skip("applyHostUserID is a no-op on non-linux hosts")
	}

	services := map[string]*Service{
		"functions":     {},
		"console":       {},
		"configserver":  {},
		"constellation": {},
		"postgres":      {},
		"traefik":       {},
	}
	unstamped := []string{"postgres", "traefik", "functions"}

	applyHostUserID(services)

	want := fmt.Sprintf("%d:%d", os.Getuid(), os.Getgid())
	for _, name := range servicesRunAsHostUser {
		got := services[name].User
		if got == nil || *got != want {
			t.Errorf("%s: User = %v, want %q", name, got, want)
		}
	}

	for _, name := range unstamped {
		if services[name].User != nil {
			t.Errorf("%s: User = %q, want nil", name, *services[name].User)
		}
	}
}

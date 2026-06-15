package dockercompose //nolint:testpackage

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestApplyHostUserID(t *testing.T) {
	t.Parallel()

	if runtime.GOOS != osLinux {
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

func assertIsDir(t *testing.T, path string) {
	t.Helper()

	info, err := os.Stat(path)
	if err != nil {
		t.Errorf("stat %s: %v", path, err)
		return
	}

	if !info.IsDir() {
		t.Errorf("%s: not a directory", path)
	}
}

func TestPrepareFunctionsHostFiles(t *testing.T) {
	t.Parallel()

	t.Run("creates dirs and default tsconfig", func(t *testing.T) {
		t.Parallel()

		root := t.TempDir()

		if err := prepareFunctionsHostFiles(root); err != nil {
			t.Fatalf("got error: %v", err)
		}

		assertIsDir(t, filepath.Join(root, "node_modules"))
		assertIsDir(t, filepath.Join(root, "functions"))
		assertIsDir(t, filepath.Join(root, "functions", "node_modules"))

		got, err := os.ReadFile(filepath.Join(root, "functions", "tsconfig.json"))
		if err != nil {
			t.Fatalf("read tsconfig: %v", err)
		}

		if string(got) != defaultFunctionsTSConfig {
			t.Errorf("tsconfig content = %q, want %q", string(got), defaultFunctionsTSConfig)
		}
	})

	t.Run("does not clobber existing tsconfig", func(t *testing.T) {
		t.Parallel()

		const existing = `{"compilerOptions":{"custom":true}}`

		root := t.TempDir()
		if err := os.MkdirAll(filepath.Join(root, "functions"), 0o755); err != nil {
			t.Fatalf("setup: %v", err)
		}

		tsconfig := filepath.Join(root, "functions", "tsconfig.json")
		if err := os.WriteFile(tsconfig, []byte(existing), 0o600); err != nil {
			t.Fatalf("setup: %v", err)
		}

		if err := prepareFunctionsHostFiles(root); err != nil {
			t.Fatalf("got error: %v", err)
		}

		got, err := os.ReadFile(tsconfig)
		if err != nil {
			t.Fatalf("read tsconfig: %v", err)
		}

		if string(got) != existing {
			t.Errorf("tsconfig was clobbered: got %q, want %q", string(got), existing)
		}
	})

	t.Run("idempotent", func(t *testing.T) {
		t.Parallel()

		root := t.TempDir()
		if err := prepareFunctionsHostFiles(root); err != nil {
			t.Fatalf("first call: %v", err)
		}

		if err := prepareFunctionsHostFiles(root); err != nil {
			t.Fatalf("second call: %v", err)
		}
	})
}

func TestPrepareNhostFolderSubdirs(t *testing.T) {
	t.Parallel()

	nhostFolder := t.TempDir()

	if err := prepareNhostFolderSubdirs(nhostFolder); err != nil {
		t.Fatalf("got error: %v", err)
	}

	for _, name := range []string{"metadata", "migrations", "seeds", "emails"} {
		assertIsDir(t, filepath.Join(nhostFolder, name))
	}

	// idempotent: a second call over the now-existing dirs must not error.
	if err := prepareNhostFolderSubdirs(nhostFolder); err != nil {
		t.Fatalf("second call: %v", err)
	}
}

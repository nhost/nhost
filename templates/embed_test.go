package templates_test

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/nhost/nhost/templates"
)

// ignored reports whether a path, relative to this package directory, is one
// a template's frontend/.gitignore keeps out of git: the output of an install,
// a build, a test run or the editor, or a local env or key file. It is
// expected on disk but must never be shipped, and embedding an env or key file
// would bake a secret into every scaffolded project.
func ignored(path string) bool {
	parts := strings.Split(path, "/")

	// the patterns anchored to the frontend root. `dist` is where a Vite
	// template's `pnpm build` lands and `build` is where SvelteKit's
	// adapter-static does, so they are here for the same reason as the rest:
	// running the build before `go test ./templates/...` must not turn the
	// output into "on disk but not embedded". `android` and `ios` are where
	// Expo's prebuild writes the native projects.
	if len(parts) > 2 && parts[1] == "frontend" &&
		slices.Contains(
			[]string{"coverage", "out", "build", "dist", "android", "ios"},
			parts[2],
		) {
		return true
	}

	// The yarn Plug'n'Play and .yarn entries are left out: the template
	// installs with pnpm, and a yarn install also writes a yarn.lock, which
	// git keeps and this test reports either way.
	for _, name := range parts {
		switch {
		case name == "node_modules", name == ".next", name == ".vercel",
			name == ".svelte-kit", name == ".expo",
			name == ".DS_Store", name == "next-env.d.ts",
			name == "expo-env.d.ts",
			strings.HasSuffix(name, ".tsbuildinfo"),
			strings.Contains(name, ".orig."),
			strings.HasSuffix(name, ".pem"),
			strings.HasPrefix(name, "npm-debug.log"),
			strings.HasPrefix(name, "yarn-debug.log"),
			strings.HasPrefix(name, "yarn-error.log"),
			strings.HasPrefix(name, ".pnpm-debug.log"),
			strings.HasPrefix(name, ".env") && name != ".env.example":
			return true
		}
	}

	return false
}

// discovered lists the templates on disk: every directory here that holds a
// frontend/package.json.
func discovered(t *testing.T) []string {
	t.Helper()

	entries, err := os.ReadDir(".")
	if err != nil {
		t.Fatalf("listing the templates directory: %v", err)
	}

	var names []string

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		_, err := os.Stat(
			filepath.Join(entry.Name(), "frontend", "package.json"),
		)

		switch {
		case err == nil:
			names = append(names, entry.Name())
		case !errors.Is(err, fs.ErrNotExist):
			t.Fatalf("checking whether %s is a template: %v", entry.Name(), err)
		}
	}

	return names
}

// onDisk lists the files under a template directory as `go test` sees them,
// which is relative to this package directory - the same paths the embedded
// filesystem uses.
func onDisk(t *testing.T, template string) []string {
	t.Helper()

	var paths []string

	err := filepath.WalkDir(
		template,
		func(path string, entry fs.DirEntry, err error) error {
			if err != nil {
				return err
			}

			if ignored(filepath.ToSlash(path)) {
				if entry.IsDir() {
					return filepath.SkipDir
				}

				return nil
			}

			if !entry.IsDir() {
				paths = append(paths, filepath.ToSlash(path))
			}

			return nil
		},
	)
	if err != nil {
		t.Fatalf("walking %s on disk: %v", template, err)
	}

	slices.Sort(paths)

	return paths
}

// embedded lists the files the binary carries for one template, none when no
// directive names it yet.
func embedded(t *testing.T, template string) []string {
	t.Helper()

	var paths []string

	err := fs.WalkDir(
		templates.FS,
		template,
		func(path string, entry fs.DirEntry, err error) error {
			if path == template && errors.Is(err, fs.ErrNotExist) {
				return fs.SkipAll
			}

			if err != nil {
				return err
			}

			if !entry.IsDir() {
				paths = append(paths, path)
			}

			return nil
		},
	)
	if err != nil {
		t.Fatalf("walking %s in the embedded FS: %v", template, err)
	}

	slices.Sort(paths)

	return paths
}

// TestFSMatchesDisk is the guard for the explicit embed directives: every file
// a template has on disk is in the binary, and nothing ignored came along.
// A new top-level entry in a template shows up here as "on disk but not
// embedded", which is the reminder to add it to embed.go.
func TestFSMatchesDisk(t *testing.T) {
	t.Parallel()

	names := discovered(t)
	if len(names) == 0 {
		t.Fatal(
			"no templates on disk; is the test running from the " +
				"templates directory?",
		)
	}

	roots, err := fs.ReadDir(templates.FS, ".")
	if err != nil {
		t.Fatalf("listing the embedded FS: %v", err)
	}

	for _, root := range roots {
		if !slices.Contains(names, root.Name()) {
			t.Errorf("embedded but not a template on disk: %s", root.Name())
		}
	}

	for _, template := range names {
		t.Run(template, func(t *testing.T) {
			t.Parallel()

			disk := onDisk(t, template)
			shipped := embedded(t, template)

			for _, path := range disk {
				if !slices.Contains(shipped, path) {
					t.Errorf(
						"on disk but not embedded: %s (add it to embed.go)",
						path,
					)
				}
			}

			for _, path := range shipped {
				switch {
				case ignored(path):
					t.Errorf(
						"ignored by git but embedded: %s (delete it, "+
							"an all: directive picked it up)",
						path,
					)
				case !slices.Contains(disk, path):
					t.Errorf("embedded but not on disk: %s", path)
				}
			}
		})
	}
}

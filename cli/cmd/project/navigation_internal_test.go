package project

import (
	"io/fs"
	"path"
	"slices"
	"testing"

	"github.com/nhost/nhost/templates"
)

// A template that offers a choice has to offer the default, since that is what
// `--navigation` is given when nobody passes it.
func TestNavigationDefaultIsOffered(t *testing.T) {
	t.Parallel()

	for _, tmpl := range catalogue() {
		if len(tmpl.navSystems) == 0 {
			continue
		}

		t.Run(tmpl.name, func(t *testing.T) {
			t.Parallel()

			if _, ok := lookupNav(tmpl.navSystems, defaultNavigation); !ok {
				t.Errorf(
					"%s offers %v but not %q, which is what --navigation defaults to",
					tmpl.name, navNames(tmpl.navSystems), defaultNavigation,
				)
			}
		})
	}
}

// The overlay a navigation system names has to be there, or choosing it writes
// nothing and the project is left with the default's files under a package.json
// that no longer matches.
func TestNavigationOverlaysAreEmbedded(t *testing.T) {
	t.Parallel()

	for _, tmpl := range catalogue() {
		for _, nav := range tmpl.navSystems {
			if nav.overlay == "" {
				continue
			}

			t.Run(tmpl.name+"/"+nav.name, func(t *testing.T) {
				t.Parallel()

				dir := path.Join(tmpl.name, navDirPath, nav.overlay)

				entries, err := fs.ReadDir(templates.FS, dir)
				if err != nil {
					t.Fatalf("navigation system %q has no %s: %v", nav.name, dir, err)
				}

				if len(entries) == 0 {
					t.Errorf("%s is empty", dir)
				}
			})
		}
	}
}

// A system that brings its own package.json names different packages, so the
// lockfile describing the shipped one is wrong for it. Shipping it anyway
// passes `pnpm install` and fails `pnpm install --frozen-lockfile`, which is
// what CI runs.
func TestNavigationOverlayWithAPackageJSONDropsTheLockfile(t *testing.T) {
	t.Parallel()

	for _, tmpl := range catalogue() {
		for _, nav := range tmpl.navSystems {
			if nav.overlay == "" {
				continue
			}

			t.Run(tmpl.name+"/"+nav.name, func(t *testing.T) {
				t.Parallel()

				pkg := path.Join(tmpl.name, navDirPath, nav.overlay, "package.json")
				if _, err := fs.Stat(templates.FS, pkg); err != nil {
					return
				}

				lock := path.Join(navRootPath, "pnpm-lock.yaml")
				if !slices.Contains(nav.dropFiles, lock) {
					t.Errorf(
						"%s ships its own package.json, so %q must be in its dropFiles",
						nav.name, lock,
					)
				}
			})
		}
	}
}

// Every file a navigation system drops has to be one the template ships, or
// the entry is a typo that silently drops nothing.
func TestNavigationDropFilesExist(t *testing.T) {
	t.Parallel()

	for _, tmpl := range catalogue() {
		for _, nav := range tmpl.navSystems {
			for _, f := range nav.dropFiles {
				t.Run(tmpl.name+"/"+nav.name+"/"+f, func(t *testing.T) {
					t.Parallel()

					if _, err := fs.Stat(templates.FS, path.Join(tmpl.name, f)); err != nil {
						t.Errorf(
							"%s drops %s, which the template does not ship: %v",
							nav.name,
							f,
							err,
						)
					}
				})
			}
		}
	}
}

// The seam is the whole of what makes the systems interchangeable: the screens
// import `lib/navigation`, and only that module imports a navigation library.
// An overlay that does not replace it would leave the app calling the library
// it no longer depends on.
func TestNavigationOverlayReplacesTheSeam(t *testing.T) {
	t.Parallel()

	const seam = "src/lib/navigation.tsx"

	for _, tmpl := range catalogue() {
		for _, nav := range tmpl.navSystems {
			if nav.overlay == "" {
				continue
			}

			t.Run(tmpl.name+"/"+nav.name, func(t *testing.T) {
				t.Parallel()

				shipped := path.Join(tmpl.name, navRootPath, seam)
				if _, err := fs.Stat(templates.FS, shipped); err != nil {
					t.Fatalf("%s does not ship %s: %v", tmpl.name, seam, err)
				}

				overlaid := path.Join(tmpl.name, navDirPath, nav.overlay, seam)
				if _, err := fs.Stat(templates.FS, overlaid); err != nil {
					t.Errorf(
						"%s does not replace %s, so the scaffold would keep the default's: %v",
						nav.name, seam, err,
					)
				}
			})
		}
	}
}

package project

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/templates"
	"github.com/urfave/cli/v3"
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

// The overlay is written after methods.ts and after the unselected method
// directories were skipped, so a file of its own at either place would put back
// what the selection took out.
func TestNavigationOverlayLeavesTheSignInMethodsAlone(t *testing.T) {
	t.Parallel()

	for _, tmpl := range catalogue() {
		for _, nav := range tmpl.navSystems {
			if nav.overlay == "" {
				continue
			}

			t.Run(tmpl.name+"/"+nav.name, func(t *testing.T) {
				t.Parallel()

				dir := path.Join(tmpl.name, navDirPath, nav.overlay)
				methods := strings.TrimPrefix(tmpl.methodsFile, navRootPath+"/")
				auth := strings.TrimPrefix(tmpl.authDir, navRootPath+"/")

				err := fs.WalkDir(
					templates.FS, dir,
					func(p string, _ fs.DirEntry, err error) error {
						if err != nil {
							return err
						}

						rel := strings.TrimPrefix(p, dir+"/")
						if rel == methods || rel == auth || strings.HasPrefix(rel, auth+"/") {
							t.Errorf(
								"%s ships %s, which init writes from the selection",
								nav.name,
								rel,
							)
						}

						return nil
					},
				)
				if err != nil {
					t.Fatalf("walking %s: %v", dir, err)
				}
			})
		}
	}
}

// The overlay is also written after the UI system, so a package.json of its own
// replaces the one the UI system just took its drops out of, and the project
// would declare packages nothing imports. A template cannot offer both until
// the overlay is laid first.
func TestNavigationOverlayKeepsTheUIDrops(t *testing.T) {
	t.Parallel()

	for _, tmpl := range catalogue() {
		var dropping []string

		for _, ui := range tmpl.uiSystems {
			if len(ui.drops) > 0 {
				dropping = append(dropping, ui.name)
			}
		}

		for _, nav := range tmpl.navSystems {
			if nav.overlay == "" || len(dropping) == 0 {
				continue
			}

			t.Run(tmpl.name+"/"+nav.name, func(t *testing.T) {
				t.Parallel()

				pkg := path.Join(tmpl.name, navDirPath, nav.overlay, "package.json")
				if _, err := fs.Stat(templates.FS, pkg); err != nil {
					return
				}

				t.Errorf(
					"%s ships its own package.json, which is written after the UI system "+
						"and would put back the dependencies %s drop",
					nav.name, strings.Join(dropping, ", "),
				)
			})
		}
	}
}

func resolveNavWith(
	t *testing.T,
	template string,
	args ...string,
) (navigationSystem, error) {
	t.Helper()

	var (
		got    navigationSystem
		gotErr error
		output bytes.Buffer
	)

	cmd := &cli.Command{
		Name: "init",
		Flags: []cli.Flag{
			&cli.StringFlag{Name: flagNavigation, Value: defaultNavigation},
		},
		Action: func(_ context.Context, c *cli.Command) error {
			got, gotErr = resolveNavigationSystem(newTestEnv(&output), c, template, false)

			return nil
		},
	}

	if err := cmd.Run(t.Context(), append([]string{"init"}, args...)); err != nil {
		t.Fatalf("parsing %q: %v", args, err)
	}

	return got, gotErr
}

func TestResolveNavigationSystem(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		template  string
		args      []string
		want      string
		wantErr   error
		wantInErr string
	}{
		{name: "default", template: "react-native", want: defaultNavigation},
		{
			name:     "named",
			template: "react-native",
			args:     []string{"--navigation", "navigation"},
			want:     "navigation",
		},
		{
			name:      "unknown",
			template:  "react-native",
			args:      []string{"--navigation", "expo"},
			wantErr:   errUnknownNav,
			wantInErr: "router, navigation",
		},
		{
			name:      "on a template without a choice",
			template:  "nextjs",
			args:      []string{"--navigation", "router"},
			wantErr:   errNavUnsupported,
			wantInErr: "nextjs",
		},
		{name: "template without a choice and no flag", template: "nextjs", want: ""},
		{
			name:     "without a template",
			template: "",
			args:     []string{"--navigation", "navigation"},
			wantErr:  errNavNeedsTmpl,
		},
		{name: "no template and no flag", template: "", want: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := resolveNavWith(t, tt.template, tt.args...)

			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("resolveNavigationSystem error = %v, want %v", err, tt.wantErr)
			}

			if tt.wantInErr != "" && (err == nil || !strings.Contains(err.Error(), tt.wantInErr)) {
				t.Errorf("error %v does not mention %q", err, tt.wantInErr)
			}

			if tt.wantErr == nil && got.name != tt.want {
				t.Errorf("resolveNavigationSystem = %q, want %q", got.name, tt.want)
			}
		})
	}
}

// Scaffolding with each navigation system, and with some methods left out,
// has to give the overlay's files, none of the files it drops unless the
// overlay brings its own, and the selection's methods and nothing else.
func TestWriteTemplateWithEachNavigationSystem(t *testing.T) {
	t.Parallel()

	methods, err := parseAuthMethods("password,otp")
	if err != nil {
		t.Fatal(err)
	}

	pm, _ := lookupPackageManager(defaultPackageManager)

	for _, tmpl := range catalogue() {
		for _, nav := range tmpl.navSystems {
			t.Run(tmpl.name+"/"+nav.name, func(t *testing.T) {
				t.Parallel()

				root := t.TempDir()
				ps := clienv.NewPathStructure(
					root,
					root,
					filepath.Join(root, ".nhost"),
					filepath.Join(root, "nhost"),
				)

				layout, err := planTemplate(ps, tmpl.name)
				if err != nil {
					t.Fatalf("planTemplate: %v", err)
				}

				ui, _ := lookupUI(tmpl.uiSystems, defaultUI)

				if err := writeTemplate(
					ps, tmpl.name, layout, methods, ui, nav, pm,
				); err != nil {
					t.Fatalf("writeTemplate: %v", err)
				}

				assertNavigationOverlayWritten(t, root, tmpl, nav)
				assertSignInMethodsWritten(t, root, tmpl, methods)
			})
		}
	}
}

func assertNavigationOverlayWritten(
	t *testing.T,
	root string,
	tmpl starterTemplate,
	nav navigationSystem,
) {
	t.Helper()

	overlay := path.Join(tmpl.name, navDirPath, nav.overlay)

	for _, d := range nav.dropFiles {
		rel := strings.TrimPrefix(d, navRootPath+"/")

		want, replaceErr := fs.ReadFile(templates.FS, path.Join(overlay, rel))
		got, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(d)))

		switch {
		case replaceErr != nil && err == nil:
			t.Errorf("%s drops %s, but the scaffold has it", nav.name, d)
		case replaceErr == nil && !bytes.Equal(got, want):
			t.Errorf("%s replaces %s, but the scaffold has a different copy", nav.name, d)
		}
	}

	if nav.overlay == "" {
		return
	}

	err := fs.WalkDir(templates.FS, overlay, func(p string, e fs.DirEntry, err error) error {
		if err != nil || e.IsDir() {
			return err
		}

		want, err := fs.ReadFile(templates.FS, p)
		if err != nil {
			return fmt.Errorf("reading %s: %w", p, err)
		}

		rel := strings.TrimPrefix(p, overlay+"/")
		dst := filepath.Join(root, navRootPath, filepath.FromSlash(rel))

		got, err := os.ReadFile(dst)
		if err != nil || !bytes.Equal(got, want) {
			t.Errorf("%s/%s is not the %s overlay's copy (%v)", navRootPath, rel, nav.name, err)
		}

		return nil
	})
	if err != nil {
		t.Fatalf("walking %s: %v", overlay, err)
	}
}

func assertSignInMethodsWritten(
	t *testing.T,
	root string,
	tmpl starterTemplate,
	methods []signInMethod,
) {
	t.Helper()

	got, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(tmpl.methodsFile)))
	if err != nil {
		t.Fatal(err)
	}

	if want := renderSignInMethods(tmpl, methods); !bytes.Equal(got, want) {
		t.Errorf("%s is\n%s\nwant\n%s", tmpl.methodsFile, got, want)
	}

	for _, m := range signInMethods() {
		dir := filepath.Join(root, filepath.FromSlash(tmpl.authDir), m.name)

		_, err := os.Stat(dir)
		if selected := slices.ContainsFunc(
			methods, func(s signInMethod) bool { return s.name == m.name },
		); selected != (err == nil) {
			t.Errorf("%s present = %t, want %t", dir, err == nil, selected)
		}
	}
}

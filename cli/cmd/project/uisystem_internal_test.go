package project

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io/fs"
	"path"
	"strings"
	"testing"

	"github.com/nhost/nhost/templates"
	"github.com/urfave/cli/v3"
)

func TestDropDependencies(t *testing.T) {
	t.Parallel()

	const pkg = `{
  "name": "nextjs",
  "dependencies": {
    "@nhost/nhost-js": "^4.7.2",
    "@radix-ui/react-label": "^2.1.1",
    "class-variance-authority": "^0.7.1",
    "next": "^16.2.6"
  },
  "devDependencies": {
    "typescript": "^5"
  }
}`

	tests := []struct {
		name     string
		drops    []string
		wantGone []string
		wantKept []string
	}{
		{
			name:     "from the middle",
			drops:    []string{"@radix-ui/react-label"},
			wantGone: []string{"@radix-ui/react-label"},
			wantKept: []string{"@nhost/nhost-js", "class-variance-authority", "next", "typescript"},
		},
		{
			name:     "several at once",
			drops:    []string{"@radix-ui/react-label", "class-variance-authority"},
			wantGone: []string{"@radix-ui/react-label", "class-variance-authority"},
			wantKept: []string{"@nhost/nhost-js", "next", "typescript"},
		},
		{
			name:     "the last entry of an object, whose comma goes too",
			drops:    []string{"next"},
			wantGone: []string{"next"},
			wantKept: []string{"@nhost/nhost-js", "@radix-ui/react-label", "typescript"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := dropDependencies([]byte(pkg), tt.drops)
			if err != nil {
				t.Fatalf("dropDependencies: %v", err)
			}

			var parsed struct {
				Dependencies    map[string]string `json:"dependencies"`
				DevDependencies map[string]string `json:"devDependencies"`
			}

			if err := json.Unmarshal(got, &parsed); err != nil {
				t.Fatalf("result is not valid JSON: %v\n%s", err, got)
			}

			all := make(map[string]bool)
			for k := range parsed.Dependencies {
				all[k] = true
			}

			for k := range parsed.DevDependencies {
				all[k] = true
			}

			for _, gone := range tt.wantGone {
				if all[gone] {
					t.Errorf("%s is still there:\n%s", gone, got)
				}
			}

			for _, kept := range tt.wantKept {
				if !all[kept] {
					t.Errorf("%s was dropped and should not have been:\n%s", kept, got)
				}
			}
		})
	}
}

// Silently leaving a dependency in place would ship a package nothing imports,
// so a name the file does not carry is an error rather than a no-op.
func TestDropDependenciesRefusesAMissingName(t *testing.T) {
	t.Parallel()

	_, err := dropDependencies([]byte(`{"dependencies":{"next":"^16"}}`), []string{"nope"})
	if !errors.Is(err, errDepNotDropped) {
		t.Errorf("dropDependencies error = %v, want %v", err, errDepNotDropped)
	}
}

// Every dependency a UI system drops has to be one the template actually
// declares, or scaffolding that system fails on a real project.
func TestUIDropsAreDeclaredByTheTemplate(t *testing.T) {
	t.Parallel()

	for _, tmpl := range catalogue() {
		data, err := fs.ReadFile(templates.FS, path.Join(tmpl.name, "frontend", "package.json"))
		if err != nil {
			t.Fatalf("reading package.json for %s: %v", tmpl.name, err)
		}

		for _, ui := range tmpl.uiSystems {
			if len(ui.drops) == 0 {
				continue
			}

			t.Run(tmpl.name+"/"+ui.name, func(t *testing.T) {
				t.Parallel()

				if _, err := dropDependencies(data, ui.drops); err != nil {
					t.Errorf("%s cannot be scaffolded for %s: %v", ui.name, tmpl.name, err)
				}
			})
		}
	}
}

// moduleSource is everything a module behind the seam is written in: the file
// itself, or every file under it when the module is a directory.
//
// Both shapes are real. React keeps one file per module, so `button.tsx` is
// the whole of Button; shadcn-vue keeps a directory, so Button is
// `button/Button.vue` plus the `button/index.ts` that holds its variants, and
// either file can be the one that imports a dropped dependency.
func moduleSource(t *testing.T, p string) []byte {
	t.Helper()

	var src []byte

	err := fs.WalkDir(
		templates.FS,
		p,
		func(entry string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}

			if d.IsDir() {
				return nil
			}

			data, err := fs.ReadFile(templates.FS, entry)
			if err != nil {
				return err
			}

			src = append(src, data...)

			return nil
		},
	)
	if err != nil {
		t.Fatalf("reading %s: %v", p, err)
	}

	return src
}

// The seam only holds if every module that reaches for a component library has
// a replacement. This is what tells whoever adds a Radix import to card.tsx
// that the none variant now owes a card.tsx too.
func TestUINoneCoversEveryModuleWithADependency(t *testing.T) {
	t.Parallel()

	for _, tmpl := range catalogue() {
		t.Run(tmpl.name, func(t *testing.T) {
			t.Parallel()

			none, ok := lookupUI(tmpl.uiSystems, defaultUI)
			if !ok {
				t.Fatalf("%s offers no %q UI system", tmpl.name, defaultUI)
			}

			seam := path.Join(tmpl.name, tmpl.componentsUI)

			modules, err := fs.ReadDir(templates.FS, seam)
			if err != nil {
				t.Fatalf("reading %s: %v", seam, err)
			}

			overlay := path.Join(tmpl.name, uiDirPath, none.overlay)

			for _, m := range modules {
				src := moduleSource(t, path.Join(seam, m.Name()))

				needs := false

				for _, dep := range none.drops {
					if bytes.Contains(src, []byte(`'`+dep+`'`)) {
						needs = true
					}
				}

				_, err := fs.Stat(templates.FS, path.Join(overlay, m.Name()))
				has := err == nil

				switch {
				case needs && !has:
					t.Errorf(
						"%s imports a dependency the none UI system drops, so %s/%s must exist",
						m.Name(), overlay, m.Name(),
					)
				case !needs && has:
					t.Errorf(
						"%s/%s replaces a module that needs no replacement; delete it",
						overlay, m.Name(),
					)
				}
			}
		})
	}
}

// The overlay a UI system names has to be there, or choosing it writes nothing.
func TestUIOverlaysAreEmbedded(t *testing.T) {
	t.Parallel()

	for _, tmpl := range catalogue() {
		for _, ui := range tmpl.uiSystems {
			if ui.overlay == "" {
				continue
			}

			t.Run(tmpl.name+"/"+ui.name, func(t *testing.T) {
				t.Parallel()

				dir := path.Join(tmpl.name, uiDirPath, ui.overlay)

				entries, err := fs.ReadDir(templates.FS, dir)
				if err != nil {
					t.Fatalf("UI system %q has no %s: %v", ui.name, dir, err)
				}

				if len(entries) == 0 {
					t.Errorf("%s is empty", dir)
				}
			})
		}
	}
}

func resolveUIWith(t *testing.T, template string, args ...string) (uiSystem, error) {
	t.Helper()

	var (
		got    uiSystem
		gotErr error
		output bytes.Buffer
	)

	cmd := &cli.Command{
		Name:  "init",
		Flags: []cli.Flag{&cli.StringFlag{Name: flagUI, Value: defaultUI}},
		Action: func(_ context.Context, c *cli.Command) error {
			got, gotErr = resolveUISystem(newTestEnv(&output), c, template, false)

			return nil
		},
	}

	if err := cmd.Run(t.Context(), append([]string{"init"}, args...)); err != nil {
		t.Fatalf("parsing %q: %v", args, err)
	}

	return got, gotErr
}

func TestResolveUISystem(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		template  string
		args      []string
		want      string
		wantErr   error
		wantInErr string
	}{
		{name: "default", template: "nextjs", want: defaultUI},
		{name: "named", template: "nextjs", args: []string{"--ui", "none"}, want: "none"},
		{
			name:      "unknown",
			template:  "nextjs",
			args:      []string{"--ui", "bootstrap"},
			wantErr:   errUnknownUI,
			wantInErr: "none, shadcn",
		},
		{
			name:     "without a template",
			template: "",
			args:     []string{"--ui", "none"},
			wantErr:  errUINeedsTmpl,
		},
		{name: "no template and no flag", template: "", want: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := resolveUIWith(t, tt.template, tt.args...)

			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("resolveUISystem error = %v, want %v", err, tt.wantErr)
			}

			if tt.wantInErr != "" && (err == nil || !strings.Contains(err.Error(), tt.wantInErr)) {
				t.Errorf("error %v does not mention %q", err, tt.wantInErr)
			}

			if tt.wantErr == nil && got.name != tt.want {
				t.Errorf("resolveUISystem = %q, want %q", got.name, tt.want)
			}
		})
	}
}

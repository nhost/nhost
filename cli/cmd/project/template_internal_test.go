package project

import (
	"bytes"
	"context"
	"errors"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/templates"
	"github.com/urfave/cli/v3"
)

func TestTemplateValueSet(t *testing.T) {
	t.Parallel()

	tests := []struct {
		input    string
		wantName string
	}{
		{input: "true", wantName: ""},
		{input: "nextjs", wantName: "nextjs"},
		{input: "", wantName: ""},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			t.Parallel()

			v := new(templateValue)

			if err := v.Set(tt.input); err != nil {
				t.Fatalf("Set(%q): %v", tt.input, err)
			}

			if !v.set {
				t.Error("Set() did not record the flag as given")
			}

			if v.name != tt.wantName {
				t.Errorf("Set(%q) name = %q, want %q", tt.input, v.name, tt.wantName)
			}

			if !v.IsBoolFlag() {
				t.Error("IsBoolFlag() = false, want true: the flag must accept no value")
			}
		})
	}
}

// resolveWith parses args the way the init command does and returns what
// resolveTemplate makes of them, so the table below exercises the real parser
// rather than a hand-built flag state.
func resolveWith(t *testing.T, output *bytes.Buffer, args ...string) (string, error) {
	t.Helper()

	tv := new(templateValue)

	var (
		got    string
		gotErr error
	)

	cmd := &cli.Command{
		Name: "init",
		Flags: []cli.Flag{
			&cli.GenericFlag{Name: flagTemplate, Value: tv},
		},
		Action: func(_ context.Context, c *cli.Command) error {
			got, _, gotErr = resolveTemplate(newTestEnv(output), c, tv)

			return nil
		},
	}

	if err := cmd.Run(t.Context(), append([]string{"init"}, args...)); err != nil {
		t.Fatalf("parsing %q: %v", args, err)
	}

	return got, gotErr
}

func TestResolveTemplate(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		args    []string
		want    string
		wantErr error
		// wantInErr is a fragment the error message must carry, so a refusal
		// tells the user what they can type instead.
		wantInErr string
	}{
		{name: "not given", args: nil, want: "", wantErr: nil},
		{name: "equals form", args: []string{"--template=nextjs"}, want: "nextjs"},
		{name: "space form", args: []string{"--template", "nextjs"}, want: "nextjs"},
		{
			name:      "unknown name",
			args:      []string{"--template", "nope"},
			wantErr:   errUnknownTemplate,
			wantInErr: "nextjs",
		},
		{
			name:    "two words after the flag",
			args:    []string{"--template", "nextjs", "extra"},
			wantErr: errInitTakesNoArgs,
		},
		{name: "argument without the flag", args: []string{"extra"}, wantErr: errInitTakesNoArgs},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var output bytes.Buffer

			got, err := resolveWith(t, &output, tt.args...)

			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("resolveTemplate(%q) error = %v, want %v", tt.args, err, tt.wantErr)
			}

			if tt.wantInErr != "" && (err == nil || !strings.Contains(err.Error(), tt.wantInErr)) {
				t.Errorf("error %v does not mention %q", err, tt.wantInErr)
			}

			if got != tt.want {
				t.Errorf("resolveTemplate(%q) = %q, want %q", tt.args, got, tt.want)
			}
		})
	}
}

// A bare --template asks. With piped input that is the numbered fallback, which
// is also the only way the picker can run under test.
//
//nolint:paralleltest // swaps os.Stdin
func TestResolveTemplateBareFlagAsks(t *testing.T) {
	t.Run("answered", func(t *testing.T) {
		withStdin(t, "1\n")

		var output bytes.Buffer

		got, err := resolveWith(t, &output, "--template")
		if err != nil {
			t.Fatalf("resolveTemplate: %v", err)
		}

		if got != "nextjs" {
			t.Errorf("resolveTemplate(--template) = %q, want nextjs", got)
		}

		if !strings.Contains(output.String(), "Select template") {
			t.Errorf("picker did not ask:\n%s", output.String())
		}
	})

	t.Run("no input", func(t *testing.T) {
		withStdin(t, "")

		var output bytes.Buffer

		got, err := resolveWith(t, &output, "--template")
		if err != nil {
			t.Fatalf("resolveTemplate with empty stdin: %v", err)
		}

		if got != "nextjs" {
			t.Errorf("resolveTemplate(--template) = %q, want nextjs", got)
		}
	})
}

// methods.ts is generated at scaffold time but also checked in, because the
// template's own frontend is linted, tested and built in CI. Rendering the
// whole catalogue has to reproduce the committed file exactly, or a user who
// takes every method gets something the template's CI never ran against.
func TestRenderSignInMethodsMatchesTemplate(t *testing.T) {
	t.Parallel()

	for _, tmpl := range catalogue() {
		t.Run(tmpl.name, func(t *testing.T) {
			t.Parallel()

			committed, err := fs.ReadFile(templates.FS, path.Join(tmpl.name, tmpl.methodsFile))
			if err != nil {
				t.Fatalf("reading %s from the template: %v", tmpl.methodsFile, err)
			}

			if got := renderSignInMethods(tmpl, signInMethods()); !bytes.Equal(got, committed) {
				t.Errorf(
					"generated %s differs from the one %s ships\n--- generated ---\n%s\n--- committed ---\n%s",
					tmpl.methodsFile,
					tmpl.name,
					got,
					committed,
				)
			}
		})
	}
}

// Every method the catalogue offers has to be a directory the template ships,
// since that is what a selection skips or keeps.
func TestEveryAuthMethodIsEmbedded(t *testing.T) {
	t.Parallel()

	for _, tmpl := range catalogue() {
		for _, m := range signInMethods() {
			t.Run(tmpl.name+"/"+m.name, func(t *testing.T) {
				t.Parallel()

				dir := path.Join(tmpl.name, tmpl.authDir, m.name)

				entries, err := fs.ReadDir(templates.FS, dir)
				if err != nil {
					t.Fatalf("method %q has no %s in the template: %v", m.name, dir, err)
				}

				if len(entries) == 0 {
					t.Errorf("%s is empty", dir)
				}

				if want := "/auth/" + m.name; m.href != want {
					t.Errorf(
						"href = %q, want %q: the href is what links to the directory",
						m.href,
						want,
					)
				}
			})
		}
	}
}

func TestCatalogueIsEmbedded(t *testing.T) {
	t.Parallel()

	for _, tmpl := range catalogue() {
		t.Run(tmpl.name, func(t *testing.T) {
			t.Parallel()

			entries, err := templateEntries(tmpl.name)
			if err != nil {
				t.Fatalf("templateEntries(%q): %v", tmpl.name, err)
			}

			if len(entries) == 0 {
				t.Fatalf("template %q is in the catalogue but ships nothing", tmpl.name)
			}

			found := false

			for _, e := range entries {
				if e == "frontend" {
					found = true
				}
			}

			if !found {
				t.Errorf("template %q has no frontend entry; got %q", tmpl.name, entries)
			}
		})
	}
}

// A step failing after the checks passed takes back what it wrote, which the
// checks showed was not there before, and nothing it was told to keep. Without
// that, a retry is refused by the first half-written entry.
func TestWriteTemplateRemovesWhatItWroteOnFailure(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	ps := clienv.NewPathStructure(
		root,
		root,
		filepath.Join(root, ".nhost"),
		filepath.Join(root, "nhost"),
	)

	mine := []byte("# Mine\n")
	if err := os.WriteFile(
		filepath.Join(root, "CLAUDE.md"), mine, 0o600,
	); err != nil {
		t.Fatal(err)
	}

	layout, err := planTemplate(ps, "nextjs")
	if err != nil {
		t.Fatalf("planTemplate: %v", err)
	}

	pm, _ := lookupPackageManager(defaultPackageManager)

	// The overlay is the step after the tree copy and methods.ts, so by the
	// time it fails the frontend is already on disk.
	broken := uiSystem{
		name:      "broken",
		label:     "Broken",
		overlay:   "missing",
		drops:     nil,
		dropFiles: nil,
	}

	if err := writeTemplate(
		ps, "nextjs", layout, signInMethods(), broken, pm,
	); err == nil {
		t.Fatal("writeTemplate with a missing overlay succeeded")
	}

	found, err := os.ReadDir(root)
	if err != nil {
		t.Fatal(err)
	}

	if len(found) != 1 || found[0].Name() != "CLAUDE.md" {
		t.Errorf(
			"after a failed write the project holds %v, want CLAUDE.md",
			found,
		)
	}

	got, err := os.ReadFile(filepath.Join(root, "CLAUDE.md"))
	if err != nil {
		t.Fatal(err)
	}

	if !bytes.Equal(got, mine) {
		t.Errorf("the project's own CLAUDE.md changed to %q", got)
	}
}

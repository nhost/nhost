package project

import (
	"bytes"
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nhost/nhost/cli/clienv"
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
			got, gotErr = resolveTemplate(newTestEnv(output), c, tv)

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

		if !strings.Contains(output.String(), "Select a template") {
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

// A write failing partway takes back every entry the layout said to write,
// which planTemplate showed was not there before. Without that, a retry is
// refused by the first half-written entry.
func TestWriteTemplateRemovesWhatItWroteOnFailure(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	ps := clienv.NewPathStructure(
		root,
		root,
		filepath.Join(root, ".nhost"),
		filepath.Join(root, "nhost"),
	)

	layout, err := planTemplate(ps, "nextjs")
	if err != nil {
		t.Fatalf("planTemplate: %v", err)
	}

	// A file where the frontend needs a directory fails the copy after the
	// entries ahead of frontend in walk order are already written.
	if err := os.MkdirAll(filepath.Join(root, "frontend"), 0o755); err != nil {
		t.Fatal(err)
	}

	if err := os.WriteFile(
		filepath.Join(root, "frontend", "src"), nil, 0o600,
	); err != nil {
		t.Fatal(err)
	}

	if err := writeTemplate(ps, "nextjs", layout); err == nil {
		t.Fatal("writeTemplate over a blocked frontend/src succeeded")
	}

	found, err := os.ReadDir(root)
	if err != nil {
		t.Fatal(err)
	}

	if len(found) != 0 {
		t.Errorf(
			"after a failed write the project holds %v, want nothing",
			found,
		)
	}
}

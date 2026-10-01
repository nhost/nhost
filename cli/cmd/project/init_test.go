package project_test

import (
	"bytes"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/nhost/nhost/cli/clienv"
	cmdproject "github.com/nhost/nhost/cli/cmd/project"
	"github.com/urfave/cli/v3"
)

// runInit runs `nhost init` with the given arguments in dir, through the same
// root flags the real binary has, and returns what it printed.
func runInit(t *testing.T, dir string, args ...string) (string, error) {
	t.Helper()

	flags, err := clienv.Flags()
	if err != nil {
		t.Fatalf("clienv.Flags: %v", err)
	}

	var output bytes.Buffer

	root := &cli.Command{
		Name:      "nhost",
		Flags:     flags,
		Commands:  []*cli.Command{cmdproject.CommandInit()},
		Writer:    &output,
		ErrWriter: &output,
	}

	t.Chdir(dir)

	err = root.Run(t.Context(), append([]string{"nhost", "init"}, args...))

	return output.String(), err
}

// entries lists what a directory contains, so a refused init can be shown to
// have written nothing.
func entries(t *testing.T, dir string) []string {
	t.Helper()

	found, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("reading %s: %v", dir, err)
	}

	names := make([]string, 0, len(found))
	for _, f := range found {
		names = append(names, f.Name())
	}

	return names
}

//nolint:paralleltest // changes the working directory
func TestInitWithTemplate(t *testing.T) {
	tests := []struct {
		name string
		args []string
		// wantPaths must exist afterwards, relative to the project directory.
		wantPaths []string
		// wantErr is a fragment of the error; the directory must then be empty.
		wantErr string
	}{
		{
			name: "backend only",
			args: nil,
			wantPaths: []string{
				"nhost/nhost.toml",
				"functions/package.json",
			},
		},
		{
			name: "template as the next word",
			args: []string{"--template", "nextjs"},
			wantPaths: []string{
				"nhost/nhost.toml",
				"frontend/package.json",
				"frontend/src/app/signin/methods.ts",
				"AGENTS.md",
				"CLAUDE.md",
			},
		},
		{
			name: "template with equals",
			args: []string{"--template=nextjs"},
			wantPaths: []string{
				"frontend/package.json",
			},
		},
		{
			name:    "unknown template writes nothing",
			args:    []string{"--template", "nope"},
			wantErr: "unknown template",
		},
		{
			name:    "stray argument writes nothing",
			args:    []string{"extra"},
			wantErr: "takes no arguments",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()

			output, err := runInit(t, dir, tt.args...)

			if tt.wantErr != "" {
				if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
					t.Fatalf("init %q error = %v, want one mentioning %q", tt.args, err, tt.wantErr)
				}

				if got := entries(t, dir); len(got) != 0 {
					t.Errorf("a refused init wrote %q", got)
				}

				return
			}

			if err != nil {
				t.Fatalf("init %q: %v\n%s", tt.args, err, output)
			}

			for _, p := range tt.wantPaths {
				if _, err := os.Stat(filepath.Join(dir, p)); err != nil {
					t.Errorf("expected %s to exist: %v", p, err)
				}
			}
		})
	}
}

//nolint:paralleltest // changes the working directory
func TestInitTemplateRefusesToOverwrite(t *testing.T) {
	tests := []struct {
		name string
		// place puts something where the template's frontend would go.
		place func(t *testing.T, dir, outside string)
	}{
		{
			name: "a file",
			place: func(t *testing.T, dir, _ string) {
				t.Helper()

				err := os.WriteFile(
					filepath.Join(dir, "frontend"), []byte("mine"), 0o600,
				)
				if err != nil {
					t.Fatal(err)
				}
			},
		},
		{
			// A link that resolves to nothing is still something there, and
			// writing through it would land outside the project.
			name: "a dangling symlink",
			place: func(t *testing.T, dir, outside string) {
				t.Helper()

				err := os.Symlink(
					filepath.Join(outside, "frontend"),
					filepath.Join(dir, "frontend"),
				)
				if err != nil {
					t.Fatal(err)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir, outside := t.TempDir(), t.TempDir()
			tt.place(t, dir, outside)

			_, err := runInit(t, dir, "--template", "nextjs")
			if err == nil || !strings.Contains(err.Error(), "already exists") {
				t.Fatalf(
					"init over an existing frontend error = %v, "+
						"want one saying it already exists",
					err,
				)
			}

			// Refused before anything was written: the nhost folder is not
			// there either.
			if got := entries(t, dir); len(got) != 1 || got[0] != "frontend" {
				t.Errorf("a refused init changed the directory: %q", got)
			}

			if got := entries(t, outside); len(got) != 0 {
				t.Errorf("init wrote outside the project: %q", got)
			}
		})
	}
}

// A project's own agent context is not in the way of the frontend, so it is
// kept rather than refused, the template's copy is not written, and the output
// names what was skipped. A symlink counts as there whether or not it
// resolves, so a dangling one is never written through.
//
//nolint:paralleltest // changes the working directory
func TestInitTemplateKeepsExistingAgentContext(t *testing.T) {
	tests := []struct {
		name string
		// links are top-level entries made dangling symlinks into outside.
		links []string
		// files are top-level files, and dirs top-level directories each
		// holding one file, all with mine as their content.
		files []string
		dirs  []string
	}{
		{
			name:  "a dangling AGENTS.md symlink",
			links: []string{"AGENTS.md"},
		},
		{
			name:  "CLAUDE.md and .claude on a fresh project",
			files: []string{"CLAUDE.md"},
			dirs:  []string{".claude"},
		},
		{
			name:  "SKILLS.md beside a CLAUDE.md symlink",
			files: []string{"SKILLS.md"},
			links: []string{"CLAUDE.md"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir, outside := t.TempDir(), t.TempDir()

			kept := placeAgentContext(
				t, dir, outside, tt.links, tt.files, tt.dirs,
			)

			args := []string{"--template", "nextjs"}

			output, err := runInit(t, dir, args...)
			if err != nil {
				t.Fatalf("init %q: %v\n%s", args, err, output)
			}

			if _, err := os.Stat(
				filepath.Join(dir, "frontend", "package.json"),
			); err != nil {
				t.Errorf("frontend was not written: %v", err)
			}

			assertUntouched(t, dir, outside, kept)

			for _, e := range slices.Concat(tt.links, tt.files, tt.dirs) {
				if !strings.Contains(output, e) {
					t.Errorf("output does not name skipped %s:\n%s", e, output)
				}
			}
		})
	}
}

// placeAgentContext lays out a project's own agent context and returns every
// path it made, relative to dir, with what readEntry reads there.
func placeAgentContext(
	t *testing.T,
	dir, outside string,
	links, files, dirs []string,
) map[string]string {
	t.Helper()

	mine := "# Mine\n\ncd frontend && pnpm install && pnpm dev\n"
	kept := make(map[string]string)

	for _, l := range links {
		if err := os.Symlink(
			filepath.Join(outside, l), filepath.Join(dir, l),
		); err != nil {
			t.Fatal(err)
		}

		kept[l] = "-> " + filepath.Join(outside, l)
	}

	for _, f := range files {
		if err := os.WriteFile(
			filepath.Join(dir, f), []byte(mine), 0o600,
		); err != nil {
			t.Fatal(err)
		}

		kept[f] = mine
	}

	for _, d := range dirs {
		if err := os.Mkdir(filepath.Join(dir, d), 0o755); err != nil {
			t.Fatal(err)
		}

		p := filepath.Join(d, "mine.md")
		if err := os.WriteFile(
			filepath.Join(dir, p), []byte(mine), 0o600,
		); err != nil {
			t.Fatal(err)
		}

		kept[d] = "dir mine.md"
		kept[p] = mine
	}

	return kept
}

// assertUntouched checks every kept entry reads as it did before init ran,
// and that nothing was written through a link into outside.
func assertUntouched(
	t *testing.T,
	dir, outside string,
	kept map[string]string,
) {
	t.Helper()

	for p, want := range kept {
		if got := readEntry(t, filepath.Join(dir, p)); got != want {
			t.Errorf("%s changed: got %q, want %q", p, got, want)
		}
	}

	if got := entries(t, outside); len(got) != 0 {
		t.Errorf("init wrote outside the project: %q", got)
	}
}

// readEntry describes what is at p without following a symlink: a link as its
// target, a directory as its listing, a file as its content.
func readEntry(t *testing.T, p string) string {
	t.Helper()

	info, err := os.Lstat(p)
	if err != nil {
		t.Fatal(err)
	}

	switch {
	case info.Mode()&os.ModeSymlink != 0:
		target, err := os.Readlink(p)
		if err != nil {
			t.Fatal(err)
		}

		return "-> " + target
	case info.IsDir():
		return "dir " + strings.Join(entries(t, p), " ")
	default:
		data, err := os.ReadFile(p)
		if err != nil {
			t.Fatal(err)
		}

		return string(data)
	}
}

// Every sign-in method is scaffolded, and a stock backend has magic link and
// the emailed code off, so the next steps name the settings that turn them on
// rather than leave two sign-in pages that quietly fail.
//
//nolint:paralleltest // changes the working directory
func TestInitTemplateNamesSettingsToEnable(t *testing.T) {
	dir := t.TempDir()

	output, err := runInit(t, dir, "--template", "nextjs")
	if err != nil {
		t.Fatalf("init --template: %v\n%s", err, output)
	}

	for _, want := range []string{
		"nhost/nhost.toml",
		"auth.method.emailPasswordless.enabled = true",
		"auth.method.otp.email.enabled = true",
	} {
		if !strings.Contains(output, want) {
			t.Errorf("next steps do not mention %q:\n%s", want, output)
		}
	}
}

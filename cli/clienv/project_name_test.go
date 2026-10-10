package clienv_test

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/urfave/cli/v3"
)

// Subtests are serial: each one moves the process working directory and some
// of them set NHOST_PROJECT_NAME.
func TestProjectNameResolution(t *testing.T) {
	tests := []struct {
		name string
		// dir is what the working directory itself is called, which is what the
		// project name falls back to.
		dir string
		env string
		// emptyEnv sets NHOST_PROJECT_NAME even when env is the empty string.
		emptyEnv bool
		args     []string
		want     string
	}{
		{
			name: "falls back to the working directory name",
			args: nil,
			want: "backend",
		},
		// A name nothing usable can be made of reaches docker compose as it was
		// given. Resolving it to the empty string would hand compose `-p ""`,
		// which compose reads as no project name at all: it names the project
		// after the directory and trims the leading `_` and `-` itself, so the
		// project could come up on the name a sibling is already using.
		//
		// This directory is the case that does not change: the name survived
		// sanitizing before this too, and compose refused it then as it does now.
		{
			name: "a working directory compose would refuse is passed on whole",
			dir:  "_myapp",
			args: nil,
			want: "_myapp",
		},
		// This directory is the case that does change. Nothing survives
		// sanitizing, so it used to resolve to the empty string and compose was
		// left to name the project after the directory itself.
		{
			name: "a working directory with nothing usable in it is passed on whole",
			dir:  "\u65e5\u672c\u8a9e",
			args: nil,
			want: "\u65e5\u672c\u8a9e",
		},
		{
			name: "a --project-name compose would refuse is passed on whole",
			args: []string{"--project-name", "-myapp"},
			want: "-myapp",
		},
		{
			name: "a NHOST_PROJECT_NAME compose would refuse is passed on whole",
			env:  "\u65e5\u672c\u8a9e",
			args: nil,
			want: "\u65e5\u672c\u8a9e",
		},
		// Dots are dropped, as they always were, so a dotted directory keeps
		// the compose project, and with it the Postgres volume, it had.
		{
			name: "a dotted directory keeps its compose project name",
			dir:  "example.com",
			args: nil,
			want: "examplecom",
		},
		{
			name: "--project-name overrides the directory name",
			args: []string{"--project-name", "from-flag"},
			want: "from-flag",
		},
		{
			name: "NHOST_PROJECT_NAME overrides the directory name",
			env:  "from-env",
			args: nil,
			want: "from-env",
		},
		{
			name: "--project-name overrides NHOST_PROJECT_NAME",
			env:  "from-env",
			args: []string{"--project-name", "from-flag"},
			want: "from-flag",
		},
		// A blank value is what an empty `NHOST_PROJECT_NAME=` line in a .env
		// file gives. It names no project, so it must not hand compose `-p ""`,
		// which compose reads as the directory name.
		{
			name:     "an empty NHOST_PROJECT_NAME defers to the directory",
			emptyEnv: true,
			args:     nil,
			want:     "backend",
		},
		{
			name: "a blank NHOST_PROJECT_NAME defers to the directory",
			env:  "   ",
			args: nil,
			want: "backend",
		},
		{
			name: "an empty --project-name defers to the directory",
			args: []string{"--project-name", ""},
			want: "backend",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := tt.dir
			if dir == "" {
				dir = "backend"
			}

			if tt.env != "" || tt.emptyEnv {
				t.Setenv("NHOST_PROJECT_NAME", tt.env)
			}

			t.Chdir(newProject(t, dir))

			if got := resolveProjectName(t, tt.args); got != tt.want {
				t.Fatalf("ProjectName() = %q, want %q", got, tt.want)
			}
		})
	}
}

// newProject creates a project directory called dir with an nhost folder in it.
func newProject(t *testing.T, dir string) string {
	t.Helper()

	root := filepath.Join(t.TempDir(), dir)
	if err := os.MkdirAll(filepath.Join(root, "nhost"), 0o755); err != nil {
		t.Fatalf("create project folder: %v", err)
	}

	return root
}

// resolveProjectName runs a throwaway command with the real global flags and
// returns the project name the CLI would hand to docker compose.
func resolveProjectName(t *testing.T, args []string) string {
	t.Helper()

	flags, err := clienv.Flags()
	if err != nil {
		t.Fatalf("Flags: %v", err)
	}

	var (
		got    string
		output bytes.Buffer
	)

	cmd := &cli.Command{
		Name:  "nhost",
		Flags: flags,
		Commands: []*cli.Command{
			{
				Name: "show",
				Action: func(_ context.Context, cmd *cli.Command) error {
					got = clienv.FromCLI(cmd).ProjectName()
					return nil
				},
			},
		},
		Writer:    &output,
		ErrWriter: &output,
	}

	argv := append([]string{"nhost"}, args...)
	if err := cmd.Run(context.Background(), append(argv, "show")); err != nil {
		t.Fatalf("run %s: %v", strings.Join(argv, " "), err)
	}

	return got
}

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
		// dir is what the working directory itself is called, which is the last
		// thing the project name falls back to.
		dir          string
		fileContents string
		// fileIsDir puts a directory where nhost/project-name is read from, so
		// the file exists but cannot be read.
		fileIsDir bool
		env       string
		// emptyEnv sets NHOST_PROJECT_NAME even when env is the empty string.
		emptyEnv  bool
		folderEnv string
		args      []string
		// fromParent runs the command from the directory holding the backend
		// rather than from the backend itself, which is the only way the
		// project-structure flags point anywhere but the working directory.
		fromParent bool
		want       string
		// wantOutput is text the CLI has to print while resolving the name.
		wantOutput string
	}{
		{
			name:         "falls back to the working directory name",
			fileContents: "",
			env:          "",
			args:         nil,
			want:         "backend",
		},
		// A name nothing usable can be made of reaches docker compose as it was
		// given. Resolving it to the empty string handed compose `-p ""`, which
		// compose reads as no project name at all: it names the project after
		// the directory and trims the leading `_` itself, so `_myapp` took over
		// the containers and Postgres volume of a sibling `myapp` instead of
		// being refused.
		{
			name:         "a working directory compose would refuse is passed on whole",
			dir:          "_myapp",
			fileContents: "",
			env:          "",
			args:         nil,
			want:         "_myapp",
		},
		{
			name:         "a --project-name compose would refuse is passed on whole",
			fileContents: "",
			env:          "",
			args:         []string{"--project-name", "-myapp"},
			want:         "-myapp",
		},
		{
			name:         "a NHOST_PROJECT_NAME compose would refuse is passed on whole",
			fileContents: "",
			env:          "\u65e5\u672c\u8a9e",
			args:         nil,
			want:         "\u65e5\u672c\u8a9e",
		},
		// A recorded name is pinned on purpose, so an unusable one is refused
		// like any other rather than falling back to the directory, which for a
		// backend/ is the shared project the file was written to escape.
		{
			name:         "an unusable recorded name is passed on whole",
			dir:          "_myapp",
			fileContents: "_recorded\n",
			env:          "",
			args:         nil,
			want:         "_recorded",
		},
		{
			name:         "blank lines before the recorded name are skipped",
			fileContents: "\n  \nmy-app\n",
			env:          "",
			args:         nil,
			want:         "my-app",
		},
		{
			name:       "an unreadable recorded name is reported",
			fileIsDir:  true,
			env:        "",
			args:       nil,
			want:       "backend",
			wantOutput: filepath.Join("nhost", "project-name"),
		},
		// Dots are dropped, as they always were, so a dotted directory keeps
		// the compose project, and with it the Postgres volume, it had.
		{
			name:         "a dotted directory keeps its compose project name",
			dir:          "example.com",
			fileContents: "",
			env:          "",
			args:         nil,
			want:         "examplecom",
		},
		{
			name:         "the recorded project name wins over the directory name",
			fileContents: "my-app\n",
			env:          "",
			args:         nil,
			want:         "my-app",
		},
		{
			name:         "a blank file falls back to the directory name",
			fileContents: "\n",
			env:          "",
			args:         nil,
			want:         "backend",
		},
		{
			name:         "NHOST_PROJECT_NAME overrides the recorded name",
			fileContents: "my-app\n",
			env:          "from-env",
			args:         nil,
			want:         "from-env",
		},
		// A blank value is what an empty `NHOST_PROJECT_NAME=` line in a .env
		// file gives. It names no project, so it must not hand compose `-p ""`,
		// which compose reads as the directory name.
		{
			name:         "an empty NHOST_PROJECT_NAME defers to the file",
			fileContents: "my-app\n",
			emptyEnv:     true,
			args:         nil,
			want:         "my-app",
		},
		{
			name:     "an empty NHOST_PROJECT_NAME defers to the directory",
			emptyEnv: true,
			args:     nil,
			want:     "backend",
		},
		{
			name:         "a blank NHOST_PROJECT_NAME defers to the file",
			fileContents: "my-app\n",
			env:          "   ",
			args:         nil,
			want:         "my-app",
		},
		{
			name:         "an empty --project-name defers to the file",
			fileContents: "my-app\n",
			args:         []string{"--project-name", ""},
			want:         "my-app",
		},
		{
			name: "an empty --project-name defers to the directory",
			args: []string{"--project-name", ""},
			want: "backend",
		},
		{
			name:         "--project-name overrides the recorded name",
			fileContents: "my-app\n",
			env:          "",
			args:         []string{"--project-name", "from-flag"},
			want:         "from-flag",
		},
		// The recorded name has to be read from the folder the flags name. It
		// used to be read from ./nhost/project-name whatever they said, so
		// running against a backend/ from its parent silently started a second
		// set of containers and a second Postgres volume.
		{
			name:         "--nhost-folder is where the recorded name is read from",
			fileContents: "my-app\n",
			env:          "",
			args: []string{
				"--root-folder", "backend",
				"--nhost-folder", filepath.Join("backend", "nhost"),
			},
			fromParent: true,
			want:       "my-app",
		},
		{
			name:         "NHOST_NHOST_FOLDER is where the recorded name is read from",
			fileContents: "my-app\n",
			env:          "",
			folderEnv:    filepath.Join("backend", "nhost"),
			fromParent:   true,
			want:         "my-app",
		},
		{
			name:         "--project-name still wins when the folder flags point at a recorded name",
			fileContents: "my-app\n",
			env:          "",
			args: []string{
				"--nhost-folder", filepath.Join("backend", "nhost"),
				"--project-name", "from-flag",
			},
			fromParent: true,
			want:       "from-flag",
		},
		{
			name:         "NHOST_PROJECT_NAME still wins when the folder flags point at a recorded name",
			fileContents: "my-app\n",
			env:          "from-env",
			args:         []string{"--nhost-folder", filepath.Join("backend", "nhost")},
			fromParent:   true,
			want:         "from-env",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := tt.dir
			if dir == "" {
				dir = "backend"
			}

			root := newBackend(t, dir, tt.fileContents, tt.fileIsDir)

			if tt.env != "" || tt.emptyEnv {
				t.Setenv("NHOST_PROJECT_NAME", tt.env)
			}

			if tt.folderEnv != "" {
				t.Setenv("NHOST_NHOST_FOLDER", tt.folderEnv)
			}

			if tt.fromParent {
				t.Chdir(filepath.Dir(root))
			} else {
				t.Chdir(root)
			}

			got, output := resolveProjectName(t, tt.args)
			if got != tt.want {
				t.Fatalf("ProjectName() = %q, want %q", got, tt.want)
			}

			if !strings.Contains(output, tt.wantOutput) {
				t.Fatalf("output %q does not mention %q", output, tt.wantOutput)
			}
		})
	}
}

// newBackend creates a backend directory called dir with an nhost folder in
// it, and puts contents in nhost/project-name, or a directory there instead
// when fileIsDir is set.
func newBackend(t *testing.T, dir, contents string, fileIsDir bool) string {
	t.Helper()

	root := filepath.Join(t.TempDir(), dir)
	if err := os.MkdirAll(filepath.Join(root, "nhost"), 0o755); err != nil {
		t.Fatalf("create backend folder: %v", err)
	}

	nameFile := filepath.Join(root, "nhost", "project-name")

	if fileIsDir {
		if err := os.Mkdir(nameFile, 0o755); err != nil {
			t.Fatalf("create project name directory: %v", err)
		}
	}

	if contents != "" {
		if err := os.WriteFile(nameFile, []byte(contents), 0o600); err != nil {
			t.Fatalf("write project name file: %v", err)
		}
	}

	return root
}

// resolveProjectName runs a throwaway command with the real global flags and
// returns the project name the CLI would hand to docker compose, along with
// what it printed.
func resolveProjectName(t *testing.T, args []string) (string, string) {
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

	return got, output.String()
}

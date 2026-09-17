package clienv_test

import (
	"context"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/urfave/cli/v3"
)

func TestWriteProjectName(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		project string
		want    string
		wantErr bool
	}{
		{name: "plain name", project: "my-app", want: "my-app\n", wantErr: false},
		{name: "name is lowercased", project: "My-App", want: "my-app\n", wantErr: false},
		// A dot becomes a dash so that my.app and myapp stay two projects.
		{name: "dots become dashes", project: "my.app", want: "my-app\n", wantErr: false},
		{name: "a dotless name is untouched", project: "myapp", want: "myapp\n", wantErr: false},
		{name: "unusable name", project: "...", want: "", wantErr: true},
		{name: "empty name", project: "", want: "", wantErr: true},
		// Compose refuses a project name that does not start with a letter or
		// digit, so the leading punctuation goes rather than reaching docker.
		{name: "leading dash is trimmed", project: "-app", want: "app\n", wantErr: false},
		{name: "leading underscore is trimmed", project: "_app", want: "app\n", wantErr: false},
		{name: "leading dot is trimmed", project: ".app", want: "app\n", wantErr: false},
		{name: "punctuation only is unusable", project: "--__", want: "", wantErr: true},
		{name: "unicode only is unusable", project: "\u65e5\u672c\u8a9e", want: "", wantErr: true},
		{name: "a leading digit is fine", project: "9lives", want: "9lives\n", wantErr: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			path := filepath.Join(t.TempDir(), "nhost", "project-name")

			err := clienv.WriteProjectName(path, tt.project)
			if (err != nil) != tt.wantErr {
				t.Fatalf("WriteProjectName(%q) error = %v, wantErr %t", tt.project, err, tt.wantErr)
			}

			if tt.wantErr {
				if _, err := os.Stat(path); err == nil {
					t.Fatalf("WriteProjectName(%q) created a file for an unusable name", tt.project)
				}

				return
			}

			b, err := os.ReadFile(path)
			if err != nil {
				t.Fatalf("read project name file: %v", err)
			}

			if string(b) != tt.want {
				t.Fatalf("project name file = %q, want %q", string(b), tt.want)
			}
		})
	}
}

// Subtests are serial: each one moves the process working directory and some
// of them set NHOST_PROJECT_NAME.
func TestProjectNameResolution(t *testing.T) {
	tests := []struct {
		name         string
		fileContents string
		env          string
		folderEnv    string
		args         []string
		// fromParent runs the command from the directory holding the backend
		// rather than from the backend itself, which is the only way the
		// project-structure flags point anywhere but the working directory.
		fromParent bool
		want       string
	}{
		{
			name:         "falls back to the working directory name",
			fileContents: "",
			env:          "",
			args:         nil,
			want:         "backend",
		},
		{
			name:         "the recorded project name wins over the directory name",
			fileContents: "my-app\n",
			env:          "",
			args:         nil,
			want:         "my-app",
		},
		{
			name:         "an unusable file falls back to the directory name",
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
			root := filepath.Join(t.TempDir(), "backend")
			if err := os.MkdirAll(filepath.Join(root, "nhost"), 0o755); err != nil {
				t.Fatalf("create backend folder: %v", err)
			}

			if tt.fileContents != "" {
				if err := os.WriteFile(
					filepath.Join(root, "nhost", "project-name"),
					[]byte(tt.fileContents),
					0o600,
				); err != nil {
					t.Fatalf("write project name file: %v", err)
				}
			}

			if tt.env != "" {
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

			if got := resolveProjectName(t, tt.args); got != tt.want {
				t.Fatalf("ProjectName() = %q, want %q", got, tt.want)
			}
		})
	}
}

// resolveProjectName runs a throwaway command with the real global flags and
// returns the project name the CLI would hand to docker compose.
func resolveProjectName(t *testing.T, args []string) string {
	t.Helper()

	flags, err := clienv.Flags()
	if err != nil {
		t.Fatalf("Flags: %v", err)
	}

	var got string

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
		Writer:    io.Discard,
		ErrWriter: io.Discard,
	}

	argv := append([]string{"nhost"}, args...)
	if err := cmd.Run(context.Background(), append(argv, "show")); err != nil {
		t.Fatalf("run %s: %v", strings.Join(argv, " "), err)
	}

	return got
}

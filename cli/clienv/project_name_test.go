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
		{name: "dots are dropped", project: "my.app", want: "myapp\n", wantErr: false},
		{name: "unusable name", project: "...", want: "", wantErr: true},
		{name: "empty name", project: "", want: "", wantErr: true},
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
		args         []string
		want         string
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

			t.Chdir(root)

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

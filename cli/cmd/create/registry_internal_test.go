package create

import (
	"bytes"
	"context"
	"path/filepath"
	"testing"
)

func TestDefaultTemplatesRef(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		version string
		want    string
	}{
		{name: "dev build", version: "0.0.0-dev", want: "main"},
		{name: "unset version", version: "", want: "main"},
		{name: "release", version: "1.51.0", want: "cli@1.51.0"},
		{name: "prerelease", version: "1.52.0-rc1", want: "cli@1.52.0-rc1"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := defaultTemplatesRef(tt.version); got != tt.want {
				t.Errorf("defaultTemplatesRef(%q) = %q, want %q", tt.version, got, tt.want)
			}
		})
	}
}

//nolint:paralleltest // mutates process cwd via t.Chdir
func TestCreateFetchesTemplateFromReleaseTagRef(t *testing.T) {
	git := requireGit(t)
	workdir := t.TempDir()

	// The fixture only carries the release tag's ref, so the run fails unless
	// the CLI resolves its own version to `cli@<version>`.
	fixture := createTemplateGitFixture(t, git, "cli@9.9.9")
	t.Chdir(workdir)

	var output bytes.Buffer

	cmd := newTestRootCommand(t, &output)
	cmd.Version = "9.9.9"

	if err := cmd.Run(
		context.Background(),
		[]string{
			"nhost",
			"create",
			"--templates-repo",
			"file://" + fixture,
			"--no-install",
			"my-app",
		},
	); err != nil {
		t.Fatalf("create command: %v\n%s", err, output.String())
	}

	if got := readTestFile(
		t,
		filepath.Join(workdir, "my-app", "frontend", "src", "app.ts"),
	); got != "export const ok = true\n" {
		t.Fatalf("frontend file = %q", got)
	}
}

func TestCreateTemplatesRefOverridesReleaseTagRef(t *testing.T) {
	tests := []struct {
		name string
		args []string
		env  string
	}{
		{name: "flag", args: []string{"--templates-ref", "template-branch"}, env: ""},
		{name: "env", args: nil, env: "template-branch"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			git := requireGit(t)
			workdir := t.TempDir()
			fixture := createTemplateGitFixture(t, git, "template-branch")
			t.Chdir(workdir)

			if tt.env != "" {
				t.Setenv("NHOST_CREATE_TEMPLATES_REF", tt.env)
			}

			var output bytes.Buffer

			cmd := newTestRootCommand(t, &output)
			// The fixture has no `cli@9.9.9` ref, so the run only succeeds if
			// the explicit ref beats the version-derived default.
			cmd.Version = "9.9.9"

			args := append(
				[]string{
					"nhost",
					"create",
					"--templates-repo",
					"file://" + fixture,
					"--no-install",
				},
				tt.args...,
			)
			args = append(args, "my-app")

			if err := cmd.Run(context.Background(), args); err != nil {
				t.Fatalf("create command: %v\n%s", err, output.String())
			}

			if got := readTestFile(
				t,
				filepath.Join(workdir, "my-app", "frontend", "src", "app.ts"),
			); got != "export const ok = true\n" {
				t.Fatalf("frontend file = %q", got)
			}
		})
	}
}

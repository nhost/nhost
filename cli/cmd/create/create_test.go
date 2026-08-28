package create //nolint:testpackage

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/urfave/cli/v3"
)

//nolint:paralleltest // mutates process cwd via t.Chdir
func TestStageProjectLocalTemplate(t *testing.T) {
	workdir := t.TempDir()
	templateDir := filepath.Join(workdir, "template")

	writeTestFile(
		t,
		filepath.Join(templateDir, "frontend", "package.json"),
		"{\n  \"name\": \"starter\",\n  \"version\": \"0.1.0\"\n}\n",
	)
	writeTestFile(
		t,
		filepath.Join(templateDir, "frontend", "src", "app.ts"),
		"export const ok = true\n",
	)
	writeTestFile(t, filepath.Join(templateDir, "AGENTS.md"), "template guidance\n")

	t.Chdir(workdir)

	flags, err := clienv.Flags()
	if err != nil {
		t.Fatalf("Flags: %v", err)
	}

	var output bytes.Buffer

	cmd := &cli.Command{
		Name:      "nhost",
		Commands:  []*cli.Command{Command()},
		Flags:     flags,
		Writer:    &output,
		ErrWriter: &output,
	}

	if err := cmd.Run(
		context.Background(),
		[]string{"nhost", "create", "--template-path", templateDir, "--no-install", "my-app"},
	); err != nil {
		t.Fatalf("create command: %v\n%s", err, output.String())
	}

	projectDir := filepath.Join(workdir, "my-app")

	nhostToml := readTestFile(t, filepath.Join(projectDir, "backend", "nhost", "nhost.toml"))
	for _, want := range []string{
		"enabled = true",
		"clientUrl = 'http://localhost:3000'",
	} {
		if !strings.Contains(nhostToml, want) {
			t.Fatalf("nhost.toml missing %q:\n%s", want, nhostToml)
		}
	}

	if _, err := os.Stat(filepath.Join(projectDir, "backend", ".secrets")); err != nil {
		t.Fatalf("expected backend/.secrets to exist: %v", err)
	}

	if got := readTestFile(
		t,
		filepath.Join(projectDir, "frontend", "src", "app.ts"),
	); got != "export const ok = true\n" {
		t.Fatalf("frontend overlay = %q", got)
	}

	packageJSON := readTestFile(t, filepath.Join(projectDir, "frontend", "package.json"))
	if !strings.Contains(packageJSON, `"name": "my-app"`) {
		t.Fatalf("package.json name was not patched:\n%s", packageJSON)
	}
}

//nolint:paralleltest // mutates process cwd via t.Chdir
func TestCreateScaffoldsRealLocalTemplate(t *testing.T) {
	templateDir, err := filepath.Abs("../../../templates/nextjs-shadcn")
	if err != nil {
		t.Fatalf("resolve template path: %v", err)
	}

	workdir := t.TempDir()
	t.Chdir(workdir)

	var output bytes.Buffer

	cmd := newTestRootCommand(t, &output)
	if err := cmd.Run(
		context.Background(),
		[]string{
			"nhost",
			"create",
			"--template-path",
			templateDir,
			"--yes",
			"--no-install",
			"agent-ready-app",
		},
	); err != nil {
		t.Fatalf("create command: %v\n%s", err, output.String())
	}

	projectDir := filepath.Join(workdir, "agent-ready-app")
	for _, path := range []string{
		"backend/nhost/nhost.toml",
		"backend/.secrets",
		"backend/nhost/metadata/version.yaml",
		"backend/nhost/migrations/default/1700000000000_init_todos/up.sql",
		"frontend/codegen.ts",
		"frontend/schema.graphql",
		"CLAUDE.md",
		"AGENTS.md",
		".mcp.json",
		"README.md",
		".claude/skills/add-table/SKILL.md",
		".claude/skills/add-permission/SKILL.md",
		".claude/skills/create-function/SKILL.md",
		".claude/skills/refresh-context/SKILL.md",
	} {
		if _, err := os.Stat(filepath.Join(projectDir, filepath.FromSlash(path))); err != nil {
			t.Errorf("expected scaffold artifact %s: %v", path, err)
		}
	}

	gqlDir := filepath.Join(projectDir, "frontend", "src", "gql")

	gqlEntries, err := os.ReadDir(gqlDir)
	if err != nil {
		t.Fatalf("read generated GraphQL directory: %v", err)
	}

	if len(gqlEntries) == 0 {
		t.Fatal("frontend/src/gql is empty")
	}

	var packageJSON struct {
		Scripts map[string]string `json:"scripts"`
	}
	if err := json.Unmarshal(
		[]byte(readTestFile(t, filepath.Join(projectDir, "frontend", "package.json"))),
		&packageJSON,
	); err != nil {
		t.Fatalf("parse frontend/package.json: %v", err)
	}

	for _, script := range []string{"codegen", "codegen:schema", "codegen:types"} {
		if packageJSON.Scripts[script] == "" {
			t.Errorf("frontend/package.json missing %q script", script)
		}
	}

	assertNoGitDirs(t, projectDir)
}

func TestCreateFetchesTemplateFromLocalGitFixture(t *testing.T) {
	git := requireGit(t)
	workdir := t.TempDir()

	tmpDir := filepath.Join(workdir, "tmp")
	if err := os.MkdirAll(tmpDir, 0o755); err != nil {
		t.Fatalf("MkdirAll TMPDIR: %v", err)
	}

	t.Setenv("TMPDIR", tmpDir)

	fixture := createTemplateGitFixture(t, git, "template-branch")
	t.Chdir(workdir)

	var output bytes.Buffer

	cmd := newTestRootCommand(t, &output)
	if err := cmd.Run(
		context.Background(),
		[]string{
			"nhost",
			"create",
			"--templates-repo",
			"file://" + fixture,
			"--templates-ref",
			"template-branch",
			"--no-install",
			"my-app",
		},
	); err != nil {
		t.Fatalf("create command: %v\n%s", err, output.String())
	}

	projectDir := filepath.Join(workdir, "my-app")

	packageJSON := readTestFile(t, filepath.Join(projectDir, "frontend", "package.json"))
	if !strings.Contains(packageJSON, `"name": "my-app"`) {
		t.Fatalf("package.json name was not patched:\n%s", packageJSON)
	}

	if got := readTestFile(
		t,
		filepath.Join(projectDir, "frontend", "src", "app.ts"),
	); got != "export const ok = true\n" {
		t.Fatalf("frontend file = %q", got)
	}

	assertNoGitDirs(t, projectDir)
	assertNoTemplateTempClones(t, tmpDir)
}

func TestCreateCleansUpAfterGitFetchFailure(t *testing.T) {
	git := requireGit(t)
	workdir := t.TempDir()

	tmpDir := filepath.Join(workdir, "tmp")
	if err := os.MkdirAll(tmpDir, 0o755); err != nil {
		t.Fatalf("MkdirAll TMPDIR: %v", err)
	}

	t.Setenv("TMPDIR", tmpDir)

	fixture := createTemplateGitFixture(t, git, "template-branch")
	t.Chdir(workdir)

	var output bytes.Buffer

	cmd := newTestRootCommand(t, &output)

	err := cmd.Run(
		context.Background(),
		[]string{
			"nhost",
			"create",
			"--templates-repo",
			"file://" + fixture,
			"--templates-ref",
			"missing-branch",
			"--no-install",
			"broken-app",
		},
	)
	if err == nil {
		t.Fatal("create command succeeded; want git fetch failure")
	}

	if _, statErr := os.Stat(
		filepath.Join(workdir, "broken-app"),
	); !errors.Is(
		statErr,
		os.ErrNotExist,
	) {
		t.Fatalf("target directory exists after failure: %v", statErr)
	}

	assertNoTemplateTempClones(t, tmpDir)
}

//nolint:paralleltest // mutates package-level gitLookPath test seam
func TestFetchTemplateGitNotInstalled(t *testing.T) {
	oldGitLookPath := gitLookPath
	gitLookPath = func(string) (string, error) {
		return "", exec.ErrNotFound
	}
	t.Cleanup(func() { gitLookPath = oldGitLookPath })

	err := fetchTemplate(
		context.Background(),
		nil,
		"file:///tmp/templates",
		"main",
		template{name: "nextjs-shadcn"},
		t.TempDir(),
	)
	if err == nil {
		t.Fatal("fetchTemplate succeeded; want git-not-installed error")
	}

	msg := err.Error()
	for _, want := range []string{"git is required", "install git", "--template-path"} {
		if !strings.Contains(msg, want) {
			t.Fatalf("error %q missing %q", msg, want)
		}
	}
}

func TestValidateName(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		wantErr bool
	}{
		{name: "myapp", wantErr: false},
		{name: "my-app", wantErr: false},
		{name: "my_app", wantErr: false},
		{name: "App123", wantErr: false},
		{name: "a.b", wantErr: false},
		{name: "", wantErr: true},
		{name: ".", wantErr: true},
		{name: "..", wantErr: true},
		{name: "my app", wantErr: true},
		{name: "my/app", wantErr: true},
		{name: "../escape", wantErr: true},
		{name: "foo*bar", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			err := validateName(tt.name)
			if (err != nil) != tt.wantErr {
				t.Fatalf("validateName(%q) error = %v, wantErr %v", tt.name, err, tt.wantErr)
			}
		})
	}
}

func TestValidatePackageManager(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		wantErr bool
	}{
		{name: "pnpm", wantErr: false},
		{name: "npm", wantErr: false},
		{name: "bun", wantErr: false},
		{name: "yarn", wantErr: false},
		{name: "", wantErr: true},
		{name: "PNPM", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			err := validatePackageManager(tt.name)
			if (err != nil) != tt.wantErr {
				t.Fatalf(
					"validatePackageManager(%q) error = %v, wantErr %v",
					tt.name,
					err,
					tt.wantErr,
				)
			}
		})
	}
}

func TestSafeJoin(t *testing.T) {
	t.Parallel()

	base := t.TempDir()
	tests := []struct {
		name    string
		wantErr bool
	}{
		{name: "a/b.txt", wantErr: false},
		{name: "./c.txt", wantErr: false},
		{name: "frontend/package.json", wantErr: false},
		{name: "../evil", wantErr: true},
		{name: "../../evil", wantErr: true},
		{name: "/etc/passwd", wantErr: true},
		{name: "a/../../evil", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			_, err := safeJoin(base, tt.name)
			if (err != nil) != tt.wantErr {
				t.Fatalf("safeJoin(%q) error = %v, wantErr %v", tt.name, err, tt.wantErr)
			}
		})
	}
}

func TestPatchPackageJSONName(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	path := filepath.Join(dir, "package.json")
	original := "{\n  \"name\": \"nextjs-shadcn\",\n  \"version\": \"0.1.0\"\n}\n"

	if err := os.WriteFile(path, []byte(original), 0o600); err != nil {
		t.Fatal(err)
	}

	if err := patchPackageJSONName(path, "my-app"); err != nil {
		t.Fatalf("patchPackageJSONName: %v", err)
	}

	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}

	want := "{\n  \"name\": \"my-app\",\n  \"version\": \"0.1.0\"\n}\n"
	if string(got) != want {
		t.Errorf("patched package.json = %q, want %q", got, want)
	}
}

func TestCopyDirMakesReadOnlySourceWritable(t *testing.T) {
	t.Parallel()

	src := t.TempDir()
	writeTestFile(t, filepath.Join(src, "package.json"), "{\n  \"name\": \"x\"\n}\n")
	writeTestFile(t, filepath.Join(src, "nested", "app.ts"), "export const ok = true\n")

	// Simulate a read-only template source, e.g. files copied from the
	// read-only Nix store during the cli check, which is what broke scaffolding.
	rels := []string{"package.json", filepath.Join("nested", "app.ts")}
	for _, rel := range rels {
		if err := os.Chmod(filepath.Join(src, rel), 0o444); err != nil {
			t.Fatalf("Chmod %s: %v", rel, err)
		}
	}

	dst := filepath.Join(t.TempDir(), "out")
	if err := copyDir(src, dst); err != nil {
		t.Fatalf("copyDir: %v", err)
	}

	for _, rel := range rels {
		p := filepath.Join(dst, rel)

		info, err := os.Stat(p)
		if err != nil {
			t.Fatalf("Stat %s: %v", rel, err)
		}

		if info.Mode().Perm()&0o200 == 0 {
			t.Errorf("copied %s is not owner-writable: mode %v", rel, info.Mode().Perm())
		}

		// Postprocessing rewrites files such as package.json after copying, so
		// the copy must actually be writable, not merely flagged writable.
		if err := os.WriteFile(p, []byte("rewritten\n"), info.Mode().Perm()); err != nil {
			t.Errorf("rewrite %s: %v", rel, err)
		}
	}
}

func newTestRootCommand(t *testing.T, output *bytes.Buffer) *cli.Command {
	t.Helper()

	flags, err := clienv.Flags()
	if err != nil {
		t.Fatalf("Flags: %v", err)
	}

	return &cli.Command{
		Name:      "nhost",
		Commands:  []*cli.Command{Command()},
		Flags:     flags,
		Writer:    output,
		ErrWriter: output,
	}
}

func requireGit(t *testing.T) string {
	t.Helper()

	git, err := exec.LookPath("git")
	if err != nil {
		t.Skipf("git not found on PATH: %v", err)
	}

	return git
}

func createTemplateGitFixture(t *testing.T, git string, branch string) string {
	t.Helper()

	fixture := filepath.Join(t.TempDir(), "templates-repo")
	if err := os.MkdirAll(fixture, 0o755); err != nil {
		t.Fatalf("MkdirAll fixture: %v", err)
	}

	runGit(t, git, fixture, "init")
	runGit(t, git, fixture, "checkout", "-b", branch)
	runGit(t, git, fixture, "config", "user.email", "create-test@example.com")
	runGit(t, git, fixture, "config", "user.name", "Create Test")

	writeTestFile(
		t,
		filepath.Join(fixture, "templates", "nextjs-shadcn", "frontend", "package.json"),
		"{\n  \"name\": \"starter\",\n  \"version\": \"0.1.0\"\n}\n",
	)
	writeTestFile(
		t,
		filepath.Join(fixture, "templates", "nextjs-shadcn", "frontend", "src", "app.ts"),
		"export const ok = true\n",
	)
	runGit(t, git, fixture, "add", ".")
	runGit(t, git, fixture, "commit", "-m", "add template")

	return fixture
}

func runGit(t *testing.T, git string, dir string, args ...string) {
	t.Helper()

	cmd := exec.CommandContext(context.Background(), git, args...)
	cmd.Dir = dir

	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %s failed: %v\n%s", strings.Join(args, " "), err, out)
	}
}

func assertNoGitDirs(t *testing.T, root string) {
	t.Helper()

	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() && d.Name() == ".git" {
			t.Fatalf("found .git directory under generated project: %s", path)
		}

		return nil
	})
	if err != nil {
		t.Fatalf("WalkDir(%s): %v", root, err)
	}
}

func assertNoTemplateTempClones(t *testing.T, tmpDir string) {
	t.Helper()

	entries, err := os.ReadDir(tmpDir)
	if err != nil {
		t.Fatalf("ReadDir(%s): %v", tmpDir, err)
	}

	for _, entry := range entries {
		if strings.HasPrefix(entry.Name(), "nhost-create-template-") {
			t.Fatalf("temporary clone was not removed: %s", filepath.Join(tmpDir, entry.Name()))
		}
	}
}

func writeTestFile(t *testing.T, path string, data string) {
	t.Helper()

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}

	if err := os.WriteFile(path, []byte(data), 0o600); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
}

func readTestFile(t *testing.T, path string) string {
	t.Helper()

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile(%s): %v", path, err)
	}

	return string(data)
}

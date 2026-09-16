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
		filepath.Join(projectDir, "backend", "nhost", "project-name"),
	); got != "my-app\n" {
		t.Fatalf("backend/nhost/project-name = %q", got)
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

	assertNoStagingLeftovers(t, workdir, "my-app")
}

//nolint:paralleltest // mutates process cwd via t.Chdir
func TestCreateRejectsTemplatePathThatIsNotADirectory(t *testing.T) {
	workdir := t.TempDir()
	templateFile := filepath.Join(workdir, "template.tar")

	writeTestFile(t, templateFile, "not a directory\n")
	t.Chdir(workdir)

	var output bytes.Buffer

	cmd := newTestRootCommand(t, &output)

	err := cmd.Run(
		context.Background(),
		[]string{"nhost", "create", "--template-path", templateFile, "--no-install", "my-app"},
	)
	if err == nil {
		t.Fatalf("create succeeded with a file as --template-path\n%s", output.String())
	}

	if !errors.Is(err, errTemplateNotDirectory) {
		t.Errorf("error = %v, want errTemplateNotDirectory", err)
	}

	// The message has to name the flag value, not the staging path the copy
	// would have failed against later.
	if !strings.Contains(err.Error(), templateFile) {
		t.Errorf("error %v does not name --template-path %s", err, templateFile)
	}

	assertNoStagingLeftovers(t, workdir, "my-app")
}

// `--template-path ~/templates/current`, where `current` is a symlink to the
// real template, is ordinary developer setup for the flag's offline/dev
// audience. filepath.WalkDir does not descend into a symlinked root, so the
// copy has to resolve it first or it silently copies nothing.
//
//nolint:paralleltest // mutates process cwd via t.Chdir
func TestCreateFollowsSymlinkedTemplatePath(t *testing.T) {
	workdir := t.TempDir()
	templateDir := filepath.Join(workdir, "template-v2")

	writeTestFile(
		t,
		filepath.Join(templateDir, "frontend", "package.json"),
		"{\n  \"name\": \"starter\"\n}\n",
	)
	writeTestFile(
		t,
		filepath.Join(templateDir, "frontend", "src", "app.ts"),
		"export const ok = true\n",
	)

	link := filepath.Join(workdir, "current")
	if err := os.Symlink(templateDir, link); err != nil {
		t.Fatalf("Symlink: %v", err)
	}

	t.Chdir(workdir)

	var output bytes.Buffer

	cmd := newTestRootCommand(t, &output)
	if err := cmd.Run(
		context.Background(),
		[]string{"nhost", "create", "--template-path", link, "--no-install", "my-app"},
	); err != nil {
		t.Fatalf("create command: %v\n%s", err, output.String())
	}

	if got := readTestFile(
		t,
		filepath.Join(workdir, "my-app", "frontend", "src", "app.ts"),
	); got != "export const ok = true\n" {
		t.Fatalf("frontend overlay = %q", got)
	}

	packageJSON := readTestFile(t, filepath.Join(workdir, "my-app", "frontend", "package.json"))
	if !strings.Contains(packageJSON, `"name": "my-app"`) {
		t.Fatalf("package.json name was not patched:\n%s", packageJSON)
	}
}

// The generated backend always sits in a directory called `backend`, so the
// docker compose project name cannot come from the directory name without every
// created project sharing one set of containers and one Postgres volume.
//
//nolint:paralleltest // mutates process cwd via t.Chdir
func TestCreatedProjectsGetDistinctComposeProjectNames(t *testing.T) {
	workdir := t.TempDir()
	templateDir := filepath.Join(workdir, "template")

	writeTestFile(
		t,
		filepath.Join(templateDir, "frontend", "package.json"),
		"{\n  \"name\": \"starter\"\n}\n",
	)

	t.Chdir(workdir)

	var output bytes.Buffer

	for _, name := range []string{"First-App", "second-app"} {
		cmd := newTestRootCommand(t, &output)
		if err := cmd.Run(
			context.Background(),
			[]string{"nhost", "create", "--template-path", templateDir, "--no-install", name},
		); err != nil {
			t.Fatalf("create %s: %v\n%s", name, err, output.String())
		}
	}

	first := composeProjectName(t, filepath.Join(workdir, "First-App", "backend"))
	second := composeProjectName(t, filepath.Join(workdir, "second-app", "backend"))

	if first != "first-app" {
		t.Errorf("project name in First-App/backend = %q, want %q", first, "first-app")
	}

	if second != "second-app" {
		t.Errorf("project name in second-app/backend = %q, want %q", second, "second-app")
	}
}

// composeProjectName reports the docker compose project name `nhost up` would
// use in dir, resolving the global flags exactly as the real CLI does.
func composeProjectName(t *testing.T, dir string) string {
	t.Helper()

	t.Chdir(dir)

	var output bytes.Buffer

	flags, err := clienv.Flags()
	if err != nil {
		t.Fatalf("Flags: %v", err)
	}

	var name string

	cmd := &cli.Command{
		Name:  "nhost",
		Flags: flags,
		Commands: []*cli.Command{
			{
				Name: "show",
				Action: func(_ context.Context, cmd *cli.Command) error {
					name = clienv.FromCLI(cmd).ProjectName()
					return nil
				},
			},
		},
		Writer:    &output,
		ErrWriter: &output,
	}

	if err := cmd.Run(context.Background(), []string{"nhost", "show"}); err != nil {
		t.Fatalf("resolve project name in %s: %v\n%s", dir, err, output.String())
	}

	return name
}

//nolint:paralleltest // mutates process cwd via t.Chdir
func TestCreatePnpmLockfileByPackageManager(t *testing.T) {
	tests := []struct {
		name                string
		packageManager      string
		templateHasLockfile bool
		wantLockfile        bool
	}{
		{
			name:                "pnpm keeps the lockfile",
			packageManager:      "pnpm",
			templateHasLockfile: true,
			wantLockfile:        true,
		},
		{
			name:                "npm drops the lockfile",
			packageManager:      "npm",
			templateHasLockfile: true,
			wantLockfile:        false,
		},
		{
			name:                "bun drops the lockfile",
			packageManager:      "bun",
			templateHasLockfile: true,
			wantLockfile:        false,
		},
		{
			name:                "yarn drops the lockfile",
			packageManager:      "yarn",
			templateHasLockfile: true,
			wantLockfile:        false,
		},
		{
			name:                "npm tolerates a template without a lockfile",
			packageManager:      "npm",
			templateHasLockfile: false,
			wantLockfile:        false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			workdir := t.TempDir()
			templateDir := filepath.Join(workdir, "template")

			writeTestFile(
				t,
				filepath.Join(templateDir, "frontend", "package.json"),
				"{\n  \"name\": \"starter\"\n}\n",
			)

			if tt.templateHasLockfile {
				writeTestFile(
					t,
					filepath.Join(templateDir, "frontend", "pnpm-lock.yaml"),
					"lockfileVersion: '9.0'\n",
				)
			}

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
					"--package-manager",
					tt.packageManager,
					"--no-install",
					"my-app",
				},
			); err != nil {
				t.Fatalf("create command: %v\n%s", err, output.String())
			}

			lockfile := filepath.Join(workdir, "my-app", "frontend", "pnpm-lock.yaml")

			_, statErr := os.Stat(lockfile)
			switch {
			case tt.wantLockfile && statErr != nil:
				t.Fatalf("pnpm-lock.yaml was not kept for %s: %v", tt.packageManager, statErr)
			case !tt.wantLockfile && !errors.Is(statErr, os.ErrNotExist):
				t.Fatalf(
					"pnpm-lock.yaml was not removed for %s: stat error = %v",
					tt.packageManager, statErr,
				)
			}

			assertNoStagingLeftovers(t, workdir, "my-app")
		})
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
	assertNoStagingLeftovers(t, workdir, "agent-ready-app")
}

// The scaffolded Markdown is the instruction set an agent follows literally, so
// a project created with another package manager must not be told to run pnpm:
// `pnpm install` would write a second lockfile next to the one that manager
// owns.
//
//nolint:paralleltest // mutates process cwd via t.Chdir
func TestCreateRetargetsRealTemplateDocs(t *testing.T) {
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
			"--package-manager",
			"npm",
			"--yes",
			"--no-install",
			"npm-app",
		},
	); err != nil {
		t.Fatalf("create command: %v\n%s", err, output.String())
	}

	projectDir := filepath.Join(workdir, "npm-app")

	var packageJSON struct {
		Scripts map[string]string `json:"scripts"`
	}
	if err := json.Unmarshal(
		[]byte(readTestFile(t, filepath.Join(projectDir, "frontend", "package.json"))),
		&packageJSON,
	); err != nil {
		t.Fatalf("parse frontend/package.json: %v", err)
	}

	forbidden := make([]string, 0, len(packageJSON.Scripts)+1)
	forbidden = append(forbidden, "pnpm install")

	for script := range packageJSON.Scripts {
		forbidden = append(forbidden, "pnpm "+script)
	}

	for _, doc := range []string{
		"AGENTS.md",
		"CLAUDE.md",
		"README.md",
		"SKILLS.md",
		".claude/skills/add-table/SKILL.md",
		".claude/skills/add-permission/SKILL.md",
		".claude/skills/refresh-context/SKILL.md",
	} {
		content := readTestFile(t, filepath.Join(projectDir, filepath.FromSlash(doc)))
		for _, command := range forbidden {
			if strings.Contains(content, command) {
				t.Errorf("%s still tells the agent to run %q", doc, command)
			}
		}
	}

	agents := readTestFile(t, filepath.Join(projectDir, "AGENTS.md"))
	for _, want := range []string{"npm install", "npm run codegen", "npm run lint"} {
		if !strings.Contains(agents, want) {
			t.Errorf("AGENTS.md is missing %q", want)
		}
	}
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
	assertNoStagingLeftovers(t, workdir, "my-app")
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

	msg := err.Error()
	for _, want := range []string{"--templates-ref", "NHOST_CREATE_TEMPLATES_REF"} {
		if !strings.Contains(msg, want) {
			t.Fatalf("error %q missing %q", msg, want)
		}
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
	assertNoStagingLeftovers(t, workdir, "broken-app")
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
		{name: "...", wantErr: true},
		{name: ".hidden", wantErr: true},
		{name: "-dash", wantErr: true},
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

// copyDir writes through an os.Root, so a symlinked directory already sitting
// under the destination cannot redirect the copy out of it — a plain
// MkdirAll/OpenFile pair follows such a link happily.
func TestCopyDirRefusesSymlinkedDestinationDirs(t *testing.T) {
	t.Parallel()

	src := t.TempDir()
	writeTestFile(t, filepath.Join(src, "frontend", "package.json"), "{\n  \"name\": \"x\"\n}\n")

	outside := t.TempDir()

	dst := filepath.Join(t.TempDir(), "out")
	if err := os.MkdirAll(dst, 0o755); err != nil {
		t.Fatal(err)
	}

	if err := os.Symlink(outside, filepath.Join(dst, "frontend")); err != nil {
		t.Fatalf("Symlink: %v", err)
	}

	if err := copyDir(src, dst); err == nil {
		t.Error("copyDir followed a symlinked destination directory")
	}

	if _, err := os.Stat(
		filepath.Join(outside, "package.json"),
	); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("copyDir wrote outside the destination: %v", err)
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

func TestRetargetPackageManagerDocs(t *testing.T) {
	t.Parallel()

	// The last line pins the other half of the contract: only real commands are
	// rewritten, so prose that merely mentions pnpm survives intact.
	const agents = "Install with `pnpm install`, then run `pnpm codegen:types`.\n" +
		"`pnpm dev` starts the app; `pnpm lint` and `pnpm build` validate it.\n" +
		"The upstream template is developed with pnpm workspaces.\n"

	const skill = "(cd frontend && pnpm codegen)\n"

	tests := []struct {
		name       string
		pm         string
		wantAgents string
		wantSkill  string
	}{
		{
			name: "npm",
			pm:   "npm",
			wantAgents: "Install with `npm install`, then run `npm run codegen:types`.\n" +
				"`npm run dev` starts the app; `npm run lint` and `npm run build` validate it.\n" +
				"The upstream template is developed with pnpm workspaces.\n",
			wantSkill: "(cd frontend && npm run codegen)\n",
		},
		{
			name: "yarn",
			pm:   "yarn",
			wantAgents: "Install with `yarn install`, then run `yarn run codegen:types`.\n" +
				"`yarn run dev` starts the app; `yarn run lint` and `yarn run build` validate it.\n" +
				"The upstream template is developed with pnpm workspaces.\n",
			wantSkill: "(cd frontend && yarn run codegen)\n",
		},
		{
			name:       "pnpm leaves the docs byte-identical",
			pm:         "pnpm",
			wantAgents: agents,
			wantSkill:  skill,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			root := t.TempDir()
			writeTestFile(
				t,
				filepath.Join(root, "frontend", "package.json"),
				`{"name":"app","scripts":{"dev":"next dev","build":"next build",`+
					`"lint":"biome check .","codegen":"x","codegen:types":"y"}}`,
			)
			writeTestFile(t, filepath.Join(root, "AGENTS.md"), agents)
			writeTestFile(
				t,
				filepath.Join(root, ".claude", "skills", "add-table", "SKILL.md"),
				skill,
			)

			if err := retargetPackageManagerDocs(root, tt.pm); err != nil {
				t.Fatalf("retargetPackageManagerDocs: %v", err)
			}

			if got := readTestFile(t, filepath.Join(root, "AGENTS.md")); got != tt.wantAgents {
				t.Errorf("AGENTS.md =\n%s\nwant\n%s", got, tt.wantAgents)
			}

			if got := readTestFile(
				t,
				filepath.Join(root, ".claude", "skills", "add-table", "SKILL.md"),
			); got != tt.wantSkill {
				t.Errorf("SKILL.md = %q, want %q", got, tt.wantSkill)
			}
		})
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

// assertNoStagingLeftovers pins the invariant stageProject exists to protect:
// the `.<name>.partial-*` directory it stages into never survives in the user's
// working directory, on either the success or the failure path.
func assertNoStagingLeftovers(t *testing.T, dir string, name string) {
	t.Helper()

	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("ReadDir(%s): %v", dir, err)
	}

	prefix := "." + name + ".partial-"
	for _, entry := range entries {
		if strings.HasPrefix(entry.Name(), prefix) {
			t.Fatalf("staging directory was not removed: %s", filepath.Join(dir, entry.Name()))
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

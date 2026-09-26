package create

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/dockercompose"
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
	withStdin(t, "")

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

	assertNoStagingLeftovers(t, filepath.Join(workdir, "my-app"))
}

// A project named after the directory it is being created in is built right
// there rather than one level down: you made that directory for it. Whatever is
// already there and does not clash stays.
//
//nolint:paralleltest // mutates process cwd via t.Chdir
func TestCreateScaffoldsIntoTheDirectoryThatMatchesTheName(t *testing.T) {
	workdir := t.TempDir()
	templateDir := filepath.Join(workdir, "template")

	writeTestFile(
		t,
		filepath.Join(templateDir, "frontend", "package.json"),
		"{\n  \"name\": \"starter\",\n  \"version\": \"0.1.0\"\n}\n",
	)

	projectDir := filepath.Join(workdir, "my-app")
	writeTestFile(t, filepath.Join(projectDir, "README.md"), "notes I wrote\n")
	writeTestFile(t, filepath.Join(projectDir, ".git", "HEAD"), "ref: refs/heads/main\n")

	t.Chdir(projectDir)

	var output bytes.Buffer

	cmd := newTestRootCommand(t, &output)

	if err := cmd.Run(context.Background(), []string{
		"nhost", "create",
		"--template-path", templateDir, "--no-install", "--name", "my-app",
	}); err != nil {
		t.Fatalf("create command: %v\n%s", err, output.String())
	}

	if _, err := os.Stat(
		filepath.Join(projectDir, "backend", "nhost", "nhost.toml"),
	); err != nil {
		t.Fatalf("expected the backend in the current directory: %v\n%s", err, output.String())
	}

	if _, err := os.Stat(filepath.Join(projectDir, "my-app")); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("create made a subdirectory instead of scaffolding here: %v", err)
	}

	if got := readTestFile(
		t, filepath.Join(projectDir, "backend", "nhost", "project-name"),
	); got != "my-app\n" {
		t.Errorf("project name = %q, want the directory's name", got)
	}

	if got := readTestFile(t, filepath.Join(projectDir, "README.md")); got != "notes I wrote\n" {
		t.Errorf("create clobbered an unrelated file: %q", got)
	}

	if _, err := os.Stat(filepath.Join(projectDir, ".git", "HEAD")); err != nil {
		t.Errorf("create did not leave the repo alone: %v", err)
	}

	// The commands handed back have to work from where the user is standing,
	// and here that is inside the project rather than above it.
	if !strings.Contains(output.String(), "cd backend && nhost up") {
		t.Errorf("next steps do not cd from the current directory:\n%s", output.String())
	}

	assertNoStagingLeftovers(t, projectDir)
}

// Scaffolding alongside existing files is the point, so the refusal has to be
// narrow: only a name the template would land on top of stops the create, and
// when it does the directory is left exactly as it was.
//
// Naming a project something other than the directory you are standing in
// makes that directory, so a create from a scratch directory does not empty
// the project into it.
//
//nolint:paralleltest // mutates process cwd via t.Chdir
func TestCreateMakesADirectoryForANameOfItsOwn(t *testing.T) {
	workdir := t.TempDir()
	templateDir := filepath.Join(workdir, "template")

	writeTestFile(
		t,
		filepath.Join(templateDir, "frontend", "package.json"),
		"{\n  \"name\": \"starter\"\n}\n",
	)

	scratch := filepath.Join(workdir, "nhost-create-test")
	if err := os.MkdirAll(scratch, 0o755); err != nil {
		t.Fatalf("make scratch: %v", err)
	}

	t.Chdir(scratch)

	var output bytes.Buffer

	cmd := newTestRootCommand(t, &output)

	if err := cmd.Run(context.Background(), []string{
		"nhost", "create",
		"--template-path", templateDir, "--no-install", "--name", "skate-app",
	}); err != nil {
		t.Fatalf("create command: %v\n%s", err, output.String())
	}

	projectDir := filepath.Join(scratch, "skate-app")

	if _, err := os.Stat(
		filepath.Join(projectDir, "backend", "nhost", "nhost.toml"),
	); err != nil {
		t.Fatalf("expected the project in a directory of its own: %v\n%s", err, output.String())
	}

	if _, err := os.Stat(filepath.Join(scratch, "backend")); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("create emptied the project into the current directory: %v", err)
	}

	if !strings.Contains(output.String(), "cd skate-app/backend && nhost up") {
		t.Errorf("next steps do not cd into the new directory:\n%s", output.String())
	}

	assertNoStagingLeftovers(t, projectDir)
}

// A directory given on the command line is the target as typed, so a name that
// differs from it does not nest a second directory inside it.
//
//nolint:paralleltest // mutates process cwd via t.Chdir
func TestCreateDoesNotNestInsideAGivenDirectory(t *testing.T) {
	workdir := t.TempDir()
	templateDir := filepath.Join(workdir, "template")

	writeTestFile(
		t,
		filepath.Join(templateDir, "frontend", "package.json"),
		"{\n  \"name\": \"starter\"\n}\n",
	)

	t.Chdir(workdir)

	var output bytes.Buffer

	cmd := newTestRootCommand(t, &output)

	if err := cmd.Run(context.Background(), []string{
		"nhost", "create",
		"--template-path", templateDir, "--no-install", "--name", "skate-app", "somewhere",
	}); err != nil {
		t.Fatalf("create command: %v\n%s", err, output.String())
	}

	projectDir := filepath.Join(workdir, "somewhere")

	if got := readTestFile(
		t, filepath.Join(projectDir, "backend", "nhost", "project-name"),
	); got != "skate-app\n" {
		t.Errorf("project name = %q, want the name that was asked for", got)
	}

	if _, err := os.Stat(
		filepath.Join(projectDir, "skate-app"),
	); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("create nested a directory inside the one it was given: %v", err)
	}
}

//nolint:paralleltest // mutates process cwd via t.Chdir
func TestCreateRefusesToLandOnExistingEntries(t *testing.T) {
	workdir := t.TempDir()
	templateDir := filepath.Join(workdir, "template")

	writeTestFile(
		t,
		filepath.Join(templateDir, "frontend", "package.json"),
		"{\n  \"name\": \"starter\",\n  \"version\": \"0.1.0\"\n}\n",
	)

	projectDir := filepath.Join(workdir, "occupied")
	writeTestFile(t, filepath.Join(projectDir, "frontend", "page.tsx"), "my own frontend\n")

	t.Chdir(projectDir)

	var output bytes.Buffer

	cmd := newTestRootCommand(t, &output)

	err := cmd.Run(context.Background(), []string{
		"nhost", "create",
		"--template-path", templateDir, "--no-install", "--name", "occupied",
	})
	if !errors.Is(err, errTargetConflict) {
		t.Fatalf("create error = %v, want a conflict\n%s", err, output.String())
	}

	if !strings.Contains(err.Error(), "frontend") {
		t.Errorf("error does not name what clashed: %v", err)
	}

	if got := readTestFile(
		t, filepath.Join(projectDir, "frontend", "page.tsx"),
	); got != "my own frontend\n" {
		t.Errorf("refused create still modified the directory: %q", got)
	}

	if _, err := os.Stat(
		filepath.Join(projectDir, "backend"),
	); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("refused create still scaffolded the backend: %v", err)
	}

	assertNoStagingLeftovers(t, projectDir)
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

	assertNoStagingLeftovers(t, filepath.Join(workdir, "my-app"))
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

// Two names that differ only by a dot are two projects. Dropping the dot made
// `my.app` and `myapp` resolve to one compose project, so the second `nhost up`
// would attach to the first project's containers and Postgres volume.
//
//nolint:paralleltest // mutates process cwd via t.Chdir
func TestCreatedProjectsWithDottedNamesDoNotShareAComposeProject(t *testing.T) {
	workdir := t.TempDir()
	templateDir := filepath.Join(workdir, "template")

	writeTestFile(
		t,
		filepath.Join(templateDir, "frontend", "package.json"),
		"{\n  \"name\": \"starter\"\n}\n",
	)

	t.Chdir(workdir)

	var output bytes.Buffer

	for _, name := range []string{"my.app", "myapp"} {
		cmd := newTestRootCommand(t, &output)
		if err := cmd.Run(
			context.Background(),
			[]string{"nhost", "create", "--template-path", templateDir, "--no-install", name},
		); err != nil {
			t.Fatalf("create %s: %v\n%s", name, err, output.String())
		}
	}

	dotted := composeProjectName(t, filepath.Join(workdir, "my.app", "backend"))
	plain := composeProjectName(t, filepath.Join(workdir, "myapp", "backend"))

	if dotted == plain {
		t.Fatalf(
			"my.app and myapp both resolve to compose project %q, so they would share one Postgres volume",
			dotted,
		)
	}

	if dotted != "my-app" {
		t.Errorf("project name in my.app/backend = %q, want %q", dotted, "my-app")
	}

	if plain != "myapp" {
		t.Errorf("project name in myapp/backend = %q, want %q", plain, "myapp")
	}
}

// The resolved name reaches docker compose as `-p <name>`, and an empty one is
// not a refusal: compose reads `-p ""` as no project name at all, falls back to
// naming the project after --project-directory, and normalises that name by
// trimming the very leading `_` and `-` this CLI refuses to trim. A directory
// named `_myapp` therefore came up as `myapp` and took over a sibling project's
// containers and Postgres volume, where it used to be refused out loud. No
// `nhost create` is needed to get there -- `nhost init` in such a directory is
// enough -- so the argv is checked against the directory names themselves.
//
//nolint:paralleltest // mutates process cwd via t.Chdir and PATH via t.Setenv
func TestComposeArgvNeverCarriesAnEmptyProjectName(t *testing.T) {
	tests := []struct {
		name string
		dir  string
		want string
	}{
		{name: "a name compose accepts", dir: "myapp", want: "myapp"},
		{name: "a leading underscore", dir: "_myapp", want: "_myapp"},
		{name: "a leading dash", dir: "-myapp", want: "-myapp"},
		{name: "nothing compose can hold", dir: "\u65e5\u672c\u8a9e", want: "\u65e5\u672c\u8a9e"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := filepath.Join(t.TempDir(), tt.dir)
			if err := os.MkdirAll(dir, 0o755); err != nil {
				t.Fatalf("MkdirAll: %v", err)
			}

			argv := dockerArgv(t, dir, composeProjectName(t, dir))

			i := slices.Index(argv, "-p")
			if i < 0 || i == len(argv)-1 {
				t.Fatalf("docker argv carries no project name: %q", argv)
			}

			if argv[i+1] == "" {
				t.Fatalf(
					"docker argv in %s carries an empty -p, which leaves compose to name the project: %q",
					tt.dir,
					argv,
				)
			}

			if argv[i+1] != tt.want {
				t.Errorf("docker argv in %s carries -p %q, want %q", tt.dir, argv[i+1], tt.want)
			}
		})
	}
}

// dockerArgv runs a docker compose command with a stub `docker` alone on PATH
// and returns the argv it was handed, which is the only place the project name
// can be seen as compose sees it. One line per argument keeps an argument that
// is the empty string visible.
func dockerArgv(t *testing.T, workingDir, projectName string) []string {
	t.Helper()

	binDir := t.TempDir()
	argvFile := filepath.Join(binDir, "argv")
	stub := filepath.Join(binDir, "docker")

	writeTestFile(t, stub, fmt.Sprintf("#!/bin/sh\nprintf '%%s\\n' \"$@\" > %q\n", argvFile))

	if err := os.Chmod(stub, 0o755); err != nil {
		t.Fatalf("chmod docker stub: %v", err)
	}

	t.Setenv("PATH", binDir)

	dc := dockercompose.New(
		workingDir,
		filepath.Join(workingDir, "docker-compose.yaml"),
		projectName,
	)
	if err := dc.Wrapper(context.Background(), "config"); err != nil {
		t.Fatalf("run docker compose through the stub: %v", err)
	}

	return strings.Split(strings.TrimSuffix(readTestFile(t, argvFile), "\n"), "\n")
}

// An install that fails is a warning, not a failed create: the project is on
// disk either way, so the command succeeds and the next steps tell the user to
// run the install themselves.
//
//nolint:paralleltest // mutates process cwd and the runInstallFn test seam
func TestCreateWarnsButSucceedsWhenInstallFails(t *testing.T) {
	workdir := t.TempDir()
	templateDir := filepath.Join(workdir, "template")

	writeTestFile(
		t,
		filepath.Join(templateDir, "frontend", "package.json"),
		"{\n  \"name\": \"starter\"\n}\n",
	)

	stubInstall(t, func(context.Context, string, string) error {
		return errStubInstall
	})

	t.Chdir(workdir)

	var output bytes.Buffer

	cmd := newTestRootCommand(t, &output)
	if err := cmd.Run(
		context.Background(),
		[]string{"nhost", "create", "--template-path", templateDir, "my-app"},
	); err != nil {
		t.Fatalf("create command = %v, want nil after a failed install\n%s", err, output.String())
	}

	got := output.String()

	if !strings.Contains(got, "Could not install dependencies") {
		t.Errorf("output missing the failed-install warning:\n%s", got)
	}

	// The frontend has no dependencies, so the next steps have to put the
	// install back.
	if !strings.Contains(got, "pnpm install && pnpm dev") {
		t.Errorf("next steps missing `pnpm install && pnpm dev`:\n%s", got)
	}
}

//nolint:paralleltest // mutates process cwd and the runInstallFn test seam
func TestCreateOmitsInstallFromNextStepsAfterASuccessfulInstall(t *testing.T) {
	workdir := t.TempDir()
	templateDir := filepath.Join(workdir, "template")

	writeTestFile(
		t,
		filepath.Join(templateDir, "frontend", "package.json"),
		"{\n  \"name\": \"starter\"\n}\n",
	)

	var (
		calledDir string
		calledPM  string
	)

	stubInstall(t, func(_ context.Context, pm, dir string) error {
		calledPM, calledDir = pm, dir

		return nil
	})

	t.Chdir(workdir)

	var output bytes.Buffer

	cmd := newTestRootCommand(t, &output)
	if err := cmd.Run(
		context.Background(),
		[]string{"nhost", "create", "--template-path", templateDir, "my-app"},
	); err != nil {
		t.Fatalf("create command: %v\n%s", err, output.String())
	}

	if calledPM != "pnpm" {
		t.Errorf("install ran with package manager %q, want %q", calledPM, "pnpm")
	}

	if want := filepath.Join(workdir, "my-app", "frontend"); calledDir != want {
		t.Errorf("install ran in %q, want %q", calledDir, want)
	}

	got := output.String()

	if strings.Contains(got, "install &&") {
		t.Errorf("next steps still ask for an install after one succeeded:\n%s", got)
	}

	if !strings.Contains(got, "pnpm dev") {
		t.Errorf("next steps missing `pnpm dev`:\n%s", got)
	}
}

var errStubInstall = errors.New("stub install failed")

// stubInstall replaces the install step for one test.
func stubInstall(t *testing.T, fn func(context.Context, string, string) error) {
	t.Helper()

	old := runInstallFn
	runInstallFn = fn

	t.Cleanup(func() { runInstallFn = old })
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

			assertNoStagingLeftovers(t, filepath.Join(workdir, "my-app"))
		})
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
	assertNoStagingLeftovers(t, filepath.Join(workdir, "my-app"))
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

	// The target directory is created before the template is fetched, and a
	// create that made it takes it back out again on the way out: a failed
	// `nhost create foo` should not leave an empty foo/ to explain.
	if _, statErr := os.Stat(filepath.Join(workdir, "broken-app")); !errors.Is(
		statErr, os.ErrNotExist,
	) {
		t.Fatalf("failed create left broken-app behind: stat err = %v", statErr)
	}

	assertNoTemplateTempClones(t, tmpDir)
}

// `git sparse-checkout set` succeeds for a path that is not in the tree, so a
// ref that predates the template gets all the way to the copy before anything
// notices. That is what anyone pinning an older tag hits, so the error has to
// name the template, the repo and the ref rather than a stat of a temp path.
func TestCreateReportsATemplateMissingAtThatRef(t *testing.T) {
	git := requireGit(t)
	workdir := t.TempDir()

	tmpDir := filepath.Join(workdir, "tmp")
	if err := os.MkdirAll(tmpDir, 0o755); err != nil {
		t.Fatalf("MkdirAll TMPDIR: %v", err)
	}

	t.Setenv("TMPDIR", tmpDir)

	// A repo that carries a template, just not the one the CLI will ask for.
	fixture := createNamedTemplateGitFixture(t, git, "template-branch", "some-other-template")
	t.Chdir(workdir)

	var output bytes.Buffer

	cmd := newTestRootCommand(t, &output)

	err := cmd.Run(
		context.Background(),
		[]string{
			"nhost", "create",
			"--templates-repo", "file://" + fixture,
			"--templates-ref", "template-branch",
			"--no-install",
			"missing-template-app",
		},
	)
	if err == nil {
		t.Fatal("create command succeeded; want a missing-template failure")
	}

	// "was not found in" rather than the template name on its own: the name
	// appears in the raw stat path too, so asserting on it alone would pass on
	// exactly the bare `stat /tmp/.../templates/nextjs-shadcn` this message
	// exists to replace.
	msg := err.Error()
	for _, want := range []string{
		fmt.Sprintf("template %q was not found in", defaultTemplate),
		fixture,
		"template-branch",
	} {
		if !strings.Contains(msg, want) {
			t.Errorf("error %q does not name %q", msg, want)
		}
	}

	assertNoTemplateTempClones(t, tmpDir)
}

// A directory the user already had is theirs even when it is empty, which is
// the only case the cleanup can actually observe: os.Remove refuses a
// directory with anything in it, so a target holding a file survives whether
// the guard is there or not. Without the guard,
// `mkdir mine && nhost create mine` would delete the user's own mine/.
func TestCreateLeavesAPreExistingEmptyTargetDirectoryBehind(t *testing.T) {
	git := requireGit(t)
	workdir := t.TempDir()

	tmpDir := filepath.Join(workdir, "tmp")
	if err := os.MkdirAll(tmpDir, 0o755); err != nil {
		t.Fatalf("MkdirAll TMPDIR: %v", err)
	}

	t.Setenv("TMPDIR", tmpDir)

	fixture := createTemplateGitFixture(t, git, "template-branch")
	t.Chdir(workdir)

	target := filepath.Join(workdir, "mine")
	if err := os.MkdirAll(target, 0o755); err != nil {
		t.Fatalf("MkdirAll target: %v", err)
	}

	var output bytes.Buffer

	cmd := newTestRootCommand(t, &output)

	if err := cmd.Run(
		context.Background(),
		[]string{
			"nhost", "create",
			"--templates-repo", "file://" + fixture,
			"--templates-ref", "missing-branch",
			"--no-install",
			"mine",
		},
	); err == nil {
		t.Fatal("create command succeeded; want git fetch failure")
	}

	if _, statErr := os.Stat(target); statErr != nil {
		t.Fatalf("failed create deleted the user's own empty directory: %v", statErr)
	}
}

// MkdirAll makes the missing parents on the way to the target, so a failed
// `nhost create projects/my-app` has to take projects/ back too rather than
// leave an empty one to explain. It stops at what it made: a parent the user
// already had, or one holding anything else, stays.
func TestCreateUnwindsTheParentsItMade(t *testing.T) {
	git := requireGit(t)
	workdir := t.TempDir()

	tmpDir := filepath.Join(workdir, "tmp")
	if err := os.MkdirAll(tmpDir, 0o755); err != nil {
		t.Fatalf("MkdirAll TMPDIR: %v", err)
	}

	t.Setenv("TMPDIR", tmpDir)

	fixture := createTemplateGitFixture(t, git, "template-branch")
	t.Chdir(workdir)

	// kept/ is the user's, so the unwind has to stop under it even though
	// everything below kept/ was this command's doing.
	kept := filepath.Join(workdir, "kept")
	if err := os.MkdirAll(kept, 0o755); err != nil {
		t.Fatalf("MkdirAll kept: %v", err)
	}

	var output bytes.Buffer

	cmd := newTestRootCommand(t, &output)

	if err := cmd.Run(
		context.Background(),
		[]string{
			"nhost", "create",
			"--templates-repo", "file://" + fixture,
			"--templates-ref", "missing-branch",
			"--no-install",
			filepath.Join("kept", "projects", "my-app"),
		},
	); err == nil {
		t.Fatal("create command succeeded; want git fetch failure")
	}

	for _, gone := range []string{
		filepath.Join(kept, "projects", "my-app"),
		filepath.Join(kept, "projects"),
	} {
		if _, statErr := os.Stat(gone); !errors.Is(statErr, os.ErrNotExist) {
			t.Errorf("failed create left %s behind: stat err = %v", gone, statErr)
		}
	}

	if _, statErr := os.Stat(kept); statErr != nil {
		t.Fatalf("failed create removed a directory the user already had: %v", statErr)
	}
}

// A directory the user already had is theirs. A failed create empties it of
// whatever it staged, but removing it would destroy work the command never
// created.
func TestCreateLeavesAPreExistingTargetDirectoryBehind(t *testing.T) {
	git := requireGit(t)
	workdir := t.TempDir()

	tmpDir := filepath.Join(workdir, "tmp")
	if err := os.MkdirAll(tmpDir, 0o755); err != nil {
		t.Fatalf("MkdirAll TMPDIR: %v", err)
	}

	t.Setenv("TMPDIR", tmpDir)

	fixture := createTemplateGitFixture(t, git, "template-branch")
	t.Chdir(workdir)

	target := filepath.Join(workdir, "mine")
	writeTestFile(t, filepath.Join(target, "NOTES.md"), "my notes\n")

	var output bytes.Buffer

	cmd := newTestRootCommand(t, &output)

	if err := cmd.Run(
		context.Background(),
		[]string{
			"nhost", "create",
			"--templates-repo", "file://" + fixture,
			"--templates-ref", "missing-branch",
			"--no-install",
			"mine",
		},
	); err == nil {
		t.Fatal("create command succeeded; want git fetch failure")
	}

	if got := readTestFile(t, filepath.Join(target, "NOTES.md")); got != "my notes\n" {
		t.Fatalf("pre-existing file = %q, want %q", got, "my notes\n")
	}

	assertNoStagingLeftovers(t, target)
}

func TestTopmostMissingDir(t *testing.T) {
	t.Parallel()

	root := t.TempDir()

	existing := filepath.Join(root, "existing")
	if err := os.MkdirAll(existing, 0o755); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}

	tests := []struct {
		name   string
		target string
		want   string
	}{
		{name: "an existing directory is nobody's to remove", target: existing, want: ""},
		{
			name:   "a missing leaf is its own root",
			target: filepath.Join(existing, "leaf"),
			want:   filepath.Join(existing, "leaf"),
		},
		{
			name:   "the topmost missing parent is the root",
			target: filepath.Join(existing, "a", "b", "c"),
			want:   filepath.Join(existing, "a"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := topmostMissingDir(tt.target); got != tt.want {
				t.Errorf("topmostMissingDir(%q) = %q, want %q", tt.target, got, tt.want)
			}
		})
	}
}

// The unwind stops at the first directory that is not empty, so work the
// command did not create is never removed.
func TestRemoveMadeDirsStopsAtWhatItDidNotMake(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	madeRoot := filepath.Join(root, "a")
	target := filepath.Join(madeRoot, "b", "c")

	if err := os.MkdirAll(target, 0o755); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}

	// Something of the user's next to the leaf stops the unwind at b/.
	writeTestFile(t, filepath.Join(madeRoot, "b", "theirs.txt"), "theirs\n")

	removeMadeDirs(target, madeRoot)

	if _, err := os.Stat(target); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("empty leaf survived: stat err = %v", err)
	}

	if _, err := os.Stat(filepath.Join(madeRoot, "b", "theirs.txt")); err != nil {
		t.Errorf("the unwind removed a directory holding the user's file: %v", err)
	}
}

// Nothing is removed when MkdirAll had nothing to make.
func TestRemoveMadeDirsKeepsAPreExistingTarget(t *testing.T) {
	t.Parallel()

	target := t.TempDir()

	removeMadeDirs(target, "")

	if _, err := os.Stat(target); err != nil {
		t.Fatalf("removeMadeDirs removed a pre-existing target: %v", err)
	}
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

	// `nhost create` prompts when both stdin and stdout are terminals, so a
	// test run from one -- `go test` under script, `docker run -t`, an IDE
	// runner -- would block on a question nobody answers until the test binary
	// times out. Pointing stdin at a file is what makes these runs take the
	// same path they take in CI.
	withStdin(t, "")

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

	return createNamedTemplateGitFixture(t, git, branch, defaultTemplate)
}

// createNamedTemplateGitFixture builds a templates repo holding exactly one
// template, under the name given. Naming it lets a test build a repo that does
// not carry the template the CLI will ask for.
//
// The fixture and the clone the CLI runs against it are both cut off from the
// developer's own git config: a global commit.gpgsign, or a core.excludesFile
// that happens to match, would otherwise fail the commit or quietly drop the
// fixture's files.
func createNamedTemplateGitFixture(
	t *testing.T, git string, branch string, templateName string,
) string {
	t.Helper()

	t.Setenv("GIT_CONFIG_GLOBAL", os.DevNull)
	t.Setenv("GIT_CONFIG_SYSTEM", os.DevNull)

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
		filepath.Join(fixture, "templates", templateName, "frontend", "package.json"),
		"{\n  \"name\": \"starter\",\n  \"version\": \"0.1.0\"\n}\n",
	)
	writeTestFile(
		t,
		filepath.Join(fixture, "templates", templateName, "frontend", "src", "app.ts"),
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
// the `.nhost-create.partial-*` directory it stages into never survives in the
// target directory, on either the success or the failure path.
func assertNoStagingLeftovers(t *testing.T, target string) {
	t.Helper()

	entries, err := os.ReadDir(target)
	if errors.Is(err, os.ErrNotExist) {
		return
	}

	if err != nil {
		t.Fatalf("ReadDir(%s): %v", target, err)
	}

	for _, entry := range entries {
		if strings.HasPrefix(entry.Name(), stagingPrefix) {
			t.Fatalf(
				"staging directory was not removed: %s",
				filepath.Join(target, entry.Name()),
			)
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

package create //nolint:testpackage

// The tests here scaffold templates/nextjs-shadcn itself rather than a
// fixture, so they are the ones that fail when the CLI and the template in
// this repo stop agreeing. They are what puts templates/nextjs-shadcn/** in
// the cli workflow's path filter and in cli/project.nix's source set.

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

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
		// The documented first step of a scaffolded project is copying this to
		// .env.local, so the artifact filter has to let it through.
		"frontend/.env.example",
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
	assertNoStagingLeftovers(t, filepath.Join(workdir, "agent-ready-app"))
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

	// The template ships both pnpm files; an npm scaffold must leave neither,
	// or `npm install` runs against pnpm's leftovers.
	for _, pnpmFile := range []string{"pnpm-lock.yaml", "pnpm-workspace.yaml"} {
		if _, err := os.Stat(
			filepath.Join(projectDir, "frontend", pnpmFile),
		); !errors.Is(err, os.ErrNotExist) {
			t.Errorf("npm scaffold kept frontend/%s: %v", pnpmFile, err)
		}
	}
}

package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// TestTutorialSnippetsCompile builds the full program on each tutorial page
// against the SDK in this tree.
//
// The pages are prose, so nothing otherwise stops them describing an API that
// no longer exists: renaming Client.GetUserSession to Client.Session left all
// five pages publishing code that did not compile, and the docs build stayed
// green because it never compiled them. This is the cheapest guard that would
// have caught it.
func TestTutorialSnippetsCompile(t *testing.T) {
	t.Parallel()

	// The getting-started pages that teach this example. Each one ends with a
	// complete program, which is what a reader copies.
	tutorialPages := []string{
		"1-introduction.mdx",
		"2-authentication.mdx",
		"3-graphql-operations.mdx",
		"4-file-uploads.mdx",
		"5-functions-sharing.mdx",
	}

	goFencePattern := regexp.MustCompile("(?s)```go[^\n]*\n(.*?)```")

	goTool, err := exec.LookPath("go")
	if err != nil {
		t.Skipf("go toolchain unavailable: %v", err)
	}

	repoRoot, err := filepath.Abs(filepath.Join("..", "..", ".."))
	if err != nil {
		t.Fatalf("resolve repository root: %v", err)
	}

	docsDir := filepath.Join(
		repoRoot, "docs", "src", "content", "docs", "getting-started", "tutorials", "go",
	)

	for _, page := range tutorialPages {
		t.Run(page, func(t *testing.T) {
			t.Parallel()

			source, err := os.ReadFile(filepath.Join(docsDir, page))
			if err != nil {
				t.Fatalf("read tutorial page: %v", err)
			}

			program := lastFullProgram(goFencePattern.FindAllStringSubmatch(string(source), -1))
			if program == "" {
				t.Fatal("page contains no complete Go program; the fence pattern has gone stale")
			}

			// Written outside the module tree so a scratch package is never left
			// behind in the repository; `go build` still resolves the SDK import
			// through this module.
			dir := t.TempDir()

			path := filepath.Join(dir, "main.go")
			if err := os.WriteFile(path, []byte(program), 0o600); err != nil {
				t.Fatalf("write extracted program: %v", err)
			}

			command := exec.CommandContext(t.Context(), goTool, "build", "-o", os.DevNull, path)
			command.Dir = repoRoot

			if output, err := command.CombinedOutput(); err != nil {
				t.Fatalf("the program published on %s does not compile: %v\n%s", page, err, output)
			}
		})
	}
}

// lastFullProgram returns the final fence that is a complete program. Pages
// introduce fragments first and close with the whole file, which is the version
// a reader ends up with.
func lastFullProgram(matches [][]string) string {
	program := ""

	for _, match := range matches {
		if strings.Contains(match[1], "package main") {
			program = match[1]
		}
	}

	return program
}

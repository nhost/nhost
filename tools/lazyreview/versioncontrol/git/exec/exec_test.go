package exec_test

import (
	"context"
	"os"
	osexec "os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nhost/nhost/tools/lazyreview/versioncontrol/git/exec"
)

// setupTestRepo creates a temporary git repository and changes the working
// directory into it via t.Chdir (restored automatically when the test ends).
// Tests using this helper must NOT call t.Parallel() because they share
// the process working directory.
func setupTestRepo(t *testing.T) string {
	t.Helper()

	tmpDir := t.TempDir()
	t.Chdir(tmpDir)

	runGitCmd(t, "init", "-b", "main")
	runGitCmd(t, "config", "user.email", "test@test.com")
	runGitCmd(t, "config", "user.name", "Test")

	writeTestFile(t, filepath.Join(tmpDir, "README.md"), "# test\n")
	runGitCmd(t, "add", "README.md")
	runGitCmd(t, "commit", "-m", "initial")

	return tmpDir
}

func runGitCmd(t *testing.T, args ...string) string {
	t.Helper()

	ctx := context.Background()
	cmd := osexec.CommandContext(ctx, "git", args...)

	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf(
			"git %s failed: %s: %v",
			strings.Join(args, " "),
			string(out),
			err,
		)
	}

	return strings.TrimSpace(string(out))
}

func writeTestFile(t *testing.T, path, content string) {
	t.Helper()

	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatalf("failed to create directory %s: %v", dir, err)
	}

	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("failed to write file %s: %v", path, err)
	}
}

func newClient(t *testing.T) *exec.Exec {
	t.Helper()

	ctx := context.Background()

	client, err := exec.NewExec(ctx)
	if err != nil {
		t.Fatalf("NewExec failed: %v", err)
	}

	return client
}

//nolint:paralleltest // tests share process CWD
func TestRoot(t *testing.T) {
	tmpDir := setupTestRepo(t)
	client := newClient(t)

	expected, _ := filepath.EvalSymlinks(tmpDir)
	got, _ := filepath.EvalSymlinks(client.Root())

	if got != expected {
		t.Errorf("expected root %s, got %s", expected, got)
	}
}

//nolint:paralleltest // tests share process CWD
func TestCurrentBranch(t *testing.T) {
	setupTestRepo(t)
	client := newClient(t)

	ctx := context.Background()

	branch, err := client.CurrentBranch(ctx)
	if err != nil {
		t.Fatalf("CurrentBranch failed: %v", err)
	}

	if branch != "main" {
		t.Errorf("expected branch main, got %s", branch)
	}
}

//nolint:paralleltest // tests share process CWD
func TestMergeBase(t *testing.T) {
	setupTestRepo(t)
	client := newClient(t)

	ctx := context.Background()

	initialHash := runGitCmd(t, "rev-parse", "HEAD")

	runGitCmd(t, "checkout", "-b", "feature")
	runGitCmd(t, "commit", "--allow-empty", "-m", "feature commit")

	base, err := client.MergeBase(ctx, "main")
	if err != nil {
		t.Fatalf("MergeBase failed: %v", err)
	}

	if base != initialHash {
		t.Errorf("expected merge-base %s, got %s", initialHash, base)
	}
}

//nolint:paralleltest // tests share process CWD
func TestNameStatus(t *testing.T) {
	tmpDir := setupTestRepo(t)
	client := newClient(t)

	ctx := context.Background()

	mergeBase := runGitCmd(t, "rev-parse", "HEAD")

	writeTestFile(t, filepath.Join(tmpDir, "README.md"), "# changed\n")
	runGitCmd(t, "add", "README.md")
	runGitCmd(t, "commit", "-m", "change readme")

	d, err := client.NameStatus(ctx, mergeBase)
	if err != nil {
		t.Fatalf("NameStatus failed: %v", err)
	}

	if !strings.Contains(d, "README.md") {
		t.Error("name-status should contain changed file")
	}

	if !strings.Contains(d, "M\t") {
		t.Error("name-status should show M for modified file")
	}
}

//nolint:paralleltest // tests share process CWD
func TestDiffFile(t *testing.T) {
	tmpDir := setupTestRepo(t)
	client := newClient(t)

	ctx := context.Background()

	writeTestFile(t, filepath.Join(tmpDir, "README.md"), "# diff-file test\n")

	d, err := client.DiffFile(ctx, "--", "README.md")
	if err != nil {
		t.Fatalf("DiffFile failed: %v", err)
	}

	if !strings.Contains(d, "README.md") {
		t.Error("DiffFile should contain the file name")
	}

	if !strings.Contains(d, "+# diff-file test") {
		t.Error("DiffFile should show the change")
	}
}

//nolint:paralleltest // tests share process CWD
func TestDiffFile_Staged(t *testing.T) {
	tmpDir := setupTestRepo(t)
	client := newClient(t)

	ctx := context.Background()

	writeTestFile(t, filepath.Join(tmpDir, "README.md"), "# staged via DiffFile\n")
	runGitCmd(t, "add", "README.md")

	d, err := client.DiffFile(ctx, "--cached", "--", "README.md")
	if err != nil {
		t.Fatalf("DiffFile --cached failed: %v", err)
	}

	if !strings.Contains(d, "+# staged via DiffFile") {
		t.Error("DiffFile --cached should show staged change")
	}
}

//nolint:paralleltest // tests share process CWD
func TestNewFileDiff(t *testing.T) {
	tmpDir := setupTestRepo(t)
	client := newClient(t)

	writeTestFile(
		t,
		filepath.Join(tmpDir, "newfile.go"),
		"package main\n\nfunc hello() {}\n",
	)

	d, err := client.NewFileDiff("newfile.go")
	if err != nil {
		t.Fatalf("NewFileDiff failed: %v", err)
	}

	if !strings.Contains(d, "diff --git a/newfile.go b/newfile.go") {
		t.Error("diff should contain file header")
	}

	if !strings.Contains(d, "new file mode 100644") {
		t.Error("diff should contain new file mode")
	}

	if !strings.Contains(d, "--- /dev/null") {
		t.Error("diff should contain /dev/null for old file")
	}

	if !strings.Contains(d, "+++ b/newfile.go") {
		t.Error("diff should contain new file path")
	}

	if !strings.Contains(d, "@@ -0,0 +1,3 @@") {
		t.Error("diff should contain hunk header with correct line count")
	}

	if !strings.Contains(d, "+package main") {
		t.Error("diff should contain added lines")
	}
}

//nolint:paralleltest // tests share process CWD
func TestNewFileDiff_SingleLine(t *testing.T) {
	tmpDir := setupTestRepo(t)
	client := newClient(t)

	writeTestFile(t, filepath.Join(tmpDir, "single.txt"), "one line\n")

	d, err := client.NewFileDiff("single.txt")
	if err != nil {
		t.Fatalf("NewFileDiff failed: %v", err)
	}

	if !strings.Contains(d, "@@ -0,0 +1,1 @@") {
		t.Error("single line file should have hunk header @@ -0,0 +1,1 @@")
	}

	if !strings.Contains(d, "+one line") {
		t.Error("diff should contain the file content")
	}
}

//nolint:paralleltest // tests share process CWD
func TestNewFileDiff_NoTrailingNewline(t *testing.T) {
	tmpDir := setupTestRepo(t)
	client := newClient(t)

	writeTestFile(t, filepath.Join(tmpDir, "noeol.txt"), "no newline at end")

	d, err := client.NewFileDiff("noeol.txt")
	if err != nil {
		t.Fatalf("NewFileDiff failed: %v", err)
	}

	if !strings.Contains(d, "@@ -0,0 +1,1 @@") {
		t.Error("should produce a single-line hunk")
	}

	if !strings.Contains(d, "+no newline at end") {
		t.Error("diff should contain the file content")
	}
}

//nolint:paralleltest // tests share process CWD
func TestNewFileDiff_NonExistent(t *testing.T) {
	setupTestRepo(t)
	client := newClient(t)

	_, err := client.NewFileDiff("does-not-exist.go")
	if err == nil {
		t.Error("expected error for non-existent file")
	}
}

//nolint:paralleltest // tests share process CWD
func TestStageFiles(t *testing.T) {
	tmpDir := setupTestRepo(t)
	client := newClient(t)

	ctx := context.Background()

	writeTestFile(t, filepath.Join(tmpDir, "a.go"), "package a\n")
	writeTestFile(t, filepath.Join(tmpDir, "b.go"), "package b\n")

	if err := client.StageFiles(ctx, []string{"a.go", "b.go"}); err != nil {
		t.Fatalf("StageFiles failed: %v", err)
	}

	out := runGitCmd(t, "status", "--porcelain")
	if !strings.Contains(out, "a.go") || !strings.Contains(out, "b.go") {
		t.Errorf("both files should be staged, status: %s", out)
	}
}

//nolint:paralleltest // tests share process CWD
func TestUnstageFiles(t *testing.T) {
	tmpDir := setupTestRepo(t)
	client := newClient(t)

	ctx := context.Background()

	writeTestFile(t, filepath.Join(tmpDir, "x.go"), "package x\n")
	writeTestFile(t, filepath.Join(tmpDir, "y.go"), "package y\n")
	runGitCmd(t, "add", "x.go", "y.go")

	if err := client.UnstageFiles(ctx, []string{"x.go", "y.go"}); err != nil {
		t.Fatalf("UnstageFiles failed: %v", err)
	}

	out := runGitCmd(t, "status", "--porcelain")
	if !strings.Contains(out, "?? x.go") || !strings.Contains(out, "?? y.go") {
		t.Errorf("files should be untracked after unstage, status: %s", out)
	}
}

//nolint:paralleltest // tests share process CWD
func TestStageHunk(t *testing.T) {
	tmpDir := setupTestRepo(t)
	client := newClient(t)

	ctx := context.Background()

	writeTestFile(t, filepath.Join(tmpDir, "README.md"), "# patched\n")

	patch, err := client.DiffFile(ctx)
	if err != nil {
		t.Fatalf("DiffFile failed: %v", err)
	}

	if err := client.StageHunk(ctx, patch); err != nil {
		t.Fatalf("StageHunk failed: %v", err)
	}

	staged, err := client.DiffFile(ctx, "--cached")
	if err != nil {
		t.Fatalf("DiffFile --cached failed: %v", err)
	}

	if !strings.Contains(staged, "+# patched") {
		t.Error("staged diff should contain the patched content")
	}
}

//nolint:paralleltest // tests share process CWD
func TestUnstageHunk(t *testing.T) {
	tmpDir := setupTestRepo(t)
	client := newClient(t)

	ctx := context.Background()

	writeTestFile(t, filepath.Join(tmpDir, "README.md"), "# to-unstage\n")
	runGitCmd(t, "add", "README.md")

	patch, err := client.DiffFile(ctx, "--cached")
	if err != nil {
		t.Fatalf("DiffFile --cached failed: %v", err)
	}

	if err := client.UnstageHunk(ctx, patch); err != nil {
		t.Fatalf("UnstageHunk failed: %v", err)
	}

	staged, err := client.DiffFile(ctx, "--cached")
	if err != nil {
		t.Fatalf("DiffFile --cached after unstage failed: %v", err)
	}

	if strings.Contains(staged, "README.md") {
		t.Error("hunk should be unstaged")
	}
}

//nolint:paralleltest // tests share process CWD
func TestCommit(t *testing.T) {
	tmpDir := setupTestRepo(t)
	client := newClient(t)

	ctx := context.Background()

	writeTestFile(t, filepath.Join(tmpDir, "committed.go"), "package main\n")
	runGitCmd(t, "add", "committed.go")

	if err := client.Commit(ctx, "test commit message"); err != nil {
		t.Fatalf("Commit failed: %v", err)
	}

	out := runGitCmd(t, "log", "--oneline", "-1")
	if !strings.Contains(out, "test commit message") {
		t.Errorf("commit message not found in log: %s", out)
	}
}

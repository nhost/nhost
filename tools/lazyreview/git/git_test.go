package git_test

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nhost/nhost/tools/lazyreview/git"
)

// setupTestRepo creates a temporary git repository and changes the working
// directory into it via t.Chdir (restored automatically when the test ends).
// Tests using this helper must NOT call t.Parallel() because they share
// the process working directory and the package-level repoRoot cache.
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
	cmd := exec.CommandContext(ctx, "git", args...)

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

func initRepoRoot(t *testing.T) {
	t.Helper()

	ctx := context.Background()
	if _, err := git.RepoRoot(ctx); err != nil {
		t.Fatalf("RepoRoot failed: %v", err)
	}
}

//nolint:paralleltest // tests share process CWD and package-level repoRoot
func TestRepoRoot(t *testing.T) {
	tmpDir := setupTestRepo(t)
	ctx := context.Background()

	root, err := git.RepoRoot(ctx)
	if err != nil {
		t.Fatalf("RepoRoot failed: %v", err)
	}

	expected, _ := filepath.EvalSymlinks(tmpDir)
	got, _ := filepath.EvalSymlinks(root)

	if got != expected {
		t.Errorf("expected root %s, got %s", expected, got)
	}
}

//nolint:paralleltest // tests share process CWD and package-level repoRoot
func TestCurrentBranch(t *testing.T) {
	setupTestRepo(t)
	initRepoRoot(t)

	ctx := context.Background()

	branch, err := git.CurrentBranch(ctx)
	if err != nil {
		t.Fatalf("CurrentBranch failed: %v", err)
	}

	if branch != "main" {
		t.Errorf("expected branch main, got %s", branch)
	}
}

//nolint:paralleltest // tests share process CWD and package-level repoRoot
func TestMergeBase(t *testing.T) {
	setupTestRepo(t)
	initRepoRoot(t)

	ctx := context.Background()

	initialHash := runGitCmd(t, "rev-parse", "HEAD")

	runGitCmd(t, "checkout", "-b", "feature")
	runGitCmd(t, "commit", "--allow-empty", "-m", "feature commit")

	base, err := git.MergeBase(ctx, "main")
	if err != nil {
		t.Fatalf("MergeBase failed: %v", err)
	}

	if base != initialHash {
		t.Errorf("expected merge-base %s, got %s", initialHash, base)
	}
}

//nolint:paralleltest // tests share process CWD and package-level repoRoot
func TestDiff(t *testing.T) {
	tmpDir := setupTestRepo(t)
	initRepoRoot(t)

	ctx := context.Background()

	mergeBase := runGitCmd(t, "rev-parse", "HEAD")

	writeTestFile(t, filepath.Join(tmpDir, "README.md"), "# changed\n")
	runGitCmd(t, "add", "README.md")
	runGitCmd(t, "commit", "-m", "change readme")

	d, err := git.Diff(ctx, mergeBase)
	if err != nil {
		t.Fatalf("Diff failed: %v", err)
	}

	if !strings.Contains(d, "README.md") {
		t.Error("diff should contain changed file")
	}

	if !strings.Contains(d, "+# changed") {
		t.Error("diff should show the change")
	}
}

//nolint:paralleltest // tests share process CWD and package-level repoRoot
func TestDiffHead(t *testing.T) {
	tmpDir := setupTestRepo(t)
	initRepoRoot(t)

	ctx := context.Background()

	writeTestFile(t, filepath.Join(tmpDir, "README.md"), "# head diff\n")
	runGitCmd(t, "add", "README.md")

	d, err := git.DiffHead(ctx)
	if err != nil {
		t.Fatalf("DiffHead failed: %v", err)
	}

	if !strings.Contains(d, "+# head diff") {
		t.Error("HEAD diff should show staged changes")
	}
}

//nolint:paralleltest // tests share process CWD and package-level repoRoot
func TestDiffUnstaged(t *testing.T) {
	tmpDir := setupTestRepo(t)
	initRepoRoot(t)

	ctx := context.Background()

	writeTestFile(t, filepath.Join(tmpDir, "README.md"), "# unstaged change\n")

	d, err := git.DiffUnstaged(ctx)
	if err != nil {
		t.Fatalf("DiffUnstaged failed: %v", err)
	}

	if !strings.Contains(d, "README.md") {
		t.Error("unstaged diff should contain modified file")
	}

	if !strings.Contains(d, "+# unstaged change") {
		t.Error("unstaged diff should show the change")
	}
}

//nolint:paralleltest // tests share process CWD and package-level repoRoot
func TestDiffStaged(t *testing.T) {
	tmpDir := setupTestRepo(t)
	initRepoRoot(t)

	ctx := context.Background()

	writeTestFile(t, filepath.Join(tmpDir, "README.md"), "# staged change\n")
	runGitCmd(t, "add", "README.md")

	d, err := git.DiffStaged(ctx)
	if err != nil {
		t.Fatalf("DiffStaged failed: %v", err)
	}

	if !strings.Contains(d, "README.md") {
		t.Error("staged diff should contain modified file")
	}

	if !strings.Contains(d, "+# staged change") {
		t.Error("staged diff should show the change")
	}
}

//nolint:paralleltest // tests share process CWD and package-level repoRoot
func TestDiffStaged_Empty(t *testing.T) {
	setupTestRepo(t)
	initRepoRoot(t)

	ctx := context.Background()

	d, err := git.DiffStaged(ctx)
	if err != nil {
		t.Fatalf("DiffStaged failed: %v", err)
	}

	if d != "" {
		t.Errorf("expected empty staged diff, got %q", d)
	}
}

//nolint:paralleltest // tests share process CWD and package-level repoRoot
func TestUntrackedFiles_None(t *testing.T) {
	setupTestRepo(t)
	initRepoRoot(t)

	ctx := context.Background()

	files, err := git.UntrackedFiles(ctx)
	if err != nil {
		t.Fatalf("UntrackedFiles failed: %v", err)
	}

	if files != nil {
		t.Errorf("expected nil for no untracked files, got %v", files)
	}
}

//nolint:paralleltest // tests share process CWD and package-level repoRoot
func TestUntrackedFiles_WithFiles(t *testing.T) {
	tmpDir := setupTestRepo(t)
	initRepoRoot(t)

	ctx := context.Background()

	writeTestFile(t, filepath.Join(tmpDir, "untracked1.go"), "package main\n")
	writeTestFile(t, filepath.Join(tmpDir, "untracked2.go"), "package main\n")

	files, err := git.UntrackedFiles(ctx)
	if err != nil {
		t.Fatalf("UntrackedFiles failed: %v", err)
	}

	if len(files) != 2 {
		t.Fatalf("expected 2 untracked files, got %d: %v", len(files), files)
	}

	found := make(map[string]bool, len(files))
	for _, f := range files {
		found[f] = true
	}

	if !found["untracked1.go"] {
		t.Error("expected untracked1.go in untracked files")
	}

	if !found["untracked2.go"] {
		t.Error("expected untracked2.go in untracked files")
	}
}

//nolint:paralleltest // tests share process CWD and package-level repoRoot
func TestNewFileDiff(t *testing.T) {
	tmpDir := setupTestRepo(t)
	initRepoRoot(t)

	writeTestFile(
		t,
		filepath.Join(tmpDir, "newfile.go"),
		"package main\n\nfunc hello() {}\n",
	)

	d, err := git.NewFileDiff("newfile.go")
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

//nolint:paralleltest // tests share process CWD and package-level repoRoot
func TestNewFileDiff_SingleLine(t *testing.T) {
	tmpDir := setupTestRepo(t)
	initRepoRoot(t)

	writeTestFile(t, filepath.Join(tmpDir, "single.txt"), "one line\n")

	d, err := git.NewFileDiff("single.txt")
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

//nolint:paralleltest // tests share process CWD and package-level repoRoot
func TestNewFileDiff_NoTrailingNewline(t *testing.T) {
	tmpDir := setupTestRepo(t)
	initRepoRoot(t)

	writeTestFile(t, filepath.Join(tmpDir, "noeol.txt"), "no newline at end")

	d, err := git.NewFileDiff("noeol.txt")
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

//nolint:paralleltest // tests share process CWD and package-level repoRoot
func TestNewFileDiff_NonExistent(t *testing.T) {
	setupTestRepo(t)
	initRepoRoot(t)

	_, err := git.NewFileDiff("does-not-exist.go")
	if err == nil {
		t.Error("expected error for non-existent file")
	}
}

//nolint:paralleltest // tests share process CWD and package-level repoRoot
func TestStageFile(t *testing.T) {
	tmpDir := setupTestRepo(t)
	initRepoRoot(t)

	ctx := context.Background()

	writeTestFile(t, filepath.Join(tmpDir, "new.go"), "package main\n")

	if err := git.StageFile(ctx, "new.go"); err != nil {
		t.Fatalf("StageFile failed: %v", err)
	}

	out := runGitCmd(t, "status", "--porcelain")
	if !strings.Contains(out, "new.go") {
		t.Errorf("file should be staged, status: %s", out)
	}
}

//nolint:paralleltest // tests share process CWD and package-level repoRoot
func TestStageFiles(t *testing.T) {
	tmpDir := setupTestRepo(t)
	initRepoRoot(t)

	ctx := context.Background()

	writeTestFile(t, filepath.Join(tmpDir, "a.go"), "package a\n")
	writeTestFile(t, filepath.Join(tmpDir, "b.go"), "package b\n")

	if err := git.StageFiles(ctx, []string{"a.go", "b.go"}); err != nil {
		t.Fatalf("StageFiles failed: %v", err)
	}

	out := runGitCmd(t, "status", "--porcelain")
	if !strings.Contains(out, "a.go") || !strings.Contains(out, "b.go") {
		t.Errorf("both files should be staged, status: %s", out)
	}
}

//nolint:paralleltest // tests share process CWD and package-level repoRoot
func TestUnstageFile(t *testing.T) {
	tmpDir := setupTestRepo(t)
	initRepoRoot(t)

	ctx := context.Background()

	writeTestFile(t, filepath.Join(tmpDir, "staged.go"), "package main\n")
	runGitCmd(t, "add", "staged.go")

	if err := git.UnstageFile(ctx, "staged.go"); err != nil {
		t.Fatalf("UnstageFile failed: %v", err)
	}

	out := runGitCmd(t, "status", "--porcelain")
	if !strings.Contains(out, "?? staged.go") {
		t.Errorf("file should be untracked after unstage, status: %s", out)
	}
}

//nolint:paralleltest // tests share process CWD and package-level repoRoot
func TestUnstageFiles(t *testing.T) {
	tmpDir := setupTestRepo(t)
	initRepoRoot(t)

	ctx := context.Background()

	writeTestFile(t, filepath.Join(tmpDir, "x.go"), "package x\n")
	writeTestFile(t, filepath.Join(tmpDir, "y.go"), "package y\n")
	runGitCmd(t, "add", "x.go", "y.go")

	if err := git.UnstageFiles(ctx, []string{"x.go", "y.go"}); err != nil {
		t.Fatalf("UnstageFiles failed: %v", err)
	}

	out := runGitCmd(t, "status", "--porcelain")
	if !strings.Contains(out, "?? x.go") || !strings.Contains(out, "?? y.go") {
		t.Errorf("files should be untracked after unstage, status: %s", out)
	}
}

//nolint:paralleltest // tests share process CWD and package-level repoRoot
func TestStageHunk(t *testing.T) {
	tmpDir := setupTestRepo(t)
	initRepoRoot(t)

	ctx := context.Background()

	writeTestFile(t, filepath.Join(tmpDir, "README.md"), "# patched\n")

	patch, err := git.DiffUnstaged(ctx)
	if err != nil {
		t.Fatalf("DiffUnstaged failed: %v", err)
	}

	if err := git.StageHunk(ctx, patch); err != nil {
		t.Fatalf("StageHunk failed: %v", err)
	}

	staged, err := git.DiffStaged(ctx)
	if err != nil {
		t.Fatalf("DiffStaged failed: %v", err)
	}

	if !strings.Contains(staged, "+# patched") {
		t.Error("staged diff should contain the patched content")
	}
}

//nolint:paralleltest // tests share process CWD and package-level repoRoot
func TestUnstageHunk(t *testing.T) {
	tmpDir := setupTestRepo(t)
	initRepoRoot(t)

	ctx := context.Background()

	writeTestFile(t, filepath.Join(tmpDir, "README.md"), "# to-unstage\n")
	runGitCmd(t, "add", "README.md")

	patch, err := git.DiffStaged(ctx)
	if err != nil {
		t.Fatalf("DiffStaged failed: %v", err)
	}

	if err := git.UnstageHunk(ctx, patch); err != nil {
		t.Fatalf("UnstageHunk failed: %v", err)
	}

	staged, err := git.DiffStaged(ctx)
	if err != nil {
		t.Fatalf("DiffStaged after unstage failed: %v", err)
	}

	if strings.Contains(staged, "README.md") {
		t.Error("hunk should be unstaged")
	}
}

//nolint:paralleltest // tests share process CWD and package-level repoRoot
func TestCommit(t *testing.T) {
	tmpDir := setupTestRepo(t)
	initRepoRoot(t)

	ctx := context.Background()

	writeTestFile(t, filepath.Join(tmpDir, "committed.go"), "package main\n")
	runGitCmd(t, "add", "committed.go")

	if err := git.Commit(ctx, "test commit message"); err != nil {
		t.Fatalf("Commit failed: %v", err)
	}

	out := runGitCmd(t, "log", "--oneline", "-1")
	if !strings.Contains(out, "test commit message") {
		t.Errorf("commit message not found in log: %s", out)
	}
}

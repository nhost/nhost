package git

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// repoRoot is cached after the first call to RepoRoot().
var repoRoot string //nolint:gochecknoglobals

func runGit(args ...string) error {
	cmd := exec.Command("git", args...) //nolint:gosec
	cmd.Dir = repoRoot

	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git %s: %s: %w", strings.Join(args, " "), strings.TrimSpace(string(out)), err)
	}

	return nil
}

func RepoRoot() (string, error) {
	out, err := exec.Command("git", "rev-parse", "--show-toplevel").Output()
	if err != nil {
		return "", fmt.Errorf("failed to get repo root: %w", err)
	}

	repoRoot = strings.TrimSpace(string(out))

	return repoRoot, nil
}

func CurrentBranch() (string, error) {
	out, err := exec.Command("git", "rev-parse", "--abbrev-ref", "HEAD").Output()
	if err != nil {
		return "", fmt.Errorf("failed to get current branch: %w", err)
	}

	return strings.TrimSpace(string(out)), nil
}

func MergeBase(base string) (string, error) {
	out, err := exec.Command("git", "merge-base", base, "HEAD").Output()
	if err != nil {
		return "", fmt.Errorf("failed to get merge-base for %s: %w", base, err)
	}

	return strings.TrimSpace(string(out)), nil
}

func Diff(mergeBase string) (string, error) {
	out, err := exec.Command("git", "diff", "-U1", mergeBase).Output()
	if err != nil {
		return "", fmt.Errorf("failed to get diff against %s: %w", mergeBase, err)
	}

	return string(out), nil
}

func DiffHead() (string, error) {
	out, err := exec.Command("git", "diff", "-U1", "HEAD").Output()
	if err != nil {
		return "", fmt.Errorf("failed to get HEAD diff: %w", err)
	}

	return string(out), nil
}

func DiffUnstaged() (string, error) {
	out, err := exec.Command("git", "diff", "-U1").Output()
	if err != nil {
		return "", fmt.Errorf("failed to get unstaged diff: %w", err)
	}

	return string(out), nil
}

func DiffStaged() (string, error) {
	out, err := exec.Command("git", "diff", "-U1", "--cached").Output()
	if err != nil {
		return "", fmt.Errorf("failed to get staged diff: %w", err)
	}

	return string(out), nil
}

// UntrackedFiles returns paths of untracked files (relative to repo root).
func UntrackedFiles() ([]string, error) {
	cmd := exec.Command("git", "ls-files", "--others", "--exclude-standard")
	cmd.Dir = repoRoot

	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to list untracked files: %w", err)
	}

	raw := strings.TrimSpace(string(out))
	if raw == "" {
		return nil, nil
	}

	return strings.Split(raw, "\n"), nil
}

// NewFileDiff generates a synthetic unified diff for an untracked file
// so it can be displayed alongside tracked diffs.
func NewFileDiff(path string) (string, error) {
	abs := filepath.Join(repoRoot, path)

	data, err := os.ReadFile(abs) //nolint:gosec
	if err != nil {
		return "", fmt.Errorf("failed to read %s: %w", path, err)
	}

	lines := strings.Split(string(data), "\n")
	// remove trailing empty line from Split if file ends with newline
	if len(lines) > 0 && lines[len(lines)-1] == "" {
		lines = lines[:len(lines)-1]
	}

	var b strings.Builder

	fmt.Fprintf(&b, "diff --git a/%s b/%s\n", path, path)
	b.WriteString("new file mode 100644\n")
	b.WriteString("--- /dev/null\n")
	fmt.Fprintf(&b, "+++ b/%s\n", path)
	fmt.Fprintf(&b, "@@ -0,0 +1,%d @@\n", len(lines))

	for _, line := range lines {
		fmt.Fprintf(&b, "+%s\n", line)
	}

	return b.String(), nil
}

func StageFile(path string) error {
	return StageFiles([]string{path})
}

func StageFiles(paths []string) error {
	args := append([]string{"add", "--"}, paths...)
	if err := runGit(args...); err != nil {
		return fmt.Errorf("failed to stage files: %w", err)
	}

	return nil
}

func UnstageFile(path string) error {
	return UnstageFiles([]string{path})
}

func UnstageFiles(paths []string) error {
	args := append([]string{"reset", "HEAD", "--"}, paths...)
	if err := runGit(args...); err != nil {
		return fmt.Errorf("failed to unstage files: %w", err)
	}

	return nil
}

func StageHunk(patch string) error {
	cmd := exec.Command("git", "apply", "--cached")
	cmd.Dir = repoRoot
	cmd.Stdin = strings.NewReader(patch)

	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to stage hunk: %s: %w", strings.TrimSpace(string(out)), err)
	}

	return nil
}

func UnstageHunk(patch string) error {
	cmd := exec.Command("git", "apply", "--cached", "-R")
	cmd.Dir = repoRoot
	cmd.Stdin = strings.NewReader(patch)

	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to unstage hunk: %s: %w", strings.TrimSpace(string(out)), err)
	}

	return nil
}

func Commit(message string) error {
	if err := runGit("commit", "-m", message); err != nil {
		return fmt.Errorf("failed to commit: %w", err)
	}

	return nil
}

func Push() error {
	if err := runGit("push"); err != nil {
		return fmt.Errorf("failed to push: %w", err)
	}

	return nil
}

func PushForce() error {
	if err := runGit("push", "--force-with-lease"); err != nil {
		return fmt.Errorf("failed to force push: %w", err)
	}

	return nil
}

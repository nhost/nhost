package exec //nolint:revive // deeply nested; os/exec aliased as osexec internally

import (
	"context"
	"fmt"
	"os"
	osexec "os/exec"
	"path/filepath"
	"strings"
)

type Exec struct {
	root string
}

func NewExec(ctx context.Context) (*Exec, error) {
	out, err := osexec.CommandContext(ctx, "git", "rev-parse", "--show-toplevel").Output()
	if err != nil {
		return nil, fmt.Errorf("failed to get repo root: %w", err)
	}

	return &Exec{
		root: strings.TrimSpace(string(out)),
	}, nil
}

func (c *Exec) Root() string {
	return c.root
}

func (c *Exec) newGitCmd(ctx context.Context, args ...string) *osexec.Cmd {
	return osexec.CommandContext(ctx, "git", args...)
}

func (c *Exec) runGit(ctx context.Context, args ...string) error {
	cmd := c.newGitCmd(ctx, args...)
	cmd.Dir = c.root

	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf(
			"git %s: %s: %w",
			strings.Join(args, " "),
			strings.TrimSpace(string(out)),
			err,
		)
	}

	return nil
}

func (c *Exec) RepoRoot(ctx context.Context) (string, error) {
	out, err := c.newGitCmd(ctx, "rev-parse", "--show-toplevel").Output()
	if err != nil {
		return "", fmt.Errorf("failed to get repo root: %w", err)
	}

	c.root = strings.TrimSpace(string(out))

	return c.root, nil
}

func (c *Exec) CurrentBranch(ctx context.Context) (string, error) {
	out, err := c.newGitCmd(ctx, "rev-parse", "--abbrev-ref", "HEAD").Output()
	if err != nil {
		return "", fmt.Errorf("failed to get current branch: %w", err)
	}

	return strings.TrimSpace(string(out)), nil
}

func (c *Exec) MergeBase(ctx context.Context, base string) (string, error) {
	out, err := c.newGitCmd(ctx, "merge-base", base, "HEAD").Output()
	if err != nil {
		return "", fmt.Errorf("failed to get merge-base for %s: %w", base, err)
	}

	return strings.TrimSpace(string(out)), nil
}

func (c *Exec) Diff(ctx context.Context, ref string) (string, error) {
	out, err := c.newGitCmd(ctx, "diff", "-U1", ref).Output()
	if err != nil {
		return "", fmt.Errorf("failed to get diff against %s: %w", ref, err)
	}

	return string(out), nil
}

func (c *Exec) DiffFile(ctx context.Context, args ...string) (string, error) {
	fullArgs := make([]string, 0, len(args)+2) //nolint:mnd
	fullArgs = append(fullArgs, "diff", "-U1")
	fullArgs = append(fullArgs, args...)

	cmd := c.newGitCmd(ctx, fullArgs...)
	cmd.Dir = c.root

	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("git diff %s: %w", strings.Join(args, " "), err)
	}

	return string(out), nil
}

func (c *Exec) DiffUnstaged(ctx context.Context) (string, error) {
	out, err := c.newGitCmd(ctx, "diff", "-U1").Output()
	if err != nil {
		return "", fmt.Errorf("failed to get unstaged diff: %w", err)
	}

	return string(out), nil
}

func (c *Exec) DiffStaged(ctx context.Context) (string, error) {
	out, err := c.newGitCmd(ctx, "diff", "-U1", "--cached").Output()
	if err != nil {
		return "", fmt.Errorf("failed to get staged diff: %w", err)
	}

	return string(out), nil
}

func (c *Exec) NewFileDiff(path string) (string, error) {
	abs := filepath.Join(c.root, path)

	data, err := os.ReadFile(abs)
	if err != nil {
		return "", fmt.Errorf("failed to read %s: %w", path, err)
	}

	lines := strings.Split(string(data), "\n")
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

func (c *Exec) StageFiles(ctx context.Context, paths []string) error {
	args := make([]string, 0, len(paths)+2) //nolint:mnd
	args = append(args, "add", "--")
	args = append(args, paths...)

	if err := c.runGit(ctx, args...); err != nil {
		return fmt.Errorf("failed to stage files: %w", err)
	}

	return nil
}

func (c *Exec) UnstageFiles(ctx context.Context, paths []string) error {
	args := make([]string, 0, len(paths)+3) //nolint:mnd
	args = append(args, "reset", "HEAD", "--")
	args = append(args, paths...)

	if err := c.runGit(ctx, args...); err != nil {
		return fmt.Errorf("failed to unstage files: %w", err)
	}

	return nil
}

func (c *Exec) StageHunk(ctx context.Context, patch string) error {
	cmd := c.newGitCmd(ctx, "apply", "--cached")
	cmd.Dir = c.root
	cmd.Stdin = strings.NewReader(patch)

	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to stage hunk: %s: %w", strings.TrimSpace(string(out)), err)
	}

	return nil
}

func (c *Exec) UnstageHunk(ctx context.Context, patch string) error {
	cmd := c.newGitCmd(ctx, "apply", "--cached", "-R")
	cmd.Dir = c.root
	cmd.Stdin = strings.NewReader(patch)

	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to unstage hunk: %s: %w", strings.TrimSpace(string(out)), err)
	}

	return nil
}

func (c *Exec) discardFile(ctx context.Context, path string) error {
	if err := c.runGit(ctx, "checkout", "HEAD", "--", path); err == nil {
		return nil
	}

	abs := filepath.Join(c.root, path)
	if err := os.Remove(abs); err != nil {
		return fmt.Errorf("failed to discard %s: %w", path, err)
	}

	return nil
}

func (c *Exec) DiscardFiles(ctx context.Context, paths []string) error {
	for _, path := range paths {
		if err := c.discardFile(ctx, path); err != nil {
			return err
		}
	}

	return nil
}

func (c *Exec) DiscardHunk(ctx context.Context, patch string) error {
	cmd := c.newGitCmd(ctx, "apply", "-R")
	cmd.Dir = c.root
	cmd.Stdin = strings.NewReader(patch)

	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to discard hunk: %s: %w", strings.TrimSpace(string(out)), err)
	}

	return nil
}

func (c *Exec) Commit(ctx context.Context, message string) error {
	if err := c.runGit(ctx, "commit", "-m", message); err != nil {
		return fmt.Errorf("failed to commit: %w", err)
	}

	return nil
}

func (c *Exec) Push(ctx context.Context) error {
	if err := c.runGit(ctx, "push"); err != nil {
		return fmt.Errorf("failed to push: %w", err)
	}

	return nil
}

func (c *Exec) PushForce(ctx context.Context) error {
	if err := c.runGit(ctx, "push", "--force-with-lease"); err != nil {
		return fmt.Errorf("failed to force push: %w", err)
	}

	return nil
}

func (c *Exec) Status(ctx context.Context) (string, error) {
	cmd := c.newGitCmd(ctx, "status", "--porcelain")
	cmd.Dir = c.root

	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to get status: %w", err)
	}

	return string(out), nil
}

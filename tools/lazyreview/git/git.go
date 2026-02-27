package git

import (
	"fmt"
	"os/exec"
	"strings"
)

func RepoRoot() (string, error) {
	out, err := exec.Command("git", "rev-parse", "--show-toplevel").Output()
	if err != nil {
		return "", fmt.Errorf("failed to get repo root: %w", err)
	}

	return strings.TrimSpace(string(out)), nil
}

func CurrentBranch() (string, error) {
	out, err := exec.Command("git", "rev-parse", "--abbrev-ref", "HEAD").Output()
	if err != nil {
		return "", fmt.Errorf("failed to get current branch: %w", err)
	}

	return strings.TrimSpace(string(out)), nil
}

func MergeBase(base string) (string, error) {
	out, err := exec.Command("git", "merge-base", base, "HEAD").Output() //nolint:gosec
	if err != nil {
		return "", fmt.Errorf("failed to get merge-base for %s: %w", base, err)
	}

	return strings.TrimSpace(string(out)), nil
}

func Diff(mergeBase string) (string, error) {
	out, err := exec.Command("git", "diff", mergeBase).Output() //nolint:gosec
	if err != nil {
		return "", fmt.Errorf("failed to get diff against %s: %w", mergeBase, err)
	}

	return string(out), nil
}

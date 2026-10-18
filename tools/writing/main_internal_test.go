package main

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestFindRepoRoot(t *testing.T) {
	t.Parallel()

	tmp := t.TempDir()

	clone := filepath.Join(tmp, "clone")
	worktree := filepath.Join(tmp, "worktree")
	nested := filepath.Join(worktree, "tools", "writing")

	for _, dir := range []string{filepath.Join(clone, ".git"), nested} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			t.Fatalf("creating %s: %v", dir, err)
		}
	}

	if err := os.WriteFile(
		filepath.Join(worktree, ".git"), []byte("gitdir: /elsewhere\n"), 0o600,
	); err != nil {
		t.Fatalf("writing .git file: %v", err)
	}

	tests := []struct {
		name    string
		dir     string
		want    string
		wantErr error
	}{
		{name: ".git directory", dir: clone, want: clone},
		{name: ".git file in a worktree", dir: worktree, want: worktree},
		{name: "nested directory", dir: nested, want: worktree},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := findRepoRoot(tt.dir)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("findRepoRoot() error = %v, want %v", err, tt.wantErr)
			}

			if got != tt.want {
				t.Errorf("findRepoRoot() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestDefaultRepoPath(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	nested := filepath.Join(root, "tools", "writing")

	for _, dir := range []string{filepath.Join(root, ".git"), nested} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			t.Fatalf("creating %s: %v", dir, err)
		}
	}

	tests := []struct {
		name  string
		cwd   string
		elems []string
		want  string
	}{
		{
			name:  "rules dir from the root",
			cwd:   root,
			elems: []string{".claude", "writing"},
			want:  filepath.Join(root, ".claude", "writing"),
		},
		{
			name:  "rubric from a nested directory",
			cwd:   nested,
			elems: []string{"tools", "writing", "rubric", "rubric.yaml"},
			want:  filepath.Join(root, "tools", "writing", "rubric", "rubric.yaml"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := defaultRepoPath(tt.cwd, "rules-dir", tt.elems...)
			if err != nil {
				t.Fatalf("defaultRepoPath() error = %v", err)
			}

			if got != tt.want {
				t.Errorf("defaultRepoPath() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestRepoRelative(t *testing.T) {
	t.Parallel()

	root := filepath.FromSlash("/repo")
	page := filepath.FromSlash("docs/src/content/docs/page.mdx")

	tests := []struct {
		name    string
		root    string
		cwd     string
		docPath string
		want    string
	}{
		{name: "no path", root: root, cwd: root, docPath: "", want: ""},
		{name: "unknown root", root: "", cwd: root, docPath: "page.mdx", want: "page.mdx"},
		{name: "relative to root", root: root, cwd: root, docPath: page, want: page},
		{
			name:    "relative to a subdirectory",
			root:    root,
			cwd:     filepath.Join(root, "docs"),
			docPath: filepath.FromSlash("src/content/docs/page.mdx"),
			want:    page,
		},
		{
			name:    "absolute inside root",
			root:    root,
			cwd:     filepath.FromSlash("/elsewhere"),
			docPath: filepath.Join(root, page),
			want:    page,
		},
		{
			name:    "outside root",
			root:    root,
			cwd:     root,
			docPath: filepath.FromSlash("../other/page.mdx"),
			want:    filepath.FromSlash("../other/page.mdx"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := repoRelative(tt.root, tt.cwd, tt.docPath); got != tt.want {
				t.Errorf("repoRelative() = %q, want %q", got, tt.want)
			}
		})
	}
}

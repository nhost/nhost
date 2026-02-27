# lazyreview - Development Guide

**Important**: Always load the root `CLAUDE.md` at the repository root for general monorepo conventions before working on this project.

A TUI tool for reviewing branch diffs file-by-file and hunk-by-hunk. It tracks review progress across sessions so you can pick up where you left off. It has two modes: **Review mode** (default) for tracking review progress, and **Git mode** for staging/unstaging files and hunks, committing, and pushing.

## Directory Structure

```
tools/lazyreview/
├── main.go          # CLI entry point (urfave/cli/v3)
├── diff/            # Unified diff parser
│   ├── parser.go    # Parses raw diff output into File/Hunk structs
│   └── parser_test.go
├── git/             # Git command wrappers
│   ├── git.go       # RepoRoot, CurrentBranch, MergeBase, Diff, Stage, Unstage, Commit, Push
│   └── git_test.go
├── review/          # Review state persistence
│   ├── state.go     # Load/Save/Reconcile review state (.lazyreview/<branch>.json)
│   └── state_test.go
├── tui/             # Bubble Tea TUI
│   ├── model.go     # Root model, key bindings, Update loop
│   ├── filelist.go  # Left panel: collapsible file tree grouped by directory
│   ├── diffview.go  # Right panel: syntax-highlighted diff with hunk navigation
│   ├── commit.go    # Commit message input overlay
│   ├── mode.go      # Mode enum (Review / Git)
│   ├── help.go      # Help overlay
│   └── styles.go    # Lip Gloss styles
├── Makefile         # Includes build/makefiles/general.makefile
└── project.nix      # Nix build definition
```

## Key Dependencies

- [Bubble Tea](https://github.com/charmbracelet/bubbletea) - TUI framework
- [Lip Gloss](https://github.com/charmbracelet/lipgloss) - Styling
- [urfave/cli/v3](https://github.com/urfave/cli) - CLI flags and commands

## Development

```sh
# Enter dev shell
nix develop .\#lazyreview

# Run
go run ./tools/lazyreview

# Test
go test ./tools/lazyreview/...

# Format
golines -w --base-formatter=gofumpt ./tools/lazyreview/

# Lint
golangci-lint run ./tools/lazyreview/...
```

## Architecture Notes

- The diff parser (`diff/`) converts raw unified diff text into structured `File` and `Hunk` types
- Review state (`review/`) persists per-branch as JSON in `.lazyreview/` at the repo root. It uses content hashes to detect when hunks have changed between sessions (`Reconcile`). State is only persisted for Review mode; Git mode uses transient in-memory state that mirrors live git staging status
- The TUI (`tui/`) follows Bubble Tea's Elm-style architecture with a root `Model` delegating to `FileList` and `DiffView` sub-models. The tool has two modes (`mode.go`): Review mode diffs from merge-base to HEAD; Git mode diffs HEAD against the working tree (including untracked files) and reflects live staging status
- Git operations (`git/`) are thin wrappers around `git` CLI commands via `os/exec`, covering diff, stage/unstage (file-level and hunk-level via `git apply --cached`), commit, push, and force push (`--force-with-lease`)

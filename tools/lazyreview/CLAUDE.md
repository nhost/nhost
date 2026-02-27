# lazyreview - Development Guide

**Important**: Always load the root `CLAUDE.md` at the repository root for general monorepo conventions before working on this project.

A TUI tool for reviewing branch diffs file-by-file and hunk-by-hunk. It tracks review progress across sessions so you can pick up where you left off. It is read-only and does not perform any git operations.

## Directory Structure

```
tools/lazyreview/
├── main.go          # CLI entry point (urfave/cli/v3)
├── diff/            # Unified diff parser
│   ├── parser.go    # Parses raw diff output into File/Hunk structs
│   └── parser_test.go
├── git/             # Git command wrappers
│   └── git.go       # RepoRoot, CurrentBranch, MergeBase, Diff
├── review/          # Review state persistence
│   ├── state.go     # Load/Save/Reconcile review state (.lazyreview/<branch>.json)
│   └── state_test.go
├── tui/             # Bubble Tea TUI
│   ├── model.go     # Root model, key bindings, Update loop
│   ├── filelist.go  # Left panel: collapsible file tree grouped by directory
│   ├── diffview.go  # Right panel: syntax-highlighted diff with hunk navigation
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
- Review state (`review/`) persists per-branch as JSON in `.lazyreview/` at the repo root. It uses content hashes to detect when hunks have changed between sessions (`Reconcile`)
- The TUI (`tui/`) follows Bubble Tea's Elm-style architecture with a root `Model` delegating to `FileList` and `DiffView` sub-models
- Git operations (`git/`) are thin wrappers around `git` CLI commands via `os/exec`

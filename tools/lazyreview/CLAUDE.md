# lazyreview - Development Guide

**Important**: Always load the root `CLAUDE.md` at the repository root for general monorepo conventions before working on this project.

A TUI tool for reviewing branch diffs file-by-file and hunk-by-hunk. It tracks review progress across sessions so you can pick up where you left off. It has two modes: **Review mode** (default) for tracking review progress, and **Git mode** for staging/unstaging files and hunks, committing, and pushing.

## Directory Structure

```
tools/lazyreview/
├── main.go                       # Composition root: creates exec, git, review, TUI
├── diff/                         # Unified diff parser (UNCHANGED)
│   ├── parser.go                 # Parses raw diff output into File/Hunk structs
│   └── parser_test.go
├── versioncontrol/
│   ├── types.go                  # Shared types (data only, no behavior)
│   └── git/
│       ├── git.go                # Git struct (implements tui.GitView); stateless, calls executor each time
│       ├── git_test.go           # Tests Git using mock Executor
│       ├── mock/
│       │   └── executor.go       # Generated mock for Executor
│       └── exec/
│           ├── exec.go           # Exec struct — thin wrappers around git CLI
│           └── exec_test.go      # Integration tests
├── review/
│   ├── review.go                 # Review struct (implements tui.View); defines GitQuerier interface
│   ├── review_test.go            # Tests Review using mock GitQuerier
│   ├── state.go                  # Load/Save/Reconcile/SetHunkReviewed (.lazyreview/<branch>.json)
│   ├── state_test.go
│   └── mock/
│       └── querier.go            # Generated mock for GitQuerier
├── tui/
│   ├── view.go                   # View + GitView interfaces (consumer-defined)
│   ├── model.go                  # Root model, key bindings, Update loop (uses tui.View)
│   ├── filelist.go               # Left panel: collapsible file tree grouped by directory
│   ├── diffview.go               # Right panel: syntax-highlighted diff with hunk navigation
│   ├── commit.go                 # Commit message input overlay
│   ├── help.go                   # Help overlay
│   ├── styles.go                 # Lip Gloss styles
│   └── mock/
│       └── view.go               # Generated mocks for View and GitView
├── Makefile                      # Includes build/makefiles/general.makefile
└── project.nix                   # Nix build definition
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

- **Consumer-defined interfaces**: Interfaces are defined by their consumers, not their implementors. `tui.View` and `tui.GitView` are defined in `tui/`, `git.Executor` in `versioncontrol/git/`, and `review.GitQuerier` in `review/`. Each interface is minimal — only the methods the consumer needs. `View` covers common operations (status, change details, stage/unstage, save); `GitView` embeds `View` and adds git-specific operations (discard, commit, push). All data methods (`GetStatus`, `GetChangeDetails`) take `context.Context` and return `error`. Both always re-fetch from git on every call (no caching).
- The diff parser (`diff/`) converts raw unified diff text into structured `File` and `Hunk` types
- Review state (`review/state.go`) persists per-branch as JSON in `.lazyreview/` at the repo root. It uses content hashes to detect when hunks have changed between sessions (`Reconcile`). State is only persisted for Review mode; Git mode is stateless and determines staging by comparing live diffs
- The `review.Review` struct implements `tui.View` for review mode. It depends on `GitQuerier` (a 2-method interface: `MergeBase` + `Diff`) for reading git data. It re-fetches the diff on every `GetStatus`/`GetChangeDetails` call but only loads persisted state from disk once (first call)
- The `versioncontrol/git.Git` struct implements `tui.GitView` for git mode. It is **stateless** — each method calls the `Executor` directly and returns results. It depends on `Executor` for all git operations. Shared types (`FileStatus`, `ChangeDetail`, `ViewConfig`, `ChangeKind`) live in `versioncontrol/types.go`
- `GetChangeDetails` accepts `FileStatus` (not a path string) so it can dispatch per-file git commands based on the file's `Kind`, `Staged`, and `Partial` fields. For fully staged files it runs `git diff --cached -- file`; for fully unstaged files it runs `git diff -- file` (or `NewFileDiff` for untracked files); for partially staged files it fetches both `git diff HEAD -- file` and `git diff -- file` and cross-references hunks via `buildHunkDetails`. Renamed files use `-M` flag.
- `FileStatus.Kind` (`ChangeKind`) classifies files as `ChangeModified`, `ChangeAdded`, `ChangeDeleted`, or `ChangeRenamed`, populated by `parseStatus` from git porcelain output
- The TUI (`tui/`) follows Bubble Tea's Elm-style architecture with a root `Model` that holds named `Review View` and `Git GitView` fields plus an active index. Mode switching (keys 1/2) changes the active view. Common operations go through `View`; git-specific operations (discard, commit, push) use `m.Git` directly — no type assertions or capability checks needed. Mode configs (labels, verbs) are defined as functions `reviewViewConfig()` / `gitViewConfig()` in the TUI package, not on the View interface
- Hunk stage/unstage/discard operations use `path` + `hunkIndex` (not hash) — the view resolves internally
- Git CLI wrappers (`versioncontrol/git/exec/`) provide the `Exec` struct that wraps `os/exec` commands. `*exec.Exec` satisfies both `git.Executor` and `review.GitQuerier` implicitly. `DiffFile(ctx, args...)` is the flexible per-file diff method that runs `git diff -U1 <args>`

## Dependency Graph (no cycles)

```
versioncontrol (types only) ← depends on: diff
versioncontrol/git/exec     ← depends on: nothing (os/exec)
versioncontrol/git          ← depends on: versioncontrol, diff
tui                         ← depends on: versioncontrol (types)
review                      ← depends on: versioncontrol, diff
main                        ← depends on: tui, versioncontrol/git, versioncontrol/git/exec, review
```

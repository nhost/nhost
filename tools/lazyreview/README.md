# lazyreview

A TUI tool for reviewing branch diffs file-by-file and hunk-by-hunk. It tracks your review progress across sessions so you can pick up where you left off.

![lazyreview](lazyreview.png)

## Features

- Collapsible file tree grouped by directory
- Hunk-level and file-level review tracking
- Toggle entire directories as reviewed
- Persisted review state per branch (stored in `.lazyreview/`)
- Includes committed, staged, and unstaged changes

## Install

```sh
go install github.com/nhost/nhost/tools/lazyreview@latest
```

## Usage

```sh
# From anywhere inside a git repo
lazyreview

# Diff against a different base branch
lazyreview --base develop
```

## Key Bindings

| Key | Action |
|-----|--------|
| `j/k`, `↑/↓` | Navigate tree / navigate hunks |
| `J/K` | Scroll diff up/down |
| `g/G` | Go to top / bottom |
| `h/←` | Collapse dir / go to parent |
| `l/→`, `Enter` | Expand dir / focus diff |
| `Tab` | Switch panel focus |
| `Space`, `a` | Toggle reviewed (file/dir/hunk) |
| `?` | Show help |
| `q` | Quit |

Review state is saved automatically on exit to `.lazyreview/<branch>.json`.

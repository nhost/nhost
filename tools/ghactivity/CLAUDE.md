# ghactivity - Go Development Guide

**Important**: Always load the root `CLAUDE.md` at the repository root for general monorepo conventions before working on this project.

**Design rules**: Repo-wide Go rules live in `.claude/docs/go-design-rules.md` — load that first. Only ghactivity-specific patterns are documented below.

`ghactivity` produces a markdown stand-up report of a GitHub user's activity in an organisation over a time window. It shells out to the `gh` CLI for authentication and HTTP, then bucketises every PR/issue the user touched into the team's stand-up template.

## Core Principles

- **No new HTTP/auth stack** — always go through the `gh` CLI via `internal/gh`. The tool inherits the user's existing `gh auth` session and never handles tokens directly.
- **The bucket classifier is the contract.** The five sections of the output (`InProgress`, `ReadyForReview`, `Blocked`, `ClosedOrMerged`, `Tentative`) are what users build their day around. Any change to `classifyPR` / `classifyIssue` must be accompanied by tests covering the moved cases.
- **First-match-wins routing.** Each item lands in exactly one section. Priority order (top wins): `ClosedOrMerged` → `Blocked` → `ReadyForReview` → `InProgress` → `Tentative`. Preserve this order unless you have a clear reason.
- **Project status name is configurable.** Don't hardcode `"Waiting"` / `"Ready for review"`; route through `Params.WaitingStatus` / `Params.ReadyStatus` so teams with different column names can use the tool.

## Directory Structure

```
tools/ghactivity/
├── main.go                          # Entry point — builds the cli.Command and dispatches to report.Action
├── cmd/
│   └── report/
│       ├── report.go                # CLI flags, time parsing, wires gh + activity + render together
│       └── report_test.go           # ParseTimestamp tests
├── internal/
│   ├── gh/
│   │   └── gh.go                    # Thin wrapper around the `gh` CLI: GraphQL via stdin, REST via `gh api`, sentinel errors
│   ├── activity/
│   │   └── activity.go              # Search query + bucket classifier (the core logic)
│   └── render/
│       ├── render.go                # Markdown emitter
│       └── render_test.go           # Renderer tests
├── project.nix                      # Nix build configuration
└── Makefile                         # Standard shared Makefile targets
```

The tool is a single binary with no subcommands. New behaviour belongs as a flag on the existing command, not a new `cmd/<name>/` package.

## The Pipeline

1. `report.Action` parses `--since` / `--until` in local time using the layout `20060102-1504`, resolves the user (CLI flag or `gh api user`), and constructs an `activity.Params`.
2. `activity.Build` issues three searches (`involves:USER`, `reviewed-by:USER`, `review-requested:USER`), dedupes by URL, and feeds the union into `categorise`.
3. `categorise` walks each node and calls `classifyPR` or `classifyIssue`. These functions encode the bucket priority — any change must keep the early-return cascade.
4. `render.Markdown` emits the report. Items within a section are sorted by `Repository` then `Number` for stable output.

## Adding a New Bucket / Signal

When extending the classifier:

1. Decide where in the priority cascade the new bucket goes and add the early-return branch in the correct order.
2. If the signal needs new GraphQL fields, add them to `searchQuery` and the corresponding struct fields in `searchNode` / `timelineItem` / `projectItem`. Keep the fragments minimal — every field broadens the required OAuth scope.
3. If the new signal needs a Projects v2 field, remember `read:project` is already required; document any *additional* scope in `cmd/report/report.go`'s missing-scope handler.
4. Add a corresponding section in `render.Markdown` and a test in `render_test.go`.

## GitHub API & Auth Notes

- **Required scopes**: `repo`, `read:org`, and `read:project`. The third is needed only because we read Projects v2 status to detect `Blocked` and `ReadyForReview`. If a future bucket can be derived without Projects v2, prefer the cheaper signal so the tool degrades gracefully for users without that scope.
- **Missing-scope handling**: `gh.ErrMissingScope` is a sentinel returned when `gh` exits with the "has not been granted the required scopes" stderr fingerprint. `report.Action` matches on it with `errors.Is` and prints the `gh auth refresh` command. If you add new fields that require a different scope, extend that mapping rather than dumping the raw stderr.
- **Time windows**: search qualifiers use ISO 8601 with the local zone offset (`time.RFC3339`). `time.Local` is gated by a `//nolint:gosmopolitan` because stand-up windows are inherently local-time concepts.
- **GraphQL timeline item types**: only enum values in `PullRequestTimelineItemsItemType` are valid for PR `timelineItems(itemTypes:)`. Notably, `PULL_REQUEST_REVIEW_COMMENT` is **not** valid — review comments are nested inside `PullRequestReview` and not standalone timeline items.

## Testing

- `render_test.go` covers the formatter (empty report, ordering, item rendering).
- `report_test.go` covers `ParseTimestamp` (the only `time` boundary).
- `internal/activity` has no unit tests today because the collector talks directly to `gh`. If you add non-trivial classifier logic, introduce a `gh.Client` interface and stub it in a `classify_internal_test.go` (white-box) so the bucket priorities are pinned by tests.

## Key Dependencies

- `github.com/urfave/cli/v3` — CLI framework.
- `gh` CLI on `PATH` at runtime (added to the devShell's `buildInputs`).

## Development Workflow

1. **Design**: identify whether the change is a new flag, a new GraphQL field, a new bucket, or a rendering tweak — each has a different surface area.
2. **Implement**: prefer extending an existing file over adding a new package; this tool is intentionally small.
3. **Test**: add or extend tests in `render_test.go` / `report_test.go`. If classifier logic changes, add tests there too.
4. **Run locally**: `go run ./tools/ghactivity -o nhost -s YYYYMMDD-HHMM` against a real `gh` session.
5. Run the mandatory post-change checks from `.claude/docs/go-design-rules.md`.

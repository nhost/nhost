# ghactivity - Go Development Guide

**Important**: Always load the root `CLAUDE.md` at the repository root for general monorepo conventions before working on this project.

**Design rules**: Repo-wide Go rules live in `.claude/docs/go-design-rules.md` — load that first. Only ghactivity-specific patterns are documented below.

`ghactivity` produces a markdown stand-up report of a GitHub user's activity in an organisation over a time window. It is distributed as a **`gh` CLI extension** (binary name `gh-activity`, invoked as `gh activity ...`) and uses `github.com/cli/go-gh/v2` for authenticated GraphQL + REST calls. It then bucketises every PR/issue the user touched into the team's stand-up template.

## Core Principles

- **No new HTTP/auth stack** — always go through `internal/gh`, which wraps the `go-gh/v2` clients. The extension inherits whatever auth context `gh` resolves (the user's `gh auth` session, or `GH_TOKEN` / `GITHUB_TOKEN` in CI). Never instantiate `http.Client` or read tokens manually.
- **The bucket classifier is the contract.** The five sections of the output (`InProgress`, `ReadyForReview`, `Blocked`, `ClosedOrMerged`, `Uncategorized`) are what users build their day around. Any change to `classifyPR` / `classifyIssue` must be accompanied by tests covering the moved cases.
- **First-match-wins routing.** Each item lands in exactly one section. Priority order (top wins): `ClosedOrMerged` → `Blocked` → `ReadyForReview` → `InProgress` → `Uncategorized`. Preserve this order unless you have a clear reason.
- **Project status name is configurable.** Don't hardcode `"Waiting"` / `"Ready for review"`; route through `Params.WaitingStatus` / `Params.ReadyStatus` so teams with different column names can use the tool. The Projects v2 *field* itself is also configurable via `Params.StatusField` (default `activity.DefaultStatusField` = `"Status"`, CLI flag `--status-field`, env var `GHACTIVITY_STATUS_FIELD`) and is threaded into the GraphQL query as the `$statusField` variable — do not reintroduce a hardcoded `fieldValueByName(name: "Status")`.

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
│   │   └── gh.go                    # Thin adapter around `go-gh/v2` GraphQLClient + RESTClient with sentinel errors
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
- **Missing-scope handling**: `gh.ErrMissingScope` is a sentinel surfaced when `go-gh` returns a `*api.GraphQLError` whose item `Type` is `INSUFFICIENT_SCOPES` (or, as a fallback, when the error string contains "has not been granted the required scopes"). `report.Action` matches on it with `errors.Is` and prints the `gh auth refresh` command. If you add new fields that require a different scope, extend the mapping in `gh.isInsufficientScopes` rather than dumping the raw error.
- **Time windows**: search qualifiers use ISO 8601 with the local zone offset (`time.RFC3339`). `time.Local` is gated by a `//nolint:gosmopolitan` because stand-up windows are inherently local-time concepts.
- **GraphQL timeline item types**: only enum values in `PullRequestTimelineItemsItemType` are valid for PR `timelineItems(itemTypes:)`. Notably, `PULL_REQUEST_REVIEW_COMMENT` is **not** valid — review comments are nested inside `PullRequestReview` and not standalone timeline items.

## Testing

- `render_test.go` covers the formatter (empty report, ordering, item rendering).
- `report_test.go` covers `ParseTimestamp` (the only `time` boundary).
- `internal/activity` pins the classifier with white-box tests in `classify_internal_test.go` against the unexported `ghClient` boundary. Stub the boundary with an inline type implementing the interface — do **not** add a `mock/` subpackage, since `package activity` cannot import it without an import cycle.

## Key Dependencies

- `github.com/urfave/cli/v3` — CLI framework.
- `github.com/cli/go-gh/v2` — authenticated GraphQL and REST clients; auth and host resolution come from the `gh` CLI's stored session or `GH_TOKEN` / `GITHUB_TOKEN`.
- `gh` CLI on `PATH` at install time (for `gh extension install --force .`) and to seed auth for local use; not strictly required at runtime if `GH_TOKEN` is set.

## Distribution

The binary is named `gh-activity` (Go produces `ghactivity`; `project.nix` renames it in `postInstall`) so `gh` discovers it as the `activity` subcommand. To install locally:

```sh
cd tools/ghactivity
mkdir -p gh-activity
go build -o gh-activity/gh-activity .
(cd gh-activity && gh extension install --force .)
gh activity --help
```

`gh extension install` derives the extension name from the **current** directory's basename and only accepts `.` as a local path — relative paths like `./gh-activity` fail with "Could not find extension". So we build into a `gh-activity/` subdir (git-ignored) and `cd` into it before installing.

## Development Workflow

1. **Design**: identify whether the change is a new flag, a new GraphQL field, a new bucket, or a rendering tweak — each has a different surface area.
2. **Implement**: prefer extending an existing file over adding a new package; this tool is intentionally small.
3. **Test**: add or extend tests in `render_test.go` / `report_test.go`. If classifier logic changes, add tests there too.
4. **Run locally**: `go run ./tools/ghactivity -o nhost -s YYYYMMDD-HHMM` against a real `gh` session (or `gh activity -o nhost -s YYYYMMDD-HHMM` after `gh extension install --force .`).
5. Run the mandatory post-change checks from `.claude/docs/go-design-rules.md`.

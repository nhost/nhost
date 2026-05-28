# gh-activity

A [`gh` CLI extension](https://docs.github.com/en/github-cli/github-cli/using-github-cli-extensions) that produces a markdown stand-up report of a GitHub user's activity in an organisation over a time window.

It looks at every pull request and issue the user touched, sorts each one into one of five buckets, and prints a markdown report ready to paste into a stand-up channel.

## Install

You need the [`gh` CLI](https://cli.github.com/) installed and authenticated (`gh auth login`).

From a clone of this repo:

```sh
cd tools/ghactivity
mkdir -p gh-activity
go build -o gh-activity/gh-activity .
(cd gh-activity && gh extension install --force .)
```

`gh extension install` derives the extension name from the basename of the **current** directory and requires that directory to start with `gh-`. The project lives at `tools/ghactivity` to keep Go import paths and CI path filters stable, so we build into a `gh-activity/` subdirectory and `cd` into it before installing (it's git-ignored). `gh` only accepts `.` as the local path — relative paths like `./gh-activity` don't work.

Verify:

```sh
gh activity --help
```

To uninstall: `gh extension remove activity`.

## Usage

```sh
gh activity --org <github-org> --since YYYYMMDD-HHMM [--until YYYYMMDD-HHMM] [--user <login>] [--output report.md]
```

| Flag | Env var | Default | Description |
| --- | --- | --- | --- |
| `--org`, `-o` | `GHACTIVITY_ORG` | _(required)_ | GitHub organisation to scope the search to. |
| `--since`, `-s` | `GHACTIVITY_SINCE` | _(required)_ | Start of the activity window, `YYYYMMDD-HHMM` in your local time zone. |
| `--until`, `-e` | `GHACTIVITY_UNTIL` | now | End of the activity window, same format. |
| `--user`, `-u` | `GHACTIVITY_USER` | the authenticated `gh` user | GitHub login to report on. |
| `--output` | `GHACTIVITY_OUTPUT` | stdout | Write the markdown to a file instead of stdout. |
| `--status-field` | `GHACTIVITY_STATUS_FIELD` | `Status` | Projects v2 single-select field name that holds the workflow column. |
| `--ready-status` | `GHACTIVITY_READY_STATUS` | `Ready for review` | Project column name that means "ready for review". |
| `--waiting-status` | `GHACTIVITY_WAITING_STATUS` | `Waiting` | Project column name that means "blocked / waiting". |

Example: yesterday's activity for the authenticated user, in the `nhost` org:

```sh
gh activity -o nhost -s 20260527-0900 -e 20260528-0900
```

### Required OAuth scopes

`gh-activity` reads PRs, issues, and **Projects v2** status. Your `gh` token needs:

- `repo`
- `read:org`
- `read:project`

If a scope is missing, the tool prints the exact `gh auth refresh` command to grant it.

## How activity is classified

The tool runs three GitHub searches against the org and your window:

- `involves:USER updated:SINCE..UNTIL`
- `reviewed-by:USER updated:SINCE..UNTIL`
- `review-requested:USER updated:SINCE..UNTIL`

It dedupes the union by URL, then routes each item into exactly one of five buckets. **Routing is first-match-wins**, in the priority order listed below — once a PR matches a bucket, no later rule can move it.

### Pull requests

For each PR, in this order:

1. **`ClosedOrMerged`** — the PR was merged or closed inside the window (`mergedAt` or `closedAt` falls between `--since` and `--until`).
2. **`Blocked`** — the user authored the PR **and** its Projects v2 status column was set to the `--waiting-status` value inside the window.
3. **`ReadyForReview`** — the user authored the PR **and** either:
   - its Projects v2 status was set to the `--ready-status` value in the window, or
   - the PR had a `ReadyForReviewEvent` (draft → ready transition) in the window.
4. **`InProgress`** — the user authored the PR **and** either:
   - the PR was opened in the window (`createdAt` is in range), or
   - the user pushed a commit in the window.
5. **`Uncategorized`** — anything else where the user left a review or comment on the PR inside the window. The name is literal: the search's `updated:` qualifier is broad, so being merely returned by search isn't enough — there has to be an actual user action (a `PullRequestReview` submitted or an `IssueComment` posted by the user) inside the window.

PRs that don't match any of the above are dropped from the report.

### Issues

Issues use a simpler rule because they don't have draft/ready or merge states:

- **`Uncategorized`** — the user authored the issue and opened it in the window, **or** the user commented on the issue in the window.

All issue activity lands in `Uncategorized` today; if a richer issue taxonomy is ever needed, it would go in front of this rule in the same first-match-wins cascade.

### Why "first-match-wins"

The bucket order encodes how a stand-up reads top-to-bottom: things that wrapped up (`ClosedOrMerged`) lead, then the things blocking the user (`Blocked`), then what's awaiting review (`ReadyForReview`), then live work (`InProgress`), and finally context items (`Uncategorized`). A PR that was opened and then merged in the same window is reported as merged, not as in-progress — which is what you'd say in stand-up.

### Why the status field is configurable

Different teams name their Projects v2 status field differently — `Status`, `Workflow Status`, `Stage` — and their column names differ too (`Ready for review` vs `In Review`, `Waiting` vs `Blocked`). `--status-field`, `--ready-status`, and `--waiting-status` let the same tool work across teams without code changes.

## Output

A markdown report with a fixed set of level-3 (`###`) sections, in this order:

1. `### 🟢 In progress`
2. `### 👀 Moved to waiting for review`
3. `### ⏸️ Blocked / waiting on something else`
4. `### ✅ Closed / merged`
5. `### 🎯 Today's focus` — scaffolding for the human to fill in.
6. `### 📝 Other` — scaffolding for the human to fill in.
7. `### Uncategorized` — items the user merely touched (reviewed/commented) inside the window.

Every heading is always emitted, even when its bucket is empty — the layout is designed to be pasted into a stand-up channel and filled in by hand, so the empty sections act as a checklist. Within a bucket, items are sorted by repository then PR/issue number for stable diffs day-to-day, and rendered as `- [PR #N](URL) Title` (or `- [Issue #N](URL) Title`).

```markdown
### 🟢 In progress

- [PR #46](https://github.com/nhost/example/pull/46) WIP: baz refactor

### 👀 Moved to waiting for review

- [PR #45](https://github.com/nhost/example/pull/45) Add bar endpoint

### ⏸️ Blocked / waiting on something else

### ✅ Closed / merged

- [PR #42](https://github.com/nhost/example/pull/42) Tidy up the foo handler

### 🎯 Today's focus

What you're planning to work on today (especially anything not yet on the board)

### 📝 Other

Anything not tracked on GitHub, FYIs, heads-ups

### Uncategorized

- [Issue #12](https://github.com/nhost/example/issues/12) Investigate flaky test
```

## Auth

Auth is delegated entirely to `gh`. The extension uses [`go-gh/v2`](https://github.com/cli/go-gh)'s default GraphQL and REST clients, which read the same credentials `gh` itself uses (the `gh auth` session, or `GH_TOKEN` / `GITHUB_TOKEN` in CI environments). The tool never reads or writes a token directly.

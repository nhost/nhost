---
name: nhost_review
description: >
  Review the current branch's diff. Generates a PR description and writes
  validated review findings to local files under `.review/`. Routes each part of
  the diff to the right developer agent (`go-developer`, `javascript-developer`,
  `generic-developer`) so the rules embedded in those agents drive the review.
  **MUST be invoked automatically — without waiting for the user to type the
  slash command — whenever the user asks to review, audit, critique, or get
  feedback on the current branch, a diff, a set of changes, a PR, or any code
  in this repo.** Trigger phrases include but are not limited to: "review my
  branch", "review the diff", "review these changes", "review this PR", "audit
  this change", "what do you think of this change", "check my changes", or any
  equivalent phrasing in any language. When in doubt, default to invoking this
  skill.
disable-model-invocation: false
argument-hint: [base-ref]
allowed-tools: Bash, Read, Write, Grep, Glob, Agent, TaskCreate, TaskUpdate, TaskList
---

You are `nhost_review`, the orchestrator for reviewing changes in this monorepo.

Your job is **routing and synthesis**. The actual rule-checking lives in the developer agents (`go-developer`, `javascript-developer`, `generic-developer`); each one loads its own CLAUDE.mds and rules doc on startup. You decide which agent gets which slice of the diff, then validate and merge their findings.

CLAUDE.md is already loaded. Do not duplicate its contents.

## Pre-fetched context

Gathered automatically. Do NOT re-fetch unless strictly necessary.

!`bash .claude/skills/nhost_review/scripts/gather-context.sh $ARGUMENTS`

---

## Phase 1 — PR description

Generate a structured PR description and publish it.

**Rules:**
- The PR body may already contain content from the author or a previous run.
- Everything between `<!-- nhost-reviewer:start -->` and `<!-- nhost-reviewer:end -->` is YOUR section — replace it entirely on each run.
- Everything OUTSIDE those markers is the author's content — preserve verbatim.
- If no markers exist yet, append your section at the end of the existing body.

Your section must contain, in order:

1. **What this PR solves** — 1–3 sentences explaining the problem this change addresses and the outcome it produces. Focus on *why* the change exists, not *what* files moved. Infer from the diff, commit messages, and any linked issue context.
2. **PR Type** — one of: `Enhancement`, `Bug fix`, `Refactoring`, `Tests`, `Documentation`, `Configuration`, `Other`.
3. **Description** — bulleted list of high-level changes (one sentence per logical change; group related files).
4. **Diagram Walkthrough** — a mermaid flowchart. Include only if the change spans multiple components/services or has non-trivial control flow.
5. **File Walkthrough** — a collapsible `<details>` table of ALL changed files, grouped by category. For each file: filename, one-line `<code>` description, link to the diff using the pre-computed hash (`https://github.com/{REPO}/pull/{PR_NUMBER}/files#diff-{HASH}`), and the pre-computed `+N/-M` stats.

Follow the format template in [template.md](template.md) exactly.

Write the complete body (author content + your section) to `.review/PR_<PR_NUMBER>_DESCRIPTION.md` via the Write tool.

### Proposed titles

Separately, propose 3 candidate PR titles — short, imperative, ≤ 70 chars, conventional-commit style where appropriate (e.g. `fix(auth): …`, `feat(dashboard): …`). Write them as a bulleted list to `.review/PR_<PR_NUMBER>_TITLES.md`. Do **not** include the titles in the PR description body.

---

## Phase 2 — Route the diff to developer agents

Group the changed files into **(language, project) buckets** so each developer agent gets a coherent slice of the diff.

**Language assignment (by file extension):**

| Extension                                     | Agent                  |
|-----------------------------------------------|------------------------|
| `*.go`                                        | `go-developer`         |
| `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.mjs`, `*.cjs` | `javascript-developer` |
| everything else                               | `generic-developer`    |

**Project sub-grouping within each language:**

- **Go:** group by the immediate Go package (directory). Don't merge unrelated packages into one agent.
- **JS/TS:** group by workspace root — `dashboard/`, `packages/nhost-js/`, `services/functions/`, `docs/`, `examples/<name>/`. Each workspace gets its own agent.
- **Generic:** group by top-level project (`services/constellation/`, `services/auth/`, `.github/`, `flake.nix` → root, etc.). Cross-project changes (e.g. a renamed env var that flows through Go, TS, and YAML) go to a single generic-developer that traces them end-to-end.

**Spawn one Agent subagent per bucket, all in a single message** so they run in parallel.

Each subagent prompt must include:

1. The agent type (`subagent_type`: `go-developer` / `javascript-developer` / `generic-developer`).
2. The file list for this bucket + the relevant diff hunks.
3. The full pre-fetched PR context (PR number, repo, base ref, etc.).
4. An explicit instruction: **"You are in review mode. Do not edit any files. Validate every finding before reporting it. Return a JSON array of confirmed findings."**
5. The expected return shape: `[{ file, line, question?, severity, description, plan, confirmed }, ...]`.

Smaller PRs may not need full parallelisation. If the diff touches a **single bucket** or is small (< ~500 changed lines total), invoke that one agent inline and skip multi-bucket coordination.

---

## Phase 3 — Validate findings the agents weren't confident on

Each developer agent has already validated its own findings against its loaded rules. Anything they return with `confirmed: false` is theirs to discard — but **you** are responsible for double-checking borderline findings before posting them. If a finding's `description` and `plan` don't make sense to you on first read, spawn a plan-mode Agent subagent to confirm by exploring the codebase. The subagent should return `{ confirmed: bool, reason: string, plan: string | null }`. Discard unconfirmed findings silently — never report false positives.

---

## Phase 4 — Cross-bucket synthesis

This is the only step a single developer agent cannot do, because no individual agent sees the whole diff. Run this orchestrator-only pass over the merged finding set:

- **Placement across packages.** Does a new Go symbol belong in a *different* touched package, or should related additions across packages collapse into one new subpackage?
- **Contract drift.** Did a Go service contract change without updating the TS client (`packages/nhost-js/`, `dashboard/`)? Did a YAML metadata change leave the SQL inconsistent?
- **Interface/implementation drift.** Did a changed interface (`Driver`, `Dialect`, `Connector`, `MessageHandler`) update every implementer? Was `go generate ./...` re-run for mocks?
- **Stale goldens.** Did a SQL/schema change land without a corresponding `testdata/` golden update?
- **Multi-language consistency.** Renames, env vars, error codes, or auth claims that flow through more than one language must stay in sync.

Add any new findings discovered here as additional comments.

---

## Phase 5 — Write findings + summary

Before writing any findings for the current run, clear stale per-finding comments for this PR only:

```bash
rm -f .review/PR_<PR_NUMBER>_COMMENT_*.md
```

Do this even when there are no confirmed findings, so old comments from earlier runs cannot be published with the fresh summary. Do not remove `DESCRIPTION`, `TITLES`, or `REVIEW` files; they are overwritten separately. Then number the current run's confirmed findings from 1.

For each confirmed finding, write `.review/PR_<PR_NUMBER>_COMMENT_<N>.md` at the repo root (N increments from 1), containing:

- `**File:**` — file path.
- `**Line:**` — line or line range.
- `**Question:**` *(Go only)* — `placement`, `package-invariant`, or `local-correctness`.
- `**Severity:**` — `blocking`, `warning`, or `suggestion`, with the one-sentence reason.
- `**Plan:**` — the concrete fix.

Then write the summary to `.review/PR_<PR_NUMBER>_REVIEW.md`, starting with a `**Decision:**` header of `approve`, `request-changes`, or `comment`, followed by:

- counts of findings by severity;
- any high-impact blocking findings called out by name;
- a 2–3 sentence overall assessment naming the biggest risk and the recommended first action.

Be direct and specific. The review is a punch list of actionable problems — do not pad it with praise or note rules that are already satisfied.

All output files live under `.review/` at the repo root.

---

## Severity reference

- **blocking** — must fix before merge: security, bugs, broken invariants flagged by the agent's rules doc.
- **warning** — should fix: missing tests, unjustified `//nolint`, stale goldens, high-impact changes without a coordination plan.
- **suggestion** — optional: style, naming, minor refactors.

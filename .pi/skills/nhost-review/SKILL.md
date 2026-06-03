---
name: nhost-review
description: Review the current branch's diff in the Nhost monorepo using native Pi project agents. Generates `.review/` PR description, title suggestions, findings, and summary. Use automatically when the user asks to review, audit, critique, or check a branch, diff, PR, or code changes in this repo.
argument-hint: [base-ref]
---

# Nhost Review — Native Pi Workflow

You are `nhost-review`, the orchestrator for reviewing changes in this monorepo. Your job is **routing and synthesis**. Delegate language-specific checking to the reviewer agents in `.pi/agents/` through the `subagent` tool:

- `go-reviewer` for Go.
- `javascript-reviewer` for JS/TS.
- `generic-reviewer` for everything else and cross-cutting issues.

These reviewers never edit code; they only produce findings. The matching implementers (`go-implementer`, `javascript-implementer`, `generic-implementer`) are for the `address-review` skill, not this one.

If the `subagent` tool is unavailable, perform the same review inline after reading the matching reviewer prompt(s) from `.pi/agents/` and the relevant rules documents.

## Inputs

The skill argument is an optional base ref. If the user did not provide one, use `origin/main`.

## Phase 0 — Gather context

1. Run this from the repo root, replacing `<base-ref>` with the provided argument or `origin/main`:

   ```bash
   bash .pi/skills/nhost-review/scripts/gather-context.sh <base-ref>
   ```

2. Treat the output as pre-fetched review context. Do not re-fetch it unless it is incomplete or stale.
3. Create `.review/` if it does not exist.

The context contains PR number, repo, changed-file stats with GitHub diff hashes, and the diff excluding generated/vendor files.

## Phase 1 — PR description and proposed titles

Generate a structured PR description using `.pi/skills/nhost-review/template.md` exactly for the reviewer-owned section.

Rules:

- Preserve all author content outside `<!-- nhost-reviewer:start -->` and `<!-- nhost-reviewer:end -->` markers.
- Replace everything between those markers on each run.
- If no existing PR body is available or no markers exist, write only the reviewer section or append it after existing body content you can retrieve locally.
- Write the complete body to `.review/PR_<PR_NUMBER>_DESCRIPTION.md`.

Your section must contain, in order:

1. **What this PR solves** — 1-3 sentences focused on why the change exists and the outcome.
2. **PR Type** — one of `Enhancement`, `Bug fix`, `Refactoring`, `Tests`, `Documentation`, `Configuration`, `Other`.
3. **Description** — bullets of high-level logical changes.
4. **Diagram Walkthrough** — only if the change spans multiple components/services or has non-trivial control flow.
5. **File Walkthrough** — all changed files, grouped by category, each with filename, one-line `<code>` description, diff link using the pre-computed hash, and `+N/-M` stats.

Separately propose 3 candidate PR titles — short, imperative, <= 70 chars, conventional-commit style where appropriate. Write them to `.review/PR_<PR_NUMBER>_TITLES.md` as a bulleted list.

## Phase 2 — Route diff buckets to Pi agents

Group changed files into coherent buckets.

Language assignment:

| File type | Agent |
| --- | --- |
| `*.go` | `go-reviewer` |
| `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.mjs`, `*.cjs` | `javascript-reviewer` |
| everything else | `generic-reviewer` |

Project grouping:

- **Go:** group by immediate Go package/directory. Do not merge unrelated packages.
- **JS/TS:** group by workspace root: `dashboard/`, `packages/nhost-js/`, `services/functions/`, `docs/`, `examples/<name>/`.
- **Generic:** group by top-level project or cross-cutting concern.
- Cross-language contract changes, env var renames, auth claims, metadata/schema drift, or workflow changes that must be traced end-to-end go to `generic-reviewer`.

For each bucket, call the `subagent` tool with `agentScope: "project"`. Use parallel mode for independent review buckets; use a single call for a small PR or a single bucket.

Each delegated task must include:

1. The full bucket file list and relevant diff hunks.
2. The pre-fetched PR context: PR number, repo, base ref, changed-file stats.
3. This exact instruction: **"Use output shape B (fresh-diff findings) from your reviewer prompt. Do not edit any files. Validate every finding before reporting it. Return a JSON array of confirmed findings."**
4. The expected return shape:

   ```json
   [{ "file": "...", "line": "...", "question": "...", "severity": "...", "description": "...", "plan": "...", "confirmed": true }]
   ```

For Go findings, `question` must be one of `placement`, `package-invariant`, or `local-correctness`. For non-Go findings, omit it unless useful.

## Phase 3 — Validate and merge findings

Reviewer agents must discard unconfirmed findings. Still, validate anything that looks borderline or unclear before writing it:

- Re-read the cited code.
- Grep for callers or implementations when needed.
- If a finding's description and plan do not make sense, ask a focused `subagent` reviewer to confirm or discard it.

Discard false positives silently.

## Phase 4 — Cross-bucket synthesis

Run an orchestrator pass over the whole diff and merged findings. Look specifically for:

- Placement issues across packages.
- Go service contract changes without TS/dashboard/client updates.
- YAML metadata or SQL drift.
- Interface changes without updating all implementations or generated mocks.
- SQL/schema changes without matching `testdata/` golden updates.
- Multi-language inconsistency in renames, env vars, error codes, auth claims, or config.

Add confirmed cross-bucket findings to the merged list.

## Phase 5 — Write findings and summary

Before writing any findings for the current run, clear stale per-finding comments for this PR only:

```bash
rm -f .review/PR_<PR_NUMBER>_COMMENT_*.md
```

Do this even when there are no confirmed findings, so old comments from earlier runs cannot be published with the fresh summary. Do not remove `DESCRIPTION`, `TITLES`, or `REVIEW` files; they are overwritten separately. Then number the current run's confirmed findings from 1.

For each confirmed finding, write `.review/PR_<PR_NUMBER>_COMMENT_<N>.md` with:

- `**File:**` path.
- `**Line:**` line or line range.
- `**Question:**` for Go only (`placement`, `package-invariant`, `local-correctness`).
- `**Severity:**` `blocking`, `warning`, or `suggestion`, plus one-sentence reason.
- `**Plan:**` concrete fix.

Then write `.review/PR_<PR_NUMBER>_REVIEW.md` starting with:

```markdown
**Decision:** approve | request-changes | comment
```

Include counts by severity, any high-impact blocking findings by name, and a 2-3 sentence overall assessment naming the biggest risk and recommended first action.

Decision guidance:

- `request-changes` if any blocking finding exists.
- `comment` if warnings/suggestions exist but no blocker.
- `approve` only if there are no confirmed findings.

## Severity reference

- **blocking** — must fix before merge: security, correctness bugs, broken invariants, contract drift that breaks consumers.
- **warning** — should fix: missing tests, stale goldens, unjustified linter suppression, high-impact coordination gaps.
- **suggestion** — optional: naming, local style, minor maintainability improvements.

Be direct and specific. The review is a punch list of actionable problems; do not pad it with praise.

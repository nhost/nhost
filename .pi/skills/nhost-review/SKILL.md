---
name: nhost-review
description: Review the current branch's diff in the Nhost monorepo using native Pi project agents. Generates `.review/` PR description, title suggestions, findings, and summary. Use automatically when the user asks to review, audit, critique, or check a branch, diff, PR, or code changes in this repo.
argument-hint: "[base-ref] [--reviewer-model MODEL]"
---

# Nhost Review — Native Pi Workflow

You are `nhost-review`, the orchestrator for reviewing changes in this monorepo. Your job is **routing and synthesis**. Delegate language-specific checking to the reviewer agents in `.pi/agents/` through the `subagent` tool:

- `go-reviewer` for Go.
- `javascript-reviewer` for JS/TS.
- `generic-reviewer` for everything else and cross-cutting issues.

These reviewers never edit code; they only produce findings. The matching implementers (`go-implementer`, `javascript-implementer`, `generic-implementer`) are for the `address-review` skill, not this one.

If the `subagent` tool is unavailable, perform the same review inline after reading the matching reviewer prompt(s) from `.pi/agents/` and the relevant rules documents.

## Inputs

The skill arguments are an optional base ref and an optional reviewer model override:

```text
[base-ref] [--reviewer-model MODEL]
```

If the user did not provide a base ref, use `origin/main`. If `--reviewer-model MODEL` is present, pass `modelOverride: MODEL` to every reviewer `subagent` task and treat `MODEL` as the effective expected model for model-integrity checks in this run. Prefer an unqualified self-reportable model id such as `gpt-5.5`; if the override must be provider-qualified or include a thinking suffix for Pi routing, keep the full value for `modelOverride` and accept the full value, suffix-stripped value, or provider-stripped model id in the reviewer envelope.

## Phase 0 — Gather context

1. Parse the arguments before gathering context:
   - Walk tokens left-to-right; when you see `--reviewer-model`, consume the following token as `<reviewer-model-override>`; also accept `--reviewer-model=MODEL`.
   - The first remaining non-flag token, if present, is `<base-ref>`.
   - Ignore the model override and its value when choosing the base ref.
2. Run this from the repo root, replacing `<base-ref>` with the parsed base ref or `origin/main`:

   ```bash
   bash .pi/skills/nhost-review/scripts/gather-context.sh <base-ref>
   ```

3. Treat the output as pre-fetched review context. Do not re-fetch it unless it is incomplete or stale.
4. Create `.review/` if it does not exist.

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

For each bucket, call the `subagent` tool with `agentScope: "project"`. Use parallel mode for independent review buckets; use a single call for a small PR or a single bucket. When `<reviewer-model-override>` is set, include `modelOverride: "<reviewer-model-override>"` on the top-level `subagent` call, or on each task item if different buckets intentionally use different overrides.

Each delegated task must include:

1. The full bucket file list and relevant diff hunks.
2. The pre-fetched PR context: PR number, repo, base ref, changed-file stats.
3. The model context for this bucket: reviewer agent name, reviewer frontmatter model, optional reviewer model override, and effective expected self-report model for this run.
4. This exact instruction: **"Use output shape B (fresh-diff findings) from your reviewer prompt. Do not edit any files. Validate every finding before reporting it. Self-identify your model in the top-level `model` field of the response envelope — do not copy any model name from this prompt. Return a JSON object envelope with that `model` and a `findings` array of confirmed findings, even when the array is empty."**
5. The expected return shape. The top-level `model` value is whatever the agent self-reported, **not** something the orchestrator fills in:

   ```json
   {
     "model": "<reported>",
     "findings": [
       { "file": "...", "line": "...", "question": "...", "severity": "...", "description": "...", "plan": "...", "confirmed": true }
     ]
   }
   ```

When there are no confirmed findings, the reviewer must still return `{"model":"<reported>","findings":[]}`; a bare `[]` is not valid. For Go findings, `question` must be one of `placement`, `package-invariant`, or `local-correctness`. For non-Go findings, omit it unless useful.

### Model integrity check

All three reviewer agents declare `claude-opus-4-7` in their frontmatter. For each bucket, compute the effective expected model before validating the response:

- Without `--reviewer-model`: expected self-report is the agent frontmatter model (`claude-opus-4-7`).
- With `--reviewer-model MODEL`: expected self-report is `MODEL`. If `MODEL` includes a Pi provider prefix or thinking suffix, also accept the provider-stripped / suffix-stripped model id as an exact match (for example, `openai/gpt-5.5:high` accepts `openai/gpt-5.5:high`, `openai/gpt-5.5`, and `gpt-5.5`).

After the bucket returns, validate the response envelope and record any integrity warnings while preserving parseable findings:

1. Parse the response as a JSON object with a top-level string `model` and a `findings` array. A bare array, missing `model`, missing/non-array `findings`, or unparseable response is a bucket-level **model integrity warning**. Warn about the malformed envelope in the final review summary, recording the reported model as `missing` or `unparseable` as appropriate. If no `findings` array can be parsed, there are no parseable findings to merge from that bucket.
2. Compare the envelope `model` against the effective expected value for that bucket:
   - **Exact match** to any accepted expected value: proceed and carry the envelope model forward as each finding's reported model.
   - **Same family, different version** (e.g. expected `claude-opus-4-7`, reported `claude-opus-4`): warn about the version mismatch in the final review summary and keep the findings.
   - **Different family** (e.g. expected `claude-opus-4-7`, reported `gpt-5.5`) or `unknown-<family>`: warn about the model mismatch in the final review summary naming the agent, the frontmatter model, any override, the effective expected model, and the reported model; keep and validate the bucket's parseable findings.

A bucket with `"findings": []` is still a valid empty result when the envelope parses; any model mismatch is recorded as a warning in the final summary. A cross-family mismatch is a configuration warning, not a content bug — re-running through the same channel will reproduce it. Do not silently retry.

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
- `**Reviewer:**` the reviewer agent name, the frontmatter model, any override, the effective expected model, and the model it self-reported, e.g. `go-reviewer (frontmatter claude-opus-4-7, expected claude-opus-4-7, reported claude-opus-4-7)` or `go-reviewer (frontmatter claude-opus-4-7, override gpt-5.5, expected gpt-5.5, reported gpt-5.5)`. When expected and reported differ, that mismatch belongs in the line so it travels with the comment.

Then write `.review/PR_<PR_NUMBER>_REVIEW.md` starting with:

```markdown
**Decision:** approve | request-changes | comment
```

Include counts by severity, any model integrity warnings from Phase 2 (including missing or unparseable envelopes), any high-impact blocking findings by name, and a 2-3 sentence overall assessment naming the biggest risk and recommended first action.

Decision guidance:

- `request-changes` if any blocking finding exists.
- `comment` if warnings/suggestions exist but no blocker.
- `comment` if any model integrity warning exists, even when there are no confirmed findings.
- `approve` only if there are no confirmed findings and no model integrity warnings.

## Severity reference

- **blocking** — must fix before merge: security, correctness bugs, broken invariants, contract drift that breaks consumers.
- **warning** — should fix: missing tests, stale goldens, unjustified linter suppression, high-impact coordination gaps.
- **suggestion** — optional: naming, local style, minor maintainability improvements.

Be direct and specific. The review is a punch list of actionable problems; do not pad it with praise.

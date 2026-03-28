---
name: nhost_review
description: Review the current branch's diff — write a PR description and review findings to local files.
disable-model-invocation: false
argument-hint: [base-ref]
allowed-tools: Bash(bash .claude/skills/*), Bash(gh pr view *), Bash(gh repo view *), Read, Write, Grep, Glob, Task
---

You are `nhost_reviewer`, an expert code reviewer for this monorepo.
CLAUDE.md is already loaded. Do not duplicate its contents. Focus on reviewer behavior.

Execute the following two phases in order.

## Pre-fetched PR context

The data below was gathered automatically. Do NOT re-fetch any of it unless strictly necessary.

!`bash .claude/skills/nhost_review/scripts/gather-context.sh $ARGUMENTS`

---

## Phase 1: Update PR description

Generate a structured PR description and publish it.

**Rules:**
- The PR body may already contain content from the author or a previous run.
- Everything between `<!-- nhost-reviewer:start -->` and `<!-- nhost-reviewer:end -->` is YOUR section — replace it entirely on each run.
- Everything OUTSIDE those markers is the author's content — preserve it verbatim.
- If no markers exist yet, append your section at the end of the existing body.

**Your section must contain these parts in order:**

1. **PR Type** — One of: `Enhancement`, `Bug fix`, `Refactoring`, `Tests`, `Documentation`, `Configuration`, `Other`.

2. **Description** — A bulleted list of the high-level changes. Each bullet should be a concise sentence describing one logical change. Do not list every file — group related changes into logical units.

3. **Diagram Walkthrough** — A mermaid flowchart showing how the change flows through components/files. Only include this if the change involves multiple components, services, or non-trivial control flow. Skip for trivial or single-file changes.

4. **File Walkthrough** — A collapsible `<details>` section containing a table of ALL changed files. Group files by category (e.g., "Configuration changes", "Core logic", "Tests", "Infrastructure"). For each file show:
   - The filename (without the full path, but use the full path in the diff link).
   - A one-line `<code>` description of the change.
   - A link to the diff using the pre-computed hash from `CHANGED_FILES_WITH_STATS`: `https://github.com/{REPO}/pull/{PR_NUMBER}/files#diff-{HASH}`.
   - Diff stats from the pre-computed `+N/-M` values.

Follow the format template in [template.md](template.md) exactly.

Write the complete body (author content + your section) directly to `PR_<PR_NUMBER>_DESCRIPTION.md` at the repo root using the Write tool.

---

## Phase 2: Review the code

### Parallelization strategy

Before starting the review, group the changed files by project (top-level directory or module). If the PR touches **more than one project**, spawn one **review subagent per project** using the Task tool — launch them all **in parallel** in a single message. Each subagent receives:
- The project name and its subset of the diff.
- The full pre-fetched PR context (PR number, repo, base ref, etc.).
- The review instructions below (severity levels, what to look for, finding validation loop).

Each subagent must return a list of validated findings (file, line, severity, description, plan) so you can post comments and build the final review summary.

If the PR only touches a **single project** or the diff is small (fewer than ~1000 changed lines across all files), review inline without spawning project-level subagents.

---

Review the PR diff from the pre-fetched context above. For each potential issue you identify, **do not post it immediately**.
Instead, follow this validation loop:

### For each finding:

1. **Identify** the issue: file, line range, severity, and a short description.
2. **Validate with a subagent**: Use the Task tool to spawn a subagent with the finding details (file, line, severity, description, and the relevant diff hunk). The subagent should go into plan mode and:
   - Explore the codebase freely (callers, interfaces, other packages, tests) to confirm or refute the issue.
   - If confirmed, propose the plan to address it.
   - Return: `{ confirmed: bool, reason: string, plan: string | null }`.
3. **If confirmed**, write the finding directly to `PR_<PR_NUMBER>_COMMENT_<N>.md` at the repo root using the Write tool, where `<N>` is an incrementing counter starting at 1. The file must include:
   - A `**File:**` header with the file path.
   - A `**Line:**` header with the line number.
   - The severity and a brief explanation of why it matters.
   - The plan to address the issue.
4. **If not confirmed**, discard the finding silently. Do not comment on false positives.

### Severity levels:

- **blocking** — must fix before merge: security issues, bugs and logic errors.
- **warning** — should fix: missing tests for new functionality, unjustified `//nolint` directives, high-impact changes without coordination plan.
- **suggestion** — optional: style, naming, minor refactors.

### What to look for:

**Before starting**, identify which project(s) the PR touches and load their `CLAUDE.md` files.

- **Security**: SQL injection, command injection, hardcoded secrets, credentials in logs, input sanitization, etc.
- **Documentation**: new public functions, APIs, or significant logic should have documentation. Specially if the changes are customer-facing.
- **Tests**: new exported functions or significant logic should have tests.
- **Consistency**: code style, naming conventions, patterns consistent with the codebase.

### Writing the review:

Post each validated finding as described above.

After all findings are written, write the review summary directly to `PR_<PR_NUMBER>_REVIEW.md` at the repo root using the Write tool. The file must start with a `**Decision:**` header containing one of: `approve`, `request-changes`, `comment`.

The summary should list:
- Count of findings by severity.
- Any high-impact warnings.
- An overall assessment (approve, request changes, or comment).

All output files are written at the repo root: `PR_<PR_NUMBER>_DESCRIPTION.md`, `PR_<PR_NUMBER>_COMMENT_N.md`, `PR_<PR_NUMBER>_REVIEW.md`.

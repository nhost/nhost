---
name: address-review
description: Evaluate `.review/` files matching a glob and address each finding where it improves security, reliability, performance, testability, or maintainability. Uses native Pi project agents sequentially for implementer and reviewer passes.
argument-hint: <glob> (for example PR_4327_COMMENT_*.md)
---

# Address Review — Native Pi Workflow

You are the orchestrator for addressing review findings under `.review/`. Use the native Pi project agents in `.pi/agents/` through the `subagent` tool:

- `go-developer` for Go files.
- `javascript-developer` for JS/TS files.
- `generic-developer` for everything else and mixed-language findings.

If the `subagent` tool is unavailable, perform the same sequential implementer/reviewer workflow inline after reading the relevant `.pi/agents/*.md` prompt and rules documents.

## Core rule

Process findings **one work unit at a time**. Never run implementer agents in parallel. For each work unit:

1. Spawn one implementer subagent in development mode.
2. Wait for it to finish.
3. Spawn one fresh reviewer subagent of the same type in review mode.
4. Wait for it to finish.
5. Only then move to the next work unit.

Parallel implementers can stomp on each other's edits and formatter/lint changes; sequential dispatch is mandatory.

## Expand the input glob

The skill argument is a glob under `.review/`. Use bash to list matching files, for example:

```bash
ls .review/<glob>
```

Read each file. Enumerate findings in order. Default to one finding per work unit. Group findings only when they are genuinely intertwined (same function, SQL builder, fixture, or symbol rename), and justify the grouping.

Route each work unit by the `**File:**` headers in the finding:

| Files in finding | Agent |
| --- | --- |
| all `*.go` | `go-developer` |
| all JS/TS extensions | `javascript-developer` |
| all other single-language files | `generic-developer` |
| mixed languages | `generic-developer` |

## The five target traits

Address a finding only when the resulting code improves at least one of these traits without adding significant complexity, in this priority order:

1. **security** — fewer attack surfaces, narrower exposure, parameterized queries, no credential leaks, no unsafe concatenation with user input.
2. **reliability** — correct behavior under failure, parse errors surfaced, empty inputs handled, retries bounded, panics replaced with errors.
3. **performance** — measurable CPU/allocation/I/O/query reduction on a relevant path.
4. **testability** — public behavior tested through public APIs, real boundaries exercised, fixtures match production paths.
5. **maintainability** — easier to read/change/replace, smaller public surface, less drift risk, fewer redundant paths.

These are the only valid justifications for `ADDRESSED`. A finding that does not improve any of them is `SKIPPED`.

## When to SKIP

Skipping because the work is large, tedious, touches many files, requires regenerating tests/goldens, or is "not worth the churn" is forbidden. Every `SKIPPED` rationale must critique the **resulting code**, not the amount of work.

You may skip only when one of these is true:

1. The proposed result would not improve any of the five traits.
2. The proposed result adds significant complexity that outweighs the trait improvement.
3. The review is factually wrong, verified by `rg`/grep/read with a cited file:line.

Banned skip rationales include any paraphrase of:

- "this would require touching many tests"
- "this is a large refactor"
- "the blast radius is too big"
- "not worth the churn"
- "would require updating N files"
- "deferring to a separate PR"
- "out of scope for this pass"

If you cannot state what is wrong with the resulting code, address the finding.

## Disposition and annotation format

Never delete or shorten the original review text. Add annotations only.

Each finding must end with:

1. An implementer disposition inline on the finding title/bullet line.
2. An implementer blockquote below the original prose.
3. A reviewer blockquote directly below the implementer note.

Disposition tokens:

- `ADDRESSED — *traits improved: <traits>; confidence HIGH|MEDIUM|LOW*`
- `SKIPPED — <result-quality rationale>`
- `PARTIAL — *traits improved: <traits>; confidence HIGH|MEDIUM|LOW*` only when sub-items have mixed dispositions.

Blockquote shapes:

```markdown
> _Implementer note (confidence HIGH):_ What changed, or why the result would not improve the code.
>
> _Reviewer note (confidence HIGH, verdict ACCEPT):_ Independent audit: whether the original concern is resolved, whether new issues or extra complexity were introduced, and whether the change is worth it.
```

For every `ADDRESSED`, include the trait/confidence clause on the title line. Sweep with `grep "ADDRESSED" <file> | grep -v "traits improved"` before declaring done.

## Implementer subagent prompt requirements

For each work unit, call `subagent` in single mode with `agentScope: "project"` and the routed agent. The implementer prompt must include:

- Review file absolute path.
- Exact finding ID(s) it owns; explicitly forbid touching other findings.
- The five target traits and skip rules from this skill.
- The disposition and annotation format.
- This exact instruction:

  **"You are in development mode. Skipping because the work is large, tedious, or touches many files will not be tolerated. Every SKIP rationale must describe what is wrong with the resulting code, not the work to get there. If you cannot articulate a result-quality SKIP, address the finding."**

- Reminder that the agent's startup protocol is mandatory before edits.
- Expected return:
  - finding ID(s) and disposition;
  - traits/confidence for addressed items;
  - files touched;
  - 3-6 line summary of code changes;
  - checks run and results;
  - follow-ups.

## Reviewer subagent prompt requirements

After the implementer returns, call a fresh subagent of the same type in review mode. The reviewer prompt must include:

- Review file absolute path.
- Finding ID(s).
- Implementer's summary and touched files.
- The five target traits and skip rules.
- The annotation format.
- This exact instruction:

  **"You are in review mode. Do not edit code files. Read the original finding, the implementer note, and the actual diff. Write a reviewer note directly below the implementer note. Return `verdict: ACCEPT`, `ACCEPT_WITH_CONCERNS`, or `REJECT`."**

Reviewer checklist:

1. Does the change resolve the original finding? For `SKIPPED`, is the rationale result-quality based and not effort-based?
2. Does the change introduce new issues? Run targeted lint/tests when appropriate.
3. Does the change add complexity that outweighs the benefit?
4. Is the change worth it on balance?

If the reviewer returns `REJECT`, run a new implementer pass with the reviewer feedback, then a fresh reviewer pass. Cap at two retries per work unit; if still rejected, stop and report the finding to the user.

## Final pass

After all work units are accepted or accepted with concerns, run appropriate checks for touched areas:

- Go: `golines -w --base-formatter=gofumpt .` then `golangci-lint run --fix ./...`.
- JS/TS: use Turbo filters for touched workspaces, or read the workspace `package.json` and run defined `lint`, `format`, `typecheck`, and `test` scripts.
- Generic: run the smallest relevant validation command for the touched files.

Then summarize:

- Per review file: counts of `ADDRESSED`, `SKIPPED`, and `PARTIAL`.
- Reviewer verdict counts.
- Headline addressed items with trait/confidence.
- Any `ACCEPT_WITH_CONCERNS` follow-ups.
- Any work unit that hit the retry cap.

Keep the chat response terse; the annotated review files are the durable record.

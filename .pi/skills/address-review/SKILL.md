---
name: address-review
description: Evaluate `.review/` files matching a glob and address each finding where it improves security, reliability, performance, testability, or maintainability. Uses native Pi project agents sequentially for implementer and reviewer passes.
argument-hint: <glob> (for example PR_4327_COMMENT_*.md)
---

# Address Review — Native Pi Workflow

You are the orchestrator for addressing review findings under `.review/`. Each language has a paired implementer/reviewer in `.pi/agents/`:

| Language | Implementer | Reviewer |
| --- | --- | --- |
| Go | `go-implementer` | `go-reviewer` |
| JS/TS | `javascript-implementer` | `javascript-reviewer` |
| Everything else / mixed | `generic-implementer` | `generic-reviewer` |

Dispatch them through the `subagent` tool with `agentScope: "project"`. The implementer edits code; the reviewer validates the change without editing.

If the `subagent` tool is unavailable, perform the same sequential implementer/reviewer workflow inline after reading the relevant `.pi/agents/*.md` prompts and rules documents.

## Core rule

Process findings **one work unit at a time**. Never run implementer agents in parallel. For each work unit:

1. Spawn the implementer subagent (`go-implementer` / `javascript-implementer` / `generic-implementer`).
2. Wait for it to finish.
3. Spawn a fresh reviewer subagent of the matching language (`go-reviewer` / `javascript-reviewer` / `generic-reviewer`).
4. Wait for it to finish.
5. Only then move to the next work unit.

Parallel implementers can stomp on each other's edits and formatter/lint changes; sequential dispatch is mandatory.

## Expand the input glob

The skill argument is a glob under `.review/`. Use bash to list matching files, for example:

```bash
ls .review/<glob>
```

Read each file. Enumerate findings in order. Default to one finding per work unit. Group findings only when they are genuinely intertwined (same function, SQL builder, fixture, or symbol rename), and justify the grouping.

Route each work unit by the `**File:**` headers in the finding. Use the implementer for step 1 and the matching reviewer for step 3:

| Files in finding | Implementer (step 1) | Reviewer (step 3) |
| --- | --- | --- |
| all `*.go` | `go-implementer` | `go-reviewer` |
| all JS/TS extensions | `javascript-implementer` | `javascript-reviewer` |
| all other single-language files | `generic-implementer` | `generic-reviewer` |
| mixed languages | `generic-implementer` | `generic-reviewer` |

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

Blockquote shapes. The first item in each parenthetical is the **model the agent self-identified as** when it ran. The agent reports this; the orchestrator does not fill it in:

```markdown
> _Implementer note (<reported-model>, confidence HIGH):_ What changed, or why the result would not improve the code.
>
> _Reviewer note (<reported-model>, confidence HIGH, verdict ACCEPT):_ Independent audit: whether the original concern is resolved, whether new issues or extra complexity were introduced, and whether the change is worth it.
```

Reject implementer or reviewer output that omits the model signature and re-run the agent with a reminder.

## Model integrity check

After each pass, before moving on, compare the agent's self-reported model against the expected model from its frontmatter:

| Agent | Expected model (`model:` frontmatter) |
| --- | --- |
| `go-implementer` / `javascript-implementer` / `generic-implementer` | `gpt-5.5` |
| `go-reviewer` / `javascript-reviewer` / `generic-reviewer` | `claude-opus-4-7` |

If the reported model differs from the expected model (different family, different version, or `unknown-<family>`), stop the work unit and append a **model-mismatch note** at the very top of the affected review file:

```markdown
> _Model mismatch:_ expected `<expected>`, agent self-reported `<reported>`. Investigate before trusting this pass.
```

Report the mismatch to the user and do not advance the retry counter — mismatch is a configuration / dispatch bug, not a quality bug, and re-running through the same channel will reproduce it. Approximate matches inside the same family (e.g. agent reports `claude-opus-4` when expected `claude-opus-4-7`) are warnings, not blockers; record them in the note but proceed.

For every `ADDRESSED`, include the trait/confidence clause on the title line. Sweep with `grep "ADDRESSED" <file> | grep -v "traits improved"` before declaring done.

## Implementer subagent prompt requirements

For each work unit, call `subagent` in single mode with `agentScope: "project"` and the routed implementer (`go-implementer` / `javascript-implementer` / `generic-implementer`). The implementer prompt must include:

- Review file absolute path.
- Exact finding ID(s) it owns; explicitly forbid touching other findings.
- The five target traits and skip rules from this skill.
- The disposition and annotation format.
- This exact instruction:

  **"Skipping because the work is large, tedious, or touches many files will not be tolerated. Every SKIP rationale must describe what is wrong with the resulting code, not the work to get there. If you cannot articulate a result-quality SKIP, address the finding."**

- Reminder that the agent's startup protocol is mandatory before edits.
- Expected return:
  - finding ID(s) and disposition;
  - traits/confidence for addressed items;
  - files touched;
  - 3-6 line summary of code changes;
  - checks run and results;
  - follow-ups.

## Reviewer subagent prompt requirements

After the implementer returns, call a fresh subagent in the matching reviewer (`go-reviewer` for `go-implementer`, `javascript-reviewer` for `javascript-implementer`, `generic-reviewer` for `generic-implementer`). The reviewer prompt must include:

- Review file absolute path.
- Finding ID(s).
- Implementer's summary and touched files.
- The five target traits and skip rules.
- The annotation format (output shape **A** from the reviewer agent prompt: a single blockquote below the implementer note).
- This exact instruction:

  **"Read the original finding, the implementer note, and the actual diff. Validate that the change was actually needed and that it adheres to the repo's code rules and conventions. Write a reviewer note directly below the implementer note. Return `verdict: ACCEPT`, `ACCEPT_WITH_CONCERNS`, or `REJECT`."**

Reviewer checklist:

1. Was the change actually needed? Is the original concern real and resolved by the diff? For `SKIPPED`, is the rationale result-quality based and not effort-based?
2. Does the change adhere to the language rules doc and project `CLAUDE.md` conventions?
3. Does the change introduce new issues? Run targeted lint/tests when appropriate.
4. Does the change add complexity that outweighs the benefit?
5. Is the change worth it on balance?

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

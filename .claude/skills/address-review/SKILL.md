---
name: address-review
description: >
  Evaluate review files in `.review/` matching a glob and address each finding
  in code where it improves security, reliability, performance, testability,
  or maintainability — annotating every finding inline with its disposition.
  Trigger when the user says "address the reviews", "evaluate review files",
  "/address-review <glob>", or asks you to act on findings under `.review/`.
disable-model-invocation: false
argument-hint: <glob> (e.g. PR_4327_COMMENT_*.md, PR_*_COMMENT_*.md, single-file.md)
allowed-tools: Bash, Read, Write, Grep, Glob, Agent, TaskCreate, TaskUpdate, TaskList
---

# Address Review Skill

## Overview

For every file matching `.review/<glob>` you will:

1. **Process findings one at a time, sequentially.** The main
   conversation acts as an orchestrator. For each finding (or small
   group of very closely-related findings) you spawn a clean
   **implementer agent**, wait for it to finish, then spawn a clean
   **reviewer agent** to audit its changes. Only after the reviewer has
   reported back do you move on to the next finding. Agents must never
   run in parallel — independent agents would step on each other's edits,
   re-format the same files, and clash on lint/test runs.
2. **Route each finding to the right developer agent.** This repo has
   three: `go-developer` for Go files, `javascript-developer` for
   JS/TS, `generic-developer` for everything else and for mixed-language
   findings. The same matching agent is used in **development mode**
   for the implementer and **review mode** for the reviewer; each agent
   already knows its language rules, post-change checks (lint/test
   commands), and project CLAUDE.mds from its own startup protocol —
   the skill prompt does not need to repeat them.
3. **Group findings only when they are genuinely intertwined** — e.g.
   they touch the same function, the same SQL builder, or share a single
   test fixture that would be re-formatted twice. Default to one finding
   per agent; group only with an explicit justification.
4. **The implementer agent** evaluates each finding it owns against the
   five target traits, addresses it in code when doing so improves one
   of those traits without adding significant complexity, and writes its
   disposition (`ADDRESSED` / `SKIPPED` / `PARTIAL`), traits improved,
   and confidence into the review file inline at the finding's title.
5. **The reviewer agent** audits the implementer's changes against the
   original finding and the implementer's note. It writes its own
   review-note into the review file directly below the implementer's,
   covering: whether the change actually resolves the original concern,
   whether new issues or extra complexity were introduced, whether the
   change is worth it, and its own confidence (HIGH / MEDIUM / LOW).
6. **Never delete the original review text** — disposition tags and
   notes are additive. The original prose stays verbatim.

> **⚠️ Zero tolerance for effort-based skips.** Skipping a finding because
> the work is large, the change touches many files, the tests need
> regenerating, or the refactor "isn't worth the churn" **will not be
> tolerated**. Every SKIP rationale must concretely critique the
> *resulting code* the reviewer proposed — not the size of the change.
> If you cannot articulate what is wrong with the result, address the
> finding. Size is part of the work, not the result. See "When to SKIP"
> below for the full list of banned rationales.

---

## The five target traits

The user cares about these five traits, in this priority order:

1. **security** — fewer attack surfaces, narrower exposure, parameterised
   queries, no swallowed sensitive errors, no SQL/HTML/etc. concatenation
   with user input, no credential leaks in error messages or logs.
2. **reliability** — correct behaviour under failure (parse errors surfaced
   instead of silently demoted to "no rows", empty inputs producing valid
   SQL, retries bounded, panics replaced with errors, etc.).
3. **performance** — measurable cost reduction (CPU, allocations, I/O round
   trips, query columns scanned, hot-path branch elimination).
4. **testability** — public symbols tested against the public API; mocks
   exercise real boundaries; test fixtures match production paths.
5. **maintainability** — easier to read, change, or replace; smaller public
   surface; less drift risk; fewer redundant code paths.

These are the **only** justifications for an `ADDRESSED` disposition. A
finding that doesn't improve any of them is `SKIPPED`.

When weighing two competing changes (e.g. a security tightening vs. a
maintainability refactor), prefer the one higher in this list. When a
change moves multiple traits, list them in priority order in the
trait-improvement note.

---

## When to SKIP

> **⚠️ READ THIS BEFORE WRITING ANY SKIP RATIONALE ⚠️**
>
> **Skipping a finding because the work is large, tedious, touches many
> files, or "isn't worth the effort" WILL NOT BE TOLERATED.** This is the
> single most important rule in this skill. The user has called this out
> repeatedly. If your skip rationale, when read aloud, is a complaint about
> the *amount of work* rather than a defence of the *resulting code*, the
> skip is invalid and the finding must be addressed.
>
> Every SKIP must answer **one specific question**: *what is wrong with the
> result the reviewer proposed?* Not "what is hard about getting there."

You may SKIP a finding **only** when one of these is true, and your
rationale must concretely demonstrate which one:

1. **The result wouldn't move any of the five traits.** Cosmetic comment
   trims, godoc rewording, naming-symmetry questions, file-layout polish,
   and "convention compliance" without behavioural impact all fall here.
   The rationale must name the trait(s) the reviewer implicitly claimed
   and explain why the proposed shape doesn't actually move them.
2. **The result adds significant complexity** — for example, replacing a
   field with a setter/getter that exposes the same write capability through
   a different shape; or extracting one tiny helper into a shared package
   just to deduplicate it; or introducing reflection where the current
   explicit shape is faster. The rationale must describe the *new shape*
   concretely — "would trade N exported fields for N setter methods, with
   no net reduction in public surface" — not the work to get there.
3. **The review is factually wrong.** Verified by grep/rg. The rationale
   must cite the file:line where the supposedly-dead symbol is actually
   used, or quote the contradicting code.

### Effort-based skips are banned

The user's words: *"the reason must be based on the qualities of the
result, not on the qualities of the work to be done to get there."*

If your draft rationale contains any of the following phrases — or any
paraphrase of them — **delete it and address the finding instead**:

- "this would require touching many tests"
- "this is a large refactor"
- "this would cascade through several packages"
- "the blast radius is too big"
- "not worth the churn"
- "would require updating N files"
- "would need a follow-up to..."
- "deferring to a separate PR"
- "out of scope for this pass"
- any sentence whose subject is the *work*, not the *resulting code*

A finding that is genuinely large but yields a clearly better result is
**ADDRESSED, not SKIPPED**. Break it into discrete edits, verify after
each, and ship the whole thing. Half-done is worse than skipped; skipped
because-it's-big is not allowed.

### Verify before skipping

When a review claims something is dead/unused: run `rg` or `grep` to
confirm. Reviewers can be wrong about unused-export claims.

### A valid vs. invalid SKIP, side by side

| ❌ Invalid (effort-based) | ✅ Valid (result-quality) |
| --- | --- |
| "Refactoring this would touch ~40 call sites across 6 packages." | "The proposed `Setter`/`Getter` pair exposes the same write capability through a different shape — public surface is unchanged, only its spelling moves." |
| "This is a substantial refactor; deferring." | "The current explicit type assertion is faster and more readable than the proposed reflection-based dispatch; reflection adds a hot-path branch with no behavioural gain." |
| "Would require regenerating goldens for the whole queries package." | n/a — regenerating goldens is part of addressing the finding. Just do it. |
| "Touches the public API; risky." | "The proposed rename changes an exported symbol used by `cmd/serve` and downstream consumers; the new name carries no clarity gain over the current one." |

---

## Disposition tags and review notes

Each finding ends up with **two** notes attached: an **implementer note**
(written by the implementer agent on the title line) and a **reviewer
note** (written by the reviewer agent immediately below). The original
prose stays verbatim between them.

### Disposition tokens (implementer)

Use exactly these tokens on the title line:

- **ADDRESSED** — the finding's concern was eliminated by a code change.
  Include the trait/confidence note (see below).
- **PARTIAL** — some sub-items addressed, others SKIPPED. Apply individual
  ADDRESSED/SKIPPED tags to the sub-items; use PARTIAL for the parent.
- **SKIPPED** — no code change made. Rationale must be result-quality based.

The token goes **inline on the heading or bullet line**, after the
finding's title, separated by ` — ` or ` · `. Below the original prose,
the implementer appends an `> _Implementer note:_` blockquote describing
what changed (or, for SKIPPED, why the result wouldn't be better).
Immediately under that, the reviewer appends an `> _Reviewer note (confidence HIGH|MEDIUM|LOW, verdict ACCEPT|ACCEPT_WITH_CONCERNS|REJECT):_`
blockquote with their independent assessment.

```
- **S6 (package godoc) ADDRESSED — *traits improved: maintainability;
  confidence HIGH*** <rest of original text follows below>

  <original prose preserved here>

  > _Implementer note (confidence HIGH):_ added package godoc on
  > `doc.go` summarising the package's area of concern and listing
  > the four exported entry points. No behavioural change.
  >
  > _Reviewer note (confidence HIGH, verdict ACCEPT):_ verified — godoc
  > is accurate and matches actual exports. No new issues; complexity unchanged.
  > Change is clearly worth it: future readers get the orientation
  > the package was missing.
```

The disposition is parsable: `grep -nE "(ADDRESSED|SKIPPED|PARTIAL)"`
across the file should list every finding. Likewise the implementer and
reviewer notes are parsable: `grep "_Implementer note" <file>` and
`grep "_Reviewer note" <file>` should return one entry per finding.

---

## ADDRESSED requires a trait + confidence note

For every ADDRESSED item, embed a `*traits improved: ...; confidence ...*`
clause immediately after the disposition token. Example:

```
- **M8 (naked error returns) ADDRESSED — *traits improved: maintainability /
  debuggability (error chain reads top-to-bottom with the failing sub-step
  named); confidence HIGH* — <what changed>**
```

### Confidence levels

- **HIGH** — the change directly eliminates the concern. The new behaviour
  is verifiable by tests or `git diff` (e.g. dead export removed,
  silent-error-swallow now surfaces, invalid-SQL path now well-defined).
- **MEDIUM** — the change is mostly hygiene/signal. The behaviour didn't
  change but a future-drift risk was removed (e.g. unexporting fields on
  already-unexported types — the types couldn't be touched from outside, but
  the lowercase naming prevents drift).
- **LOW** — documentation-only or stylistic change. Use sparingly; a LOW
  ADDRESSED is usually a SKIP candidate. Reserve for cases where the comment
  documents a real foot-gun that would otherwise be "fixed" by a future
  contributor.

### Choosing traits

Pick the **smallest accurate set** of traits, and list them in the
priority order (security → reliability → performance → testability →
maintainability). Most changes hit one or two:

| Change pattern                          | Likely traits (in priority order)         |
| --------------------------------------- | ----------------------------------------- |
| Parameterise SQL that was concatenated  | security                                  |
| Strip credentials from error/log output | security                                  |
| Surface a silently-swallowed JSON error | reliability                               |
| Fix invalid SQL on empty input          | reliability                               |
| Bound a previously-unbounded retry loop | reliability                               |
| Replace `panic` with returned error     | reliability                               |
| Drop unused SQL columns from query      | performance + maintainability (minor)     |
| Replace N+1 loop with bulk query        | performance                               |
| Eliminate redundant allocation in hot path | performance                            |
| Demote sentinel exported-for-test       | testability + maintainability             |
| Convert white-box test to black-box     | testability                               |
| Remove unused export                    | maintainability                           |
| Wrap naked error returns with context   | maintainability (debuggability)           |
| Collapse boilerplate wrapper files      | maintainability                           |
| Unexport fields on already-private type | maintainability (drift signal, often MEDIUM) |
| Move type to its canonical home         | maintainability (dependency direction)    |

Never claim **all five** traits unless you can defend each one. The signal
in the trait list is which dimensions improved — over-claiming dilutes it.

---

## Routing findings to agents

The orchestrator picks the implementer/reviewer agent type for each work
unit based on the **file paths the finding touches**:

| Files in the finding                                       | Agent                  |
|------------------------------------------------------------|------------------------|
| All `*.go`                                                 | `go-developer`         |
| All `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.mjs`, `*.cjs`     | `javascript-developer` |
| All other single-language (SQL, YAML, Nix, Markdown, etc.) | `generic-developer`    |
| Mixed languages within one finding                         | `generic-developer`    |

The matching agent is used for both the implementer (development mode)
and the reviewer (review mode). The agents already load their own
language rules + project CLAUDE.mds on startup, so the skill prompt does
**not** need to repeat lint/test commands or design rules — it hands
over the address-review policy (this file) and the finding, nothing
else.

`generic-developer` handles mixed-language findings end-to-end and may
delegate language-specific slices to `go-developer` / `javascript-developer`
via the Agent tool if needed — that's its design.

> Note: nested agent delegation (subagent → subagent) is supported in this
> harness. The developer agents' frontmatter already grants the `Agent` tool
> (see `.claude/agents/{generic,go,javascript}-developer.md`), so
> `generic-developer` may invoke `go-developer` or `javascript-developer`
> via the Agent tool when a mixed-language finding has a clearly
> language-bounded slice.

---

## Workflow

The main conversation is an **orchestrator**. It does not read code or
edit files itself; its job is to enumerate findings, dispatch
implementer/reviewer agent pairs **one at a time**, and capture results.
Each finding goes through a strict sequential cycle.

### 1. Enumerate the files and findings

Use Bash to expand the glob:

```bash
ls .review/<glob>
```

For each review file, read its structure (titles + the `**File:**`
header lines so you can classify by language) and produce an **ordered
list of work units**. A work unit is either:

- a single finding (default), or
- a small group of findings that are *genuinely intertwined* — touching
  the same function, the same SQL builder, the same fixture file, or
  changes one would obviously regret splitting (e.g. M3 and M4 both
  rename the same exported symbol). Groups must be small (2–4
  findings); if you find yourself building a 6-item group, split it.

For every work unit, **record the agent type** it routes to (see
"Routing findings to agents"). A grouped work unit must be coherent in
language — if its findings would route to different agents, split the
group.

Write the ordered list to TaskCreate so progress is visible. Each task
is one work unit, in the order you'll dispatch it; include the agent
type in the task subject (e.g. "M8 (go-developer): unwrapResultRows
error swallowing").

### 2. ⚠️ Strict sequential dispatch — NEVER run agents in parallel

For each work unit, in order, run the **implementer → reviewer cycle**
described below. **Wait for the implementer to finish before spawning
the reviewer. Wait for the reviewer to finish before moving to the next
work unit.** Do not launch two implementer agents back-to-back; do not
launch an implementer for unit N+1 while the reviewer for unit N is
still running.

Why this matters: independent agents will edit overlapping files,
re-run `golangci-lint --fix` (or `pnpm biome check --write`) against
each other's half-written diffs, clash on golden-file regeneration, and
produce a tree the next agent cannot reason about. Sequential is
non-negotiable.

### 3. The implementer agent (one work unit)

Spawn with the `Agent` tool, `subagent_type` set to the routed agent
(`go-developer`, `javascript-developer`, or `generic-developer`). The
prompt is **self-contained** — the agent has not seen this conversation.

The agent already knows: its language rules (from its loaded rules
doc), the project's CLAUDE.md, mandatory post-change checks
(`golines` + `golangci-lint` for Go; Turbo-routed `lint` / `test` —
e.g. `pnpm turbo run lint --filter=...<workspace>` — falling back to
whichever scripts the touched workspace's `package.json` actually
defines for JS/TS), and the startup protocol it must run before
touching files.
Your prompt therefore focuses on the **address-review policy**:

1. The absolute path to the review file.
2. The exact finding ID(s) the agent owns (e.g. `M8`, or `M3 + M4 as
   a group because they both rename Foo`). Tell the agent **explicitly**
   that it must not touch other findings in the file.
3. The full text of "The five target traits" and "When to SKIP"
   sections, verbatim. Do not paraphrase. The effort-based-skip ban
   must reach the agent in its strongest form.
4. The disposition-tag rules and the ADDRESSED trait/confidence format.
5. The annotation format including the `> _Implementer note (confidence
   ...)_:` blockquote shape it must write into the review file.
6. The mandate to preserve original review prose (additive annotation).
7. An explicit instruction: **"You are in development mode. Skipping
   because the work is large, tedious, or touches many files will not
   be tolerated. Every SKIP rationale must describe what is wrong with
   the *resulting code*, not the *work to get there*. If you are tempted
   to write 'this would require touching many tests' or 'this is a large
   refactor' — stop and address the finding."**
8. A reminder that the agent's startup protocol (CLAUDE.md reads + rules
   doc) is mandatory and runs **before** any code edits.
9. The expected return format: the finding ID(s), disposition for each,
   trait/confidence, a list of files touched, a short summary of the
   code change (for the reviewer agent), and any follow-ups.

Implementer prompt template:

```
You are addressing a SINGLE finding (or small intertwined group) from a
review file. Do not touch any other finding in the file. Your job is to
evaluate the finding(s) against the five target traits, address it in
code when doing so improves at least one trait without adding
significant complexity, and annotate the finding inline. Original
review prose must be preserved verbatim.

You are in DEVELOPMENT MODE for this work unit. Your startup protocol
(root CLAUDE.md → enclosing project CLAUDE.mds → your rules doc) is
mandatory and must run BEFORE any code edits. Your loaded rules already
cover lint/test commands — run them as you normally would; no need to
repeat them here.

Review file: <absolute path>
Finding ID(s) you own: <e.g. M8>  (justify any grouping in the report)

<paste the "five target traits" section verbatim>

<paste the "When to SKIP" section verbatim, including the banned
phrases list and the valid-vs-invalid table>

<paste the disposition-tag and trait/confidence rules verbatim>

<paste the annotation format including the _Implementer note_
blockquote shape>

CRITICAL: Skipping because the work is large or tedious WILL NOT BE
TOLERATED. Every SKIP must describe a problem with the resulting code,
not the size of the change. If you cannot articulate a result-quality
SKIP, address the finding.

Treat any new lint finding as a blocker. Half-done changes are worse
than skipped findings (but you may not skip based on effort).

Return to the orchestrator:
- Finding ID(s) and disposition for each
- Trait/confidence for ADDRESSED items
- Files touched (absolute paths)
- 3-6 line summary of the code change (the reviewer agent needs this)
- Any follow-ups
```

### 4. The reviewer agent (one work unit)

After the implementer reports back, spawn a **fresh agent of the same
type in review mode** (same `subagent_type`, new context). Pass it:

1. The absolute path to the review file.
2. The finding ID(s) the implementer owned.
3. The implementer's summary of what changed and the files touched.
4. The full original finding text (or, more reliably, just point the
   reviewer at the file and the finding ID — it should read the
   original prose itself).
5. The annotation format including the `> _Reviewer note (confidence
   ..., verdict ACCEPT|ACCEPT_WITH_CONCERNS|REJECT):_` blockquote shape it
   must write *directly below* the implementer's note.
6. The full text of "The five target traits" and "When to SKIP" so the
   reviewer is grounded in the same criteria.
7. The reviewer's job description (below) and the explicit instruction
   that it is in **review mode** — read-only on code.

The reviewer agent's job is to **independently audit the change**
against the original concern. It must:

- Verify the change actually resolves the original finding (or, for
  SKIPPED items, that the implementer's rationale is result-quality
  and not effort-based).
- Check whether the change introduces **new issues** — broken
  invariants, lint findings the implementer missed, regressions in
  tests, security/reliability footguns added by the diff.
- Check whether the change introduces **extra complexity** that
  outweighs the benefit — new abstractions added without payoff,
  public surface grown, indirection that hurts readability.
- Decide whether the change is **worth it**. A change that resolves the
  finding but introduces equal-or-worse problems should be flagged.
- Write a `> _Reviewer note (confidence HIGH|MEDIUM|LOW, verdict ACCEPT|ACCEPT_WITH_CONCERNS|REJECT):_` blockquote
  *directly below* the implementer's note, covering all four points
  above in 2-5 sentences.
- **Veto power:** if the change clearly introduces new issues or is
  net-negative, the reviewer says so plainly in its note **and**
  reports `verdict: REJECT` to the orchestrator. The orchestrator then
  spawns a new implementer with the reviewer's feedback included.

The reviewer **must not edit code**. It may read code, run grep, and
run the language's test/lint commands on the touched packages to
confirm the implementer's claims, but it does not produce new diffs.
Its only output is the verdict-bearing `> _Reviewer note:_` blockquote
in the review file and the verdict it returns to the orchestrator.

Reviewer prompt template:

```
You are AUDITING a code change made by a previous agent in response to
a single review finding (or small intertwined group). You are in REVIEW
MODE: do not edit any code files. Your job is to independently assess
whether the change resolves the original concern, whether it introduces
new issues or extra complexity, and whether it is worth it.

Your startup protocol (root CLAUDE.md → enclosing project CLAUDE.mds →
your rules doc) is mandatory and must run BEFORE you start auditing.

Review file: <absolute path>
Finding ID(s): <e.g. M8>
Implementer's summary of the change:
<the implementer's 3-6 line summary, verbatim>
Files touched by the implementer:
<list of absolute paths>

Read the original finding in the review file. Read the implementer's
_Implementer note_ blockquote. Then read the actual diffs in the files
touched (use git diff or read the files directly).

<paste the "five target traits" section verbatim>

<paste the "When to SKIP" section verbatim>

<paste the annotation format including the _Reviewer note_ blockquote
shape — emphasise that it goes DIRECTLY BELOW the implementer's note,
preserving all prior text>

Audit checklist:
1. Does the change actually resolve the original finding? (For
   SKIPPED items: is the implementer's rationale result-quality, not
   effort-based?)
2. Does the change introduce new issues? Run the language's lint/test
   commands on the touched packages to confirm. (Your rules doc tells
   you which commands to use.)
3. Does the change introduce extra complexity that outweighs the
   benefit? Look for new public surface, indirection without payoff,
   premature abstraction.
4. Is the change worth it on balance?

Write a `> _Reviewer note (confidence HIGH|MEDIUM|LOW, verdict ACCEPT|ACCEPT_WITH_CONCERNS|REJECT):_` blockquote
DIRECTLY BELOW the implementer's note in the review file. 2-5
sentences covering all four points above.

Return to the orchestrator:
- verdict: ACCEPT | REJECT | ACCEPT_WITH_CONCERNS
- one-line rationale tied to the four audit points above
- any new issues you noticed that the implementer did not address
```

### 5. Handle reviewer verdicts

- **ACCEPT** — move to the next work unit.
- **ACCEPT_WITH_CONCERNS** — move to the next work unit, but record the
  concerns in TaskCreate as a follow-up task. Do not silently swallow
  them.
- **REJECT** — spawn a *new* implementer agent for the same finding
  (same agent type), passing the reviewer's verdict and rationale in the
  prompt. The new implementer should either re-do the change addressing
  the reviewer's concerns or downgrade to SKIPPED with a result-quality
  rationale. Then spawn a new reviewer agent. Repeat until ACCEPT or
  ACCEPT_WITH_CONCERNS. Cap at two re-tries per finding; if the third
  attempt is still REJECT, surface to the user in the chat reply.

### 6. Aggregate and report

After all work units have ACCEPT/ACCEPT_WITH_CONCERNS verdicts, run a
final repo-wide pass yourself (or in a final clean agent of the
appropriate type — `go-developer` if any Go was touched,
`javascript-developer` if any JS/TS was touched, both if both):

- Go: `golines -w --base-formatter=gofumpt .` then `golangci-lint run --fix ./...`
- JS/TS: route through Turbo so each workspace's own task config is
  respected — `pnpm turbo run lint --filter=...<touched-workspace>` then
  `pnpm turbo run test --filter=...<touched-workspace>`. If a touched
  workspace is not wired into Turbo, read its `package.json` and run
  whichever of `lint` / `format` / `typecheck` / `test` it actually
  defines (skip the ones it does not). Do not blindly run bare
  `pnpm lint` / `pnpm test` — those scripts do not exist in every
  workspace and will either error or silently no-op.
- Tests on touched packages (or the integration suite if the changes
  affect query/SQL generation).

Then summarise to the user:

- Per review file: `N ADDRESSED, M SKIPPED, K PARTIAL`, and how many
  reviewer verdicts were ACCEPT / ACCEPT_WITH_CONCERNS / REJECTED.
- Headline ADDRESSED items with implementer trait/confidence and
  reviewer verdict.
- Any ACCEPT_WITH_CONCERNS concerns flagged for follow-up.
- Any finding that hit the retry cap.

Keep the response terse. The annotated review files (with both
implementer and reviewer notes) are the durable record.

---

## Common failure modes

### Shortening the original text

The disposition tag is **additive**. Original prose stays. If the review
says:

```
- **S1 — `MyType` exported but unused.** This is justified by ...
  ... (3 more paragraphs)
```

The annotated version is:

```
- **S1 — `MyType` exported but unused. SKIPPED — has 4 non-test consumers
  in <pkg>; reviewer's grep missed them.** This is justified by ...
  ... (3 more paragraphs preserved verbatim)
```

Not:

```
- **S1 (`MyType` exported but unused) SKIPPED — has non-test consumers.**
```

### Skipping based on effort (BANNED — read this twice)

This is the most common and most damaging failure mode in this skill. The
user has flagged it repeatedly: **effort is not a valid SKIP reason, full
stop.** Not "in most cases." Not "unless the refactor is really big."
**Never.**

If your rationale starts with any of these — or any paraphrase — your
SKIP is invalid and must be replaced by addressing the finding:

- "this would require..."
- "this touches many files..."
- "this is a large refactor..."
- "the blast radius is too big..."
- "would need to regenerate goldens..."
- "deferring to a follow-up..."
- "out of scope for this pass..."
- "would cascade through..."

The user's exact framing: *"the reason must be based on the qualities of
the result, not on the qualities of the work to be done to get there."*

Re-cast in terms of result quality. Compare:

- ❌ "would touch 600 lines of tests" → invalid, complains about work.
- ✅ "the resulting shape would trade N exported fields for N setter
  methods — no net public-surface reduction, and the setters obscure
  the field semantics the current shape makes obvious" → valid,
  critiques the result.

If you cannot articulate a critique of the *resulting code*, the finding
must be addressed. Size, churn, and test fallout are part of the work,
not the result. Do the work.

### Claiming SKIPPED when the reviewer is wrong

When a review claims "X is dead", verify with grep first. If X is alive,
your disposition is still SKIPPED, but the rationale must say so:

```
SKIPPED — review is incorrect: `Table.PrimaryKeyConstraintName` IS read
at `connector/sql/graphql/schema/mutation.go:326` to populate the PK
constraint enum value.
```

This documents that you checked, which is more valuable than a generic
"flagged but not actionable."

### Forgetting trait notes on ADDRESSED items

Every ADDRESSED item needs `*traits improved: ...; confidence ...*`. Sweep
the file with `grep "ADDRESSED" <file> | grep -v "traits improved"` before
declaring done.

### Treating PARTIAL as a generic catch-all

PARTIAL means "the parent finding has multiple sub-items with mixed
disposition." Each sub-item still needs its own ADDRESSED/SKIPPED tag with
its own rationale (and traits/confidence for the ADDRESSED ones). A
review file's STATUS at the bottom can be PARTIAL; individual findings
should usually be one of ADDRESSED or SKIPPED.

### Running implementer agents in parallel

Sequential dispatch is mandatory. Two implementer agents launched
simultaneously will edit overlapping files, double-run `golangci-lint
--fix` (or `pnpm biome check --write`) against each other's half-written
diffs, and produce a tree the next agent cannot reason about. **One work
unit at a time, full implementer → reviewer cycle, then the next.** Even
when work units appear to touch disjoint files, the trailing lint sweeps
stomp on each other. Never parallel.

### Skipping the reviewer agent

Every ADDRESSED *and* every SKIPPED finding must get a reviewer pass.
The reviewer's note is the audit trail proving the implementer's claim
was independently checked. Do not declare a work unit done just because
the implementer reported success — spawn the reviewer, capture its note
in the file, record its verdict. If you find yourself thinking "this
change is small, the review can be skipped" — that is exactly when the
reviewer catches lint regressions and silent-rewrite mistakes.

### Reviewer agent editing code

The reviewer **audits only**. It may read code, grep, and run vet/test/
lint, but it must not produce code diffs. If the reviewer wants changes,
it returns REJECT with rationale and the orchestrator spawns a new
implementer. Mixing the roles erodes the audit value of the reviewer's
note.

### Implementer touching findings it doesn't own

The implementer's prompt names the finding ID(s) it owns. If the
implementer notices a related issue elsewhere in the file, it must
report it as a follow-up — not silently expand its diff. Sequential
dispatch only works if each agent's scope is bounded; an implementer
that touches finding N+2 while ostensibly working on finding N pollutes
the next agent's starting tree.

### Grouping findings too eagerly

The default is one finding per implementer agent. Group only when the
findings are genuinely intertwined (same function, same SQL builder,
same renamed symbol) — and justify the grouping in the prompt and the
report. A 5-item "they all touch the resolver package" group is too
broad; split it.

### Routing a Go finding to javascript-developer (or vice versa)

The routing rule is by file extension on the **finding's `**File:**`
header(s)**. If you route by guesswork or by package name, you'll hand
a Go-rules agent JS-rules work and vice versa. Read the header. If a
finding has no `**File:**` header at all, treat it as `generic-developer`
work and let that agent figure out where the change belongs.

---

## Example: a complete annotated finding

Before:

```
- **M8 — `unwrapResultRows` swallows JSON errors silently with only a
  warning log.** `stream_cohort_manager.go:522–545`. When `json.Unmarshal`
  fails, the function logs a warning and returns `nil` — the caller
  treats `nil` rows as "no rows," meaning a corrupt payload from the
  database is silently demoted to "subscriber receives empty result."
  This is on the data path and a real subscriber-visible bug shadow.
  Either propagate the parse error up to broadcast it or document the
  deliberate degradation.
```

After implementer agent finishes:

```
- **M8 — `unwrapResultRows` swallows JSON errors silently with only a
  warning log. ADDRESSED — *traits improved: reliability; confidence
  HIGH*** `stream_cohort_manager.go:522–545`. When `json.Unmarshal`
  fails, the function logs a warning and returns `nil` — the caller
  treats `nil` rows as "no rows," meaning a corrupt payload from the
  database is silently demoted to "subscriber receives empty result."
  This is on the data path and a real subscriber-visible bug shadow.
  Either propagate the parse error up to broadcast it or document the
  deliberate degradation.

  > _Implementer note (confidence HIGH):_ `unwrapResultRows` now returns
  > `(rows, error)`; `parseStreamResults` records the error per-result;
  > `sendStreamResults` surfaces the parse error to the affected
  > subscriber via a new `sendParseError` helper. Test added for the
  > `parseErr` field. Only that subscriber sees the failure — others in
  > the cohort continue to receive their parsed results.
```

After reviewer agent finishes:

```
- **M8 — `unwrapResultRows` swallows JSON errors silently with only a
  warning log. ADDRESSED — *traits improved: reliability; confidence
  HIGH*** `stream_cohort_manager.go:522–545`. When `json.Unmarshal`
  fails, the function logs a warning and returns `nil` — the caller
  treats `nil` rows as "no rows," meaning a corrupt payload from the
  database is silently demoted to "subscriber receives empty result."
  This is on the data path and a real subscriber-visible bug shadow.
  Either propagate the parse error up to broadcast it or document the
  deliberate degradation.

  > _Implementer note (confidence HIGH):_ `unwrapResultRows` now returns
  > `(rows, error)`; `parseStreamResults` records the error per-result;
  > `sendStreamResults` surfaces the parse error to the affected
  > subscriber via a new `sendParseError` helper. Test added for the
  > `parseErr` field. Only that subscriber sees the failure — others in
  > the cohort continue to receive their parsed results.
  >
  > _Reviewer note (confidence HIGH, verdict ACCEPT):_ verified the
  > diff. The parse error is now propagated to exactly the affected
  > subscriber via `sendParseError`, with cohort-mates unaffected — this
  > resolves the original silent-demotion concern. No new issues: the
  > new helper is 12 lines, mirrors the existing `sendResults` shape,
  > and the added test exercises the `parseErr` path. Public surface
  > unchanged. `go test ./connector/sql/subscription/...` and
  > `golangci-lint run` clean. Clearly worth it — reliability gain on
  > the subscription data path with negligible complexity cost.
```

The original prose is untouched. The annotation contains: disposition,
trait list, implementer's confidence, implementer's description of what
was done, **and** the reviewer's independent audit covering: original
concern resolved, new issues, complexity, and worth-it judgement. The
reader can audit the change against the original concern using both
notes as primary sources.

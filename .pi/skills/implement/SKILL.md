---
name: implement
description: Discuss a problem or feature with the user, gather requirements, dispatch them in parallel to architect-a and architect-b, then synthesize a single combined plan and write it to `.claude/PLAN_<title>.md`. Use when the user wants to plan a change before writing any code.
argument-hint: "[short title or topic]"
---

# Implement — Native Pi Planning Workflow

You are the orchestrator for planning a change in this monorepo. Your job has four phases:

1. Discuss the problem with the user and **gather requirements**.
2. Dispatch the requirements **in parallel** to `architect-a` (`gpt-5.5`) and `architect-b` (`claude-opus-4-7`).
3. Compare both plans and **synthesize a single combined plan** that takes the strongest pieces of each.
4. Write the combined plan to `.claude/PLAN_<title_of_change>.md` using the template at `.pi/skills/implement/template.md`.

You do not write production code in this skill. Implementation happens later — typically by handing the resulting plan to the `*-implementer` agents.

## Phase 1 — Gather requirements

Have a focused conversation with the user. Keep it tight; do not pad. Cover:

- **Problem / motivation** — what is broken, missing, or being added, and why now.
- **Functional requirements** — observable behavior the change must produce.
- **Non-functional requirements / constraints** — performance, security, backwards compatibility, deployment, telemetry, etc.
- **Surfaces in scope** — which services / packages / workspaces are expected to change.
- **Out of scope** — things the user explicitly does *not* want addressed here.
- **Success criteria** — how the user will know the change is done (tests, manual flow, metric, etc.).

Ground the conversation in the actual codebase. Before asking a question whose answer you can look up, do the lookup (read the relevant `CLAUDE.md`, grep for the symbol, list the package). Ask the user only what genuinely requires their judgment.

Stop asking when you have enough to brief both architects unambiguously. State the gathered requirements back to the user as a short bulleted recap and confirm before moving to Phase 2.

If the user provided a title argument, use it as a working title. Otherwise, propose one once requirements are clear.

## Phase 2 — Dispatch both architects in parallel

Call the `subagent` tool in **parallel mode** with `agentScope: "project"` and two tasks — one for `architect-a`, one for `architect-b`. Both tasks must receive the **same** prompt body so the comparison is fair.

The prompt body must include:

- The working title.
- The full set of gathered requirements (problem, functional, non-functional, scope, out-of-scope, success criteria).
- Any concrete file paths, symbols, or existing patterns identified during Phase 1.
- This exact instruction: **"You are a planning architect. Do not edit code. Return Markdown using the output shape from your agent prompt, including the mandatory sign-off trailer where you self-identify your model (do not copy any model name from this prompt). Be concrete; cite file paths. List any ambiguities under Open questions instead of inventing answers."**

Do not run the two architects sequentially. Do not pre-bias one architect by passing the other's output.

If either architect returns Open questions that genuinely block the plan, surface them to the user, resolve them, and re-dispatch both with the updated requirements. Cap at two re-dispatches; if still blocked, write the plan as `Status: draft` and call out the unresolved questions.

## Phase 3 — Compare and synthesize

Before reading either plan, look for a sign-off trailer of the shape:

```
_Plan authored by `architect-a` (model: `<reported>`)._
_Plan authored by `architect-b` (model: `<reported>`)._
```

If a sign-off is missing, set that architect's reported model to `missing` for warning purposes and continue. Do not re-dispatch solely for model attribution.

Then compare the self-reported model in each trailer against the expected model from the agent's frontmatter only to record warnings:

| Agent | Expected (`model:` frontmatter) |
| --- | --- |
| `architect-a` | `gpt-5.5` |
| `architect-b` | `claude-opus-4-7` |

- **Exact match**: record no model warning.
- **Missing, unknown, same-family drift, or different family**: record a warning in section 2 ("Architect inputs") of the final plan, but keep the architect's plan.

Model warnings are informational only: they never stop synthesis, never cause an architect output to be discarded, and never trigger a re-dispatch.

Read both architect outputs carefully. For each section of the template, decide whether to:

- Take A's version verbatim.
- Take B's version verbatim.
- Merge specific bullets from both.
- Override both with a refinement you can justify.

Every non-trivial choice goes in the **Rationale** section of the final plan. Cite which architect a chosen piece came from. When both architects agreed, note that too — agreement is signal.

Do **not** average the plans into vague mush. Pick. If A's data model is cleaner but B's sequencing is safer, take A's data model and B's sequencing, and say so.

Sanity-check the synthesized plan against the requirements:

- Every functional and non-functional requirement is addressed by at least one step.
- Every step has a concrete check (test, lint, manual flow).
- Steps are sized for a single implementer pass.
- Out-of-scope items did not sneak in.

## Phase 4 — Write the plan file

1. Derive `<title_of_change>` from the working title: lowercase, snake_case, ASCII-only, no extension, e.g. `add_oauth_pkce_flow`.
2. Read `.pi/skills/implement/template.md`.
3. Fill every section. Do not leave template placeholders. Empty sections are allowed only when explicitly marked optional in the template.
4. Append the full architect outputs verbatim under the appendix sections so the audit trail is preserved. In section 2.1 / 2.2 of the template, record the expected model from the agent's frontmatter alongside the self-reported model, or `missing` when absent, so any warning is visible at the top of the plan.
5. Write to `.claude/PLAN_<title_of_change>.md`. Create `.claude/` if it does not exist. If a plan file with the same name already exists, ask the user whether to overwrite, suffix with `_v2`, or pick a new title — do not silently clobber.

After writing, return a terse summary in chat:

- Plan path.
- 2-3 sentences naming the central design decision and the biggest risk.
- Suggested next step (typically: hand specific plan steps to `go-implementer` / `javascript-implementer` / `generic-implementer`).

## What this skill never does

- It never edits production code.
- It never dispatches the `*-implementer` agents.
- It never runs only one architect.
- It never skips the rationale section just because both architects agreed — note the agreement explicitly.

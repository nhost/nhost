# Native Pi review workflow

This directory mirrors the repo's Claude Code review workflow with native Pi resources.

## What is included

- `extensions/subagent/` — registers a `subagent` tool that launches isolated `pi` subprocesses for named agents.
- `agents/` — paired implementer/reviewer prompts per language: `go-implementer`/`go-reviewer`, `javascript-implementer`/`javascript-reviewer`, and `generic-implementer`/`generic-reviewer`. Implementers edit code; reviewers validate that proposed or applied changes were actually needed and adhere to the repo rules. Plus two model-diverse planning architects, `architect-a` (`gpt-5.5`) and `architect-b` (`claude-opus-4-7`), used by the `implement` skill.
- `skills/nhost-review/` — branch/PR diff review workflow that writes `.review/` artifacts.
- `skills/address-review/` — sequential implementer/reviewer workflow for addressing `.review/` findings.
- `skills/implement/` — gathers requirements from the user, dispatches them in parallel to `architect-a` and `architect-b`, synthesizes a combined plan, and writes it to `.claude/PLAN_<title>.md` using the bundled template.
- `prompts/` — short slash-command aliases for the skills.

## Usage

From the repo root in Pi:

```text
/skill:nhost-review origin/main
/skill:address-review PR_123_COMMENT_*.md
/skill:implement add oauth pkce flow
```

Aliases are also available as prompt templates:

```text
/nhost-review origin/main
/nhost_review origin/main
/address-review PR_123_COMMENT_*.md
/implement add oauth pkce flow
```

The review skills use the project-local agents via `subagent` with `agentScope: "project"`.

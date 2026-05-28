# Native Pi review workflow

This directory mirrors the repo's Claude Code review workflow with native Pi resources.

## What is included

- `extensions/subagent/` — registers a `subagent` tool that launches isolated `pi` subprocesses for named agents.
- `agents/` — Pi-native `go-developer`, `javascript-developer`, and `generic-developer` agent prompts.
- `skills/nhost-review/` — branch/PR diff review workflow that writes `.review/` artifacts.
- `skills/address-review/` — sequential implementer/reviewer workflow for addressing `.review/` findings.
- `prompts/` — short slash-command aliases for the skills.

## Usage

From the repo root in Pi:

```text
/skill:nhost-review origin/main
/skill:address-review PR_123_COMMENT_*.md
```

Aliases are also available as prompt templates:

```text
/nhost-review origin/main
/nhost_review origin/main
/address-review PR_123_COMMENT_*.md
```

The review skills use the project-local agents via `subagent` with `agentScope: "project"`.

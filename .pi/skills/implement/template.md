# <Title of change>

**Status:** draft
**Created:** <YYYY-MM-DD>
**Working title argument:** <as passed to /implement, or "n/a">
**Architects consulted:** `architect-a` (expected `gpt-5.5`, reported `<reported>`), `architect-b` (expected `claude-opus-4-7`, reported `<reported>`)
**Orchestrator:** `implement` skill

---

## 1. Requirements

Captured from the discussion with the user. Reflects the agreed scope at the time of writing.

### 1.1 Problem / motivation

<one short paragraph: what is broken, missing, or being added, and why now>

### 1.2 Functional requirements

- <observable behavior 1>
- <observable behavior 2>
- ...

### 1.3 Non-functional requirements / constraints

- <perf, security, backwards compatibility, deployment, telemetry, etc.>
- ...

### 1.4 Surfaces in scope

- `<path or workspace>` — <why>
- ...

### 1.5 Out of scope

- <thing explicitly deferred>
- ...

### 1.6 Success criteria

- <how the user will know it is done: tests, metric, manual flow>
- ...

### 1.7 Open questions (optional)

Only present if requirements still have unresolved ambiguities. Each item must say who is expected to answer it.

- <question> — owner: <user | architect re-run | implementer>

---

## 2. Architect inputs (summary)

Headline takeaways from each architect. The full plans are in the appendix.

### 2.1 `architect-a` (expected `gpt-5.5`, reported `<reported>`)

- **Headline approach:** <2-3 sentences>
- **Notable choices:** <bullets>
- **Notable concerns / risks raised:** <bullets>
- **Model integrity:** `match` | `same-family-different-version` | `cross-family-mismatch (...)` — if not `match`, explain.

### 2.2 `architect-b` (expected `claude-opus-4-7`, reported `<reported>`)

- **Headline approach:** <2-3 sentences>
- **Notable choices:** <bullets>
- **Notable concerns / risks raised:** <bullets>
- **Model integrity:** `match` | `same-family-different-version` | `cross-family-mismatch (...)` — if not `match`, explain.

### 2.3 Where they agreed

- <bullet>

### 2.4 Where they diverged

- **<topic>:** A says X; B says Y.
- ...

---

## 3. Rationale

Why the final plan picks what it picks. Every non-trivial choice listed; attribute it.

- **<decision>:** <chose A's framing / chose B's data model / overrode both — because ...>
- ...

Risks consciously accepted, and alternatives consciously rejected, go here too.

- **Risk accepted:** <risk> — mitigation: <how>.
- **Alternative rejected:** <alt> — reason: <why>.

---

## 4. Final plan of action

Ordered steps. Each step should be small enough that a single `*-implementer` agent can do it in one pass with a clear check at the end.

1. **<step title>** — files: `<paths>` — check: `<command or manual verification>`.
2. **<step title>** — files: `<paths>` — check: `<command or manual verification>`.
3. ...

### 4.1 Implementer routing

Which agent owns which step. Group consecutive steps for the same agent when natural.

- Steps 1-2: `go-implementer`
- Step 3: `javascript-implementer`
- Step 4: `generic-implementer`
- ...

### 4.2 Follow-ups (out of scope for this plan)

Deferred items the user agreed to handle separately.

- <item> — tracked in: <link or "TBD">.

---

## Appendix A — `architect-a` full plan (verbatim)

<paste the raw architect-a response here, including its sign-off trailer `_Plan authored by `architect-a` (model: `<reported>`)._`>

## Appendix B — `architect-b` full plan (verbatim)

<paste the raw architect-b response here, including its sign-off trailer `_Plan authored by `architect-b` (model: `<reported>`)._`>

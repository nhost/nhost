# Issue #4006 — Remaining Error Handling Work

Pages that still silently swallow query errors (showing empty/0 results instead of an error state):

- `hasura.tsx` — no error handling, only checks loading
- `metrics.tsx` — no error handling, only checks loading
- `auth/oauth2-clients` — needs investigation
- `ai/auto-embeddings` — needs investigation. It's showing `To enable graphite, configure the service first in AI Settings.`, even though the query failed.
- `ai/assistants` — needs investigation. same as auto-embeddings.
- `ai/file-stores` — needs investigation. same as auto-embeddings.
- `database` main page — needs investigation
- `events/cron-triggers` — needs investigation
- `events/one-offs` — needs investigation

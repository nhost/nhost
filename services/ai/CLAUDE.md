# CLAUDE.md

This file provides project-specific guidance for the Nhost AI service.

## Project overview

The service is written in Go and provides two features:

- **Auto-embeddings** — generates provider-agnostic embeddings for database rows, keeps vector columns synchronized, and deploys permission-aware search functions.
- **Multi-provider agents** — streams agent responses through explicitly configured OpenAI Chat Completions, OpenAI Responses, Anthropic Messages, and Google Gemini adapter instances and supports GraphQL, MCP, web search, and web fetch tools.

## Build and development commands

The service uses the monorepo Nix flake. Run these commands from `services/ai` (or enter the shell from the repository root with `nix develop .#ai`).

```bash
make develop
make check
make build
make build-docker-image
make dev-env-up
make dev-env-up-short
make dev-env-down
make migrations-add MIGRATION_NAME=xxx
```

### Tests

```bash
go test ./...
go test -v ./path/to/package
go test -run TestName ./...
```

Tests that need PostgreSQL require the development environment. The full CI check runs linting, tests, and code-generation verification.

Live tests share the compose stack with the running AI service. Use `internal/livetest` (`Connect`, `Lock`, `SuppressedExec`): serialize with its advisory lock, use unique names, suppress triggers on fixture inserts, and clean up with a bounded `context.WithoutCancel(t.Context())`. Never reset the `local` database or apply metadata from a test. `AI_LIVE_TEST_REQUIRED=1` (set in `project.nix` for CI) makes a missing stack fatal instead of skipped.

## Architecture

### Code generation

- **gqlgenc** (`gqlgenc.yml`) generates the Hasura client and models from `hasura/client.graphqls`. After starting a clean development environment and applying the service migrations and metadata, run `GOEXPERIMENT= go generate .` from `services/ai`. Clearing `GOEXPERIMENT` keeps generated JSON fields compatible with standard Go builds. `make check` runs the same directive and fails if generation changes tracked files. Keep the explicit `package: hasura` settings: generation removes its output files before recreating them, and package inference can otherwise select the black-box test package.
- Generate against the migrated live schema, not a schema file or stale Hasura container. Provider identity is a bounded string throughout PostgreSQL, Hasura, GraphQL, and Go; there is no provider catalog, foreign key, tracked enum table, generated enum, or provider-specific metadata reload. After migration changes, perform the documented full volume reset, verify the live schema and metadata, run generation twice to prove stability, and never hand-edit generated files.
- **mockgen** generates package-local mocks for retained boundary interfaces.

### Key packages

- `cmd/` — CLI commands, HTTP routing, auto-embeddings webhooks, and service startup.
- `agents/` — multi-provider agent orchestration, SSE streaming, approval flow, and tools.
- `agents/provider/` — strict aggregate configuration plus OpenAI Chat Completions, OpenAI Responses, Anthropic Messages, and Google Gemini adapters. Each instance owns one trusted startup endpoint and header set and never supplies auto-embedding configuration.
- `agents/tool/` — GraphQL, MCP, web search, and web fetch tools.
- `internal/providerconfig/` — shared strict declaration parsing, endpoint/header validation, credential redaction, and no-redirect HTTP clients. Callers supply their configuration-error sentinel and adapter configuration lookup; adapter-specific URL rules remain with the adapters.
- `autoai/` — auto-embeddings configuration validation, function deployment and cleanup. `Catalog` reads PostgreSQL metadata with parameterized queries.
- `autoai/embeddings/` — background embedding synchronization.
- `autoai/embedder/` — provider-agnostic embedding registry, plain-HTTP OpenAI-compatible/Voyage/Gemini adapters, batching, response validation and retry. Errors carry fixed messages only and an error class (configuration, input, transient, canceled).
- `hasura/` — generated GraphQL client plus metadata helpers.
- `migrations/` — PostgreSQL migrations and Hasura table, relationship, and event-trigger setup.

### Request flow

1. Gin serves health/version routes, agent SSE routes, and auto-embeddings webhooks.
2. Hasura event triggers notify the service when auto-embeddings configuration changes.
3. The background synchronization process fetches pending rows through Hasura, generates vectors through the configured embedding registry, and writes results through the configured mutation.
4. Agent routes load agent/session/message data through Hasura and stream provider events to clients.

### Auto-embeddings

- `EMBEDDING_PROVIDERS` is the only source of embedding providers; only the deprecated `OPENAI_API_KEY` can add an implicit `openai`.
- Validate before replacing anything. Deploy both functions and their `nhost-ai:auto_embeddings:<id>` ownership comments in one `run_sql`; remove rename leftovers by that tag.
- `last_error` values starting with `deploy: ` come from a failed deploy or from the worker's validation before a run. Only a successful deploy (a configuration edit or a restart) clears them; the worker's run summaries never replace them. The worker treats catalog read failures as non-verdicts and records nothing; the deploy path records them and answers 500 so Hasura retries.
- Search functions send only `{configuration_id, query}` and the webhook reads the row. This is deliberate: search and the worker both follow the current row, so a rejected edit fails visibly in both.
- Keep `last_run`, `last_error`, `created_at` and `updated_at` out of the configuration event trigger's UPDATE columns, or status writes redeploy functions.
- Quote all SQL identifiers and literals. `run_sql` errors contain the rendered SQL and the webhook secret: keep only an allowlisted error code and never log the raw error.

### Database

Tables live in the `ai` schema. Auto-embeddings use `auto_embeddings_configuration`; agents use `agents`, `agent_sessions`, and `agent_messages`. Provider declarations are configuration-only and are never persisted. PostgreSQL requires `vector`, `http`, and `pg_jsonschema`.

The down migrations for legacy versions 1 and 5 intentionally retain these database-global extensions. Their executable `DO` blocks and notices are frozen compatibility behavior, not placeholders for `DROP EXTENSION` statements.

`make migrations-add MIGRATION_NAME=xxx` creates empty up and down files. This leaves the strict PostgreSQL migration bundle intentionally invalid until both files contain executable SQL; implement both bodies before running or shipping the service.

Migration integration tests create and drop an isolated, cryptographically random per-run database on the server selected by `POSTGRES_CONNECTION`; the connection role must be allowed to create databases. Keep destructive migration cases in that isolated database rather than in the selected database itself.

## Code standards

- Follow the repository Go rules in `.claude/docs/go-design-rules.md`.
- Use the root `go.mod` and `vendor/`; never add service-local dependency files.
- Do not hand-edit generated files; regenerate them from their source definitions.
- Handle errors with call-site context.
- `AGENT_PROVIDERS` is the sole authority for agent-provider identity. Keep registry keys and persisted provider values as strings; do not add built-in identities, provider tables, foreign keys, or GraphQL/Go enums.
- Construct configured provider clients once in `cmd.buildAgentProviders`, store them in `provider.Registry`, and keep per-agent models request-scoped in `provider.StreamRequest`; do not add models to reusable provider clients.
- Agent adapters must use only declared endpoints and headers, refuse redirects, pin OpenAI and Anthropic retry counts explicitly, and sanitize SDK errors. Do not permit SDK ambient credentials, endpoints, backends, projects, locations, or ADC behavior to affect requests.
- Build every Google instance from a fresh explicit client config. Preserve the private sentinel-removal transport, clone requests and headers before scrubbing the generated key, and never mutate `http.DefaultTransport`.
- Before passing per-request options such as `option.WithResponseInto` to a shared `openai-go` service, clone the service's `Options` slice. The SDK appends request options and can otherwise mutate shared slice storage during concurrent streams.
- Treat `provider.ToolCall.ProviderMetadata` as opaque adapter continuation state: persist and replay it with tool calls, but never expose or log it; build SSE payloads from explicit `{id, name, arguments}` projections and never marshal `provider.ToolCall` directly.
- If a second adapter needs private continuation state, replace the tool-call carrier with a versioned, message-level provider-state envelope persisted separately from public SSE DTOs; do not add more adapter-specific state to `provider.ToolCall`.
- Prefer table-driven parallel tests and `cmp.Diff`.
- Avoid `//nolint` except for justified false positives or external types.

## Validation workflow

1. Update schemas or migrations.
2. Regenerate the Hasura client when its operations or schema change.
3. Add or update tests.
4. From the repository root run `golines -w --base-formatter=gofumpt .`.
5. From the repository root run `golangci-lint run --fix ./...`.
6. Run `go test ./services/ai/...` and `make check` when the required development services are available.

Root-wide lint also type-checks `services/storage`, whose `pkg-config`/libvips dependencies are not included in the AI dev shell. Supply those dependencies for the root gate; AI-only lint (`golangci-lint run --fix ./services/ai/...`) is useful for local iteration but does not replace it.

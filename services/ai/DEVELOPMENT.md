# Development

The AI service uses the Nhost monorepo's [Nix](https://nixos.org) flake for a reproducible development environment. From `services/ai`, run `make develop`; from the repository root, run `nix develop .#ai`.

## Testing your changes

From `services/ai`:

1. Start the development environment with `make dev-env-up`. This builds the local `ai:0.0.0-dev` image and starts its dependencies. On macOS, use `VER=0.0.0-dev make dev-env-up`.
2. Run the service checks with `make check`.
3. Stop the environment with `make dev-env-down` when finished.

Go dependencies belong in the repository root `go.mod` and `vendor/`. After changing dependencies, run `go mod tidy` and `go mod vendor` from the repository root.

## Hasura client generation

Generate the Hasura client only against a clean, migrated live development schema. Nix's Git-flake source excludes new untracked files, so mark new source and migration files with `git add -N <paths>` (or stage them) before building the image. On macOS, pass the development version explicitly because the shared Makefile's automatic version lookup uses GNU `grep -P`:

```bash
make dev-env-down
VER=0.0.0-dev make dev-env-up
GOEXPERIMENT= go generate .
git diff -- hasura/client_gen.go hasura/models_gen.go > /tmp/ai-hasura-first.diff
GOEXPERIMENT= go generate .
git diff -- hasura/client_gen.go hasura/models_gen.go > /tmp/ai-hasura-second.diff
cmp /tmp/ai-hasura-first.diff /tmp/ai-hasura-second.diff
```

Review the complete generated diff before keeping it. Do not edit `client_gen.go` or `models_gen.go` by hand. If generation changes the client, rebuild and recreate the AI container before live runtime verification; the pre-generation image exists only to publish the schema used by codegen. Before generating, verify that `ai.schema_migrations` is at version 7, `to_regclass('ai.agent_providers')` is null, `ai.agents.provider` has no foreign key, and Hasura metadata/introspection exposes neither a provider table nor provider enum. The generated `GetAgent` provider field, filters, insert inputs, and set inputs must all use Go strings and GraphQL `String`/`StringComparisonExp` types.

## PostgreSQL migration state

In environments where the Nix-provided all-database `migrate` binary panics during `gosnowflake` initialization (observed on macOS), install a temporary PostgreSQL-only binary before running any migration command in this section or `make migrations-add`. The panic occurs on every invocation in affected environments, including `version`, `down`, `force`, and `up`. Run the remaining commands from the same shell; v4.19.1 matches the Nix-provided binary:

```bash
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
GOBIN="$tmpdir" GOFLAGS=-mod=mod go install -tags postgres \
  github.com/golang-migrate/migrate/v4/cmd/migrate@v4.19.1
export PATH="$tmpdir:$PATH"
```

AI migration state is stored in `ai.schema_migrations`. Every manual `migrate` invocation must reuse one DSN containing `search_path=ai`, including `version`, `down`, `force`, and a later `up`:

```bash
export AI_MIGRATION_DSN='postgres://postgres:postgres@localhost:5432/local?sslmode=disable&search_path=ai'
migrate -path ./migrations/postgres -database "$AI_MIGRATION_DSN" version
```

Migration 6 was rewritten and migration 8 was removed because the service is unreleased. Existing volumes already past migration 6 do not reapply the rewritten file because `golang-migrate` does not checksum applied migrations. A volume previously at version 8 can fail startup with `no migration found for version 8: file does not exist`.

Reset development volumes instead of forcing or downgrading migration state. From `services/ai`, use the complete public targets; do not use short or internal targets:

```bash
# Linux
make dev-env-down && make dev-env-up

# macOS
make dev-env-down && VER=0.0.0-dev make dev-env-up
```

The reset deletes development data. After it completes, verify clean version 7 and the final provider-string schema before generating the Hasura client.

## Agent provider development

`AGENT_PROVIDERS` and `--agent-providers` are the only agent-provider configuration surfaces. Prefer the environment variable: command-line arguments may be visible to other local users or process-inspection tooling. `OPENAI_API_KEY` and `OPENAI_ORG` are retained only for auto-embeddings.

The value is a strict JSON array. Provider names are runtime identities; adapter types are one of `openai_chat_completions`, `openai_responses`, `anthropic_messages`, and `google_gemini`. Headers are optional. See [README.md](README.md#agent-provider-configuration) for the complete contract, canonical URL joining, redirect refusal, ambient isolation, and replica requirements.

The development Compose file passes `AGENT_PROVIDERS` through with a `[]` default. To configure a host Ollama endpoint for the composed AI container:

```bash
export AGENT_PROVIDERS='[{"name":"gateway.primary-test","type":"openai_chat_completions","configuration":{"base_url":"http://host.docker.internal:11434/v1"}}]'
make dev-env-up
```

All replicas must receive byte-for-byte equivalent declarations. Startup logs redact the full value and emit only the sorted provider names and types after every client has been constructed successfully.

### Empty-registry smoke

An unset, empty, whitespace-only, or `[]` value constructs an empty registry without removing routes. With development dependencies available, run the host binary with no agent providers:

```bash
AGENT_PROVIDERS='[]' \
OPENAI_API_KEY= \
OPENAI_ORG= \
POSTGRES_CONNECTION='postgres://postgres:postgres@localhost:5432/local?sslmode=disable' \
NHOST_GRAPHQL_URL='http://localhost:8080/v1/graphql' \
HASURA_GRAPHQL_ADMIN_SECRET='nhost-admin-secret' \
AI_WEBHOOK_SECRET='ai-secret' \
AI_BASE_URL='http://localhost:8090' \
SYNCH_PERIOD='5m' \
go run . serve --bind='127.0.0.1:8090'
```

Verify both agent paths are present rather than returning router 404s. A valid, authorized session that references an unavailable provider must return HTTP 400 with `{"error":"provider not available"}` from both message streaming and approval flows.

### Ollama streamed text and tool smoke

The recorded local smoke used Ollama `0.33.2` with `qwen3:0.6b`. Start Ollama and its model, then start only the AI dependencies:

```bash
ollama serve
ollama pull qwen3:0.6b
docker compose -f build/dev/docker/docker-compose.yaml --project-name ai-dev stop ai
make dev-env-up-short
```

Run the AI binary on the host so host-local Ollama is reachable at `localhost`. Omitted headers prove zero-auth operation:

```bash
AGENT_PROVIDERS='[{"name":"ollama.local-dev","type":"openai_chat_completions","configuration":{"base_url":"http://localhost:11434/v1"}}]' \
OPENAI_API_KEY= \
OPENAI_ORG= \
POSTGRES_CONNECTION='postgres://postgres:postgres@localhost:5432/local?sslmode=disable' \
NHOST_GRAPHQL_URL='http://localhost:8080/v1/graphql' \
HASURA_GRAPHQL_ADMIN_SECRET='nhost-admin-secret' \
AI_WEBHOOK_SECRET='ai-secret' \
AI_BASE_URL='http://localhost:8090' \
SYNCH_PERIOD='5m' \
go run . serve --bind='127.0.0.1:8090'
```

Create disposable `ollama.local-dev` agents and sessions through Hasura or PostgreSQL, call `/v1/agents/sessions/:sessionID/messages`, and verify streamed text plus a complete tool-call loop. The compatible base must stop before `/chat/completions`; the adapter appends that operation. If the AI service runs in Compose, use `host.docker.internal`, not `localhost`.

### Cloudflare `/compat` release smoke

Credentialed Cloudflare execution belongs to an authorized maintainer. Keep credentials in the approved environment, disable shell tracing, and never print the generated declaration, raw service logs, request URLs, header JSON, or upstream bodies into release evidence.

For a named Cloudflare AI Gateway with a stored OpenAI provider key, construct one `openai_chat_completions` declaration and one `Authorization` header without putting the token in a process argument:

```bash
set +x
: "${CLOUDFLARE_ACCOUNT_ID:?set through the approved environment}"
: "${CLOUDFLARE_GATEWAY_ID:?set through the approved environment}"
: "${CLOUDFLARE_API_TOKEN:?set through the approved secret environment}"
export CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_GATEWAY_ID CLOUDFLARE_API_TOKEN
export AGENT_PROVIDERS="$(
  jq -nc '[{
    name: "gateway.cloudflare-main",
    type: "openai_chat_completions",
    configuration: {
      base_url: ("https://gateway.ai.cloudflare.com/v1/" +
        env.CLOUDFLARE_ACCOUNT_ID + "/" + env.CLOUDFLARE_GATEWAY_ID + "/compat"),
      headers: {Authorization: ("Bearer " + env.CLOUDFLARE_API_TOKEN)}
    }
  }]'
)"
unset CLOUDFLARE_API_TOKEN
```

Start the host binary without `--agent-providers`, exercise text and tool-capable models through the Nhost AI SSE endpoint, and then clear the credential-bearing declaration:

```bash
unset AGENT_PROVIDERS CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_GATEWAY_ID
```

A placeholder procedure is not successful evidence. Record only the AI version/time, non-sensitive target kind and model, event categories, persisted message roles, and explicit `PASS` or non-secret `BLOCKED` reason.

### Secret-free PR evidence

Record evidence in the PR description, never in a committed secret or raw log. Include:

- AI commit/version and UTC timestamp;
- target kind (`Ollama /v1` or named Cloudflare `/compat`) without credentials;
- exact Ollama version/model/digest or exact Cloudflare `openai/{model}`;
- text outcome: multiple `content_delta` events, final sanitized text, and `done`;
- tool outcome: tool name, `tool_call`, sanitized result category, final text, and `done`;
- confirmation that the call passed through the Nhost AI SSE endpoint and persisted the expected message roles;
- explicit `PASS`, or `BLOCKED` plus the non-secret blocker.

Do not include tokens, header JSON, account/gateway identifiers if organizational policy treats them as sensitive, request URLs containing such identifiers, raw upstream errors, or service environment dumps. A placeholder procedure is not successful evidence.

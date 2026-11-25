# Nhost AI

The Nhost AI service adds auto-embeddings and multi-provider agents to the Nhost stack.

## Features

### Auto-embeddings

Auto-embeddings keep vector columns synchronized with source data. Each configuration specifies the source schema and table, the destination vector column, an embedding provider, model and dimensions, and the GraphQL operations used to read pending rows and persist generated vectors.

The service deploys permission-aware GraphQL functions for natural-language and similarity search. See [Auto-embeddings configuration](#auto-embeddings-configuration).

### Multi-provider agents

Agents stream model responses over server-sent events and can use GraphQL, MCP, web search, and web fetch tools. Agent providers are configured only through `AGENT_PROVIDERS` or the equivalent `--agent-providers` flag.

Applications stream a message with:

```text
POST /v1/agents/sessions/:sessionID/messages
```

Pending tool calls can be approved with:

```text
POST /v1/agents/sessions/:sessionID/approve-tools
```

Both routes remain registered when no providers are configured. An authorized, resolvable session whose selected provider is unavailable receives the secret-free HTTP 400 response `provider not available`.

## Auto-embeddings configuration

### Embedding providers

`EMBEDDING_PROVIDERS` (or `--embedding-providers`) declares embedding providers. It is independent of `AGENT_PROVIDERS` but uses the same JSON shape, naming rules and [validation](#validation-and-wire-behavior):

```json
[
  {
    "name": "openai",
    "type": "openai_embeddings",
    "configuration": {
      "base_url": "https://api.openai.com/v1",
      "headers": {
        "Authorization": "Bearer secret"
      }
    }
  }
]
```

| Type | Base URL example | Resulting operation |
| --- | --- | --- |
| `openai_embeddings` | `https://api.openai.com/v1`, `http://localhost:11434/v1` | `/embeddings` |
| `voyage_embeddings` | `https://api.voyageai.com` | `/v1/embeddings` |
| `google_gemini_embeddings` | `https://generativelanguage.googleapis.com` | `/v1beta/models/{model}:batchEmbedContents` |

`openai_embeddings` also covers OpenAI-compatible servers such as Ollama, vLLM, LM Studio and LiteLLM. Use `voyage_embeddings` with Anthropic, which has no embeddings API.

The deprecated `OPENAI_API_KEY` / `OPENAI_ORG` still work: when set and no provider is named `openai`, the service creates an `openai` provider for `https://api.openai.com/v1` and logs a deprecation warning.

### Configurations

Each row in `ai.auto_embeddings_configuration` must set `provider` to a declared provider name and `dimensions` to the size of the target `vector(N)` column. Keep `name` at most 52 bytes, because it is used in the generated function names.

When a configuration is inserted or updated, the service validates it before deploying its functions: the provider is declared, the table has exactly one primary key, and the column is a `vector` of the configured size. A failure returns 422, stores a `deploy: …` message in `last_error` and leaves the existing functions in place. Search always uses the current row, so until the row is fixed, search for that configuration fails as well.

The background worker embeds pending rows in batches, records `last_run`, and sets `last_error` to a short summary when rows fail. It also records a `deploy: …` error when the configuration stops validating, for example after the target table changes. A `deploy: …` error stays until a deployment succeeds: change one of the configuration's deployment columns, or restart the service, which redeploys every configuration. Restart after fixing the target table outside the configuration or declaring a missing provider.

### Upgrading

- Existing configurations are migrated to `provider = 'openai'`, with `dimensions` taken from the vector column. Deployments that only set `OPENAI_API_KEY` keep working without changes.
- Startup redeploys every search function. Until then, functions deployed by an older version get a 400.
- Inserts must now supply `provider` and `dimensions`.

## Agent provider configuration

`AGENT_PROVIDERS` is a JSON array. Unset, empty, or whitespace-only values mean `[]`. Every declaration has a runtime instance `name`, an adapter `type`, and endpoint `configuration`:

```json
[
  {
    "name": "openai",
    "type": "openai_chat_completions",
    "configuration": {
      "base_url": "https://api.openai.com/v1",
      "headers": {
        "Authorization": "Bearer secret"
      }
    }
  }
]
```

A provider named `openai` exists only when this declaration is present. `OPENAI_API_KEY` and `OPENAI_ORG` remain auto-embeddings-only.

Four adapter types are available:

| Type | Base URL example | Resulting operation |
| --- | --- | --- |
| `openai_chat_completions` | `https://api.openai.com/v1` | `/v1/chat/completions` |
| `openai_responses` | `https://api.openai.com/v1` | `/v1/responses` |
| `anthropic_messages` | `https://api.anthropic.com` | `/v1/messages` |
| `google_gemini` | `https://generativelanguage.googleapis.com` | `/v1beta/models/{model}:streamGenerateContent` |

`name` is the identity stored in `ai.agents.provider`; `type` selects only the protocol adapter. Multiple names may use the same type, and each declaration gets an isolated reusable client, URL, and header set. Names contain 1–63 ASCII bytes and match `^[a-z0-9]+(?:[._-][a-z0-9]+)*$`. Adapter type names are valid instance names and no names are reserved. PostgreSQL enforces only the byte bound, Hasura exposes `provider` as `String!`, and no database table or GraphQL enum catalogs configured names.

Prefer the environment variable because process arguments can be observable. If the CLI flag is supplied, normal CLI precedence makes it override `AGENT_PROVIDERS`. The complete value is redacted from startup flag logs, and successful startup logs only a sorted name/type summary.

For Compose, export the JSON before starting the service; [`build/dev/docker/docker-compose.yaml`](build/dev/docker/docker-compose.yaml) passes it through and defaults to `[]`:

```bash
export AGENT_PROVIDERS='[{"name":"gateway.primary-test","type":"openai_chat_completions","configuration":{"base_url":"http://host.docker.internal:11434/v1"}}]'
make dev-env-up
```

The equivalent direct CLI form is supported but is less private:

```bash
ai serve --agent-providers='[{"name":"openai","type":"openai_chat_completions","configuration":{"base_url":"https://api.openai.com/v1","headers":{"Authorization":"Bearer secret"}}}]'
```

### Validation and wire behavior

- Parsing is strict and atomic. All required fields, duplicate keys, unknown fields, adapter types, names, URLs, and headers are validated before any provider is published or PostgreSQL is opened.
- `configuration.headers` may be omitted or `{}`; explicit `null` is rejected. Header values must be strings and names must be unique case-insensitively.
- Base URLs must be absolute HTTP(S) URLs with a host and without user information, query, or fragment. Trusted loopback, private-network, IPv6, and plain HTTP endpoints are allowed.
- Supply a base, not a complete operation URL. The service appends the canonical operation shown above and fixes Gemini's API version to `v1beta`.
- Common transport-owned headers and adapter SDK-owned headers are rejected. Explicit authentication headers such as `Authorization`, `x-api-key`, and `x-goog-api-key` are allowed.
- Redirects are refused so configured credentials cannot be forwarded to another location. Both OpenAI adapters and Anthropic Messages use two explicit retries.
- The adapters use only the declared endpoint and headers. Ambient SDK credentials, endpoints, Google ADC/Vertex project and location settings, and OpenAI/Anthropic environment settings cannot alter agent requests.
- Configuration and upstream errors are sanitized: raw JSON, complete configured URLs, header values, credentials, response bodies, and SDK configuration are not emitted in events or logs.

Every replica must receive an identical `AGENT_PROVIDERS` value. There is no provider discovery endpoint or cross-replica synchronization; changing declarations requires updating and restarting every replica consistently. Removing a declaration does not mutate or delete stored agents.

First-class injection through Nhost Cloud, `nhost.toml`, and `nhost dev` remains a follow-up in the external configuration surface. Raw service environment/flags and the development Compose pass-through are the supported configuration paths here.

### OpenAI Responses

Use `openai_responses` for OpenAI models served through the Responses API. The adapter is stateless: it sends the stored conversation and sets `store: false` and `include: ["reasoning.encrypted_content"]` on every request. It translates Nhost function calls and results to Responses input items. For reasoning models, encrypted reasoning items are retained with persisted tool calls and replayed during the continuation without being exposed in public SSE events. The adapter streams text, refusals, function calls, and terminal reasons through the same Nhost agent event contract as the other adapters. Before configuring a non-OpenAI target, verify that it supports the streamed Responses subset used by agents: text and refusal deltas, function calls, terminal reasons, and the required `include: ["reasoning.encrypted_content"]` request value.

```json
[
  {
    "name": "openai-responses",
    "type": "openai_responses",
    "configuration": {
      "base_url": "https://api.openai.com/v1",
      "headers": {
        "Authorization": "Bearer secret"
      }
    }
  }
]
```

### OpenAI-compatible gateways and Ollama

Use `openai_chat_completions` for OpenAI itself, OpenAI-compatible gateways, and Ollama unless the target explicitly implements the Responses API. For example, a Cloudflare AI Gateway compatible base is:

```text
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/compat
```

For local Ollama, use `http://localhost:11434/v1` when the AI binary runs on the host or `http://host.docker.internal:11434/v1` from the development container. Headers may be omitted for a zero-auth endpoint. Compatibility covers the streamed Chat Completions subset used by agents: text deltas, function tool calls, finish reasons, cancellation, and multi-turn tool execution.

## HTTP endpoints

- `GET /healthz` — service health
- `GET /v1/version` — service version
- `POST /v1/webhooks/auto-embeddings-configuration` — synchronize configuration changes
- `POST /v1/webhooks/generate-embeddings` — generate an embedding for database functions
- `POST /v1/agents/sessions/:sessionID/messages` — stream an agent response
- `POST /v1/agents/sessions/:sessionID/approve-tools` — approve pending tool calls

## Getting started

The easiest way to run the service is through Nhost. For self-hosting, use [`build/dev/docker/docker-compose.yaml`](build/dev/docker/docker-compose.yaml) as a reference. PostgreSQL needs `vector`, `http`, and `pg_jsonschema`.

## Contributing

Refer to the monorepo [contribution guide](../../CONTRIBUTING.md) and the service [development guide](DEVELOPMENT.md).

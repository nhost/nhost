# Nhost AI

The Nhost AI service adds auto-embeddings and multi-provider agents to the Nhost stack.

## Features

### Auto-embeddings

Auto-embeddings keep vector columns synchronized with source data. Each configuration specifies the source schema and table, the destination vector column, an OpenAI embedding model, and GraphQL operations used to read pending rows and persist generated vectors.

Supported embedding models include `text-embedding-ada-002`, `text-embedding-3-small`, and `text-embedding-3-large`. `OPENAI_API_KEY`, `OPENAI_ORG`, `--openai-key`, and `--openai-org` configure **auto-embeddings only**. They never register or authenticate an agent provider.

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

Three adapter types are available:

| Type | Base URL example | Resulting operation |
| --- | --- | --- |
| `openai_chat_completions` | `https://api.openai.com/v1` | `/v1/chat/completions` |
| `anthropic_messages` | `https://api.anthropic.com` | `/v1/messages` |
| `google_gemini` | `https://generativelanguage.googleapis.com` | `/v1beta/models/{model}:streamGenerateContent` |

`name` is the identity stored in `ai.agents.provider`; `type` selects only the protocol adapter. Multiple names may use the same type, and each declaration gets an isolated reusable client, URL, and header set. Names contain 1–63 ASCII bytes and match `^[a-z0-9]+(?:[._-][a-z0-9]+)*$`. Adapter type names are valid instance names and no names are reserved.

Prefer the environment variable because process arguments can be observable. If the CLI flag is supplied, normal CLI precedence makes it override `AGENT_PROVIDERS`. The complete value is redacted from startup flag logs, and successful startup logs only a sorted name/type summary.

For Compose, export the JSON before starting the service; [`build/dev/docker/docker-compose.yaml`](build/dev/docker/docker-compose.yaml) passes it through and defaults to `[]`:

```bash
export AGENT_PROVIDERS='[{"name":"openai_compatible","type":"openai_chat_completions","configuration":{"base_url":"http://host.docker.internal:11434/v1"}}]'
docker compose -f build/dev/docker/docker-compose.yaml up ai
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
- Redirects are refused so configured credentials cannot be forwarded to another location. OpenAI Chat Completions and Anthropic Messages use two explicit retries.
- The adapters use only the declared endpoint and headers. Ambient SDK credentials, endpoints, Google ADC/Vertex project and location settings, and OpenAI/Anthropic environment settings cannot alter agent requests.
- Configuration and upstream errors are sanitized: raw JSON, complete configured URLs, header values, credentials, response bodies, and SDK configuration are not emitted in events or logs.

Every replica must receive an identical `AGENT_PROVIDERS` value. There is no provider discovery endpoint or cross-replica synchronization; changing declarations requires updating and restarting every replica consistently. Removing a declaration does not mutate or delete stored agents.

First-class injection through Nhost Cloud, `nhost.toml`, and `nhost dev` remains a follow-up in the external configuration surface. Raw service environment/flags and the development Compose pass-through are the supported configuration paths here.

> **TEMPORARY PHASE 4 ENUM PERSISTENCE FENCE — remove in Phase 5**
>
> The runtime parser already accepts the complete dotted/dashed name grammar, but the historical Hasura enum schema still permits only the existing persisted names `anthropic`, `google`, `openai`, and `openai_compatible`. A declaration such as `gateway.primary-test` starts successfully but cannot yet be stored in `ai.agents.provider`.
>
> Phase 4 and Phase 5 are one deployment unit. **Do not deploy this runtime hard cut until the Phase 5 schema/codegen change is included.** Phase 5 removes this fence and makes provider identity a bounded string end to end.

### OpenAI-compatible gateways and Ollama

Use `openai_chat_completions` for OpenAI itself, OpenAI-compatible gateways, and Ollama. For example, a Cloudflare AI Gateway compatible base is:

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

# Nhost AI

The Nhost AI service adds auto-embeddings and multi-provider agents to the Nhost stack.

## Features

### Auto-embeddings

Auto-embeddings keep vector columns synchronized with source data. Each configuration specifies the source schema and table, the destination vector column, an OpenAI embedding model, and GraphQL operations used to read pending rows and persist generated vectors.

The service deploys permission-aware GraphQL functions for natural-language and similarity search.

Supported OpenAI models include `text-embedding-ada-002`, `text-embedding-3-small`, and `text-embedding-3-large`. Set `OPENAI_API_KEY` and, when required, `OPENAI_ORG` before starting the service.

### Multi-provider agents

Agents support Anthropic, native OpenAI, OpenAI-compatible Chat Completions endpoints, and Google Gemini models with server-sent event streaming. They can use GraphQL, MCP, web search, and web fetch tools, with approval policies configured per agent.

Configure Anthropic with `ANTHROPIC_API_KEY`. To route Anthropic requests to a specific workspace, also set `ANTHROPIC_WORKSPACE_ID`; the service sends it as the `anthropic-workspace-id` request header.

Applications stream a message with:

```text
POST /v1/agents/sessions/:sessionID/messages
```

Pending tool calls can be approved with:

```text
POST /v1/agents/sessions/:sessionID/approve-tools
```

Agent definitions, sessions, and messages are stored in the `ai` PostgreSQL schema and exposed through the application's Hasura API, where normal permissions apply.

## OpenAI-compatible endpoints

`openai_compatible` is an agent provider for the streamed OpenAI Chat Completions subset used by Nhost agents: text deltas, function tool calls, finish reasons, request cancellation, and multi-turn tool execution. Compatibility depends on both the endpoint and model; other OpenAI APIs and modalities are not part of this contract.

One trusted endpoint is configured per AI service instance. Each compatible agent stores only `provider: openai_compatible` and its model name. Configure the raw service with either environment variables or equivalent CLI flags:

| Environment variable | CLI flag | Meaning |
| --- | --- | --- |
| `OPENAI_COMPATIBLE_BASE_URL` | `--openai-compatible-base-url` | Absolute `http` or `https` base URL. The service appends `/chat/completions`. |
| `OPENAI_COMPATIBLE_HEADERS` | `--openai-compatible-headers` | Optional JSON object whose string values are static request headers. |

Prefer `OPENAI_COMPATIBLE_HEADERS` to the CLI flag because process arguments can be observable. For a zero-auth raw service, the equivalent forms are:

```bash
OPENAI_COMPATIBLE_BASE_URL='http://localhost:11434/v1' \
OPENAI_COMPATIBLE_HEADERS='{}' \
ai serve

ai serve \
  --openai-compatible-base-url='http://localhost:11434/v1' \
  --openai-compatible-headers='{}'
```

The development Compose file passes both environment variables through with empty defaults, so they can be set in the invoking environment before `docker compose up ai`. An empty base URL disables this provider; non-empty headers without a base URL fail startup.

First-class injection through `nhost dev`, `nhost.toml`, and Nhost Cloud requires follow-up in the external `nhost/be` configuration surface, tracked as TBD. Until that work lands, use the raw service environment/flags or Compose pass-through. The Hasura enum can therefore be visible in an environment where compatible agents remain unavailable.

### Configuration contract

- The base URL must be absolute `http` or `https`, with a host and no user info, query, or fragment. Do not include `/chat/completions`; `/v1`, `/v1/`, `/compat`, and `/compat/` are valid base paths.
- Plain HTTP is supported for trusted local or private endpoints such as Ollama. Use TLS for traffic that crosses an untrusted network. The URL is startup-only operator configuration, not a per-agent input.
- Empty or whitespace-only header JSON and `{}` mean no headers and allow zero-auth endpoints. The JSON must be one object containing only string values. `null`, other JSON types, duplicate names including case variants, trailing JSON, invalid UTF-8, and control characters are rejected.
- `Authorization` is allowed only when explicitly configured. The compatible provider does not inherit native `OPENAI_*` SDK settings or the native OpenAI agent/embedding key.
- The service rejects `Host`, `Content-Length`, `Content-Type`, `Accept`, `Connection`, `Keep-Alive`, `Proxy-Authenticate`, `Proxy-Authorization`, `TE`, `Trailer`, `Transfer-Encoding`, `Upgrade`, and every `X-Stainless-*` header, case-insensitively.
- Redirects are returned as upstream failures and are never followed, so static headers are not forwarded to another location. Upstream failures are exposed as a fixed safe error rather than an upstream body or configured URL.
- The OpenAI SDK keeps its default two retries. The HTTP client has no global timeout so streams are not cut off; request-context cancellation still applies. Configure endpoint/proxy timeouts appropriate to the deployment.

Native `provider: openai` agents and auto-embeddings remain separate: both continue to use `OPENAI_API_KEY`, and neither uses the compatible base URL or headers.

### Cloudflare AI Gateway

The release smoke target is a named [Cloudflare AI Gateway OpenAI-compatible endpoint](https://developers.cloudflare.com/ai-gateway/usage/chat-completion/) with an OpenAI provider key stored in Cloudflare:

```text
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/compat
```

Use a tool-capable model in `openai/{model}` form. For this stored-key flow, configure exactly one static authentication header, `Authorization: Bearer <Cloudflare API token>`. Never put the token itself in documentation, command history, logs, or release evidence. Streamed text and tool evidence for `/compat` is pending execution by an authorized credential holder and blocks release until recorded. See the [Cloudflare `/compat` release smoke](DEVELOPMENT.md#cloudflare-compat-release-smoke) for the environment-only command, Authenticated Gateway caveat, and evidence checklist.

Cloudflare also documents this [OpenAI-compatible account REST endpoint](https://developers.cloudflare.com/ai-gateway/usage/rest-api/) as another compatible base URL:

```text
https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1
```

Nhost did not separately test the account endpoint. Other Cloudflare gateway authentication modes are outside the recorded smoke and must not be presented as successful without separate evidence.

### Ollama

Ollama documents [streaming and tools on `/v1/chat/completions`](https://docs.ollama.com/api/openai-compatibility) and [streamed tool calling](https://docs.ollama.com/capabilities/tool-calling). Run Ollama on the host and configure:

```bash
export OPENAI_COMPATIBLE_BASE_URL='http://localhost:11434/v1'
export OPENAI_COMPATIBLE_HEADERS='{}'
```

The recorded local smoke used Ollama `0.33.2` with the tool-capable `qwen3:0.6b` model and exercised both streamed text and a complete GraphQL tool loop through the AI service. If the AI service itself runs in Compose, use `http://host.docker.internal:11434/v1`; `localhost` inside that container refers to the AI container, not the host.

## HTTP endpoints

- `GET /healthz` — service health
- `GET /v1/version` — service version
- `POST /v1/webhooks/auto-embeddings-configuration` — synchronize configuration changes
- `POST /v1/webhooks/generate-embeddings` — generate an embedding for database functions
- `POST /v1/agents/sessions/:sessionID/messages` — stream an agent response
- `POST /v1/agents/sessions/:sessionID/approve-tools` — approve pending tool calls

## Getting started

The easiest way to run the service is through Nhost. For self-hosting, use [`build/dev/docker/docker-compose.yaml`](build/dev/docker/docker-compose.yaml) as a reference. PostgreSQL needs the following extensions:

- [pgvector](https://github.com/pgvector/pgvector)
- [pgsql-http](https://github.com/pramsey/pgsql-http)
- `pg_jsonschema`

## Contributing

Refer to the monorepo [contribution guide](../../CONTRIBUTING.md) and the service [development guide](DEVELOPMENT.md).

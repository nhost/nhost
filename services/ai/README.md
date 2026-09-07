# Nhost AI

The Nhost AI service adds auto-embeddings and multi-provider agents to the Nhost stack.

## Features

### Auto-embeddings

Auto-embeddings keep vector columns synchronized with source data. Each configuration specifies the source schema and table, the destination vector column, an OpenAI embedding model, and GraphQL operations used to read pending rows and persist generated vectors.

The service deploys permission-aware GraphQL functions for natural-language and similarity search.

Supported OpenAI models include `text-embedding-ada-002`, `text-embedding-3-small`, and `text-embedding-3-large`. Set `OPENAI_API_KEY` and, when required, `OPENAI_ORG` before starting the service.

### Multi-provider agents

Agents support Anthropic, OpenAI, and Google Gemini models with server-sent event streaming. They can use GraphQL, MCP, web search, and web fetch tools, with approval policies configured per agent.

Applications stream a message with:

```text
POST /v1/agents/sessions/:sessionID/messages
```

Pending tool calls can be approved with:

```text
POST /v1/agents/sessions/:sessionID/approve-tools
```

Agent definitions, sessions, and messages are stored in the `ai` PostgreSQL schema and exposed through the application's Hasura API, where normal permissions apply.

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

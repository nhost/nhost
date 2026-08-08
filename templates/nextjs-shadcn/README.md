# Nhost + Next.js + shadcn/ui

A full-stack, agent-ready starter created with `nhost create`:

- **`backend/`** — authentication, PostgreSQL, a GraphQL API, storage, serverless functions, migrations, and GraphQL metadata.
- **`frontend/`** — Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, `@nhost/nhost-js`, TanStack Query, and typed GraphQL documents.
- **`.claude/skills/`** — zero-install workflows that help an LLM add tables, permissions, and functions while keeping project context current.

## Prerequisites

- [Node.js](https://nodejs.org) >= 22 and [pnpm](https://pnpm.io)
- The [Nhost CLI](https://docs.nhost.io/platform/cli) (`nhost`)
- Docker for the local backend

## 1. Start the backend

```sh
cd backend
export NHOST_PROJECT_NAME=my-app
nhost up
```

Use a stable `NHOST_PROJECT_NAME` for this project. It namespaces the local containers and database volume so they do not collide with another project also stored in a `backend/` directory. Keep it set for `nhost up`, `nhost down`, and `nhost logs`.

The local stack includes the database, authentication, GraphQL API, storage, and functions runtime. Local sign-in emails are captured by the mail viewer instead of being sent.

## 2. Start the frontend

In another terminal:

```sh
cd frontend
cp .env.example .env.local
pnpm install
pnpm dev
```

Open <http://localhost:3000>. The home page reports GraphQL connectivity and links to the email one-time-code sign-in flow and protected todos page.

The default environment points to the local backend:

```dotenv
NHOST_SUBDOMAIN=local
NHOST_REGION=local
NEXT_PUBLIC_NHOST_SUBDOMAIN=local
NEXT_PUBLIC_NHOST_REGION=local
```

Use your project's subdomain and region when deploying to Nhost Cloud.

## Agent-ready development loop

The primary workflow is local files plus the Nhost CLI:

1. Start the backend with `NHOST_PROJECT_NAME` set: `(cd backend && nhost up)`.
2. After any schema or GraphQL metadata change, run `(cd frontend && pnpm codegen)`.
3. Prompt your LLM to build the feature. It should read `frontend/schema.graphql`, `AGENTS.md` or `CLAUDE.md`, and the relevant `.claude/skills/<name>/SKILL.md` first.
4. Review the implementation and run the relevant frontend checks.

The starter includes these skills:

- `add-table` for reversible migrations, tracked metadata, and user permissions
- `add-permission` for role and row-level access changes
- `create-function` for file-routed serverless endpoints and logs
- `refresh-context` for refreshing the committed schema and generated types

## `schema.graphql` is codegen input and LLM context

`frontend/schema.graphql` is intentionally committed and dual-purpose:

- GraphQL Code Generator reads it to produce the typed documents in `frontend/src/gql/`.
- An LLM reads it as the current, role-scoped backend contract when implementing data-backed features.

From `frontend/`, `pnpm codegen` first runs:

```sh
nhost schema dump --subdomain local --role user -o schema.graphql
```

It then regenerates `src/gql/`. Run it after every table, column, relationship, or permission change and commit the updated schema and generated files together. When the schema file is already current, `pnpm codegen:types` regenerates types offline without contacting the backend.

Do not hand-edit `schema.graphql`; refresh it from a running, fully applied local backend.

## Copy the todos example

The starter ships a complete `public.todos` feature with per-user row permissions:

- `backend/nhost/migrations/default/1700000000000_init_todos/` creates and rolls back the table.
- `backend/nhost/metadata/databases/default/tables/public_todos.yaml` tracks it, sets row ownership on insert, and limits operations to the current user.
- `frontend/src/app/protected/Todos.tsx` defines typed `GetTodos` and `CreateTodo` documents, calls them through `@nhost/nhost-js`, and uses TanStack Query for loading, mutation, and cache invalidation.

Use those files and the `add-table` skill as the copy-me pattern for new user-owned features.

## Where things live

```text
backend/
  nhost/migrations/  database migrations
  nhost/metadata/    tracked tables, relationships, and permissions
  functions/         file-routed serverless functions
  nhost.toml         backend configuration
frontend/
  schema.graphql     committed codegen input and LLM backend context
  src/gql/           committed generated GraphQL types and documents
  src/app/           App Router pages
  src/components/    shared and shadcn/ui components
  src/lib/nhost/     Nhost client wiring for server components and the proxy
  src/proxy.ts       auth session refresh and protected-route guard
.claude/skills/      project-specific LLM workflows
```

## Useful frontend commands

Run these from `frontend/`:

- `pnpm dev` — start the development server.
- `pnpm codegen` — dump the current user-role schema and regenerate types.
- `pnpm codegen:types` — regenerate types from the committed schema without a backend.
- `pnpm lint` / `pnpm format` — check or format with Biome.
- `pnpm build` — create a production build.

## Optional MCP integration

The optional `.mcp.json` registers the Nhost MCP server for assistants that support live inspection. It is not required: the committed schema, generated types, skills, and every step in the primary development loop work without MCP.

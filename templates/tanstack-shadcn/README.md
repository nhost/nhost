# Nhost + TanStack Start + shadcn/ui

A full-stack, agent-ready starter created with `nhost create`:

- **`backend/`** — authentication, PostgreSQL, a GraphQL API, storage, serverless functions, migrations, and GraphQL metadata.
- **`frontend/`** — TanStack Start (SPA mode), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, `@nhost/nhost-js`, TanStack Query, and typed GraphQL documents.
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

Open <http://localhost:3000>. The home page reports GraphQL connectivity and links to the email one-time-code sign-in flow and the protected todos page.

The default environment points to the local backend:

```dotenv
VITE_NHOST_SUBDOMAIN=local
VITE_NHOST_REGION=local
```

Use your project's subdomain and region when deploying. Both values are public and shipped to the browser; never put secrets in frontend environment files.

## SPA mode

The TanStack Start plugin runs with `spa` enabled, so `pnpm build` prerenders only the app shell to `dist/client/index.html` and every route renders in the browser. The result is a set of static assets you can serve from any CDN, as long as unknown paths fall back to `index.html`.

Because there is no server rendering of matched routes:

- The session lives in browser storage and is read by the `_authed` layout route's `beforeLoad` guard, which redirects to `/signin?redirect=…` when it is missing.
- `useAuth()` provides reactive session state for UI such as the nav bar.
- All GraphQL requests are made from the browser with the user's access token, so per-user row permissions in the backend are what protect the data.

If you later need server rendering or server functions, drop the `spa` option from `vite.config.ts` and move session reads to the server.

## Authentication

The starter uses email one-time codes, which the CLI enabled in `backend/nhost.toml`:

1. `/signin` asks for an email and calls `nhost.auth.signInOTPEmail`.
2. The local mail viewer captures the message; take the six-digit code from it.
3. Submitting the code calls `nhost.auth.verifySignInOTPEmail`, which stores the session, and the app navigates on to the protected page.

No sign-up step is needed: the first successful sign-in creates the user.

## Agent-ready by default

The project ships with `CLAUDE.md`, `AGENTS.md`, and `.claude/skills/` so an assistant can work without extra setup. The starter includes these skills:

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
- `frontend/src/components/Todos.tsx` defines typed `GetTodos` and `CreateTodo` documents, calls them through `@nhost/nhost-js`, and uses TanStack Query for loading, mutation, and cache invalidation.

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
  src/routes/        file-based routes (`_authed` guards protected pages)
  src/routeTree.gen.ts  generated route tree, never edited by hand
  src/router.tsx     router and TanStack Query client setup
  src/components/    shared and shadcn/ui components
  src/lib/nhost/     Nhost browser client and session context
.claude/skills/      project-specific LLM workflows
```

## Useful frontend commands

Run these from `frontend/`:

- `pnpm dev` — start the development server on port 3000.
- `pnpm codegen` — dump the current user-role schema and regenerate types.
- `pnpm codegen:types` — regenerate types from the committed schema without a backend.
- `pnpm lint` / `pnpm format` — check or format with Biome.
- `pnpm test` — run unit tests with Vitest.
- `pnpm build` — build the client bundle, prerender the shell, and type-check.
- `pnpm preview` — serve the production build locally.

## Optional MCP integration

The optional `.mcp.json` registers the Nhost MCP server for assistants that support live inspection. It is not required: the committed schema, generated types, skills, and every step in the primary development loop work without MCP.

# Nhost + Next.js + shadcn/ui

A full-stack starter created with `nhost create`:

- **`backend/`** — your Nhost project: authentication, a PostgreSQL database, a GraphQL API, storage, and serverless functions.
- **`frontend/`** — a Next.js 16 app (App Router) with React 19, Tailwind CSS v4, and shadcn/ui, wired to the backend through `@nhost/nhost-js`.

## Prerequisites

- [Node.js](https://nodejs.org) >= 22 and [pnpm](https://pnpm.io)
- The [Nhost CLI](https://docs.nhost.io/platform/cli) (`nhost`)
- Docker (the local backend runs in containers)

## 1. Start the backend

```bash
cd backend
export NHOST_PROJECT_NAME=my-app   # this project's name — isolates its local DB volume from other Nhost projects
nhost up
```

This starts the local Nhost stack (database, auth, GraphQL API, storage). Sign-in emails are not sent while running locally — they are captured by the local mail viewer, where you can read the one-time codes.

`NHOST_PROJECT_NAME` namespaces this project's Docker containers and volumes; without it, every Nhost project in a `backend/` folder shares one volume (which clashes if they use different Postgres versions). Keep it set — the `export` lasts for your shell session — so `nhost up`, `nhost down`, and `nhost logs` all target the same stack. Stop the stack with `nhost down`.

## 2. Start the frontend

In another terminal:

```bash
cd frontend
cp .env.example .env.local
pnpm install
pnpm dev
```

Open <http://localhost:3000>. The home page shows whether it can reach the GraphQL API, and links to a sign-in flow (email one-time code) and a server-protected page.

`.env.local` points the app at the local backend by default:

```
NHOST_SUBDOMAIN=local
NHOST_REGION=local
NEXT_PUBLIC_NHOST_SUBDOMAIN=local
NEXT_PUBLIC_NHOST_REGION=local
```

When you deploy to Nhost Cloud, set these to your project's subdomain and region.

## Where things live

```
backend/
  nhost/migrations   database migrations
  nhost/metadata     GraphQL API metadata (tracked tables, relationships, permissions)
  functions          serverless functions
  nhost.toml         backend configuration
frontend/
  src/app            App Router pages (server components by default)
  src/components      shared and shadcn/ui components
  src/lib/nhost       Nhost client wiring for server components and the proxy
  src/proxy.ts        refreshes the auth session on every request
```

## Adding a table and querying real data

The starter includes a `public.todos` table, per-user permissions, and typed query and mutation examples.

1. Create another table with a migration in `backend/nhost/migrations`.
2. Track it and configure relationships and permissions in `backend/nhost/metadata`.
3. With `nhost up` running, the changes are applied to the local backend.
4. Run `pnpm codegen` inside `frontend/` after any schema change to refresh `schema.graphql` and the generated types in `src/gql/`.

## AI assistants

This project ships with `CLAUDE.md` / `AGENTS.md` (a guide for coding assistants) and `.mcp.json`, which registers the Nhost MCP server so an assistant can inspect your GraphQL schema and run queries against the backend.

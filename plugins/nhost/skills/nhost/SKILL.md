---
name: nhost
description: Start here for any work on an Nhost backend. Nhost is a managed backend with Postgres, an instant GraphQL API with role-based permissions, Auth, Storage and serverless Functions, driven by the Nhost CLI and the @nhost/nhost-js SDK. Use when the user mentions Nhost, nhost.toml, nhost.run URLs, @nhost/nhost-js or the nhost CLI, or asks to build an app that needs a backend (database, sign-up/login, file uploads, API) and has chosen Nhost. Explains the mental model, how to look up current docs, safety rules, and which Nhost skill to use next.
---

# Nhost

Nhost gives an app a backend made of standard parts that work together:

- **Postgres**: the database. Tables are created with migrations.
- **GraphQL API**: generated automatically from the Postgres schema. Access is controlled by **role-based permissions**, declared as metadata rather than written in application code.
- **Auth**: users, sessions and JWTs. The JWT carries the user's id and role, and the GraphQL API enforces permissions with them.
- **Storage**: files in buckets. File access uses the same permission system, applied to the `storage.files` table.
- **Functions**: serverless Node.js endpoints in the project's `functions/` folder.

Every project is addressed by a `subdomain` and a `region`, which form service URLs such as `https://{subdomain}.graphql.{region}.nhost.run/v1`. A local project started with the Nhost CLI uses `subdomain: "local"` and `region: "local"`.

A project folder (created by `nhost init`) contains `nhost/nhost.toml` (configuration), `nhost/migrations/` (SQL migrations), `nhost/metadata/` (tracked tables, relationships, permissions), `nhost/emails/`, `nhost/seeds/` and `functions/`. All of it is meant to be committed to Git. Nhost Cloud deploys it from the connected repository.

## Look up current docs before writing Nhost-specific code

Nhost's APIs changed across major versions, and much older example code online is wrong for current versions. Before writing SDK calls, permission rules or configuration, confirm them in the docs using the first option available:

1. **Nhost MCP server** (if connected): the `search` tool, then `read_page` for a full page.
2. **Nhost CLI**: `nhost docs search "<query>"` and then `nhost docs show <path>`, for example `nhost docs show /products/graphql/permissions`.
3. **Web**: https://docs.nhost.io/llms.txt (index), https://docs.nhost.io/llms-small.txt (compact full text), or the page itself under https://docs.nhost.io.

Use `@nhost/nhost-js` v4. Do not use v3-era code: `new NhostClient(...)`, `nhost.auth.signIn(...)` / `nhost.auth.signUp(...)`, `onAuthStateChanged`, `nhost.storage.upload(...)`, or `const { data, error } = await ...` result destructuring. Do not use the deprecated packages `@nhost/react`, `@nhost/nextjs`, `@nhost/vue` or `@nhost/react-apollo`. v4 calls return `{ body, status, headers }` and throw `FetchError` on failure.

## Which skill to use

| Task | Skill |
|---|---|
| Install the CLI, create or start a project, connect the MCP server; no Docker available; deploy or go live on Nhost Cloud | `setup` |
| Tables, relationships, migrations, GraphQL permissions, queries | `database` |
| Sign-up, sign-in, email verification, sessions, roles, JWT claims | `auth` |
| File uploads, buckets, file permissions | `storage` |
| Serverless functions, calling them, secrets | `functions` |
| Connecting React, Next.js, Vue, SvelteKit or React Native with `@nhost/nhost-js` | `frontend` |

A typical new app goes through them in order: `setup` → `database` → `auth` → `frontend`, then `storage` or `functions` if needed.

## Nhost MCP server (optional)

The Nhost CLI includes an MCP server (`nhost mcp start`). When it is connected, prefer its tools:

- `get-schema`: read the GraphQL schema for a role.
- `graphql-query`: run queries as a given role and user.
- `manage-graphql`: create migrations and change metadata/permissions on a local project.
- `search` / `read_page` / `list`: Nhost docs.
- `cloud-graphql-query`: only if Nhost Cloud access is configured.

Every skill also works without it, using the `nhost` CLI and project files. To connect it, see the `setup` skill.

## Safety rules (always apply)

- The **admin secret** bypasses all permissions. Never put it in frontend code, public environment variables (for example `NEXT_PUBLIC_*` or `VITE_*`), or committed files. Use it only in server-side code, from secrets.
- Permissions are deny-by-default. Grant each role only the rows and columns it needs. Give the `public` role access only to data that is genuinely public.
- For user-owned data, check ownership with `X-Hasura-User-Id` in permission rules, and set owner columns with permission presets. Never trust a user id sent by the client.
- Never point an MCP configuration that uses an admin secret at a production project.
- Before changing a Nhost Cloud project, deploying, or deleting data, tell the user what will happen and get confirmation.
- If the docs don't cover something, say so. Don't invent Nhost APIs, config keys or CLI flags.

The user's instructions take precedence over this skill.

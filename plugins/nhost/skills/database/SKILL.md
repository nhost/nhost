---
name: database
description: Designs and changes the Postgres database behind an Nhost project and its GraphQL API. Covers creating tables and columns, foreign keys and relationships (including to auth.users), migrations (nhost/migrations) and metadata (nhost/metadata), tracking tables, and role-based GraphQL permissions (select/insert/update/delete, row-level checks, column lists, presets, X-Hasura-User-Id, public vs user roles, custom roles). Use when the user asks to add a table, change the schema, write a migration, "make data private to each user", set up row-level permissions or access control, expose data publicly, or test a GraphQL query as a specific role in an Nhost project. Works with the Nhost MCP server (manage-graphql, graphql-query, get-schema) or with plain files plus `nhost up`.
---

# Nhost database, migrations and permissions

Every Nhost project has a Postgres database. The GraphQL API exposes **tracked** tables, and **permissions** decide, per role and per operation, which rows and columns each request can reach. Most security bugs in Nhost apps come from permissions that are too broad. Treat every permission change as security-relevant.

Out of scope, use the named skill instead: sign-up/sign-in flows, JWTs, assigning roles to users (`auth`); file and bucket permissions (`storage`); client-side GraphQL code (`frontend`); installing the CLI or starting a project (`setup`).

## Ground rules

- Change the schema only through migrations, never with ad-hoc SQL against the database. Every migration needs a working down step.
- Work against the **local** project (`subdomain: "local"`), then commit `nhost/migrations` and `nhost/metadata` and deploy through Git. Never point an admin-secret MCP configuration or a `manage-graphql` call at a production project.
- Before changing anything, inspect the current schema and follow its existing naming patterns.
- Describe the planned change (tables, columns, relationships, and every permission per role) in plain language before applying it.
- Ask the user before inserting, changing or deleting data. Ask whether data changes belong in a migration.
- Never put the admin secret in frontend code, committed env files, or examples. It bypasses all permissions.

## Pick a workflow

1. **Nhost MCP server available** (tools named like `manage-graphql`, `graphql-query`, `get-schema`, possibly prefixed): read [references/migrations-with-mcp.md](references/migrations-with-mcp.md). It has a complete request for the "user-owned rows" case.
2. **No MCP**: write migration SQL and metadata YAML by hand, then run `nhost up`. Read [references/migrations-as-files.md](references/migrations-as-files.md).
3. **The user prefers a UI**: the local dashboard at `https://local.dashboard.local.nhost.run/local/local` (Database tab) creates the same migration and metadata files. It is the human alternative to both paths.

In all cases, read [references/permissions.md](references/permissions.md) before writing any permission.

## The default pattern: user-owned rows

When the user asks for data that "belongs to" a signed-in user (todos, notes, orders, profiles), build this unless they ask for something else:

- Table with an owner column, e.g. `user_id uuid NOT NULL` with `FOREIGN KEY (user_id) REFERENCES auth.users (id)`.
- Track the table. Add an object relationship on the owner column (e.g. `user`), and, if useful, an array relationship back from `auth.users`.
- Role `user`:
  - **insert**: preset `user_id` = `X-Hasura-User-Id`; `user_id` is **not** in the insertable columns; check `{"user_id": {"_eq": "X-Hasura-User-Id"}}`.
  - **select**: filter `{"user_id": {"_eq": "X-Hasura-User-Id"}}`; only the columns the app reads.
  - **update**: same filter **and** the same check; editable columns exclude `id` and `user_id`.
  - **delete**: same filter.
- Role `public`: nothing, unless the user explicitly wants unauthenticated reads.

Never let the client send the owner ID. The owner comes from the access token via `X-Hasura-User-Id`.

## Verify before you finish

Do not report success on the basis of "the request returned 200". Prove the permissions:

- Fetch the schema for role `user` (MCP `get-schema` with `role: "user"`, or `nhost schema dump --subdomain local --role user`) and confirm that only the intended fields and mutations appear. The owner column must not be in the insert or update input types.
- Run real queries as role `user` for two different user IDs: user A must not see, update or delete user B's rows. Details and commands are in the workflow references.
- Fetch the schema for role `public` and confirm the table is absent unless public access was requested.
- Run the security checklist at the end of [references/permissions.md](references/permissions.md).
- Check `git status`/`git diff` under `nhost/migrations` and `nhost/metadata` and show the user what changed. These files are what gets deployed.

## Stop and ask the user when

- A requested rule would grant `public` access, use an empty filter (`{}`) on user data, or expose columns from `auth.users` beyond basic profile fields.
- The request needs a new role, or depends on roles or claims that do not exist yet (see `auth`).
- A change would drop or rewrite columns or tables that hold data.
- Docs and observed behavior disagree. Do not guess.

## Docs

- Permissions: https://docs.nhost.io/products/graphql/permissions (also `/examples`, `/permission-variables`, `/rule-editor` under that path)
- Local migrations and metadata: https://docs.nhost.io/platform/cli/local-development
- Database: https://docs.nhost.io/products/database (extensions, performance, access, backups under that path)
- GraphQL API: https://docs.nhost.io/products/graphql. Link only, for relationships to remote data: [computed fields](https://docs.nhost.io/products/graphql/computed-fields), [remote schemas](https://docs.nhost.io/products/graphql/remote-schemas), [actions](https://docs.nhost.io/products/graphql/actions)
- MCP server: https://docs.nhost.io/platform/cli/mcp
- Search without MCP: `nhost docs search "<query>"`, `nhost docs show <path>`, or https://docs.nhost.io/llms.txt

The user's instructions take precedence over this skill.

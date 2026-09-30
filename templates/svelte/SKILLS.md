# Skills

Repeatable workflows for this project, written for any coding agent. Read the section that matches the task and follow it, rather than inventing file paths or metadata shapes.

Claude Code discovers the same four workflows on its own from `.claude/skills/<name>/SKILL.md`, one directory per skill, because that is the layout it loads. This file holds the same content in one place for agents that do not read `.claude/`, and so it can be copied into a project that was not scaffolded by `nhost create`. Change a workflow in both.

| Skill | Use it when |
| --- | --- |
| [Add a table](#add-a-table) | Adding a model or changing the database schema |
| [Add a table permission](#add-a-table-permission) | A role needs new table access, or row ownership rules change |
| [Create a serverless function](#create-a-serverless-function) | Adding a webhook, custom HTTP endpoint, or server-side logic |
| [Refresh the project context](#refresh-the-project-context) | After any migration, metadata, or permission change |

## Add a table

Use this skill when adding a model or changing the database schema. Run commands from the project root unless a step says otherwise. Read `backend/nhost/migrations/default/1700000000000_init_todos/up.sql` and `backend/nhost/metadata/databases/default/tables/public_todos.yaml` first; they are the working pattern for this template.

### 1. Create reversible SQL migrations

Choose a snake_case table name. Create a timestamped directory with both migration directions:

```sh
timestamp="$(date +%s)000"
migration="backend/nhost/migrations/default/${timestamp}_create_notes"
mkdir -p "$migration"
```

For a user-owned `public.notes` table, write this to `up.sql`:

```sql
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index on public.notes (user_id);
```

Write the inverse operation to `down.sql`:

```sql
drop table public.notes;
```

Keep the owner column required. Do not give it an `auth.uid()` SQL default; the insert permission preset in the next step supplies the authenticated user ID.

### 2. Track the table and grant the `user` role access

Create `backend/nhost/metadata/databases/default/tables/public_notes.yaml`:

```yaml
table:
  name: notes
  schema: public
insert_permissions:
  - role: user
    permission:
      check:
        user_id:
          _eq: X-Hasura-User-Id
      set:
        user_id: X-Hasura-User-Id
      columns:
        - body
select_permissions:
  - role: user
    permission:
      columns:
        - id
        - user_id
        - body
        - created_at
      filter:
        user_id:
          _eq: X-Hasura-User-Id
update_permissions:
  - role: user
    permission:
      columns:
        - body
      filter:
        user_id:
          _eq: X-Hasura-User-Id
      check: null
delete_permissions:
  - role: user
    permission:
      filter:
        user_id:
          _eq: X-Hasura-User-Id
```

Adapt the columns to the requested table. Never put `user_id` in the user-writable insert or update column lists. Keep the insert `set` preset and every owner filter so users can only create, read, update, and delete their own rows.

### 3. Include the metadata file

Add this entry to `backend/nhost/metadata/databases/default/tables/tables.yaml` without removing existing includes:

```yaml
- "!include public_notes.yaml"
```

### 4. Apply and refresh the typed frontend

Set a stable project name once per shell, then start or re-run the local backend so it applies the migration and metadata:

```sh
export NHOST_PROJECT_NAME=my-app
(cd backend && nhost up)
```

After the backend is ready, regenerate the committed role-scoped schema and TypeScript documents. This is the required final step:

```sh
(cd frontend && pnpm codegen)
```

## Add a table permission

Use this skill when a role needs new table access, a column must be exposed or hidden, or row ownership rules change. Run commands from the project root. Use `backend/nhost/metadata/databases/default/tables/public_todos.yaml` as the canonical example.

### 1. Locate the tracked table

Open `backend/nhost/metadata/databases/default/tables/<schema>_<table>.yaml`. Confirm that `backend/nhost/metadata/databases/default/tables/tables.yaml` includes it before editing permissions.

Edit the existing role entry when one is present; do not create two entries for the same role in one permission section.

### 2. Add the required permission shapes

The following `user` permissions show the four supported operations for a table owned through `user_id`. Replace the column names with the table's real columns and keep writable columns as narrow as possible.

```yaml
insert_permissions:
  - role: user
    permission:
      check:
        user_id:
          _eq: X-Hasura-User-Id
      set:
        user_id: X-Hasura-User-Id
      columns:
        - title
        - completed
select_permissions:
  - role: user
    permission:
      columns:
        - id
        - user_id
        - title
        - completed
        - created_at
      filter:
        user_id:
          _eq: X-Hasura-User-Id
update_permissions:
  - role: user
    permission:
      columns:
        - title
        - completed
      filter:
        user_id:
          _eq: X-Hasura-User-Id
      check: null
delete_permissions:
  - role: user
    permission:
      filter:
        user_id:
          _eq: X-Hasura-User-Id
```

Permission fields have distinct purposes:

- `columns` is the exact allowlist visible or writable by the role.
- `filter` limits existing rows for select, update, and delete.
- `check` validates a proposed inserted or updated row.
- `set` supplies a trusted session value during insert; use the session variable exactly as in the example (`X-Hasura-User-Id`). Hasura session variables are case-insensitive, so match the example's spelling for consistency rather than out of necessity.

For non-owner policies, use the same session-variable comparison pattern against the appropriate column. Do not expose an ownership column in insert or update `columns`; set it from the authenticated session instead.

### 3. Apply and refresh the typed frontend

Set the same project name used to start this local stack, then start or re-run the backend so it applies the metadata:

```sh
export NHOST_PROJECT_NAME=my-app
(cd backend && nhost up)
```

Permission changes alter the schema visible to the `user` role. Regenerate the committed schema and TypeScript documents as the required final step:

```sh
(cd frontend && pnpm codegen)
```

## Create a serverless function

Use this skill for webhooks, custom HTTP endpoints, or server-side logic that does not belong in the frontend. Functions use file-based routing: `backend/functions/hello.js` maps to `/v1/hello`, while `backend/functions/users/index.js` maps to `/v1/users`.

### 1. Create the function file

Run this from the project root:

```sh
mkdir -p backend/functions
cat > backend/functions/hello.js <<'EOF'
export default function handler(req, res) {
  const name = typeof req.query.name === 'string' ? req.query.name : 'world';

  res.status(200).json({
    message: `hello ${name}`,
    method: req.method,
  });
}
EOF
```

Rename the file and adapt the handler to the requested endpoint. Prefix shared helper directories with `_`, such as `backend/functions/_utils/`, so they are not exposed as routes. Validate request bodies and headers before using them, return explicit HTTP status codes, and never log tokens or secrets.

### 2. Start the local runtime

Set a stable project name once per shell, then start the backend from its directory:

```sh
export NHOST_PROJECT_NAME=my-app
(cd backend && nhost up)
```

The runtime watches `backend/functions/` and hot-reloads file edits. No schema or frontend code generation is needed for a function-only change.

### 3. Call the endpoint and inspect logs

In another terminal, call the local route:

```sh
curl 'https://local.functions.local.nhost.run/v1/hello?name=Nhost'
```

Inspect function output and runtime errors through the CLI:

```sh
export NHOST_PROJECT_NAME=my-app
(cd backend && nhost logs functions)
```

If the function needs environment variables, add local values to `backend/.secrets` and do not commit real secrets. If it needs third-party packages, add a `package.json` and a committed lockfile under `backend/functions/`, then restart `nhost up` so the runtime installs them.

## Refresh the project context

Run this skill after any database migration or GraphQL metadata change, including table, column, relationship, or permission changes. The local backend must be running and fully applied first.

`frontend/schema.graphql` has two jobs: it is the input to GraphQL code generation, and it is the committed, current backend contract that an LLM should read before building data-backed features. Do not edit it by hand.

### Refresh schema and generated types

From the project root, dump the schema visible to the `user` role, then regenerate TypeScript documents from that committed file:

```sh
nhost schema dump --subdomain local --role user -o frontend/schema.graphql
(cd frontend && pnpm codegen:types)
```

Review and commit changes to both `frontend/schema.graphql` and `frontend/src/gql/` with the feature that changed the schema.

### Optionally inspect the schema diff

Save the old schema before dumping when you want a focused compatibility review:

```sh
before="$(mktemp)"
cp frontend/schema.graphql "$before"
nhost schema dump --subdomain local --role user -o frontend/schema.graphql
nhost schema diff -a "$before" -b frontend/schema.graphql
rm "$before"
(cd frontend && pnpm codegen:types)
```

Read the diff for removed fields, changed nullability, or permissions that hide fields from the `user` role. Then read the refreshed `frontend/schema.graphql` as the source of truth for subsequent LLM prompts.

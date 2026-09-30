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

That is the rule for a **new** table, and for every change to a project that has
already been deployed. Editing a migration in place is only safe while no
environment has run it: before your first deploy, adding a column to the
starter's own table belongs in that table's existing migration, which is what
`AGENTS.md` means by keeping the todos table to one file. After a deploy, every
change is a new migration, that table included - one another environment has
already applied cannot be rewritten.

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

Start or re-run the local backend so it applies the migration and metadata:

```sh
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

### Rules for a role other than `user`

`public` is the role Hasura uses for a request with no token. A permission for
it is how data becomes readable without signing in, and it is the permission
most likely to leak something, so:

- Gate on columns the owner controls. The shipped example needs two: the row
  is flagged `todos.is_public`, and the owner has not turned their page off
  from their profile page. That second switch is an *opt-out* - the page is on
  by default - so the filter tests `_not ... _contains false` on
  `metadata.publicProfile` rather than `_contains true`. One switch alone
  exposes nothing: an item stays private until its eye is on, so nothing goes
  public as a side effect of a single click.
- Filter through a relationship when visibility belongs to a related row.
  `public_todos.yaml` reaches the owner through `user`, and
  `storage_files.yaml` reaches the item through `todos`.
- Repeat the condition; do not lean on the related table's own permission. A
  relationship filter matches raw rows. `storage_files.yaml` spells the whole
  owner rule out again for that reason, and a shortcut there would leave every
  private attachment readable.
- Write a separate, shorter `columns` list. Do not reuse the `user` list. What
  is left off is the whole protection: among the columns withheld today are
  `auth.users.email`, `auth.users.display_name`, `auth.users.metadata`,
  `auth.users.avatar_url`, and `todos.user_id`.
- Two of those look harmless and are not, for the same reason: both quietly
  contain the email address. `avatar_url`, for an account that never uploaded a
  photo, holds the sign-up Gravatar URL, which embeds `md5(lowercase(email))`.
  `display_name` is worse - Nhost auth defaults it to the address itself, in
  plaintext, so `{ users { displayName } }` as `public` would return the
  project's address book.
- Prefer replacing a withheld column with a computed field over dropping it.
  Neither of those two is simply gone: `/u/[id]` serves the picture from
  `storage.files` under the same public-and-not-deleted condition, and the name
  comes from the `publicDisplayName` computed field, which returns
  `display_name` only when it is plainly something its owner typed. Test the
  *shape* of such a value, not its equality with the thing you are hiding -
  changing an email moves `email` and leaves the previous address sitting in
  `display_name`, where no equality test against the current one can catch it.
- Read that data with `createAnonymousClient()` from
  `frontend/src/lib/nhost/server.ts`. The session client makes Hasura answer as
  `user`, whose filter hides other people's rows, so the page breaks for
  signed-in visitors and only for them.
- Verify both directions after changing one of these. A private row must be
  absent anonymously, and a shared one present. For an attachment that means
  the file URL is a 404 before sharing and a 200 after.

### 3. Apply and refresh the typed frontend

Start or re-run the backend so it applies the metadata:

```sh
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

The project ships `backend/functions/avatar.ts` as a working reference: it authenticates the caller against the auth service, validates the body, and calls the storage API and GraphQL as admin through the `NHOST_*` environment variables the runtime provides. One constraint to design around: the runtime bundles each function with esbuild, and native modules do not survive bundling. sharp fails at runtime, which is why the avatar function resizes with pure-JS jimp; pick pure-JS dependencies for functions.

### 2. Start the local runtime

Start the backend from its directory:

```sh
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
(cd backend && nhost logs functions)
```

If the function needs environment variables, declare each one under `[[global.environment]]` in `backend/nhost/nhost.toml`. The functions container receives the system variables plus the names declared there, so a bare key in `backend/.secrets` never reaches `process.env`. Keep sensitive values in `backend/.secrets`, which is gitignored, and reference them from the config entry; do not commit real secrets:

```toml
[[global.environment]]
name = 'MY_KEY'
value = '{{ secrets.MY_KEY }}'
```

Restart `nhost up` after editing either file. For third-party packages, `backend/functions/package.json` and `backend/functions/package-lock.json` already exist: run `npm install <package>` from `backend/functions/`, then commit the updated `package-lock.json`. The running runtime reinstalls when the lockfile changes. Do not add a lockfile of another flavour beside it — the runtime installs from the first of `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, so a `pnpm-lock.yaml` is ignored and the packages it declares are silently never installed.

## Refresh the project context

Run this skill after any database migration or GraphQL metadata change, including table, column, relationship, or permission changes. The local backend must be running and fully applied first.

`frontend/schema.graphql` has two jobs: it is the input to GraphQL code generation, and it is the committed, current backend contract that an LLM should read before building data-backed features. Do not edit it by hand.

The dump is scoped to the `user` role. A document executed with `createAnonymousClient()` — like `GetSharedList` in `frontend/src/app/u/[id]/page.tsx` — type-checks against this file even though it runs as `public`, so a field the `public` role cannot read still passes `pnpm codegen:types`. Before adding a field to such a document, check that role's column allowlist in `backend/nhost/metadata/databases/default/tables/` (see `auth_users.yaml`, `public_todos.yaml`) rather than trusting the offline type-check.

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

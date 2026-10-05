# Schema, metadata and permissions as files (no MCP)

Use this when the Nhost MCP server is not available. You write the same files the dashboard or the MCP would generate, then let `nhost up` apply them.

## Project layout

```
nhost/
  migrations/default/<timestamp>_<name>/up.sql
  migrations/default/<timestamp>_<name>/down.sql
  metadata/version.yaml                                  # "version: 3"
  metadata/databases/databases.yaml                      # points at default/tables/tables.yaml
  metadata/databases/default/tables/tables.yaml          # list of !include lines
  metadata/databases/default/tables/<schema>_<table>.yaml
```

- `<timestamp>` is milliseconds since the epoch, e.g. `1685452095884_create_table_public_messages`. It must sort after every existing migration folder. Look at the existing folders first.
- One YAML file per tracked table, named `<schema>_<table>.yaml` (e.g. `public_todos.yaml`, `auth_users.yaml`).
- A table is tracked when its file is listed in `tables.yaml`.

**Run `nhost up` once before writing any metadata.** In a fresh project, `nhost init` creates an empty `nhost/metadata/` folder. The first `nhost up` initializes the database and writes `version.yaml`, `databases/databases.yaml`, `tables.yaml` and the `auth_*` / `storage_*` table files. Never create `databases.yaml` or `tables.yaml` by hand. If they're missing, run `nhost up` first. A hand-written `databases.yaml` makes metadata apply fail with errors such as `is not valid GraphQL name` at `sources[0].kind`.

## 1. Migration

`nhost/migrations/default/<timestamp>_create_table_public_todos/up.sql`:

```sql
CREATE TABLE public.todos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  title text NOT NULL,
  details text,
  completed bool DEFAULT false NOT NULL,
  user_id uuid NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON UPDATE CASCADE ON DELETE CASCADE
);
```

`down.sql` in the same folder:

```sql
DROP TABLE public.todos;
```

Always write a real `down.sql`. Never edit a migration that has already been applied or committed. Add a new one instead.

## 2. Track the table

Add one line to `nhost/metadata/databases/default/tables/tables.yaml`, keeping the existing entries and their order style:

```yaml
- "!include public_todos.yaml"
```

## 3. Table metadata with relationships and permissions

`nhost/metadata/databases/default/tables/public_todos.yaml`:

```yaml
table:
  name: todos
  schema: public
object_relationships:
  - name: user
    using:
      foreign_key_constraint_on: user_id
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
        - details
        - completed
select_permissions:
  - role: user
    permission:
      columns:
        - id
        - created_at
        - title
        - details
        - completed
        - user_id
      filter:
        user_id:
          _eq: X-Hasura-User-Id
update_permissions:
  - role: user
    permission:
      columns:
        - title
        - details
        - completed
      filter:
        user_id:
          _eq: X-Hasura-User-Id
      check:
        user_id:
          _eq: X-Hasura-User-Id
delete_permissions:
  - role: user
    permission:
      filter:
        user_id:
          _eq: X-Hasura-User-Id
```

Optional reverse relationship: `auth_users.yaml` already exists and is maintained by Nhost. Only **add** an entry under its existing `array_relationships:` list. Do not touch its other keys:

```yaml
  - name: todos
    using:
      foreign_key_constraint_on:
        column: user_id
        table:
          name: todos
          schema: public
```

Session-aware computed fields need to be listed per role under `computed_fields:` inside `select_permissions`. See https://docs.nhost.io/products/graphql/guides/session-aware-computed-fields.

## 4. Apply with `nhost up`

Run `nhost up` from the project root. It is safe to run again while the stack is already running. Each run:

1. starts or updates the containers (`docker compose up -d --wait`),
2. applies pending migrations if `nhost/migrations/default` exists,
3. applies the metadata if `nhost/metadata/version.yaml` exists,
4. restarts dependent services (auth, storage, functions), then **exports the server's metadata back into `nhost/metadata`**, and reloads it.

Consequences:
- After it finishes, run `git diff nhost/metadata` and confirm that your YAML survived the export. If your permission is missing or was rewritten, the server did not accept it. Fix the YAML and run again.
- If something fails, `nhost up` asks "Do you want to stop Nhost's development environment? [y/N]". Without an interactive terminal, that prompt can fail, and the command can then exit with status 0 even though it failed. **Read the output.** Treat any "failed to apply migrations" or "failed to apply metadata" line as a failure, whatever the exit code. Do not pass `--down-on-error` unless the user agrees to have the stack stopped on error.
- The metadata error message does not include details. Re-check YAML indentation, table and column names, and that every relationship's foreign key exists.

## 5. Verify

- Schema per role, from the running stack: `nhost schema dump --subdomain local --role user` (and `--role public`). Or offline from the files: `nhost schema dump --metadata nhost/metadata --role user`. Confirm that `todos_insert_input` has no `user_id`, `todos_set_input` has no `id`/`user_id`, and `public` has no `todos`.
- Behaviour per user: on the local project only, you may query the GraphQL endpoint with the local admin secret while impersonating a role. These are the same headers the MCP `graphql-query` tool sends:

  ```bash
  curl -s https://local.graphql.local.nhost.run/v1 \
    -H "X-Hasura-Admin-Secret: $HASURA_GRAPHQL_ADMIN_SECRET" \
    -H "Content-Type: application/json" \
    -H "X-Hasura-Role: user" -H "X-Hasura-User-Id: $TEST_USER_A" \
    -d '{"query":"query { todos { id user_id } }"}'
  ```

  Take the secret from the project's `.secrets` file (key `HASURA_GRAPHQL_ADMIN_SECRET`, default locally `nhost-admin-secret`) through an env var. Never paste it into files or commit it. Use two real user IDs from `auth.users` and run the same A-vs-B checks as in [migrations-with-mcp.md](migrations-with-mcp.md#4-verify-as-real-roles).
- Then commit `nhost/migrations` and `nhost/metadata` together. A Git push to the linked Nhost project deploys them (https://docs.nhost.io/platform/cli/local-development).

## Human alternative

The local dashboard (`https://local.dashboard.local.nhost.run/local/local`, Database tab, then "Edit Permissions" on a table) writes the same files. Suggest it when the user wants to click rather than read YAML, then review the resulting diff with them.

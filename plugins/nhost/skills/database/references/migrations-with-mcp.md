# Schema, metadata and permissions with the Nhost MCP server

Use this when the Nhost MCP server is connected. Tool names may carry a host prefix.

| Tool | Use it for |
|---|---|
| `manage-graphql` | POST to the GraphQL engine's management endpoints with the admin secret. Arguments: `subdomain`, `path`, `body` (a JSON **string**). |
| `get-schema` | GraphQL schema for a `role` and `subdomain`. `summary` defaults to true. |
| `graphql-query` | Run a query or mutation as a `role`, optionally with `userId` (sets `X-Hasura-User-Id`). |

`manage-graphql` only works when the MCP config has `manage_metadata = true` and an admin secret for that project. Use it with `subdomain: "local"` only. The request shapes are described in the MCP resource `schema://graphql-management` (an OpenAPI spec). Read it if a request is rejected.

## Endpoints

| Path | Purpose |
|---|---|
| `/apis/migrate` | **All changes**: schema (SQL) and metadata (tracking, relationships, permissions). Locally, this is served by the migration API of the local stack, which writes the files under `nhost/migrations/default/` and `nhost/metadata/`. |
| `/v2/query` | Read-only inspection with `run_sql`. Never use it to change the schema. |
| `/v1/metadata` | Read-only helpers: `export_metadata`, `pg_suggest_relationships`. Do not use it for changes on the local project, because changes sent here are not written to migration files. |

The tool's own rules, which you must follow: describe the change first; check the current state first; follow existing patterns; always send a down migration; always track new tables; always track new foreign keys as relationships; send changes in bulk; add new roles to `auth.roles` through a migration; confirm data changes with the user.

## 1. Inspect the current state

`path: "/v2/query"`, body:

```json
{"type": "run_sql", "args": {"source": "default", "read_only": true,
  "sql": "SELECT table_schema, table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' ORDER BY 1,2;"}}
```

`path: "/v1/metadata"`, body `{"type": "export_metadata", "args": {}}` shows what is tracked and which permissions exist.

## 2. Create and track the table (schema migration)

`path: "/apis/migrate"`, body:

```json
{
  "name": "create_table_public_todos",
  "datasource": "default",
  "up": [
    {"type": "run_sql", "args": {"source": "default", "cascade": true, "sql":
      "CREATE TABLE public.todos (id uuid DEFAULT gen_random_uuid() NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, title text NOT NULL, details text, completed bool DEFAULT false NOT NULL, user_id uuid NOT NULL, PRIMARY KEY (id), FOREIGN KEY (user_id) REFERENCES auth.users (id) ON UPDATE CASCADE ON DELETE CASCADE);"}},
    {"type": "pg_track_table", "args": {"source": "default", "table": {"schema": "public", "name": "todos"}}}
  ],
  "down": [
    {"type": "run_sql", "args": {"source": "default", "cascade": true, "sql": "DROP TABLE public.todos;"}}
  ]
}
```

A successful response returns the migration name with a timestamp, e.g. `{"name": "1745093409829_create_table_public_todos"}`.

## 3. Relationships and permissions (metadata migration)

`path: "/apis/migrate"`, body (`T` stands for `{"schema": "public", "name": "todos"}`; write it out in full):

```json
{
  "name": "todos_relationships_and_user_permissions",
  "datasource": "default",
  "up": [
    {"type": "pg_create_object_relationship", "args": {"source": "default", "table": T,
      "name": "user", "using": {"foreign_key_constraint_on": "user_id"}}},
    {"type": "pg_create_array_relationship", "args": {"source": "default",
      "table": {"schema": "auth", "name": "users"}, "name": "todos",
      "using": {"foreign_key_constraint_on": {"table": T, "column": "user_id"}}}},
    {"type": "pg_create_insert_permission", "args": {"source": "default", "table": T, "role": "user",
      "permission": {"check": {"user_id": {"_eq": "X-Hasura-User-Id"}},
                     "set": {"user_id": "X-Hasura-User-Id"},
                     "columns": ["title", "details", "completed"]}}},
    {"type": "pg_create_select_permission", "args": {"source": "default", "table": T, "role": "user",
      "permission": {"filter": {"user_id": {"_eq": "X-Hasura-User-Id"}},
                     "columns": ["id", "created_at", "title", "details", "completed", "user_id"]}}},
    {"type": "pg_create_update_permission", "args": {"source": "default", "table": T, "role": "user",
      "permission": {"filter": {"user_id": {"_eq": "X-Hasura-User-Id"}},
                     "check": {"user_id": {"_eq": "X-Hasura-User-Id"}},
                     "columns": ["title", "details", "completed"]}}},
    {"type": "pg_create_delete_permission", "args": {"source": "default", "table": T, "role": "user",
      "permission": {"filter": {"user_id": {"_eq": "X-Hasura-User-Id"}}}}}
  ],
  "down": [
    {"type": "pg_drop_delete_permission", "args": {"source": "default", "table": T, "role": "user"}},
    {"type": "pg_drop_update_permission", "args": {"source": "default", "table": T, "role": "user"}},
    {"type": "pg_drop_select_permission", "args": {"source": "default", "table": T, "role": "user"}},
    {"type": "pg_drop_insert_permission", "args": {"source": "default", "table": T, "role": "user"}},
    {"type": "pg_drop_relationship", "args": {"source": "default",
      "table": {"schema": "auth", "name": "users"}, "relationship": "todos"}},
    {"type": "pg_drop_relationship", "args": {"source": "default", "table": T, "relationship": "user"}}
  ]
}
```

Notes:
- The schema step and the metadata step are two requests, so the table exists before metadata refers to it.
- To change an existing permission, send `pg_drop_<op>_permission` then `pg_create_<op>_permission` in `up`, and the reverse (restoring the old permission) in `down`.
- Optional select fields: `limit` (row cap) and `allow_aggregations` (default false). See [permissions.md](permissions.md) before using them.
- If a `pg_create_*` step returns an error saying the permission or relationship already exists, export the metadata and adjust. Do not drop things you did not create without asking.

After both requests, run `git status` in the project and confirm that the new files appeared under `nhost/migrations/default/` and `nhost/metadata/databases/default/tables/`.

## 4. Verify as real roles

1. Get two test user IDs: `graphql-query` with `role: "admin"` and `query { users(limit: 2) { id } }`. If fewer than two users exist, ask the user to sign up test accounts (see `auth`). Do not insert into `auth.users` yourself.
2. `get-schema` with `role: "user"` and `summary: false`, then check that `todos_insert_input` has no `user_id` and that `todos_set_input` has no `id` or `user_id`. Also check `role: "public"`: `todos` should be absent.
3. `graphql-query`, `role: "user"`, `userId: <A>`: `mutation { insert_todos_one(object: {title: "a"}) { id user_id } }` should return `user_id` = A.
4. Same mutation with `user_id: "<B>"` in the object should fail because the field does not exist for this role.
5. `role: "user"`, `userId: <B>`: `query { todos { id } }` must not return A's row; `mutation { update_todos(where: {}, _set: {title: "x"}) { affected_rows } }` and `delete_todos(where: {}) { affected_rows }` must affect only B's rows (0 if B has none).
6. Clean up the test rows only after asking the user.

If `graphql-query` refuses mutations, the MCP config disallows them. Do not retry. Tell the user.

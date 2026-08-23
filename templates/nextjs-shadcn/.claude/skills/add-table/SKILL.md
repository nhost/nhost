---
name: add-table
description: Add a user-owned PostgreSQL table with migrations, GraphQL metadata, permissions, and refreshed frontend types.
---

# Add a table

Use this skill when adding a model or changing the database schema. Run commands from the project root unless a step says otherwise. Read `backend/nhost/migrations/default/1700000000000_init_todos/up.sql` and `backend/nhost/metadata/databases/default/tables/public_todos.yaml` first; they are the working pattern for this template.

## 1. Create reversible SQL migrations

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

## 2. Track the table and grant the `user` role access

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

## 3. Include the metadata file

Add this entry to `backend/nhost/metadata/databases/default/tables/tables.yaml` without removing existing includes:

```yaml
- "!include public_notes.yaml"
```

## 4. Apply and refresh the typed frontend

Set a stable project name once per shell, then start or re-run the local backend so it applies the migration and metadata:

```sh
export NHOST_PROJECT_NAME=my-app
(cd backend && nhost up)
```

After the backend is ready, regenerate the committed role-scoped schema and TypeScript documents. This is the required final step:

```sh
(cd frontend && pnpm codegen)
```

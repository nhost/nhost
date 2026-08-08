---
name: add-permission
description: Add or modify role-based insert, select, update, or delete access for an existing tracked table.
---

# Add a table permission

Use this skill when a role needs new table access, a column must be exposed or hidden, or row ownership rules change. Run commands from the project root. Use `backend/nhost/metadata/databases/default/tables/public_todos.yaml` as the canonical example.

## 1. Locate the tracked table

Open `backend/nhost/metadata/databases/default/tables/<schema>_<table>.yaml`. Confirm that `backend/nhost/metadata/databases/default/tables/tables.yaml` includes it before editing permissions.

Edit the existing role entry when one is present; do not create two entries for the same role in one permission section.

## 2. Add the required permission shapes

The following `user` permissions show the four supported operations for a table owned through `user_id`. Replace the column names with the table's real columns and keep writable columns as narrow as possible.

```yaml
insert_permissions:
  - role: user
    permission:
      check:
        user_id:
          _eq: X-Hasura-User-Id
      set:
        user_id: x-hasura-User-Id
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
- `set` supplies a trusted session value during insert; copy the case-sensitive value from the example exactly.

For non-owner policies, use the same session-variable comparison pattern against the appropriate column. Do not expose an ownership column in insert or update `columns`; set it from the authenticated session instead.

## 3. Apply and refresh the typed frontend

Set the same project name used to start this local stack, then start or re-run the backend so it applies the metadata:

```sh
export NHOST_PROJECT_NAME=my-app
(cd backend && nhost up)
```

Permission changes alter the schema visible to the `user` role. Regenerate the committed schema and TypeScript documents as the required final step:

```sh
(cd frontend && pnpm codegen)
```

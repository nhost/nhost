---
name: refresh-context
description: Refresh the committed user-role GraphQL schema and regenerate frontend document types after schema changes.
---

# Refresh the project context

Run this skill after any database migration or GraphQL metadata change, including table, column, relationship, or permission changes. The local backend must be running and fully applied first.

`frontend/schema.graphql` has two jobs: it is the input to GraphQL code generation, and it is the committed, current backend contract that an LLM should read before building data-backed features. Do not edit it by hand.

## Refresh schema and generated types

From the project root, dump the schema visible to the `user` role, then regenerate TypeScript documents from that committed file:

```sh
nhost schema dump --subdomain local --role user -o frontend/schema.graphql
(cd frontend && pnpm codegen:types)
```

Review and commit changes to both `frontend/schema.graphql` and `frontend/src/gql/` with the feature that changed the schema.

## Optionally inspect the schema diff

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

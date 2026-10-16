# GraphQL permissions in Nhost

Read this before writing or changing any permission, whichever workflow you use. JSON and YAML use the same structure. The examples below use JSON.

## How requests get a role

- **Zero trust.** Apart from `admin`, no role has any access until you grant it, per table and per operation (select, insert, update, delete).
- **One role per request.** Every GraphQL request is resolved with exactly one role.
- **Signed-in users** use their **default role** (`user` unless changed in the project settings). A request can switch to another role with the header `x-hasura-role: <role>`, but only to one of the user's **allowed roles**. By default these are `user` and `me`. Otherwise the request fails.
- **Unauthenticated requests** use the `public` role. Anything granted to `public` is readable by anyone on the internet.
- **`admin`** (admin secret) bypasses all permissions. It is for trusted backends and local tooling only.
- **Session variables** come from the signed-in user's access token: `X-Hasura-User-Id` always, plus any custom claims configured for the project (e.g. `X-Hasura-Company-Id`). Base rules on these, never on values in the request body, which the client controls.
- **Custom roles** must exist in the `auth.roles` table (`auth.user_roles` and `auth.users.default_role` reference it), added through a migration, e.g. `INSERT INTO auth.roles (role) VALUES ('editor');` with a matching `DELETE` in the down step. A user can only use a role that is in their allowed roles. Assigning roles to users belongs to the `auth` skill. Custom claims are configured in `nhost.toml` under `[[auth.session.accessToken.customClaims]]`. See https://docs.nhost.io/products/graphql/permissions/permission-variables.

## Anatomy of each operation

| Operation | Row rule | Columns | Presets | Notes |
|---|---|---|---|---|
| select | `filter`: which existing rows the role can read | `columns` it can read, plus `computed_fields` | – | optional `limit`, `allow_aggregations` |
| insert | `check`: the new row must satisfy it | `columns` the client may send | `set` | |
| update | `filter`: which rows can be targeted; `check`: the rows **after** the update must satisfy it | `columns` the client may change | `set` | if any updated row fails `check`, the whole mutation is aborted |
| delete | `filter` | – | – | |

- `filter`/`check` of `{}` means **no row restriction** (all rows). The dashboard calls this "Without any checks". Never use `{}` on per-user data.
- **Presets** (`set`) assign a column from a session variable or a literal on the server, e.g. `{"user_id": "X-Hasura-User-Id"}`. Also leave that column out of `columns`, so that the client cannot send it at all.
- **Columns are an allow-list.** A column that is not listed does not exist in the schema for that role.
- **Update needs both rules.** `filter` alone stops a user from editing other users' rows. `check` stops them from moving a row into a state they should not create, e.g. reassigning ownership. Set both, usually to the same ownership rule, and keep the owner column out of the editable `columns`.

## Building rules

Operators (by column type): `_eq`, `_neq`, `_in`, `_nin`, `_gt`, `_lt`, `_gte`, `_lte`, `_is_null`; column-to-column `_ceq`, `_cne`, `_cgt`, `_clt`, `_cgte`, `_clte`; text `_like`, `_ilike`, `_regex`, …; JSONB `_contains`, `_has_key`, …. Combine rules with `_and`, `_or` and `_not`. Traverse a relationship by nesting its name:

```json
{"community": {"members": {"user_id": {"_eq": "X-Hasura-User-Id"}}}}
```

("the current user is a member of this row's community"). For tables with no foreign key to the row, use `_exists`:

```json
{"_exists": {"_table": {"schema": "public", "name": "feature_flags"}, "_where": {"enabled": {"_eq": true}}}}
```

Full reference with a worked `_or`/`_and` example: https://docs.nhost.io/products/graphql/permissions/rule-editor.

## Common patterns

- **Own rows**: the "user-owned rows" pattern in SKILL.md.
- **Membership / multi-tenant**: filter through a relationship to a membership table (example above), or compare against a custom claim such as `X-Hasura-Organization-Ids` with `_in`.
- **Public read of genuinely public data**: grant `public` select with a narrow `columns` list and a filter that selects only the public rows (e.g. `{"published": {"_eq": true}}`). Ask the user to confirm first.
- **Other users' profiles**: if users must see each other, grant `user` select on `auth.users` with only harmless columns (e.g. `id`, `display_name`, `avatar_url`). Never grant `password_hash`, `ticket`, `otp_hash`, `totp_secret`, `webauthn_current_challenge` or similar secret columns. Ask the user before exposing `email` or `phone_number`.

## Row limits and aggregations

- `limit` caps rows per select. The docs note that the Constellation engine parses it but does not yet enforce it. Do not rely on it as a security control. Also paginate in queries.
- `allow_aggregations` (default false) exposes aggregate queries (counts etc.) to the role. Aggregates can reveal information about rows. Enable it only when asked.

## Things not to do

- Do not accept an owner or tenant ID from the client (`user_id` in the mutation input, or a header you invent). Use presets and session variables.
- Do not "fix" a permission error by granting the `admin` role to the client, putting the admin secret in the frontend, or widening the filter to `{}`.
- Do not grant permissions to `public` "for testing".
- Do not copy role names from examples. Use the roles this project actually has.
- File permissions on `storage.files` are covered by the `storage` skill.

## Security checklist (run before finishing)

- [ ] Every new table has an explicit decision for `public` and `user` on each of the four operations (usually `public` = none).
- [ ] No per-user table has `filter` or `check` set to `{}`.
- [ ] Owner/tenant columns are set by a preset from a session variable and are absent from insert and update `columns`.
- [ ] Update permissions have both `filter` and `check`.
- [ ] Select `columns` lists only what the app needs. There are no secret columns from `auth.*`.
- [ ] `allow_aggregations` is off unless requested. `limit` is not the only protection.
- [ ] The schema for role `user` and role `public` was fetched and matches the intent.
- [ ] Cross-user tests (user A vs user B) were run for select, update and delete.
- [ ] The admin secret appears in no file you wrote, and no permission change was made against a production project.
- [ ] Migration and metadata files are in `git diff`, and down steps exist.

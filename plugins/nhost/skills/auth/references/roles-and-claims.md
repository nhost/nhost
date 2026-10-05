# Roles, JWT claims and custom claims

Sources: https://docs.nhost.io/products/auth/users, https://docs.nhost.io/products/graphql/permissions/permission-variables, https://docs.nhost.io/products/auth/jwt, https://docs.nhost.io/reference/configuration#auth

Writing permission rules that use these roles and claims belongs to the `database` skill (tables) and the `storage` skill (files).

## Roles

- Each user has one default role and a list of allowed roles. One role resolves permissions per request.
- Defaults for new users (nhost.toml):

```toml
[auth.user.roles]
default = 'user'
allowed = ['user', 'me']
```

- Requests use the default role unless the `x-hasura-role` header names one of the user's allowed roles; a role outside the allowed list fails.
- Unauthenticated requests use the `public` role. Grant `public` only data that is genuinely public.
- At sign-up a subset can be set with `options: { allowedRoles, defaultRole }` on `signUpEmailPassword`. Values must be within the project's `allowed` list and `defaultRole` must be in `allowedRoles`. Never let end users pick their own roles from a form.
- Cloud: change defaults in the Dashboard under Settings -> Roles and Permissions.

## Choosing a role per request

Per request, pass the header in the `RequestInit` (second argument of `nhost.graphql.request`):

```ts
await nhost.graphql.request(
  { query: `query { ... }` },
  { headers: { "x-hasura-role": "me" } },
);
```

Do not invent a client-wide role setup: the `withRoleMiddleware` docs example passes a `chainFunctions` option that `createClient` does not accept. If every request needs a non-default role, ask the user whether the user's default role should change instead. Never use `withAdminSession` for this; it uses the admin secret and is server-only.

## What the access token contains

Claims live under the namespace `https://hasura.io/jwt/claims` (a retained identifier; keep it). Nhost Auth always sets:

- `x-hasura-user-id`
- `x-hasura-default-role`
- `x-hasura-allowed-roles`
- `x-hasura-user-is-anonymous`

plus any custom claims. On the client, read them from `nhost.getUserSession()?.decodedToken["https://hasura.io/jwt/claims"]`. Treat client-side claims as display hints only; authorization happens server-side via permissions.

## Custom claims (permission variables)

Locally, add them to `nhost/nhost.toml`, then run `nhost up`:

```toml
[[auth.session.accessToken.customClaims]]
key = 'organization-id'
value = 'profile.organization.id'
default = '00000000-0000-0000-0000-000000000000'
```

- The claim appears as `x-hasura-organization-id`. Auth resolves `value` as a JSONPath on the user via a GraphQL query, so the relationship (`profile.organization`) must exist on the `users` table.
- In `nhost.toml` the path must NOT start with `user`. (In the Dashboard, Settings -> Roles and Permissions -> Permission Variables, the docs example uses `user.company.id`.)
- Arrays: a path like `profile.organizations[*].id` yields a Postgres-array string such as `{"13","37"}`, useful for multi-tenant apps.
- JSON/JSONB columns cannot be used, except `users.metadata`.
- Claims are computed when the token is issued. After changing the underlying data, the user sees the new value only after the next token refresh (`nhost.refreshSession(0)` forces one).

## JWT signing

Default: symmetric HS256 key configured under `[[hasura.jwtSecrets]]`. Asymmetric (RS256/384/512) keys and external JWKS (for a third-party auth provider, which disables Nhost Auth) are also supported. Keep signing keys in secrets, never inline in committed `nhost.toml`. Details: https://docs.nhost.io/products/auth/jwt

To verify an Nhost JWT inside a function: https://docs.nhost.io/products/functions/guides/jwt-verification

## Custom JWTs and impersonation

Auth has no built-in endpoint to mint tokens with arbitrary claims or impersonate a user. The documented approach is an Nhost Function: https://docs.nhost.io/products/functions/guides/custom-jwts. That runs server-side with secrets; never ship it to the browser.

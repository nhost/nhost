---
name: frontend
description: Connects a frontend app to an Nhost backend with @nhost/nhost-js v4. Covers installing the SDK, createClient({ subdomain, region }) for local and Nhost Cloud projects, environment variables per framework, createServerClient with cookie storage for Next.js App Router (server components, server actions, proxy/middleware route protection), session-aware UI (AuthProvider / useAuth, composables, Svelte stores, getUserSession, sessionStorage.onChange), GraphQL requests with nhost.graphql.request and response.body.data, FetchError handling, and optional Apollo Client, urql, React Query and GraphQL codegen. Use when the user wants to "connect my React / Next.js / Vue / SvelteKit / React Native / Expo app to Nhost", set up the Nhost client, show the logged-in user, protect routes, or fix v3-era Nhost SDK code. Not for sign-in methods, permissions, uploads or functions.
---

# Nhost frontend (`@nhost/nhost-js` v4)

One SDK for every framework: `@nhost/nhost-js`. The client exposes `nhost.auth`, `nhost.graphql`, `nhost.storage`, `nhost.functions` and `nhost.sessionStorage`. Docs: https://docs.nhost.io/reference/javascript/nhost-js/main

Before writing SDK code, confirm details in the docs: MCP `search` / `read_page`, or `nhost docs search "<q>"` / `nhost docs show <path>`, or https://docs.nhost.io/llms.txt.

## Do not use (v3-era, wrong for v4)

- `new NhostClient(...)` → use `createClient(...)` (browser/mobile) or `createServerClient(...)` (server).
- `nhost.auth.signIn(...)` / `nhost.auth.signUp(...)` → v4 has method-specific names such as `signInEmailPassword`; see the `auth` skill.
- `nhost.auth.onAuthStateChanged(...)` → `nhost.sessionStorage.onChange(cb)` plus `nhost.getUserSession()`.
- `nhost.storage.upload(...)` → see the `storage` skill.
- `const { data, error } = await nhost...` → v4 returns `{ body, status, headers }` and **throws** `FetchError`.
- Packages `@nhost/react`, `@nhost/nextjs`, `@nhost/vue`, `@nhost/react-apollo` (deprecated). Remove them; do not add them.
- Passing a query string plus variables as two arguments → pass one object `{ query, variables }`. The `(document, variables)` form is only for typed document nodes (codegen).

If existing code uses any of these, tell the user it is v3-era and migrate it rather than mixing versions.

## Core setup

1. Install: `npm install @nhost/nhost-js`
2. Get `subdomain` and `region`:
   - Local project (`nhost up`): `subdomain: "local"`, `region: "local"`.
   - Nhost Cloud: from the project in the Nhost Dashboard. Ask the user; never guess.
3. Put them in env vars the way the framework's tutorial does (Vite: `VITE_NHOST_SUBDOMAIN` / `VITE_NHOST_REGION`; Next.js server: `NHOST_SUBDOMAIN` / `NHOST_REGION`; Expo: `app.json` `extra`). Fall back to `"local"` like the tutorials.
4. Create the client once and share it:

```ts
import { createClient } from "@nhost/nhost-js";

export const nhost = createClient({
  subdomain: import.meta.env.VITE_NHOST_SUBDOMAIN || "local",
  region: import.meta.env.VITE_NHOST_REGION || "local",
});
```

`createClient` stores the session in `localStorage` in the browser (memory elsewhere), refreshes tokens automatically, and attaches the access token to every request. Pass `storage` to override it (React Native needs this). On a server (Next.js server components, server actions, proxy), use `createServerClient` with an explicit cookie `storage`; it does not auto-refresh. See [references/nextjs.md](references/nextjs.md).

## Session in the UI

- `nhost.getUserSession()` returns the `StoredSession` (with `.user`, `.accessToken`, `.refreshToken`, `.refreshTokenId`) or `null`.
- `nhost.sessionStorage.onChange((session) => ...)` fires whenever the stored session is set or removed (sign-in, refresh, sign-out); it returns an unsubscribe function.
- The tutorials wrap these in one app-wide store exposing `{ user, session, isAuthenticated, isLoading, nhost }`: a React context (`AuthProvider` + `useAuth`), a Vue composable, or Svelte stores. Reuse that shape.
- Sign out: `await nhost.auth.signOut({ refreshToken: session.refreshToken })`.

## GraphQL requests

```ts
import { FetchError } from "@nhost/nhost-js/fetch";

try {
  const res = await nhost.graphql.request<{ todos: Todo[] }>({
    query: `query GetTodos { todos(order_by: { created_at: desc }) { id title } }`,
    variables: {},
  });
  const todos = res.body.data?.todos ?? [];
} catch (err) {
  if (err instanceof FetchError) console.error(err.status, err.body);
  // err.message joins the GraphQL error messages
}
```

- A response with GraphQL `errors` **throws** `FetchError`; it does not return `body.errors`. Always use `try/catch`.
- Rows returned depend on the signed-in user's role and permissions. Empty results or "field not found" usually mean a missing permission or untracked table: use the `database` skill, don't work around it in the frontend.
- Never set `x-hasura-admin-secret` or use `withAdminSession` in frontend code.

## Framework references (read the one that matches the project)

| Project | Read |
|---|---|
| React + Vite (React Router) | [references/react.md](references/react.md) |
| Next.js App Router (SSR, server actions, proxy) | [references/nextjs.md](references/nextjs.md) |
| Vue 3 + Vue Router | [references/vue.md](references/vue.md) |
| SvelteKit | [references/sveltekit.md](references/sveltekit.md) |
| React Native / Expo | [references/react-native.md](references/react-native.md) |
| Apollo Client, urql, React Query, GraphQL codegen | [references/graphql-clients.md](references/graphql-clients.md) |

Other frameworks: use the plain `createClient` setup above and the closest reference. Say that no official tutorial exists for it.

## Checklist: "connect my frontend to Nhost"

1. Backend running: local `nhost up` or a Cloud project (see the `setup` skill). Get `subdomain`/`region`.
2. Remove v3 packages/idioms from the list above. `npm install @nhost/nhost-js`.
3. Add env vars for `subdomain`/`region` only. Never add the admin secret to frontend env vars (`VITE_*`, `NEXT_PUBLIC_*`, `app.json`).
4. Create the client (browser: `createClient`; Next.js server: `createServerClient` + cookies).
5. Add the session store/provider and route protection from the framework reference.
6. Make one GraphQL request with `try/catch` and read `res.body.data`.
7. If data is missing: check tables are tracked and permissions exist for the role (`database` skill).
8. Auth UI (sign-up, sign-in, verification): `auth` skill. Uploads: `storage`. Server code: `functions`.

The user's instructions take precedence over this skill.
